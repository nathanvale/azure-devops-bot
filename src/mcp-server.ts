#!/usr/bin/env node

import type { Tool } from '@modelcontextprotocol/sdk/types.js'

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

import { AzureDevOpsClient } from './services/azure-devops.js'
import { DatabaseService } from './services/database.js'
import { SyncService } from './services/sync-service.js'

export class AzureDevOpsMCPServer {
  private server: Server
  private syncService: SyncService
  private db: DatabaseService
  public userEmails: string[] = []

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

  async start() {
    // Configure user emails for Azure DevOps queries
    this.userEmails = this.getConfiguredEmails()
    AzureDevOpsClient.setUserEmails(this.userEmails)

    console.error(
      `Configured to filter for work items assigned to: ${this.userEmails.join(', ')}`,
    )

    // Start background sync using detailed sync (shows interval message)
    await this.syncService.startBackgroundSync(true)

    // Perform initial detailed sync if needed
    const shouldSync = await this.syncService.shouldSync()
    if (shouldSync) {
      console.error('Performing initial detailed sync...')
      await this.syncService.performSyncDetailed()
    }

    const transport = new StdioServerTransport()
    await this.server.connect(transport)
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