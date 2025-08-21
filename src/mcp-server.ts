#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

import { SyncService } from './services/sync-service.js';
import { DatabaseService } from './services/database.js';
import { QueryEngine } from './services/query-engine.js';
import { AzureDevOpsClient } from './services/azure-devops.js';
import { AzureAuth } from './services/auth.js';

export class AzureDevOpsMCPServer {
  private server: Server;
  private syncService: SyncService;
  private db: DatabaseService;
  private queryEngine: QueryEngine;
  public userEmails: string[] = [];

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
      }
    );

    this.syncService = new SyncService();
    this.db = new DatabaseService();
    this.queryEngine = new QueryEngine(this.db);

    this.setupHandlers();
  }

  private getConfiguredEmails(): string[] {
    // Check for command line arguments first
    const args = process.argv.slice(2);
    const emailArg = args.find(arg => arg.startsWith('--emails='));
    
    if (!emailArg) {
      console.error('Error: Email addresses must be provided via --emails parameter');
      console.error('Example: pnpm mcp --emails=user1@domain.com,user2@domain.com');
      process.exit(1);
    }
    
    const emails = emailArg.split('=')[1].split(',').map(email => email.trim()).filter(email => email.length > 0);
    
    if (emails.length === 0) {
      console.error('Error: At least one valid email address must be provided');
      console.error('Example: pnpm mcp --emails=user1@domain.com,user2@domain.com');
      process.exit(1);
    }
    
    return emails;
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'get_work_items',
            description: 'Get all work items (stories, bugs, tasks) assigned to you from Azure DevOps',
            inputSchema: {
              type: 'object',
              properties: {
                filter: {
                  type: 'string',
                  description: 'Optional filter: "active", "open", "user-stories", "bugs", "tasks", or "all"',
                  enum: ['active', 'open', 'user-stories', 'bugs', 'tasks', 'all']
                }
              }
            }
          },
          {
            name: 'query_work',
            description: 'Query work items using natural language',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Natural language query about your work items'
                }
              },
              required: ['query']
            }
          },
          {
            name: 'sync_data',
            description: 'Manually sync all relevant work items (current assignments + completed work) from Azure DevOps',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'get_work_item_url',
            description: 'Get direct Azure DevOps URL for a work item',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'number',
                  description: 'Work item ID'
                }
              },
              required: ['id']
            }
          }
        ] satisfies Tool[]
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'get_work_items':
            return await this.handleGetWorkItems(args);
          
          case 'query_work':
            return await this.handleQueryWork(args);
          
          case 'sync_data':
            return await this.handleSyncData();
          
          case 'get_work_item_url':
            return await this.handleGetWorkItemUrl(args);
          
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };
      }
    });
  }

  private async handleGetWorkItems(args: any) {
    const filter = args?.filter || 'all';
    let items;

    switch (filter) {
      case 'active':
        items = await this.db.getWorkItemsByStateForUsers('Active', this.userEmails);
        break;
      case 'open':
        const newItems = await this.db.getWorkItemsByStateForUsers('New', this.userEmails);
        const activeItems = await this.db.getWorkItemsByStateForUsers('Active', this.userEmails);
        const inProgressItems = await this.db.getWorkItemsByStateForUsers('In Progress', this.userEmails);
        items = [...newItems, ...activeItems, ...inProgressItems];
        break;
      case 'user-stories':
        items = await this.db.getWorkItemsByTypeForUsers('User Story', this.userEmails);
        break;
      case 'bugs':
        items = await this.db.getWorkItemsByTypeForUsers('Bug', this.userEmails);
        break;
      case 'tasks':
        items = await this.db.getWorkItemsByTypeForUsers('Task', this.userEmails);
        break;
      default:
        items = await this.db.getWorkItemsForUsers(this.userEmails);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(items, null, 2)
        }
      ]
    };
  }

  private async handleQueryWork(args: any) {
    const query = args?.query;
    if (!query) {
      throw new Error('Query is required');
    }

    const response = await this.queryEngine.processQuery(query, this.userEmails);
    
    return {
      content: [
        {
          type: 'text',
          text: response
        }
      ]
    };
  }

  private async handleSyncData() {
    await this.syncService.performSync();
    
    return {
      content: [
        {
          type: 'text',
          text: 'Successfully synced work items from Azure DevOps'
        }
      ]
    };
  }

  private async handleGetWorkItemUrl(args: any) {
    const id = args?.id;
    if (!id) {
      throw new Error('Work item ID is required');
    }

    const url = `https://dev.azure.com/fwcdev/Customer%20Services%20Platform/_workitems/edit/${id}`;
    
    return {
      content: [
        {
          type: 'text',
          text: url
        }
      ]
    };
  }


  async start() {
    // Configure user emails for Azure DevOps queries
    this.userEmails = this.getConfiguredEmails();
    AzureDevOpsClient.setUserEmails(this.userEmails);
    
    console.error(`Configured to filter for work items assigned to: ${this.userEmails.join(', ')}`);

    // Start background sync (shows interval message)
    await this.syncService.startBackgroundSync();

    // Perform initial sync if needed
    const shouldSync = await this.syncService.shouldSync();
    if (shouldSync) {
      await this.syncService.performSync();
    }

    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }

  async stop() {
    await this.syncService.close();
  }
}

// Handle graceful shutdown
const server = new AzureDevOpsMCPServer();

process.on('SIGINT', async () => {
  await server.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await server.stop();
  process.exit(0);
});

// Start the server
server.start().catch(console.error);