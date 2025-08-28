# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-08-27-cli-enhancement/spec.md

> Created: 2025-08-27
> Version: 1.0.0

## Technical Requirements

- **CLI Framework**: Professional argument parsing with validation and help generation
- **Verbosity Control**: Four-level filtering system with performance optimization
- **Progress Feedback**: Visual indicators for operations >2 seconds duration
- **Output Formatting**: Consistent, structured output across all commands
- **Performance**: CLI parsing overhead <5ms, output formatting <10ms
- **Memory**: Minimal memory overhead, lazy loading of UI components
- **Backward Compatibility**: Zero breaking changes to existing usage patterns

## Architecture Overview

```typescript
// Core CLI architecture interfaces
interface CLIConfiguration {
  verbosity: VerbosityLevel
  format: OutputFormat
  debug: boolean
  quiet: boolean
}

enum VerbosityLevel {
  QUIET = 0, // Only errors and final results
  NORMAL = 1, // Key milestones and summaries (default)
  VERBOSE = 2, // Detailed logging (current behavior)
  DEBUG = 3, // Everything + structured logs
}

enum OutputFormat {
  TEXT = 'text', // Human-readable with colors (default)
  JSON = 'json', // Machine-readable structured data
  MARKDOWN = 'markdown', // Documentation-ready format
}

// Main CLI configuration and setup
interface CLIOptions {
  verbose?: boolean
  quiet?: boolean
  debug?: boolean
  format?: 'text' | 'json' | 'markdown'
}
```

## Approach Options

**Option A: Minimal Integration**

- Pros: Quick implementation, low risk
- Cons: Limited functionality, doesn't solve core problems

**Option B: Comprehensive CLI Framework** (Selected)

- Pros: Professional interface, scalable, addresses all requirements
- Cons: More initial development work

**Option C: Configuration File Based**

- Pros: Persistent settings, advanced configuration
- Cons: Additional complexity, conflicts with current ENV approach

**Rationale:** Option B provides the right balance of professionalism and functionality while maintaining simplicity. The comprehensive approach ensures long-term maintainability and user satisfaction.

## External Dependencies

- **commander@^12.1.0** - Professional CLI argument parsing and help generation
- **ora@^8.1.0** - Terminal spinners with TypeScript support and ESM compatibility
- **cli-progress@^3.12.0** - Customizable progress bars with TypeScript definitions
- **chalk@^5.3.0** - Terminal colors with ESM support and TypeScript integration
- **boxen@^8.0.1** - Bordered console output for structured messages

**Justification:** These are industry-standard libraries with excellent TypeScript support, ESM compatibility, and proven reliability in production environments.

## Implementation Details

### 1. CLI Configuration Setup

```typescript
// src/cli/cli-config.ts
import { Command } from 'commander'

export interface CLIOptions {
  verbose: boolean
  quiet: boolean
  debug: boolean
  format: 'text' | 'json' | 'markdown'
}

export function setupCLI(): {
  program: Command
  options: CLIOptions
  query: string
} {
  const program = new Command()

  program
    .name('azure-devops-bot')
    .description(
      'Azure DevOps work item sync and query tool with instant local access',
    )
    .version('1.0.0')
    .usage('[options] [query]')
    .option('-v, --verbose', 'detailed output with comprehensive logging')
    .option('-q, --quiet', 'minimal output showing only essential information')
    .option(
      '-d, --debug',
      'maximum verbosity including debug logs and API traces',
    )
    .option(
      '-f, --format <type>',
      'output format: text, json, or markdown',
      'text',
    )
    .argument('[query]', 'work item query or command', 'summary')
    .addHelpText(
      'after',
      `

Examples:
  azure-devops-bot "my work items"              # Normal output with work items
  azure-devops-bot --quiet "sprint status"     # Minimal summary only  
  azure-devops-bot --verbose --format json     # Detailed JSON output
  azure-devops-bot --debug "sync issues"       # Maximum debug information
  
