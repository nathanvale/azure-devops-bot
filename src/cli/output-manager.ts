import chalk from 'chalk';
import boxen from 'boxen';
import ora, { Ora } from 'ora';
import { VerbosityLevel, OutputFormat } from './cli-config.js';

export class OutputManager {
  private verbosity: VerbosityLevel;
  private format: OutputFormat;
  private activeSpinner: Ora | null = null;
  // Store original console methods to bypass quiet mode suppression
  private originalConsole = (global as any).originalConsole || {
    log: console.log.bind(console),
    error: console.error.bind(console),
    warn: console.warn.bind(console),
  };

  constructor(verbosity: VerbosityLevel, format: OutputFormat) {
    this.verbosity = verbosity;
    this.format = format;
  }

  // Core logging methods with verbosity filtering
  info(message: string, details?: any, level: VerbosityLevel = VerbosityLevel.NORMAL): void {
    if (this.verbosity < level) return;
    
    if (this.activeSpinner) {
      this.activeSpinner.stop();
    }

    switch (this.format) {
      case OutputFormat.JSON:
        this.outputJSON({ level: 'info', message, details, timestamp: new Date().toISOString() });
        break;
      case OutputFormat.MARKDOWN:
        this.outputMarkdown(`**Info:** ${message}`, details);
        break;
      default:
        this.originalConsole.log(chalk.blue('ℹ️ '), message);
        if (details && this.verbosity >= VerbosityLevel.VERBOSE) {
          this.originalConsole.log(chalk.dim('   Details:'), details);
        }
    }

    if (this.activeSpinner) {
      this.activeSpinner.start();
    }
  }

  success(message: string, details?: any, level: VerbosityLevel = VerbosityLevel.NORMAL): void {
    if (this.verbosity < level) return;
    
    if (this.activeSpinner) {
      this.activeSpinner.succeed(message);
      this.activeSpinner = null;
      return;
    }

    switch (this.format) {
      case OutputFormat.JSON:
        this.outputJSON({ level: 'success', message, details, timestamp: new Date().toISOString() });
        break;
      case OutputFormat.MARKDOWN:
        this.outputMarkdown(`✅ **Success:** ${message}`, details);
        break;
      default:
        this.originalConsole.log(chalk.green('✅'), message);
        if (details && this.verbosity >= VerbosityLevel.VERBOSE) {
          this.originalConsole.log(chalk.dim('   Details:'), details);
        }
    }
  }

  error(message: string, details?: any): void {
    // ALWAYS show errors regardless of verbosity - critical for user feedback
    if (this.activeSpinner) {
      this.activeSpinner.fail(message);
      this.activeSpinner = null;
    }

    // Use process.stderr.write as a fallback if originalConsole is not available
    const errorOut = this.originalConsole?.error || ((msg: string) => process.stderr.write(msg + '\n'));

    // Force output using original console to bypass quiet mode suppression
    switch (this.format) {
      case OutputFormat.JSON:
        // Use originalConsole directly to ensure error is shown
        errorOut(JSON.stringify({ level: 'error', message, details, timestamp: new Date().toISOString() }, null, 2));
        break;
      case OutputFormat.MARKDOWN:
        errorOut(`❌ **Error:** ${message}`);
        if (details) {
          errorOut('```json');
          errorOut(JSON.stringify(details, null, 2));
          errorOut('```');
        }
        break;
      default:
        errorOut(chalk.red('❌ Error:') + ' ' + message);
        if (details && this.verbosity >= VerbosityLevel.VERBOSE) {
          errorOut(chalk.dim('   Details:') + ' ' + JSON.stringify(details));
        }
    }
  }

  warn(message: string, details?: any): void {
    if (this.verbosity < VerbosityLevel.NORMAL) return;
    
    if (this.activeSpinner) {
      this.activeSpinner.stop();
    }

    switch (this.format) {
      case OutputFormat.JSON:
        this.outputJSON({ level: 'warn', message, details, timestamp: new Date().toISOString() });
        break;
      case OutputFormat.MARKDOWN:
        this.outputMarkdown(`⚠️ **Warning:** ${message}`, details);
        break;
      default:
        console.log(chalk.yellow('⚠️ '), message);
        if (details && this.verbosity >= VerbosityLevel.VERBOSE) {
          console.log(chalk.dim('   Details:'), details);
        }
    }

    if (this.activeSpinner) {
      this.activeSpinner.start();
    }
  }

