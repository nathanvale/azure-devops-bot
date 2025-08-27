#!/usr/bin/env node

import * as dotenv from 'dotenv'

// Load environment variables from .env file
dotenv.config()

import type { Tool } from '@modelcontextprotocol/sdk/types.js'

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

import { initializeLogger, LoggerFactory } from './utils/logger.js'
import { AzureDevOpsClient } from './services/azure-devops.js'
import { DatabaseService } from './services/database.js'
import { SyncService } from './services/sync-service.js'
import { SyncMetrics } from './utils/sync-metrics.js'

export class AzureDevOpsMCPServer {
  private server: Server
  private syncService: SyncService
  private db: DatabaseService
  private syncMetrics: SyncMetrics
  public userEmails: string[] = []
  private logger = LoggerFactory.createForComponent('mcp-server')

  constructor() {
    this.server = new Server(
      {
        name: 'azure-devops-bot',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      },
    )

    this.syncService = new SyncService()
    this.db = new DatabaseService()
    this.syncMetrics = new SyncMetrics(this.db.client)

    this.setupHandlers()
  }

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

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'wit_force_sync_work_items',
            description:
              'Force sync all work items from Azure DevOps with complete metadata',
            inputSchema: {
              type: 'object',
              properties: {
                concurrency: {
                  type: 'number',
                  description:
                    'Optional concurrency limit for parallel fetching (default: 5)',
                  minimum: 1,
                  maximum: 20,
                },
              },
            },
          },
          {
            name: 'wit_my_work_items',
            description:
              'Retrieve a list of work items relevant to the authenticated user',
            inputSchema: {
              type: 'object',
              properties: {
                filter: {
                  type: 'string',
                  description:
                    'Optional filter: "active", "open", "closed", or "all"',
                  enum: ['active', 'open', 'closed', 'all'],
                },
              },
            },
          },
          {
            name: 'wit_get_work_item',
            description: 'Get a single work item by ID with complete details',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'number',
                  description: 'Work item ID',
                },
              },
              required: ['id'],
            },
          },
          {
            name: 'wit_get_work_items_batch_by_ids',
            description: 'Retrieve a list of work items by IDs in batch',
            inputSchema: {
              type: 'object',
              properties: {
                ids: {
                  type: 'array',
                  items: { type: 'number' },
                  description: 'Array of work item IDs',
                },
              },
              required: ['ids'],
            },
          },
          {
            name: 'wit_list_work_item_comments',
            description: 'Retrieve a list of comments for a work item by ID',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'number',
                  description: 'Work item ID',
                },
              },
              required: ['id'],
            },
          },
          {
            name: 'wit_get_work_items_for_iteration',
            description:
              'Retrieve a list of work items for a specified iteration',
            inputSchema: {
              type: 'object',
              properties: {
                iterationPath: {
                  type: 'string',
                  description:
                    'Iteration path (e.g., "Customer Services Platform\\Sprint 1")',
                },
              },
              required: ['iterationPath'],
            },
          },
          {
            name: 'wit_add_work_item_comment',
            description: 'Add a comment to a work item by ID',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'number',
                  description: 'Work item ID',
                },
                comment: {
                  type: 'string',
                  description: 'Comment text to add',
                },
              },
              required: ['id', 'comment'],
            },
          },
          {
            name: 'wit_link_work_item_to_pull_request',
            description: 'Link a single work item to an existing pull request',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'number',
                  description: 'Work item ID',
                },
                pullRequestUrl: {
                  type: 'string',
                  description: 'Full URL to the pull request',
                },
              },
              required: ['id', 'pullRequestUrl'],
            },
          },
          {
            name: 'wit_sync_status',
            description: 'Get comprehensive sync status, metrics, and error reports',
            inputSchema: {
              type: 'object',
              properties: {
                includeHistory: {
                  type: 'boolean',
                  description: 'Include recent sync history (default: false)',
                },
                historyLimit: {
                  type: 'number',
                  description: 'Number of recent syncs to include (default: 5)',
                  minimum: 1,
                  maximum: 20,
                },
              },
            },
          },
          {
            name: 'wit_get_work_items_by_assignee',
            description: 'Get work items filtered by assignee name',
            inputSchema: {
              type: 'object',
              properties: {
                assigneeName: {
                  type: 'string',
                  description: 'Assignee name or email to filter by',
                },
              },
              required: ['assigneeName'],
            },
          },
          {
            name: 'wit_get_current_sprint_items',
            description: 'Get work items for the current sprint (auto-detected)',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'wit_get_work_items_by_state',
            description: 'Get work items filtered by state',
            inputSchema: {
              type: 'object',
              properties: {
                state: {
                  type: 'string',
                  description: 'Work item state (e.g., "Active", "New", "Closed")',
                },
              },
              required: ['state'],
            },
          },
          {
            name: 'wit_get_team_work_items',
            description: 'Get work items filtered by team (area path)',
            inputSchema: {
              type: 'object',
              properties: {
                teamPath: {
                  type: 'string',
                  description: 'Team area path to filter by',
                },
              },
              required: ['teamPath'],
            },
          },
          {
            name: 'wit_get_work_item_with_relations',
            description: 'Get a single work item with all relationships and links',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'number',
                  description: 'Work item ID',
                },
              },
              required: ['id'],
            },
          },
        ] satisfies Tool[],
      }
    })

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params

      try {
        switch (name) {
          case 'wit_force_sync_work_items':
            return await this.handleForceSyncWorkItems(args)

          case 'wit_my_work_items':
            return await this.handleMyWorkItems(args)

          case 'wit_get_work_item':
            return await this.handleGetWorkItem(args)

          case 'wit_get_work_items_batch_by_ids':
            return await this.handleGetWorkItemsBatchByIds(args)

          case 'wit_list_work_item_comments':
            return await this.handleListWorkItemComments(args)

          case 'wit_get_work_items_for_iteration':
            return await this.handleGetWorkItemsForIteration(args)

          case 'wit_add_work_item_comment':
            return await this.handleAddWorkItemComment(args)

          case 'wit_link_work_item_to_pull_request':
            return await this.handleLinkWorkItemToPullRequest(args)

          case 'wit_sync_status':
            return await this.handleSyncStatus(args)

          case 'wit_get_work_items_by_assignee':
            return await this.handleGetWorkItemsByAssignee(args)

          case 'wit_get_current_sprint_items':
            return await this.handleGetCurrentSprintItems(args)

          case 'wit_get_work_items_by_state':
            return await this.handleGetWorkItemsByState(args)

          case 'wit_get_team_work_items':
            return await this.handleGetTeamWorkItems(args)

          case 'wit_get_work_item_with_relations':
            return await this.handleGetWorkItemWithRelations(args)

          default:
            throw new Error(`Unknown tool: ${name}`)
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        }
      }
    })
  }

  private async handleForceSyncWorkItems(args?: { concurrency?: number }) {
    const concurrency = args?.concurrency || 5
    await this.syncService.performSyncDetailed(concurrency)

    return {
      content: [
        {
          type: 'text',
          text: `Successfully synced work items with detailed metadata from Azure DevOps (concurrency: ${concurrency})`,
        },
      ],
    }
  }

  private async handleMyWorkItems(args?: { filter?: string }) {
    const filter = args?.filter || 'all'
    let items

    switch (filter) {
      case 'active':
        items = await this.db.getWorkItemsByStateForUsers(
          'Active',
          this.userEmails,
        )
        break
      case 'open': {
        const newItems = await this.db.getWorkItemsByStateForUsers(
          'New',
          this.userEmails,
        )
        const activeItems = await this.db.getWorkItemsByStateForUsers(
          'Active',
          this.userEmails,
        )
        const inProgressItems = await this.db.getWorkItemsByStateForUsers(
          'In Progress',
          this.userEmails,
        )
        items = [...newItems, ...activeItems, ...inProgressItems]
        break
      }
      case 'closed':
        items = await this.db.getWorkItemsByStateForUsers(
          'Closed',
          this.userEmails,
        )
        break
      default:
        items = await this.db.getWorkItemsForUsers(this.userEmails)
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(items, null, 2),
        },
      ],
    }
  }

  private async handleGetWorkItem(args?: { id?: number }) {
    const id = args?.id
    if (!id) {
      throw new Error('Work item ID is required')
    }

    const item = await this.db.getWorkItemById(id)
    if (!item) {
      throw new Error(`Work item ${id} not found`)
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(item, null, 2),
        },
      ],
    }
  }

  private async handleGetWorkItemsBatchByIds(args?: { ids?: number[] }) {
    const ids = args?.ids
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      throw new Error('Work item IDs array is required')
    }

    const items = await this.db.getWorkItemsByIds(ids)

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(items, null, 2),
        },
      ],
    }
  }

  private async handleListWorkItemComments(args?: { id?: number }) {
    const id = args?.id
    if (!id) {
      throw new Error('Work item ID is required')
    }

    const comments = await this.db.getWorkItemComments(id)

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(comments, null, 2),
        },
      ],
    }
  }

  private async handleGetWorkItemsForIteration(args?: {
    iterationPath?: string
  }) {
    const iterationPath = args?.iterationPath
    if (!iterationPath) {
      throw new Error('Iteration path is required')
    }

    const items = await this.db.getWorkItemsByIteration(iterationPath)

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(items, null, 2),
        },
      ],
    }
  }

  private async handleAddWorkItemComment(args?: {
    id?: number
    comment?: string
  }) {
    const id = args?.id
    const comment = args?.comment
    if (!id) {
      throw new Error('Work item ID is required')
    }
    if (!comment) {
      throw new Error('Comment text is required')
    }

    const azureClient = new AzureDevOpsClient()
    await azureClient.addWorkItemComment(id, comment)

    // Force sync to get the new comment
    await this.syncService.performSyncDetailed()

    return {
      content: [
        {
          type: 'text',
          text: `Successfully added comment to work item ${id}`,
        },
      ],
    }
  }

  private async handleLinkWorkItemToPullRequest(args?: {
    id?: number
    pullRequestUrl?: string
  }) {
    const id = args?.id
    const pullRequestUrl = args?.pullRequestUrl
    if (!id) {
      throw new Error('Work item ID is required')
    }
    if (!pullRequestUrl) {
      throw new Error('Pull request URL is required')
    }

    const azureClient = new AzureDevOpsClient()
    await azureClient.linkWorkItemToPullRequest(id, pullRequestUrl)

    return {
      content: [
        {
          type: 'text',
          text: `Successfully linked work item ${id} to pull request: ${pullRequestUrl}`,
        },
      ],
    }
  }

  private async handleSyncStatus(args?: {
    includeHistory?: boolean
    historyLimit?: number
  }) {
    const includeHistory = args?.includeHistory || false
    const historyLimit = args?.historyLimit || 5

    try {
      // Get summary statistics
      const summary = await this.syncMetrics.getSyncSummary()
      
      // Get latest sync
      const latestSync = await this.syncMetrics.getLatestSync()
      
      let statusText = `# Azure DevOps Sync Status\n\n`

      // Current Status Summary
      statusText += `## Current Status\n`
      statusText += `- **Total Syncs**: ${summary.totalSyncs}\n`
      statusText += `- **Average Success Rate**: ${summary.avgSuccessRate}%\n`
      statusText += `- **Average Duration**: ${summary.avgDuration}ms\n`
      statusText += `- **Last Sync**: ${summary.lastSyncTime ? summary.lastSyncTime.toISOString() : 'Never'}\n`
      statusText += `- **Recent Failures (24h)**: ${summary.recentFailures}\n\n`

      // Latest Sync Details
      if (latestSync) {
        statusText += `## Latest Sync Details\n`
        statusText += `- **Start Time**: ${latestSync.startTime.toISOString()}\n`
        statusText += `- **Duration**: ${latestSync.durationMs}ms\n`
        statusText += `- **Type**: ${latestSync.syncType}\n`
        statusText += `- **Status**: ${latestSync.status.toUpperCase()}\n`
        statusText += `- **Total Attempted**: ${latestSync.totalAttempted}\n`
        statusText += `- **Total Succeeded**: ${latestSync.totalSucceeded}\n`
        statusText += `- **Total Failed**: ${latestSync.totalFailed}\n`
        statusText += `- **Success Rate**: ${latestSync.successRate}%\n`
        statusText += `- **Total Errors**: ${latestSync.totalErrors}\n\n`

        // Error Breakdown
        if (latestSync.totalErrors > 0) {
          statusText += `### Error Breakdown\n`
          const errorTypes = Object.entries(latestSync.errorsByType)
            .sort(([,a], [,b]) => b - a)
          
          for (const [errorType, count] of errorTypes) {
            statusText += `- **${errorType}**: ${count} occurrences\n`
          }
          statusText += `\n`
        }
      } else {
        statusText += `## Latest Sync Details\n`
        statusText += `No sync data available.\n\n`
      }

      // Error Trends
      if (Object.keys(summary.errorTrends).length > 0) {
        statusText += `## Error Trends (24h)\n`
        const sortedTrends = Object.entries(summary.errorTrends)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 10)
        
        for (const [errorType, count] of sortedTrends) {
          statusText += `- **${errorType}**: ${count} occurrences\n`
        }
        statusText += `\n`
      }

      // Recent History
      if (includeHistory) {
        const recentSyncs = await this.syncMetrics.getRecentSyncs(historyLimit)
        
        if (recentSyncs.length > 0) {
          statusText += `## Recent Sync History (${recentSyncs.length})\n\n`
          statusText += `| Start Time | Duration | Type | Status | Success Rate | Errors |\n`
          statusText += `|------------|----------|------|--------|--------------|--------|\n`
          
          for (const sync of recentSyncs) {
            const startTime = sync.startTime.toISOString().substring(0, 19).replace('T', ' ')
            const duration = `${Math.round(sync.durationMs / 1000)}s`
            const status = sync.status.charAt(0).toUpperCase() + sync.status.slice(1)
            
            statusText += `| ${startTime} | ${duration} | ${sync.syncType} | ${status} | ${sync.successRate}% | ${sync.totalErrors} |\n`
          }
          statusText += `\n`
        }
      }

      // Recommendations
      statusText += `## Recommendations\n`
      
      if (summary.avgSuccessRate < 95) {
        statusText += `⚠️  **Low Success Rate**: Current average success rate is ${summary.avgSuccessRate}%. Consider investigating error patterns.\n`
      }
      
      if (summary.recentFailures > 3) {
        statusText += `⚠️  **High Failure Count**: ${summary.recentFailures} failed syncs in the last 24 hours. Check PAT token and network connectivity.\n`
      }
      
      if (summary.avgDuration > 60000) {
        statusText += `⚠️  **Slow Syncs**: Average sync duration is ${Math.round(summary.avgDuration / 1000)}s. Consider reducing concurrency or checking network performance.\n`
      }
      
      const topError = Object.entries(summary.errorTrends).sort(([,a], [,b]) => b - a)[0]
      if (topError && topError[1] > 5) {
        statusText += `⚠️  **Recurring Error**: ${topError[0]} has occurred ${topError[1]} times recently. This may need attention.\n`
      }
      
      if (summary.avgSuccessRate >= 95 && summary.recentFailures <= 1 && summary.avgDuration <= 60000) {
        statusText += `✅ **System Healthy**: Sync performance is within acceptable parameters.\n`
      }

      return {
        content: [
          {
            type: 'text',
            text: statusText,
          },
        ],
      }

    } catch (error) {
      this.logger.error('Failed to get sync status', {
        component: 'mcp-server',
        error: error instanceof Error ? error.message : String(error),
        operation: 'sync_status'
      })

      return {
        content: [
          {
            type: 'text',
            text: `Error retrieving sync status: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      }
    }
  }

  private async handleGetWorkItemsByAssignee(args?: { assigneeName?: string }) {
    const assigneeName = args?.assigneeName
    if (!assigneeName) {
      throw new Error('Assignee name is required')
    }

    const items = await this.db.getWorkItemsByAssignee(assigneeName)

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(items, null, 2),
        },
      ],
    }
  }

  private async handleGetCurrentSprintItems(args?: {}) {
    const items = await this.db.getCurrentSprintItems()

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(items, null, 2),
        },
      ],
    }
  }

  private async handleGetWorkItemsByState(args?: { state?: string }) {
    const state = args?.state
    if (!state) {
      throw new Error('State is required')
    }

    const items = await this.db.getWorkItemsByState(state)

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(items, null, 2),
        },
      ],
    }
  }

  private async handleGetTeamWorkItems(args?: { teamPath?: string }) {
    const teamPath = args?.teamPath
    if (!teamPath) {
      throw new Error('Team path is required')
    }

    const items = await this.db.getWorkItemsByTeam(teamPath)

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(items, null, 2),
        },
      ],
    }
  }

  private async handleGetWorkItemWithRelations(args?: { id?: number }) {
    const id = args?.id
    if (!id) {
      throw new Error('Work item ID is required')
    }

    const item = await this.db.getWorkItemWithFullRelations(id)
    if (!item) {
      throw new Error(`Work item ${id} not found`)
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(item, null, 2),
        },
      ],
    }
  }

  async start() {
    // Initialize logger first
    await initializeLogger('mcp-server')
    
    // Configure user emails for Azure DevOps queries
    this.userEmails = this.getConfiguredEmails()
    AzureDevOpsClient.setUserEmails(this.userEmails)

    this.logger.info('MCP Server starting', {
      userEmails: this.userEmails,
      emailCount: this.userEmails.length,
      operation: 'server_startup'
    })

    console.error(`Configured to filter for work items assigned to: ${this.userEmails.join(', ')}`)

    // Start background sync using detailed sync (shows interval message)
    await this.syncService.startBackgroundSync(true)

    // Perform initial detailed sync if needed
    const shouldSync = await this.syncService.shouldSync()
    if (shouldSync) {
      this.logger.info('Starting initial sync', {
        operation: 'initial_sync',
        syncRequired: true
      })
      
      console.error('Performing initial detailed sync...')
      await this.syncService.performSyncDetailed()
    } else {
      this.logger.debug('Skipping initial sync', {
        operation: 'initial_sync', 
        syncRequired: false
      })
    }

    this.logger.info('MCP Server connecting to transport', {
      transport: 'stdio',
      operation: 'server_connect'
    })

    const transport = new StdioServerTransport()
    await this.server.connect(transport)
    
    this.logger.info('MCP Server ready', {
      operation: 'server_ready',
      success: true
    })
  }

  async stop() {
    await this.syncService.close()
  }
}

// Handle graceful shutdown
const server = new AzureDevOpsMCPServer()

process.on('SIGINT', async () => {
  await server.stop()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await server.stop()
  process.exit(0)
})

// Start the server
server.start().catch(console.error)