Output Formats:
  text     Human-readable with colors and formatting (default)
  json     Structured data for programmatic use
  markdown Documentation-ready format for reports
  
Verbosity Levels:
  --quiet   Only errors and final results
  (default) Key milestones and summaries
  --verbose Detailed logging and progress information  
  --debug   Complete traces, API calls, and debug information
`,
    )

  // Validate format option
  const formatValues = ['text', 'json', 'markdown']
  program.hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts()
    if (opts.format && !formatValues.includes(opts.format)) {
      console.error(
        `Error: Invalid format '${opts.format}'. Must be one of: ${formatValues.join(', ')}`,
      )
      process.exit(1)
    }

    // Validate conflicting options
    if (opts.quiet && opts.verbose) {
      console.error('Error: Cannot use --quiet and --verbose together')
      process.exit(1)
    }

    if (opts.quiet && opts.debug) {
      console.error('Error: Cannot use --quiet and --debug together')
      process.exit(1)
    }
  })

  program.parse()

  const options = program.opts() as CLIOptions
  const query = program.args[0] || 'summary'

  return { program, options, query }
}

export function determineVerbosityLevel(options: CLIOptions): VerbosityLevel {
  if (options.quiet) return VerbosityLevel.QUIET
  if (options.debug) return VerbosityLevel.DEBUG
  if (options.verbose) return VerbosityLevel.VERBOSE
  return VerbosityLevel.NORMAL
}
```

### 2. Output Manager Implementation

````typescript
// src/cli/output-manager.ts
import chalk from 'chalk'
import boxen from 'boxen'
import ora, { Ora } from 'ora'
import { VerbosityLevel, OutputFormat } from './cli-config.js'

export class OutputManager {
  private verbosity: VerbosityLevel
  private format: OutputFormat
  private activeSpinner: Ora | null = null

  constructor(verbosity: VerbosityLevel, format: OutputFormat) {
    this.verbosity = verbosity
    this.format = format
  }

  // Core logging methods with verbosity filtering
  info(
    message: string,
    details?: any,
    level: VerbosityLevel = VerbosityLevel.NORMAL,
  ): void {
    if (this.verbosity < level) return

    if (this.activeSpinner) {
      this.activeSpinner.stop()
    }

    switch (this.format) {
      case OutputFormat.JSON:
        this.outputJSON({
          level: 'info',
          message,
          details,
          timestamp: new Date().toISOString(),
        })
        break
      case OutputFormat.MARKDOWN:
        this.outputMarkdown(`**Info:** ${message}`, details)
        break
      default:
        console.log(chalk.blue('ℹ️ '), message)
        if (details && level >= VerbosityLevel.VERBOSE) {
          console.log(chalk.dim('   Details:'), details)
        }
    }

    if (this.activeSpinner) {
      this.activeSpinner.start()
    }
  }

  success(
    message: string,
    details?: any,
    level: VerbosityLevel = VerbosityLevel.NORMAL,
  ): void {
    if (this.verbosity < level) return

    if (this.activeSpinner) {
      this.activeSpinner.succeed(message)
      this.activeSpinner = null
      return
    }

    switch (this.format) {
      case OutputFormat.JSON:
        this.outputJSON({
          level: 'success',
          message,
          details,
          timestamp: new Date().toISOString(),
        })
        break
      case OutputFormat.MARKDOWN:
        this.outputMarkdown(`✅ **Success:** ${message}`, details)
        break
      default:
        console.log(chalk.green('✅'), message)
        if (details && level >= VerbosityLevel.VERBOSE) {
          console.log(chalk.dim('   Details:'), details)
        }
    }
  }

