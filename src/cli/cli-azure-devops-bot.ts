import type { OutputManager } from './output-manager.js'
import type { ProgressManager } from './progress-manager.js'

import { AzureDevOpsBot } from '../azure-devops-bot.js'
import { AzureDevOpsClient } from '../services/azure-devops.js'
import { CLISyncService } from '../services/cli-sync-service.js'
import { VerbosityLevel } from './cli-config.js'

export class CLIAzureDevOpsBot extends AzureDevOpsBot {
  private outputManager: OutputManager
  private progressManager: ProgressManager
  protected syncService: CLISyncService

  constructor(outputManager: OutputManager, progressManager: ProgressManager) {
    super()
    this.outputManager = outputManager
    this.progressManager = progressManager
    // Replace the base syncService with CLI-enhanced version
    this.syncService = new CLISyncService(outputManager, progressManager)
  }

  async start(query: string): Promise<void> {
    try {
      // Email validation with progress indication
      this.outputManager.startSpinner('Validating email addresses...')

      const userEmails = this.getUserEmails()
      AzureDevOpsClient.setUserEmails(userEmails)

      const azureClient = new AzureDevOpsClient()
      const { valid, invalid } =
        await azureClient.validateUserEmails(userEmails)

      if (invalid.length > 0) {
        this.outputManager.stopSpinner()
        this.outputManager.error('Email validation failed', {
          invalidEmails: invalid,
          validEmails: valid,
        })

        this.outputManager.box(
          'Please ensure these email addresses:\n' +
            '  1. Are correctly spelled\n' +
            '  2. Exist in the Azure DevOps organization\n' +
            '  3. Have access to the project',
          'Email Validation Failed',
        )

        process.exit(1)
      }

      this.outputManager.stopSpinner('Email validation successful')
      this.outputManager.debug('Validated emails', { validEmails: valid })

      // Start background sync but DON'T show the message yet
      await this.syncService.startBackgroundSync(true) // Use detailed sync

      const shouldSync = await this.syncService.shouldSync()
      if (shouldSync) {
        // Only show sync message in verbose mode or higher
        this.outputManager.info(
          'Starting initial sync...',
          undefined,
          VerbosityLevel.VERBOSE,
        )
        this.progressManager.startIndeterminate('Syncing work items')

        await this.syncService.performSyncDetailed()

        this.progressManager.stopIndeterminate('Sync completed')
      } else {
        this.outputManager.debug('Skipping sync - data is recent')
      }

      // Process query with formatted output
      this.outputManager.info(
        `Processing query: "${query}"`,
        undefined,
        VerbosityLevel.VERBOSE,
      )

      const response = await this.queryEngine.processQuery(query, userEmails)

      // Debug: ensure we're getting a response
      if (response === undefined || response === null) {
        process.stderr.write('DEBUG: Response is null or undefined\n')
      }

      this.outputManager.formatResult(response)

      // NOW show the background sync message and start countdown
      this.syncService.showBackgroundSyncStartedMessage()
      this.syncService.startPendingCountdown()

      // Ensure output is flushed before exit
      process.stdout.write('')
    } catch (error) {
      this.outputManager.error(
        'Azure DevOps Bot failed',
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : { error: String(error) },
      )
      process.exit(1)
    }
  }

  // Override getUserEmails to use OutputManager for errors
  protected getUserEmails(): string[] {
    const envEmails = process.env.AZURE_DEVOPS_USER_EMAILS
    if (!envEmails) {
      this.outputManager.error(
        'AZURE_DEVOPS_USER_EMAILS environment variable is required',
        {
          examples: ['Jane.Citizen@fwc.gov.au,ITEX-JC@fwc.gov.au'],
          setupMethods: [
            'Create .env file with AZURE_DEVOPS_USER_EMAILS',
            'Export in shell: export AZURE_DEVOPS_USER_EMAILS="emails"',
            'Add to shell profile (~/.bashrc, ~/.zshrc)',
          ],
        },
      )

      this.outputManager.box(
        'Set your email address(es) for Azure DevOps work item assignment:\n\n' +
          'Example: AZURE_DEVOPS_USER_EMAILS=jane@company.com,john@company.com\n\n' +
          'Methods:\n' +
          '1. Create .env file: echo "AZURE_DEVOPS_USER_EMAILS=your@email.com" >> .env\n' +
          '2. Export in shell: export AZURE_DEVOPS_USER_EMAILS=your@email.com\n' +
          '3. Add to shell profile: echo "export AZURE_DEVOPS_USER_EMAILS=..." >> ~/.zshrc',
        'Setup Required',
      )

      process.exit(1)
    }

    const emails = envEmails
      .split(',')
      .map((email) => email.trim())
      .filter((email) => email.length > 0)

    if (emails.length === 0) {
      this.outputManager.error('No valid email addresses provided', {
        raw_value: envEmails,
        required_min: 1,
      })
      process.exit(1)
    }

    return emails
  }
}
