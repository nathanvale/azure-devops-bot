#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

import { SyncService } from './sync-service.js';
import { DatabaseService } from './database.js';
import { QueryEngine } from './query-engine.js';

class AzureDevOpsMCPServer {
  private server: Server;
  private syncService: SyncService;
  private db: DatabaseService;
  private queryEngine: QueryEngine;

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

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'get_work_items',
            description: 'Get all work items assigned to you from Azure DevOps',
            inputSchema: {
              type: 'object',
              properties: {
                filter: {
                  type: 'string',
                  description: 'Optional filter: "active", "open", "user-stories", or "all"',
                  enum: ['active', 'open', 'user-stories', 'all']
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
            description: 'Manually sync work items from Azure DevOps',
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
        items = await this.db.getWorkItemsByState('Active');
        break;
      case 'open':
        const newItems = await this.db.getWorkItemsByState('New');
        const activeItems = await this.db.getWorkItemsByState('Active');
        const inProgressItems = await this.db.getWorkItemsByState('In Progress');
        items = [...newItems, ...activeItems, ...inProgressItems];
        break;
      case 'user-stories':
        items = await this.db.getWorkItemsByType('User Story');
        break;
      default:
        items = await this.db.getAllWorkItems();
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

    const response = await this.queryEngine.processQuery(query);
    
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
    // Perform initial sync if needed
    const shouldSync = await this.syncService.shouldSync();
    if (shouldSync) {
      await this.syncService.performSync();
    }

    // Start background sync
    await this.syncService.startBackgroundSync();

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