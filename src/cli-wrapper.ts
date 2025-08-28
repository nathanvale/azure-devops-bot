#!/usr/bin/env node

// This wrapper handles quiet mode by suppressing console output BEFORE any modules load
const isQuietMode =
  process.argv.includes('--quiet') || process.argv.includes('-q')
const isVerboseMode =
  process.argv.includes('--verbose') || process.argv.includes('-v')
const isDebugMode =
  process.argv.includes('--debug') || process.argv.includes('-d')

// Unless in verbose or debug mode, suppress structured logging
if (!isVerboseMode && !isDebugMode) {
  // For both quiet and normal modes, suppress structured library logs
  process.env.LOG_LEVEL = 'error' // Only log errors
  process.env.PINO_LOG_LEVEL = 'error' // Ensure pino respects this
  process.env.ORCHESTR8_LOG_LEVEL = 'error' // Control @orchestr8 packages
  process.env.DOTENV_SILENT = 'true'
  process.env.DOTENV_DEBUG = '' // Disable dotenv debug output
  process.env.SUPPRESS_NO_CONFIG_WARNING = 'true'
  process.env.NODE_ENV = 'production' // Many libraries are quieter in production
  process.env.DISABLE_DOTENV_LOGGING = 'true'
}

if (isQuietMode) {
  // Additional suppression for quiet mode - suppress even our own console output
  process.env.LOG_SILENT = 'true'

  // Store original console methods before overriding
  const originalConsole = {
    log: console.log.bind(console),
    error: console.error.bind(console),
    warn: console.warn.bind(console),
    debug: console.debug.bind(console),
    info: console.info.bind(console),
  }

  // Make them available globally for OutputManager to use
  ;(global as Record<string, unknown>).originalConsole = originalConsole

  // Override all console methods to suppress output
  console.log = () => {}
  console.debug = () => {}
  console.info = () => {}
  console.warn = () => {}
  console.error = () => {} // Suppress console.error too in quiet mode
}

// Now import and run the main module
import('./index.js')