  error(message: string, details?: any): void {
    // Always show errors regardless of verbosity
    if (this.activeSpinner) {
      this.activeSpinner.fail(message)
      this.activeSpinner = null
    }

    switch (this.format) {
      case OutputFormat.JSON:
        this.outputJSON({
          level: 'error',
          message,
          details,
          timestamp: new Date().toISOString(),
        })
        break
      case OutputFormat.MARKDOWN:
        this.outputMarkdown(`❌ **Error:** ${message}`, details)
        break
      default:
        console.error(chalk.red('❌ Error:'), message)
        if (details) {
          console.error(chalk.dim('   Details:'), details)
        }
    }
  }

  debug(message: string, details?: any): void {
    if (this.verbosity < VerbosityLevel.DEBUG) return

    switch (this.format) {
      case OutputFormat.JSON:
        this.outputJSON({
          level: 'debug',
          message,
          details,
          timestamp: new Date().toISOString(),
        })
        break
      case OutputFormat.MARKDOWN:
        this.outputMarkdown(`🔍 **Debug:** ${message}`, details)
        break
      default:
        console.log(chalk.dim('🔍 [DEBUG]'), message)
        if (details) {
          console.log(chalk.dim('   '), details)
        }
    }
  }

  // Progress indication methods
  startSpinner(text: string): void {
    if (
      this.verbosity === VerbosityLevel.QUIET ||
      this.format !== OutputFormat.TEXT
    ) {
      return
    }

    this.activeSpinner = ora({
      text,
      color: 'blue',
      spinner: 'dots',
    }).start()
  }

  updateSpinner(text: string): void {
    if (this.activeSpinner) {
      this.activeSpinner.text = text
    }
  }

  stopSpinner(successMessage?: string): void {
    if (this.activeSpinner) {
      if (successMessage) {
        this.activeSpinner.succeed(successMessage)
      } else {
        this.activeSpinner.stop()
      }
      this.activeSpinner = null
    }
  }

  // Structured output formatting
  formatResult(data: any): void {
    switch (this.format) {
      case OutputFormat.JSON:
        this.outputJSON(data)
        break
      case OutputFormat.MARKDOWN:
        this.outputMarkdownResult(data)
        break
      default:
        this.outputTextResult(data)
    }
  }

  // Format-specific output methods
  private outputJSON(data: any): void {
    console.log(JSON.stringify(data, null, 2))
  }

  private outputMarkdown(message: string, details?: any): void {
    console.log(message)
    if (details) {
      console.log('```json')
      console.log(JSON.stringify(details, null, 2))
      console.log('```')
    }
  }

  private outputTextResult(data: any): void {
    if (Array.isArray(data)) {
      console.log(chalk.bold(`\n📋 Results (${data.length} items):`))
      data.forEach((item, index) => {
        console.log(
          `${chalk.dim(`${index + 1}.`)} ${this.formatWorkItem(item)}`,
        )
      })
    } else {
      console.log(
        boxen(JSON.stringify(data, null, 2), {
          padding: 1,
          borderColor: 'blue',
          title: 'Result',
        }),
      )
    }
  }

  private outputMarkdownResult(data: any): void {
    console.log('# Azure DevOps Bot Results\n')
    if (Array.isArray(data)) {
      console.log(`Found ${data.length} items:\n`)
      data.forEach((item, index) => {
        console.log(
          `${index + 1}. **${item.title || item.id}** - ${item.state || 'Unknown'}`,
        )
      })
    } else {
      console.log('```json')
      console.log(JSON.stringify(data, null, 2))
      console.log('```')
    }
  }

  private formatWorkItem(item: any): string {
    const title = chalk.bold(item.title || `Work Item ${item.id}`)
    const state = item.state ? chalk.cyan(`[${item.state}]`) : ''
    const assignee = item.assignedTo ? chalk.dim(`(@${item.assignedTo})`) : ''

    return `${title} ${state} ${assignee}`.trim()
  }

