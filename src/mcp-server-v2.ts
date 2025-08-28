#!/usr/bin/env node

// Only load dotenv if environment variables haven't been loaded yet
// This prevents duplicate messages when tsx --env-file is used
if (!process.env.AZURE_DEVOPS_PAT) {
  const dotenv = await import('dotenv')
  dotenv.config()
}

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

import { AdminDomain } from './mcp-tools/domains/admin/index.js'
import { CacheDomain } from './mcp-tools/domains/cache/index.js'
import { SyncDomain } from './mcp-tools/domains/sync/index.js'
// Import new domain-based architecture
import { MCPToolRegistry } from './mcp-tools/registry/index.js'
import { AzureDevOpsClient } from './services/azure-devops.js'
import { DatabaseService } from './services/database.js'
import { SyncService } from './services/sync-service.js'
import { initializeLogger, LoggerFactory } from './utils/logger.js'
import { SyncMetrics } from './utils/sync-metrics.js'

/**
 * Azure DevOps MCP Server v2 - Domain-Based Architecture
 *
 * This version implements Microsoft's azure-devops-mcp patterns with:
 * - Domain-based tool organization (cache, sync, admin, wit, core)
 * - Comprehensive Zod schema validation
 * - Granular, single-purpose tools
 * - Runtime type safety
 * - Consistent error handling
 */
export class AzureDevOpsMCPServerV2 {
  private server: Server
  private toolRegistry: MCPToolRegistry
  private db: DatabaseService
  private syncService: SyncService
  private syncMetrics: SyncMetrics
  private azureClient: AzureDevOpsClient
  public userEmails: string[] = []
  private logger = LoggerFactory.createForComponent('mcp-server-v2')

  constructor() {
    this.server = new Server(
      {
        name: 'azure-devops-bot',
        version: '2.0.0', // Incremented for domain architecture
      },
      {
        capabilities: {
          tools: {},
        },
      },
    )

    // Initialize services
    this.db = new DatabaseService()
    this.syncService = new SyncService()
    this.syncMetrics = new SyncMetrics(this.db.client)
    this.azureClient = new AzureDevOpsClient()

    // Initialize domain registry with default enabled domains
    this.toolRegistry = new MCPToolRegistry({
      enabledDomains: ['cache', 'sync', 'admin'],
      defaultDomains: ['cache', 'sync', 'admin'],
    })

    this.setupDomains()
    this.setupHandlers()
  }

  /**
   * Register all domain implementations
   */
  private setupDomains(): void {
    try {
      // Register Cache domain
      const cacheDomain = new CacheDomain(
        this.db,
        this.syncMetrics,
        this.userEmails,
      )
      this.toolRegistry.registerDomain(cacheDomain)
      this.logger.info('Registered Cache domain', {
        toolCount: cacheDomain.getTools().length,
      })

      // Register Sync domain
      const syncDomain = new SyncDomain(this.syncService, this.syncMetrics)
      this.toolRegistry.registerDomain(syncDomain)
      this.logger.info('Registered Sync domain', {
        toolCount: syncDomain.getTools().length,
      })

      // Register Admin domain
      const adminDomain = new AdminDomain(this.db, this.azureClient)
      this.toolRegistry.registerDomain(adminDomain)
      this.logger.info('Registered Admin domain', {
        toolCount: adminDomain.getTools().length,
      })

      // Log registry statistics
      const stats = this.toolRegistry.getStats()
      this.logger.info('Domain registry initialized', {
        totalDomains: stats.totalDomains,
        enabledDomains: stats.enabledDomains,
        totalTools: stats.totalTools,
        enabledTools: stats.enabledTools,
        domainBreakdown: stats.domainBreakdown,
      })
    } catch (error) {
      this.logger.error('Failed to setup domains', {
        error: error instanceof Error ? error.message : String(error),
        operation: 'domain_setup',
      })
      throw error
    }
  }

