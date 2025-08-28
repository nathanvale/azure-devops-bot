#!/usr/bin/env node

// Only load dotenv if we haven't loaded environment variables yet
// (tsx --env-file would have already loaded them)
// Also check if tsx has loaded the env file (when using --env-file, TSX_LOADED_ENV_FILES is set)
if (!process.env.AZURE_DEVOPS_PAT && !process.env.TSX_LOADED_ENV_FILES) {
  // Temporarily suppress console.log to hide dotenv's injection message in non-verbose modes
  const shouldBeQuiet =
    process.env.DOTENV_SILENT === 'true' || process.env.LOG_LEVEL === 'error'
  const originalLog = console.log
  if (shouldBeQuiet) {
    console.log = () => {} // Suppress dotenv's injection message
  }

  const dotenv = await import('dotenv')
  dotenv.config()

  // Restore console.log
  if (shouldBeQuiet) {
    console.log = originalLog
  }
}

import type { OutputFormat } from './cli/index.js'

import { AzureDevOpsBot } from './azure-devops-bot.js'
import {
  setupCLI,
  determineVerbosityLevel,
  VerbosityLevel,
  OutputManager,
  ProgressManager,
  CLIAzureDevOpsBot,
} from './cli/index.js'
import { initializeLogger } from './utils/logger.js'

// Export the base class for backward compatibility
export { AzureDevOpsBot } from './azure-devops-bot.js'

// Only run if this is the main module (not being imported for tests)
if (
  process.argv[1] &&
  (process.argv[1].endsWith('/index.js') ||
    process.argv[1].endsWith('/index.ts') ||
    process.argv[1].endsWith('/cli-wrapper.ts'))
) {
  // Initialize logger and start CLI bot
  async function main() {
    // Setup CLI and determine configuration
    const { options, query } = setupCLI()
    const verbosity = determineVerbosityLevel(options)
    const format = options.format as OutputFormat

    // Initialize output management
    const outputManager = new OutputManager(verbosity, format)
    const progressManager = new ProgressManager(verbosity, format)

    // Initialize logger with appropriate level based on CLI verbosity
    // Set LOG_LEVEL based on verbosity to suppress structured logs in normal mode
    if (options.debug) {
      process.env.LOG_LEVEL = 'debug'
    } else if (verbosity <= VerbosityLevel.NORMAL) {
      // For quiet and normal modes, suppress all structured logging to console
      process.env.LOG_LEVEL = 'error' // Only log errors
      process.env.PINO_LOG_LEVEL = 'error' // Ensure pino also respects this
      process.env.ORCHESTR8_LOG_LEVEL = 'error' // Control @orchestr8 packages
    } else if (verbosity === VerbosityLevel.VERBOSE) {
      process.env.LOG_LEVEL = 'info'
    }

    await initializeLogger('azure-devops-bot')

    // Always use CLI mode now that it's implemented
    const isCliMode = true

    if (isCliMode) {
      // Create and start enhanced bot with CLI features
      const bot = new CLIAzureDevOpsBot(outputManager, progressManager)

      // Handle graceful shutdown
      const shutdown = async () => {
        // Use direct output for shutdown message to ensure it's always shown
        process.stdout.write('\n👋 Goodbye!\n')
        await bot.stop()
        process.exit(0)
      }

      process.on('SIGINT', shutdown)
      process.on('SIGTERM', shutdown)

      // Start with enhanced CLI interface
      await bot.start(query)
    } else {
      // Use basic bot for backward compatibility
      const bot = new AzureDevOpsBot()

      // Handle graceful shutdown
      const shutdown = async () => {
        // Use direct output for shutdown message to ensure it's always shown
        process.stdout.write('\n👋 Goodbye!\n')
        await bot.stop()
        process.exit(0)
      }

      process.on('SIGINT', shutdown)
      process.on('SIGTERM', shutdown)

      // Start with basic interface
      await bot.start(query)
    }
  }

  main().catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}
