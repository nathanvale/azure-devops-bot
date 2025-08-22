#!/usr/bin/env node

import { AzureDevOpsClient } from './services/azure-devops.js'
import { DatabaseService } from './services/database.js'
import { QueryEngine } from './services/query-engine.js'
import { SyncService } from './services/sync-service.js'

export class AzureDevOpsBot {
  private syncService: SyncService
  private db: DatabaseService
  private queryEngine: QueryEngine
  private userEmails: string[] = []

  constructor() {
    this.syncService = new SyncService()
    this.db = new DatabaseService()
    this.queryEngine = new QueryEngine(this.db)
  }

  private getUserEmails(): string[] {
    const envEmails = process.env.AZURE_DEVOPS_USER_EMAILS
    if (!envEmails) {
      console.error(
        '❌ Error: AZURE_DEVOPS_USER_EMAILS environment variable is required',
      )
      console.error('')
      console.error(
        'Please set the email address(es) that your Azure DevOps account uses for work item assignment:',
      )
      console.error(
        'Example: AZURE_DEVOPS_USER_EMAILS=Jane.Citizen@fwc.gov.au,ITEX-JC@fwc.gov.au',
      )
      console.error('')
      console.error('You can set this environment variable in several ways:')
      console.error('')
      console.error('1. Create a .env file in your project root:')
      console.error(
        '   echo "AZURE_DEVOPS_USER_EMAILS=Jane.Citizen@fwc.gov.au,ITEX-JC@fwc.gov.au" >> .env',
      )
      console.error('')
      console.error('2. Export directly in your shell:')
      console.error(
        '   export AZURE_DEVOPS_USER_EMAILS=Jane.Citizen@fwc.gov.au,ITEX-JC@fwc.gov.au',
      )
      console.error('')
      console.error(
        '3. Set permanently in your shell profile (~/.bashrc, ~/.zshrc, etc.):',
      )
      console.error(
        '   echo "export AZURE_DEVOPS_USER_EMAILS=Jane.Citizen@fwc.gov.au,ITEX-JC@fwc.gov.au" >> ~/.zshrc',
      )
      console.error('')
      console.error('4. Run with the environment variable inline:')
      console.error(
        '   AZURE_DEVOPS_USER_EMAILS=Jane.Citizen@fwc.gov.au,ITEX-JC@fwc.gov.au pnpm dev',
      )
      process.exit(1)
    }

    const emails = envEmails
      .split(',')
      .map((email) => email.trim())
      .filter((email) => email.length > 0)

    if (emails.length === 0) {
      console.error(
        '❌ Error: At least one valid email address must be provided',
      )
      console.error(
        'Example: AZURE_DEVOPS_USER_EMAILS=Jane.Citizen@fwc.gov.au,ITEX-JC@fwc.gov.au',
      )
      process.exit(1)
    }

    return emails
  }

  async start(): Promise<void> {
    try {
      // Configure user emails for Azure DevOps queries
      this.userEmails = this.getUserEmails()
      AzureDevOpsClient.setUserEmails(this.userEmails)

      console.log(
        `🔍 Validating email addresses in Azure DevOps: ${this.userEmails.join(', ')}`,
      )

      // Validate emails exist in Azure DevOps
      const azureClient = new AzureDevOpsClient()
      const { valid, invalid } = await azureClient.validateUserEmails(
        this.userEmails,
      )

      if (invalid.length > 0) {
        console.error(
          '❌ Error: The following email addresses were not found in Azure DevOps:',
        )
        invalid.forEach((email) => console.error(`  • ${email}`))
        console.error('')
        console.error('Please ensure these email addresses:')
        console.error('  1. Are correctly spelled')
        console.error('  2. Exist in the Azure DevOps organization')
        console.error('  3. Have access to the project')
        console.error('')
        console.error(
          'Valid emails found:',
          valid.length > 0 ? valid.join(', ') : 'None',
        )
        process.exit(1)
      }

      console.log(
        `✅ All email addresses validated successfully: ${valid.join(', ')}`,
      )

      // Start background detailed sync (shows interval message)
      await this.syncService.startBackgroundSync(true)

      // Check if we need to sync
      const shouldSync = await this.syncService.shouldSync()
      if (shouldSync) {
        console.log('🔄 Syncing work items with detailed metadata...')
        await this.syncService.performSyncDetailed()
      }

      // Get query from command line args
      const query = process.argv.slice(2).join(' ') || 'summary'

      // Process query
      const response = await this.queryEngine.processQuery(
        query,
        this.userEmails,
      )
      console.log('\n' + response)
    } catch (error) {
      console.error('❌ Error:', error)
      process.exit(1)
    }
  }

  async stop(): Promise<void> {
    await this.syncService.close()
  }
}

// Only run if this is the main module (not being imported for tests)
if (
  process.argv[1] &&
  (process.argv[1].endsWith('/index.js') ||
    process.argv[1].endsWith('/index.ts'))
) {
  // Handle graceful shutdown
  const bot = new AzureDevOpsBot()

  process.on('SIGINT', async () => {
    console.log('\n👋 Shutting down...')
    await bot.stop()
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    console.log('\n👋 Shutting down...')
    await bot.stop()
    process.exit(0)
  })

  // Start the bot
  bot.start().catch(console.error)
}