  // Box formatting for important messages
  box(message: string, title?: string): void {
    if (
      this.verbosity === VerbosityLevel.QUIET &&
      this.format === OutputFormat.TEXT
    ) {
      return
    }

    switch (this.format) {
      case OutputFormat.JSON:
        this.outputJSON({
          type: 'box',
          title,
          message,
          timestamp: new Date().toISOString(),
        })
        break
      case OutputFormat.MARKDOWN:
        console.log(`### ${title || 'Notice'}\n${message}\n`)
        break
      default:
        console.log(
          boxen(message, {
            padding: 1,
            borderColor: 'yellow',
            title: title || 'Notice',
          }),
        )
    }
  }
}
````

### 3. Progress Manager Implementation

```typescript
// src/cli/progress-manager.ts
import CliProgress from 'cli-progress'
import chalk from 'chalk'
import { VerbosityLevel, OutputFormat } from './cli-config.js'

export class ProgressManager {
  private verbosity: VerbosityLevel
  private format: OutputFormat
  private progressBar: CliProgress.SingleBar | null = null
  private progressInterval: NodeJS.Timeout | null = null

  constructor(verbosity: VerbosityLevel, format: OutputFormat) {
    this.verbosity = verbosity
    this.format = format
  }

  startProgress(label: string, total: number): void {
    // Don't show progress bars in quiet mode or non-text formats
    if (
      this.verbosity === VerbosityLevel.QUIET ||
      this.format !== OutputFormat.TEXT
    ) {
      return
    }

    this.progressBar = new CliProgress.SingleBar({
      format: `${chalk.blue('📊')} ${label} |${chalk.cyan('{bar}')}| {percentage}% || {value}/{total} Items || ETA: {eta_formatted}`,
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
      clearOnComplete: true,
      stopOnComplete: true,
    })

    this.progressBar.start(total, 0)
  }

  updateProgress(current: number, statusText?: string): void {
    if (this.progressBar) {
      this.progressBar.update(current)
      if (statusText && this.verbosity >= VerbosityLevel.VERBOSE) {
        // Update with custom payload
        this.progressBar.update(current, { status: statusText })
      }
    }
  }

  completeProgress(message?: string): void {
    if (this.progressBar) {
      this.progressBar.stop()
      this.progressBar = null

      if (message && this.verbosity >= VerbosityLevel.NORMAL) {
        console.log(chalk.green('✅'), message)
      }
    }
  }

  // For operations where we don't know the total
  startIndeterminate(label: string): void {
    if (
      this.verbosity === VerbosityLevel.QUIET ||
      this.format !== OutputFormat.TEXT
    ) {
      return
    }

    let dots = 0
    console.log(chalk.blue('🔄'), `${label}...`)

    this.progressInterval = setInterval(() => {
      dots = (dots + 1) % 4
      process.stdout.write(
        `\r${chalk.blue('🔄')} ${label}${'.'.repeat(dots)}${' '.repeat(3 - dots)}`,
      )
    }, 500)
  }

  stopIndeterminate(message?: string): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval)
      this.progressInterval = null

      // Clear the line and show completion
      process.stdout.write('\r\x1b[K')
      if (message) {
        console.log(chalk.green('✅'), message)
      }
    }
  }

  // Periodic progress reporting for long operations
  reportProgress(current: number, total: number, operation: string): void {
    if (this.verbosity < VerbosityLevel.VERBOSE) return

    const percentage = Math.round((current / total) * 100)
    const statusText = `${operation}: ${current}/${total} (${percentage}%)`

    switch (this.format) {
      case OutputFormat.JSON:
        console.log(
          JSON.stringify({
            type: 'progress',
            operation,
            current,
            total,
            percentage,
            timestamp: new Date().toISOString(),
          }),
        )
        break
      case OutputFormat.MARKDOWN:
        console.log(`**Progress:** ${statusText}`)
        break
      default:
        console.log(chalk.dim('📊'), statusText)
    }
  }
}
```

### 4. Format Handlers

