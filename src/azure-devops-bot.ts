import { AzureDevOpsClient } from './services/azure-devops.js'
import { DatabaseService } from './services/database.js'
import { QueryEngine } from './services/query-engine.js'
import { SyncService } from './services/sync-service.js'
import { LoggerFactory } from './utils/logger.js'

// Environment variables are loaded in index.ts or via tsx --env-file
// No need to load dotenv here - it causes duplicate messages

export class AzureDevOpsBot {
  protected syncService: SyncService
  protected db: DatabaseService
  protected queryEngine: QueryEngine
  private userEmails: string[] = []
  private _logger?: ReturnType<typeof LoggerFactory.createForComponent>

  private get logger() {
    if (!this._logger) {
      this._logger = LoggerFactory.createForComponent('azure-devops-bot')
    }
    return this._logger
  }

  constructor() {
    this.syncService = new SyncService()
    this.db = new DatabaseService()
    this.queryEngine = new QueryEngine(this.db)
  }

  protected getUserEmails(): string[] {
    const envEmails = process.env.AZURE_DEVOPS_USER_EMAILS
    if (!envEmails) {
      this.logger.error(
        'AZURE_DEVOPS_USER_EMAILS environment variable is required',
        {
          error: 'missing_user_emails',
          required: true,
          examples: ['Jane.Citizen@fwc.gov.au,ITEX-JC@fwc.gov.au'],
        },
      )
      console.error(
        '\n❌ Error: AZURE_DEVOPS_USER_EMAILS environment variable is required\n',
      )
      console.error('Please set your email address(es) for Azure DevOps:')
      console.error('  - These are the email addresses used in Azure DevOps')
      console.error(
        '  - Multiple emails can be provided, comma-separated (e.g., user@company.com,alias@company.com)',
      )
      console.error('')
      console.error('Examples:')
      console.error(
        '  export AZURE_DEVOPS_USER_EMAILS="jane.doe@company.com,jdoe@company.com"',
      )
      console.error(
        '  AZURE_DEVOPS_USER_EMAILS="user@company.com" azure-devops-bot',
      )
      console.error('')
      process.exit(1)
    }

    const emails = envEmails
      .split(',')
      .map((email) => email.trim())
      .filter((email) => email.length > 0)

    if (emails.length === 0) {
      this.logger.error(
        'No valid email addresses found in AZURE_DEVOPS_USER_EMAILS',
        {
          raw_value: envEmails,
          required_min: 1,
        },
      )
      console.error('❌ Error: No valid email addresses found')
      process.exit(1)
    }

    this.userEmails = emails
    this.logger.info('User emails configured', {
      email_count: emails.length,
      emails: emails,
    })

    return emails
  }

  async start(query: string = 'summary'): Promise<void> {
    try {
      console.log('🔍 Validating email addresses...')
      const userEmails = this.getUserEmails()
      // Set userEmails on the client
      AzureDevOpsClient.setUserEmails(userEmails)

      const azureClient = new AzureDevOpsClient()
      const { valid, invalid } =
        await azureClient.validateUserEmails(userEmails)

      if (invalid.length > 0) {
        console.error('\n❌ Email validation failed!')
        console.error('The following emails are not valid in Azure DevOps:')
        invalid.forEach((email: string) => console.error(`  - ${email}`))
        console.error('\nPlease ensure these email addresses:')
        console.error('  1. Are correctly spelled')
        console.error('  2. Exist in the Azure DevOps organization')
        console.error('  3. Have access to the project')
        console.error('')
        console.error('Valid emails found:')
        valid.forEach((email: string) => console.error(`  ✓ ${email}`))
        process.exit(1)
      }

      console.log(
        `✅ All email addresses validated successfully: ${valid.join(', ')}`,
      )

      // Start background sync
      this.logger.info('Starting background sync')
      await this.syncService.startBackgroundSync(true)

      // Check if we should run a sync now
      const shouldSync = await this.syncService.shouldSync()
      if (shouldSync) {
        console.log('🔄 Starting initial sync...')
        await this.syncService.performSyncDetailed()
      } else {
        console.log('ℹ️  Data is recent, skipping sync')
      }

      // Process the query
      console.log(`\n📋 Processing query: "${query}"`)
      const response = await this.queryEngine.processQuery(query, userEmails)
      console.log('\n📊 Results:')
      console.log(JSON.stringify(response, null, 2))
    } catch (error) {
      this.logger.error('Failed to process query', { error })
      console.error('❌ Error:', error)
      process.exit(1)
    }
  }

  async stop(): Promise<void> {
    this.logger.info('Stopping Azure DevOps Bot')
    this.syncService.stopBackgroundSync()
    // Database doesn't have disconnect method, it's handled automatically
  }
}
