import { Command } from 'commander'

export interface CLIOptions {
  verbose: boolean
  quiet: boolean
  debug: boolean
  format: 'text' | 'json' | 'markdown'
}

export enum VerbosityLevel {
  QUIET = 0,
  NORMAL = 1,
  VERBOSE = 2,
  DEBUG = 3,
}

export enum OutputFormat {
  TEXT = 'text',
  JSON = 'json',
  MARKDOWN = 'markdown',
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
    .option(
      '-v, --verbose',
      'detailed output with comprehensive logging',
      false,
    )
    .option(
      '-q, --quiet',
      'minimal output showing only essential information',
      false,
    )
    .option(
      '-d, --debug',
      'maximum verbosity including debug logs and API traces',
      false,
    )
    .option(
      '-f, --format <type>',
      'output format: text, json, or markdown',
      'text',
    )
    .allowUnknownOption(false)
    .allowExcessArguments(true)
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

  program.parse()

  const options = program.opts() as CLIOptions

  // Validate format option
  const formatValues = ['text', 'json', 'markdown']
  if (options.format && !formatValues.includes(options.format)) {
    console.error(
      `Error: Invalid format '${options.format}'. Must be one of: ${formatValues.join(', ')}`,
    )
    process.exit(1)
  }

  // Validate conflicting options
  if (options.quiet && options.verbose) {
    console.error('Error: Cannot use --quiet and --verbose together')
    process.exit(1)
  }

  if (options.quiet && options.debug) {
    console.error('Error: Cannot use --quiet and --debug together')
    process.exit(1)
  }

  // Collect all remaining arguments as query
  const query = program.args.join(' ') || 'summary'

  return { program, options, query }
}

export function determineVerbosityLevel(options: CLIOptions): VerbosityLevel {
  if (options.quiet) return VerbosityLevel.QUIET
  if (options.debug) return VerbosityLevel.DEBUG
  if (options.verbose) return VerbosityLevel.VERBOSE
  return VerbosityLevel.NORMAL
}