  debug(message: string, details?: any): void {
    if (this.verbosity < VerbosityLevel.DEBUG) return;
    
    switch (this.format) {
      case OutputFormat.JSON:
        this.outputJSON({ level: 'debug', message, details, timestamp: new Date().toISOString() });
        break;
      case OutputFormat.MARKDOWN:
        this.outputMarkdown(`🔍 **Debug:** ${message}`, details);
        break;
      default:
        this.originalConsole.log(chalk.dim('🔍 [DEBUG]'), message);
        if (details) {
          this.originalConsole.log(chalk.dim('   '), details);
        }
    }
  }

  // Progress indication methods
  startSpinner(text: string): void {
    if (this.verbosity === VerbosityLevel.QUIET || this.format !== OutputFormat.TEXT) {
      return;
    }
    
    this.activeSpinner = ora({
      text,
      color: 'blue',
      spinner: 'dots'
    }).start();
  }

  updateSpinner(text: string): void {
    if (this.activeSpinner) {
      this.activeSpinner.text = text;
    }
  }

  stopSpinner(successMessage?: string): void {
    if (this.activeSpinner) {
      if (successMessage) {
        this.activeSpinner.succeed(successMessage);
      } else {
        this.activeSpinner.stop();
      }
      this.activeSpinner = null;
    }
  }

  // Structured output formatting - ALWAYS outputs even in quiet mode
  formatResult(data: any): void {
    // This method always outputs regardless of verbosity
    // because it's the final result the user requested
    switch (this.format) {
      case OutputFormat.JSON:
        this.outputJSON(data);
        break;
      case OutputFormat.MARKDOWN:
        this.outputMarkdownResult(data);
        break;
      default:
        this.outputTextResult(data);
    }
  }

  // Format-specific output methods
  private outputJSON(data: any): void {
    // Always output JSON results regardless of verbosity
    if (this.originalConsole && this.originalConsole.log) {
      this.originalConsole.log(JSON.stringify(data, null, 2));
    } else {
      // Fallback to process.stdout if originalConsole not available
      process.stdout.write(JSON.stringify(data, null, 2) + '\n');
    }
  }

  private outputMarkdown(message: string, details?: any): void {
    const output = this.originalConsole?.log || ((msg: string) => process.stdout.write(msg + '\n'));
    output(message);
    if (details) {
      output('```json');
      output(JSON.stringify(details, null, 2));
      output('```');
    }
  }

  private outputTextResult(data: any): void {
    // Use process.stdout.write as a fallback if originalConsole is not available
    const output = this.originalConsole?.log || ((msg: string) => process.stdout.write(msg + '\n'));
    
    if (Array.isArray(data)) {
      output(chalk.bold(`\n📋 Results (${data.length} items):`));
      data.forEach((item, index) => {
        output(`${chalk.dim(`${index + 1}.`)} ${this.formatWorkItem(item)}`);
      });
    } else {
      output(boxen(JSON.stringify(data, null, 2), {
        padding: 1,
        borderColor: 'blue',
        title: 'Result'
      }));
    }
  }

  private outputMarkdownResult(data: any): void {
    const output = this.originalConsole?.log || ((msg: string) => process.stdout.write(msg + '\n'));
    output('# Azure DevOps Bot Results\n');
    if (Array.isArray(data)) {
      output(`Found ${data.length} items:\n`);
      data.forEach((item, index) => {
        output(`${index + 1}. **${item.title || item.id}** - ${item.state || 'Unknown'}`);
      });
    } else {
      output('```json');
      output(JSON.stringify(data, null, 2));
      output('```');
    }
  }

  private formatWorkItem(item: any): string {
    const title = chalk.bold(item.title || `Work Item ${item.id}`);
    const state = item.state ? chalk.cyan(`[${item.state}]`) : '';
    const assignee = item.assignedTo ? chalk.dim(`(@${item.assignedTo})`) : '';
    
    return `${title} ${state} ${assignee}`.trim();
  }

  // Box formatting for important messages
  box(message: string, title?: string, forceShow: boolean = false): void {
    // Skip box in quiet mode unless it's forced (for errors)
    if (!forceShow && this.verbosity === VerbosityLevel.QUIET && this.format === OutputFormat.TEXT) {
      return;
    }

    switch (this.format) {
      case OutputFormat.JSON:
        this.outputJSON({ type: 'box', title, message, timestamp: new Date().toISOString() });
        break;
      case OutputFormat.MARKDOWN:
        this.originalConsole.log(`### ${title || 'Notice'}\n${message}\n`);
        break;
      default:
        this.originalConsole.log(boxen(message, {
          padding: 1,
          borderColor: 'yellow',
          title: title || 'Notice'
        }));
    }
  }
}