```typescript
// src/cli/formatters/text-formatter.ts
import chalk from 'chalk'

export class TextFormatter {
  static formatWorkItems(items: any[]): string {
    if (items.length === 0) {
      return chalk.yellow('No work items found')
    }

    const output = [
      `\n${chalk.bold.blue('📋 Work Items')} (${items.length} found):\n`,
    ]

    items.forEach((item, index) => {
      const number = chalk.dim(`${index + 1}.`)
      const title = chalk.bold(item.title || `Work Item ${item.id}`)
      const state = this.formatState(item.state)
      const assignee = item.assignedTo
        ? chalk.dim(`@${item.assignedTo}`)
        : chalk.dim('unassigned')

      output.push(`  ${number} ${title}`)
      output.push(`     ${state} • ${assignee}`)

      if (item.description && item.description.length > 0) {
        const shortDesc =
          item.description.slice(0, 80) +
          (item.description.length > 80 ? '...' : '')
        output.push(`     ${chalk.dim(shortDesc)}`)
      }

      output.push('')
    })

    return output.join('\n')
  }

  static formatSyncSummary(summary: any): string {
    const duration = summary.durationMs ? ` in ${summary.durationMs}ms` : ''
    const title = chalk.bold.green('✅ Sync Complete')

    const stats = [
      `${chalk.cyan(summary.totalItems || 0)} work items`,
      `${chalk.magenta(summary.totalComments || 0)} comments`,
      `${chalk.yellow(summary.successRate || 100)}% success rate`,
    ].join(' • ')

    return `\n${title}${duration}\n${stats}\n`
  }

  private static formatState(state: string): string {
    const stateColors: Record<string, (str: string) => string> = {
      New: chalk.blue,
      Active: chalk.yellow,
      Resolved: chalk.green,
      Closed: chalk.gray,
      Removed: chalk.red,
    }

    const formatter = stateColors[state] || chalk.white
    return formatter(`[${state}]`)
  }
}

// src/cli/formatters/json-formatter.ts
export class JSONFormatter {
  static formatWorkItems(items: any[], metadata?: any): string {
    const output = {
      timestamp: new Date().toISOString(),
      count: items.length,
      items: items.map((item) => ({
        id: item.id,
        title: item.title,
        state: item.state,
        assignedTo: item.assignedTo,
        createdDate: item.createdDate,
        changedDate: item.changedDate,
        workItemType: item.workItemType,
        description: item.description,
        tags: item.tags,
      })),
      metadata: metadata || null,
    }

    return JSON.stringify(output, null, 2)
  }

  static formatSyncSummary(summary: any): string {
    const output = {
      timestamp: new Date().toISOString(),
      type: 'sync_summary',
      ...summary,
    }

    return JSON.stringify(output, null, 2)
  }
}

// src/cli/formatters/markdown-formatter.ts
export class MarkdownFormatter {
  static formatWorkItems(items: any[], metadata?: any): string {
    const output = ['# Azure DevOps Work Items Report\n']

    if (metadata) {
      output.push(`*Generated: ${new Date().toISOString()}*\n`)
      output.push(`*Query: ${metadata.query || 'N/A'}*\n`)
    }

    output.push(`## Summary\n`)
    output.push(`Found **${items.length}** work items.\n`)

    if (items.length > 0) {
      output.push(`## Work Items\n`)

      items.forEach((item, index) => {
        output.push(
          `### ${index + 1}. ${item.title || `Work Item ${item.id}`}\n`,
        )
        output.push(`- **ID:** ${item.id}`)
        output.push(`- **State:** ${item.state || 'Unknown'}`)
        output.push(`- **Assigned To:** ${item.assignedTo || 'Unassigned'}`)
        output.push(`- **Type:** ${item.workItemType || 'Unknown'}\n`)

        if (item.description) {
          output.push(`**Description:**\n${item.description}\n`)
        }
      })
    }

    return output.join('\n')
  }

  static formatSyncSummary(summary: any): string {
    const output = ['# Sync Summary Report\n']

    output.push(`*Completed: ${new Date().toISOString()}*\n`)

    if (summary.durationMs) {
      output.push(`**Duration:** ${summary.durationMs}ms\n`)
    }

    output.push(`## Statistics\n`)
    output.push(`- **Total Items:** ${summary.totalItems || 0}`)
    output.push(`- **Total Comments:** ${summary.totalComments || 0}`)
    output.push(`- **Success Rate:** ${summary.successRate || 100}%\n`)

    return output.join('\n')
  }
}
```

### 5. Integration with Existing Codebase

```typescript
// src/index.ts - Updated main entry point
#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config();