  /**
   * Setup MCP protocol handlers
   */
  private setupHandlers(): void {
    // List tools handler - returns all tools from enabled domains
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      try {
        const tools = this.toolRegistry.getTools()

        this.logger.debug('Listing tools', {
          toolCount: tools.length,
          enabledDomains: this.toolRegistry
            .getEnabledDomains()
            .map((d) => d.getName()),
          operation: 'list_tools',
        })

        return { tools }
      } catch (error) {
        this.logger.error('Failed to list tools', {
          error: error instanceof Error ? error.message : String(error),
          operation: 'list_tools',
        })
        throw error
      }
    })

    // Call tool handler - delegates to appropriate domain
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params

      this.logger.debug('Tool call received', {
        toolName: name,
        argsKeys: args ? Object.keys(args as object) : [],
        operation: 'call_tool',
      })

      try {
        const response = await this.toolRegistry.handleTool(name, args)

        this.logger.debug('Tool call completed', {
          toolName: name,
          responseLength: response.content[0]?.text?.length || 0,
          operation: 'call_tool',
        })

        // Return response matching MCP SDK expectations
        return response as { 
          content: Array<{ type: 'text'; text: string }> 
        }
      } catch (error) {
        this.logger.error('Tool call failed', {
          toolName: name,
          error: error instanceof Error ? error.message : String(error),
          operation: 'call_tool',
        })

        // Return standardized error response
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  error: {
                    code: 'TOOL_EXECUTION_ERROR',
                    message: `Tool '${name}' execution failed: ${error instanceof Error ? error.message : String(error)}`,
                    tool: name,
                    timestamp: new Date().toISOString(),
                  },
                },
                null,
                2,
              ),
            },
          ],
        }
      }
    })
  }

  /**
   * Configure user emails for filtering
   */
  private getConfiguredEmails(): string[] {
    // Check for command line arguments first
    const args = process.argv.slice(2)
    const emailArg = args.find((arg) => arg.startsWith('--emails='))

    if (!emailArg) {
      console.error(
        'Error: Email addresses must be provided via --emails parameter',
      )
      console.error(
        'Example: pnpm mcp --emails=user1@domain.com,user2@domain.com',
      )
      process.exit(1)
    }

    const emailPart = emailArg.split('=')[1]
    if (!emailPart) {
      console.error(
        '❌ Invalid email format. Expected: --emails=email@domain.com',
      )
      process.exit(1)
    }
    const emails = emailPart
      .split(',')
      .map((email) => email.trim())
      .filter((email) => email.length > 0)

    if (emails.length === 0) {
      console.error('Error: At least one valid email address must be provided')
      console.error(
        'Example: pnpm mcp --emails=user1@domain.com,user2@domain.com',
      )
      process.exit(1)
    }

    return emails
  }

  /**
   * Update user emails configuration
   */
  public updateUserEmails(emails: string[]): void {
    this.userEmails = emails

    // Update Azure client
    AzureDevOpsClient.setUserEmails(emails)

    // Update cache domain with new emails
    const cacheDomain = this.toolRegistry.getDomain('cache')
    if (cacheDomain) {
      // Recreate cache domain with new emails
      this.toolRegistry.unregisterDomain('cache')
      const newCacheDomain = new CacheDomain(this.db, this.syncMetrics, emails)
      this.toolRegistry.registerDomain(newCacheDomain)

      this.logger.info('Updated user emails in cache domain', {
        emailCount: emails.length,
        emails: emails,
      })
    }
  }

  /**
   * Get current registry configuration
   */
  public getRegistryStats() {
    return this.toolRegistry.getStats()
  }

  /**
   * Enable/disable specific domains
   */
  public updateDomainConfig(config: {
    enabledDomains?: string[]
    disabledDomains?: string[]
  }): void {
    this.toolRegistry.updateConfig(config)

    this.logger.info('Updated domain configuration', {
      config,
      stats: this.toolRegistry.getStats(),
    })
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    try {
      // Initialize logger first
      await initializeLogger('mcp-server-v2')

      // Configure user emails
      this.userEmails = this.getConfiguredEmails()
      this.updateUserEmails(this.userEmails)

      this.logger.info('MCP Server v2 starting', {
        version: '2.0.0',
        userEmails: this.userEmails,
        emailCount: this.userEmails.length,
        architecture: 'domain-based',
        operation: 'server_startup',
      })

      console.error(
        `✅ Azure DevOps Bot v2.0 - Domain Architecture\n` +
          `📧 Configured for: ${this.userEmails.join(', ')}\n` +
          `🏗️  Domains: ${this.toolRegistry
            .getEnabledDomains()
            .map((d) => d.getName())
            .join(', ')}\n` +
          `🔧 Tools: ${this.toolRegistry.getStats().enabledTools} total`,
      )

      // Start background sync
      await this.syncService.startBackgroundSync(true)

      // Perform initial sync if needed
      const shouldSync = await this.syncService.shouldSync()
      if (shouldSync) {
        this.logger.info('Starting initial sync', {
          operation: 'initial_sync',
          syncRequired: true,
        })

        console.error('🔄 Performing initial detailed sync...')
        await this.syncService.performSyncDetailed()
      } else {
        this.logger.debug('Skipping initial sync', {
          operation: 'initial_sync',
          syncRequired: false,
        })
      }

      // Connect to MCP transport
      this.logger.info('MCP Server connecting to transport', {
        transport: 'stdio',
        operation: 'server_connect',
      })

      const transport = new StdioServerTransport()
      await this.server.connect(transport)

      this.logger.info('MCP Server v2 ready', {
        operation: 'server_ready',
        success: true,
        version: '2.0.0',
        totalTools: this.toolRegistry.getStats().enabledTools,
      })

      console.error('🚀 MCP Server v2 ready - Domain architecture active!')
    } catch (error) {
      this.logger.error('Failed to start MCP Server v2', {
        error: error instanceof Error ? error.message : String(error),
        operation: 'server_startup',
      })
      throw error
    }
  }

  /**
   * Stop the server gracefully
   */
  async stop(): Promise<void> {
    try {
      await this.syncService.close()
      this.logger.info('MCP Server v2 stopped', {
        operation: 'server_shutdown',
      })
    } catch (error) {
      this.logger.error('Error during server shutdown', {
        error: error instanceof Error ? error.message : String(error),
        operation: 'server_shutdown',
      })
    }
  }
}

// Handle graceful shutdown
const server = new AzureDevOpsMCPServerV2()

process.on('SIGINT', async () => {
  console.error('\n🛑 Shutting down MCP Server v2...')
  await server.stop()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.error('\n🛑 Shutting down MCP Server v2...')
  await server.stop()
  process.exit(0)
})

// Start the server
server.start().catch((error) => {
  console.error('💥 Failed to start MCP Server v2:', error)
  process.exit(1)
})
