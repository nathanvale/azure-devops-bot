import type { Ora } from 'ora'

import chalk from 'chalk'
// @ts-ignore - cli-progress doesn't have type definitions
import CliProgress from 'cli-progress'
import ora from 'ora'

import { VerbosityLevel, OutputFormat } from './cli-config.js'

export class ProgressManager {
  private verbosity: VerbosityLevel
  private format: OutputFormat
  private progressBar: CliProgress.SingleBar | null = null
  private progressInterval: NodeJS.Timeout | null = null
  private countdownSpinner: Ora | null = null
  private countdownInterval: NodeJS.Timeout | null = null

  constructor(verbosity: VerbosityLevel, format: OutputFormat) {
    this.verbosity = verbosity
    this.format = format
  }

  startProgress(label: string, total: number): void {
    // Clean up any existing progress first
    this.cleanup()

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
      if (statusText && this.verbosity >= VerbosityLevel.VERBOSE) {
        // Update with custom payload
        this.progressBar.update(current, { status: statusText })
      } else {
        this.progressBar.update(current)
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
    // Clean up any existing progress first
    this.cleanup()

    if (
      this.verbosity === VerbosityLevel.QUIET ||
      this.format !== OutputFormat.TEXT
    ) {
      return
    }

    let dots = 0
    // Write initial spinner text without newline so we can overwrite it
    process.stdout.write(`${chalk.blue('🔄')} ${label}...`)

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

      // Clear the line
      process.stdout.write('\r\x1b[K')
      if (message) {
        // Now safe to use console.log since we cleared the spinner line
        console.log(chalk.green('✅'), message)
      }
      // Don't add newline if no message - let next output decide
    }
  }

  // Periodic progress reporting for long operations
  reportProgress(current: number, total: number, operation: string): void {
    if (this.verbosity < VerbosityLevel.VERBOSE) return

    const percentage = total === 0 ? NaN : Math.round((current / total) * 100)
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

  // Start countdown spinner for next sync
  // This shows EVEN in quiet mode since it's essential feedback
  startSyncCountdown(nextSyncTime: Date): void {
    // Clean up any existing spinners/progress
    this.cleanup()

    // Show countdown spinner even in quiet mode (but not in JSON format)
    if (this.format === OutputFormat.JSON) {
      return
    }

    // Create the spinner with initial text
    this.countdownSpinner = ora({
      text: this.getCountdownText(nextSyncTime),
      spinner: 'dots',
      color: 'cyan',
    }).start()

    // Update countdown every second
    this.countdownInterval = setInterval(() => {
      const remaining = this.getTimeRemaining(nextSyncTime)

      if (remaining <= 0) {
        // Time's up! Show preparation message
        if (this.countdownSpinner) {
          this.countdownSpinner.succeed(
            'Sync time reached! Preparing to sync...',
          )
        }
        this.stopSyncCountdown()
      } else if (remaining <= 10) {
        // Last 10 seconds - change color to yellow
        if (this.countdownSpinner) {
          this.countdownSpinner.color = 'yellow'
          this.countdownSpinner.text = this.getCountdownText(nextSyncTime)
        }
      } else {
        // Normal countdown update
        if (this.countdownSpinner) {
          this.countdownSpinner.text = this.getCountdownText(nextSyncTime)
        }
      }
    }, 1000)
  }

  // Stop the countdown spinner
  stopSyncCountdown(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval)
      this.countdownInterval = null
    }

    if (this.countdownSpinner) {
      // Don't call stop() or clear() - let it stay succeeded or be replaced
      this.countdownSpinner = null
    }
  }

  // Get formatted countdown text
  private getCountdownText(nextSyncTime: Date): string {
    const remaining = this.getTimeRemaining(nextSyncTime)
    const minutes = Math.floor(remaining / 60)
    const seconds = remaining % 60

    if (remaining <= 10) {
      return `Next sync in ${seconds} seconds ⚠️`
    } else if (minutes === 0) {
      return `Next sync in ${seconds} seconds ⏱️`
    } else if (minutes === 1) {
      return `Next sync in 1 minute ${seconds} seconds ⏱️`
    } else {
      return `Next sync in ${minutes} minutes ${seconds} seconds ⏱️`
    }
  }

  // Calculate time remaining in seconds
  private getTimeRemaining(nextSyncTime: Date): number {
    const now = new Date()
    const diff = nextSyncTime.getTime() - now.getTime()
    return Math.max(0, Math.floor(diff / 1000))
  }

  // Clean up any active progress indicators
  private cleanup(): void {
    if (this.progressBar) {
      this.progressBar.stop()
      this.progressBar = null
    }

    if (this.progressInterval) {
      clearInterval(this.progressInterval)
      this.progressInterval = null
      // Clear any remaining output
      process.stdout.write('\r\x1b[K')
    }

    // Also cleanup countdown if active
    this.stopSyncCountdown()
  }
}