import { initializeLogger, LoggerFactory } from './utils/logger.js';
import { setupCLI, determineVerbosityLevel, OutputFormat } from './cli/cli-config.js';
import { OutputManager } from './cli/output-manager.js';
import { ProgressManager } from './cli/progress-manager.js';
import { AzureDevOpsBot } from './azure-devops-bot.js';

export class CLIAzureDevOpsBot extends AzureDevOpsBot {
  private outputManager: OutputManager;
  private progressManager: ProgressManager;

  constructor(outputManager: OutputManager, progressManager: ProgressManager) {
    super();
    this.outputManager = outputManager;
    this.progressManager = progressManager;
  }

  async start(query: string): Promise<void> {
    try {
      // Email validation with progress indication
      this.outputManager.startSpinner('Validating email addresses...');

      const userEmails = this.getUserEmails();
      AzureDevOpsClient.setUserEmails(userEmails);

      const azureClient = new AzureDevOpsClient();
      const { valid, invalid } = await azureClient.validateUserEmails(userEmails);

      if (invalid.length > 0) {
        this.outputManager.stopSpinner();
        this.outputManager.error('Email validation failed', {
          invalidEmails: invalid,
          validEmails: valid
        });

        this.outputManager.box(
          'Please ensure these email addresses:\n' +
          '  1. Are correctly spelled\n' +
          '  2. Exist in the Azure DevOps organization\n' +
          '  3. Have access to the project',
          'Email Validation Failed'
        );

        process.exit(1);
      }

      this.outputManager.stopSpinner('Email validation successful');
      this.outputManager.debug('Validated emails', { validEmails: valid });

      // Background sync with progress
      await this.syncService.startBackgroundSync(true);

      const shouldSync = await this.syncService.shouldSync();
      if (shouldSync) {
        this.outputManager.info('Starting initial sync...', null, VerbosityLevel.NORMAL);
        this.progressManager.startIndeterminate('Syncing work items');

        await this.syncService.performSyncDetailed();

        this.progressManager.stopIndeterminate('Sync completed');
      } else {
        this.outputManager.debug('Skipping sync - data is recent');
      }

      // Process query with formatted output
      this.outputManager.info(`Processing query: "${query}"`, null, VerbosityLevel.VERBOSE);

      const response = await this.queryEngine.processQuery(query, userEmails);
      this.outputManager.formatResult(response);

    } catch (error) {
      this.outputManager.error(
        'Azure DevOps Bot failed',
        error instanceof Error ? { message: error.message, stack: error.stack } : error
      );
      process.exit(1);
    }
  }

  // Override getUserEmails to use OutputManager for errors
  protected getUserEmails(): string[] {
    const envEmails = process.env.AZURE_DEVOPS_USER_EMAILS;
    if (!envEmails) {
      this.outputManager.error(
        'AZURE_DEVOPS_USER_EMAILS environment variable is required',
        {
          examples: ['Jane.Citizen@fwc.gov.au,ITEX-JC@fwc.gov.au'],
          setupMethods: [
            'Create .env file with AZURE_DEVOPS_USER_EMAILS',
            'Export in shell: export AZURE_DEVOPS_USER_EMAILS="emails"',
            'Add to shell profile (~/.bashrc, ~/.zshrc)'
          ]
        }
      );

      this.outputManager.box(
        'Set your email address(es) for Azure DevOps work item assignment:\n\n' +
        'Example: AZURE_DEVOPS_USER_EMAILS=jane@company.com,john@company.com\n\n' +
        'Methods:\n' +
        '1. Create .env file: echo "AZURE_DEVOPS_USER_EMAILS=your@email.com" >> .env\n' +
        '2. Export in shell: export AZURE_DEVOPS_USER_EMAILS=your@email.com\n' +
        '3. Add to shell profile: echo "export AZURE_DEVOPS_USER_EMAILS=..." >> ~/.zshrc',
        'Setup Required'
      );

      process.exit(1);
    }

    const emails = envEmails
      .split(',')
      .map(email => email.trim())
      .filter(email => email.length > 0);

    if (emails.length === 0) {
      this.outputManager.error('No valid email addresses provided', {
        raw_value: envEmails,
        required_min: 1
      });
      process.exit(1);
    }

    return emails;
  }
}

// Main execution
if (process.argv[1]?.endsWith('/index.js') || process.argv[1]?.endsWith('/index.ts')) {
  async function main() {
    // Setup CLI and determine configuration
    const { program, options, query } = setupCLI();
    const verbosity = determineVerbosityLevel(options);
    const format = options.format as OutputFormat;

    // Initialize output management
    const outputManager = new OutputManager(verbosity, format);
    const progressManager = new ProgressManager(verbosity, format);

    // Initialize logger with appropriate level
    await initializeLogger('azure-devops-bot');

    // Create and start enhanced bot
    const bot = new CLIAzureDevOpsBot(outputManager, progressManager);

    // Handle graceful shutdown
    const shutdown = async () => {
      outputManager.info('Shutting down...', null, VerbosityLevel.NORMAL);
      await bot.stop();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    // Start with enhanced CLI interface
    await bot.start(query);
  }

  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
```

### 6. Migration from Console.log

```typescript
// Example migration patterns

// BEFORE: Direct console.log usage
console.log('🔍 Validating email addresses...')
console.log(
  `✅ All email addresses validated successfully: ${valid.join(', ')}`,
)
console.error('❌ Error:', error)

// AFTER: OutputManager usage
outputManager.startSpinner('Validating email addresses...')
outputManager.stopSpinner('Email validation successful')
outputManager.debug('Validated emails', { validEmails: valid })
outputManager.error('Email validation failed', { error: error.message })

// BEFORE: Progress reporting in sync-service.ts
console.log(
  `📝 Comment sync progress: ${completed}/${total} work items (${percent}%)`,
)

// AFTER: Progress management
progressManager.startProgress('Syncing comments', total)
progressManager.updateProgress(completed)
progressManager.completeProgress('Comment sync completed')
```

## Performance Considerations

- **Lazy Loading**: UI components (ora, cli-progress) only loaded when needed
- **Format Detection**: JSON/Markdown formatting bypasses expensive color/styling operations
- **Verbosity Filtering**: Early returns prevent unnecessary string formatting and I/O
- **Memory Efficiency**: Progress indicators cleaned up automatically
- **Startup Time**: CLI parsing adds <5ms overhead to application startup

## Error Handling Strategy

```typescript
// Enhanced error handling with context
export class CLIError extends Error {
  constructor(
    message: string,
    public code: string,
    public suggestions: string[] = []
  ) {
    super(message);
    this.name = 'CLIError';
  }
}

// Usage in OutputManager
error(message: string, error?: Error | unknown): void {
  if (error instanceof CLIError) {
    console.error(chalk.red('❌'), message);
    console.error(chalk.dim('   Code:'), error.code);

    if (error.suggestions.length > 0) {
      console.error(chalk.dim('   Suggestions:'));
      error.suggestions.forEach(suggestion => {
        console.error(chalk.dim('   •'), suggestion);
      });
    }
  } else {
    // Standard error handling
    console.error(chalk.red('❌ Error:'), message);
  }
}
```

This technical specification provides complete implementation details with extensive code examples that can be directly used during development. The architecture balances functionality with performance while maintaining backward compatibility.
