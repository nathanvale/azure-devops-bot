import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { createTestWorkItem } from '../../tests/utils/test-helpers'
import { DatabaseService } from '../services/database'
import { SyncService } from '../services/sync-service'

// Mock all dependencies
vi.mock('../services/sync-service')
vi.mock('../services/database')
vi.mock('@modelcontextprotocol/sdk/server/index.js')

import { AzureDevOpsMCPServer } from '../mcp-server'

interface MCPTool {
  name: string
  description?: string
  inputSchema?: unknown
}

describe('AzureDevOpsMCPServer', () => {
  let server: AzureDevOpsMCPServer
  let mockSyncService: any
  let mockDb: any
  let mockMCPServer: any
  let originalArgv: string[]

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()

    // Mock process.argv to include email parameter
    originalArgv = process.argv
    process.argv = [
      'node',
      'script.js',
      '--emails=test@example.com,test2@example.com',
    ]

    // Mock process.exit to prevent test termination
    vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called')
    }) as typeof process.exit)

    // Mock the MCP Server
    mockMCPServer = {
      setRequestHandler: vi.fn(),
      connect: vi.fn(),
      close: vi.fn(),
    }
    vi.mocked(Server).mockImplementation(() => mockMCPServer as any)

    // Create server instance
    server = new AzureDevOpsMCPServer()

    // Set user emails for testing
    server.userEmails = ['test@example.com', 'test2@example.com']

    // Get mocked dependencies using type assertion to access private properties
    mockSyncService = (server as any).syncService
    mockDb = (server as any).db

    // Setup default mock implementations
    mockSyncService.shouldSync = vi.fn().mockResolvedValue(false)
    mockSyncService.performSync = vi.fn().mockResolvedValue(undefined)
    mockSyncService.performSyncDetailed = vi.fn().mockResolvedValue(undefined)
    mockSyncService.startBackgroundSync = vi.fn().mockResolvedValue(undefined)
    mockSyncService.close = vi.fn().mockResolvedValue(undefined)

    mockDb.getWorkItemsByState = vi.fn().mockResolvedValue([])
    mockDb.getWorkItemsByType = vi.fn().mockResolvedValue([])
    mockDb.getAllWorkItems = vi.fn().mockResolvedValue([])
    mockDb.getWorkItemsForUsers = vi.fn().mockResolvedValue([])
    mockDb.getWorkItemsByStateForUsers = vi.fn().mockResolvedValue([])
    mockDb.getWorkItemsByTypeForUsers = vi.fn().mockResolvedValue([])
    mockDb.getWorkItemById = vi.fn().mockResolvedValue(null)
    mockDb.getWorkItemsByIds = vi.fn().mockResolvedValue([])
    mockDb.getWorkItemComments = vi.fn().mockResolvedValue([])
    mockDb.getWorkItemsByIteration = vi.fn().mockResolvedValue([])
  })

  afterEach(() => {
    // Restore original process.argv
    process.argv = originalArgv
    vi.restoreAllMocks()
  })

  describe('constructor', () => {
    it('should initialize MCP server with correct configuration', () => {
      expect(Server).toHaveBeenCalledWith(
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
    })

    it('should create service instances', () => {
      expect(SyncService).toHaveBeenCalledTimes(1)
      expect(DatabaseService).toHaveBeenCalledTimes(1)
    })

    it('should setup request handlers', () => {
      expect(mockMCPServer.setRequestHandler).toHaveBeenCalledTimes(2)
    })
  })

  describe('tool registration', () => {
    it('should register ListToolsRequestSchema handler', () => {
      const calls = mockMCPServer.setRequestHandler.mock.calls
      const listToolsCall = calls.find((call: unknown[]) => {
        const schema = call[0] as any
        // Check if this is a Zod schema with the correct structure
        return schema && schema._def && schema._def.typeName === 'ZodObject'
      })

      expect(listToolsCall).toBeDefined()
    })

    it('should register CallToolRequestSchema handler', () => {
      const calls = mockMCPServer.setRequestHandler.mock.calls

      expect(calls).toHaveLength(2)
      expect(calls[0]).toBeDefined()
      expect(calls[1]).toBeDefined()
    })
  })

  describe('list tools handler', () => {
    let listToolsHandler: (...args: any[]) => any

    beforeEach(() => {
      const calls = mockMCPServer.setRequestHandler.mock.calls
      // The first call should be the ListToolsRequestSchema handler
      listToolsHandler = calls[0][1]
    })

    it('should return all available tools', async () => {
      const result = await listToolsHandler()

      expect(result.tools).toHaveLength(8)

      const toolNames = result.tools.map((tool: MCPTool) => tool.name)
      expect(toolNames).toContain('wit_force_sync_work_items')
      expect(toolNames).toContain('wit_my_work_items')
      expect(toolNames).toContain('wit_get_work_item')
      expect(toolNames).toContain('wit_get_work_items_batch_by_ids')
      expect(toolNames).toContain('wit_list_work_item_comments')
      expect(toolNames).toContain('wit_get_work_items_for_iteration')
      expect(toolNames).toContain('wit_add_work_item_comment')
      expect(toolNames).toContain('wit_link_work_item_to_pull_request')
    })

    it('should have properly defined tool schemas', async () => {
      const result = await listToolsHandler()

      result.tools.forEach((tool: MCPTool) => {
        expect(tool).toHaveProperty('name')
        expect(tool).toHaveProperty('description')
        expect(tool).toHaveProperty('inputSchema')
        expect(tool.inputSchema).toHaveProperty('type', 'object')
      })
    })

    it('should define wit_force_sync_work_items tool correctly', async () => {
      const result = await listToolsHandler()
      const tool = result.tools.find(
        (t: MCPTool) => t.name === 'wit_force_sync_work_items',
      )

      expect(tool.description).toContain(
        'Force sync all work items from Azure DevOps',
      )
      expect(tool.inputSchema.properties).toHaveProperty('concurrency')
    })

    it('should define wit_my_work_items tool correctly', async () => {
      const result = await listToolsHandler()
      const tool = result.tools.find(
        (t: MCPTool) => t.name === 'wit_my_work_items',
      )

      expect(tool.description).toContain(
        'Retrieve a list of work items relevant to the authenticated user',
      )
      expect(tool.inputSchema.properties).toHaveProperty('filter')
      expect(tool.inputSchema.properties.filter.enum).toEqual([
        'active',
        'open',
        'closed',
        'all',
      ])
    })

    it('should define wit_get_work_item tool correctly', async () => {
      const result = await listToolsHandler()
      const tool = result.tools.find(
        (t: MCPTool) => t.name === 'wit_get_work_item',
      )

      expect(tool.description).toContain('Get a single work item by ID')
      expect(tool.inputSchema.properties).toHaveProperty('id')
      expect(tool.inputSchema.properties.id.type).toBe('number')
      expect(tool.inputSchema.required).toContain('id')
    })
  })

  describe('call tool handler', () => {
    let callToolHandler: (...args: any[]) => any

    beforeEach(() => {
      const calls = mockMCPServer.setRequestHandler.mock.calls
      // The second call should be the CallToolRequestSchema handler
      callToolHandler = calls[1][1]
    })

    describe('wit_force_sync_work_items tool', () => {
      it('should perform detailed sync', async () => {
        mockSyncService.performSyncDetailed.mockResolvedValue(undefined)

        const result = await callToolHandler({
          params: {
            name: 'wit_force_sync_work_items',
            arguments: {},
          },
        })

        expect(mockSyncService.performSyncDetailed).toHaveBeenCalledWith(5)
        expect(result.content[0].text).toBe(
          'Successfully synced work items with detailed metadata from Azure DevOps (concurrency: 5)',
        )
      })

      it('should handle custom concurrency', async () => {
        mockSyncService.performSyncDetailed.mockResolvedValue(undefined)

        await callToolHandler({
          params: {
            name: 'wit_force_sync_work_items',
            arguments: { concurrency: 10 },
          },
        })

        expect(mockSyncService.performSyncDetailed).toHaveBeenCalledWith(10)
      })
    })

    describe('wit_my_work_items tool', () => {
      it('should handle "active" filter', async () => {
        const mockItems = [createTestWorkItem({ state: 'Active' })]
        mockDb.getWorkItemsByStateForUsers.mockResolvedValue(mockItems)

        const result = await callToolHandler({
          params: {
            name: 'wit_my_work_items',
            arguments: { filter: 'active' },
          },
        })

        expect(mockDb.getWorkItemsByStateForUsers).toHaveBeenCalledWith(
          'Active',
          ['test@example.com', 'test2@example.com'],
        )
        expect(result.content[0].text).toBe(JSON.stringify(mockItems, null, 2))
      })

      it('should handle default filter', async () => {
        const allItems = [createTestWorkItem()]
        mockDb.getWorkItemsForUsers.mockResolvedValue(allItems)

        const result = await callToolHandler({
          params: {
            name: 'wit_my_work_items',
            arguments: {},
          },
        })

        expect(mockDb.getWorkItemsForUsers).toHaveBeenCalledWith([
          'test@example.com',
          'test2@example.com',
        ])
        expect(result.content[0].text).toBe(JSON.stringify(allItems, null, 2))
      })
    })

    describe('wit_get_work_item tool', () => {
      it('should get work item by id', async () => {
        const mockItem = createTestWorkItem({ id: 123 })
        mockDb.getWorkItemById.mockResolvedValue(mockItem)

        const result = await callToolHandler({
          params: {
            name: 'wit_get_work_item',
            arguments: { id: 123 },
          },
        })

        expect(mockDb.getWorkItemById).toHaveBeenCalledWith(123)
        expect(result.content[0].text).toBe(JSON.stringify(mockItem, null, 2))
      })

      it('should handle work item not found', async () => {
        mockDb.getWorkItemById.mockResolvedValue(null)

        const result = await callToolHandler({
          params: {
            name: 'wit_get_work_item',
            arguments: { id: 999 },
          },
        })

        expect(result.content[0].text).toContain('Error')
        expect(result.content[0].text).toContain('Work item 999 not found')
      })

      it('should handle missing id argument', async () => {
        const result = await callToolHandler({
          params: {
            name: 'wit_get_work_item',
            arguments: {},
          },
        })

        expect(result.content[0].text).toContain('Error')
        expect(result.content[0].text).toContain('Work item ID is required')
      })
    })

    describe('wit_get_work_items_batch_by_ids tool', () => {
      it('should get multiple work items by ids', async () => {
        const mockItems = [
          createTestWorkItem({ id: 1 }),
          createTestWorkItem({ id: 2 }),
        ]
        mockDb.getWorkItemsByIds.mockResolvedValue(mockItems)

        const result = await callToolHandler({
          params: {
            name: 'wit_get_work_items_batch_by_ids',
            arguments: { ids: [1, 2] },
          },
        })

        expect(mockDb.getWorkItemsByIds).toHaveBeenCalledWith([1, 2])
        expect(result.content[0].text).toBe(JSON.stringify(mockItems, null, 2))
      })

      it('should handle empty ids array', async () => {
        const result = await callToolHandler({
          params: {
            name: 'wit_get_work_items_batch_by_ids',
            arguments: { ids: [] },
          },
        })

        expect(result.content[0].text).toContain('Error')
        expect(result.content[0].text).toContain(
          'Work item IDs array is required',
        )
      })
    })

    describe('wit_list_work_item_comments tool', () => {
      it('should get comments for work item', async () => {
        const mockComments = [{ id: 1, text: 'Test comment' }]
        mockDb.getWorkItemComments.mockResolvedValue(mockComments)

        const result = await callToolHandler({
          params: {
            name: 'wit_list_work_item_comments',
            arguments: { id: 123 },
          },
        })

        expect(mockDb.getWorkItemComments).toHaveBeenCalledWith(123)
        expect(result.content[0].text).toBe(
          JSON.stringify(mockComments, null, 2),
        )
      })
    })

    describe('error handling', () => {
      it('should handle unknown tool names', async () => {
        const result = await callToolHandler({
          params: {
            name: 'unknown_tool',
            arguments: {},
          },
        })

        expect(result.content[0].text).toContain('Error')
        expect(result.content[0].text).toContain('Unknown tool: unknown_tool')
      })

      it('should wrap all errors in proper response format', async () => {
        mockDb.getWorkItemsForUsers.mockRejectedValue(
          new Error('Database error'),
        )

        const result = await callToolHandler({
          params: {
            name: 'wit_my_work_items',
            arguments: {},
          },
        })

        expect(result.content).toHaveLength(1)
        expect(result.content[0].type).toBe('text')
        expect(result.content[0].text).toContain('Error')
      })
    })
  })

  describe('start method', () => {
    it('should check if sync is needed', async () => {
      mockSyncService.shouldSync.mockResolvedValue(true)

      await server.start()

      expect(mockSyncService.shouldSync).toHaveBeenCalledTimes(1)
    })

    it('should perform initial sync when needed', async () => {
      mockSyncService.shouldSync.mockResolvedValue(true)

      await server.start()

      expect(mockSyncService.performSyncDetailed).toHaveBeenCalledTimes(1)
    })

    it('should skip initial sync when not needed', async () => {
      mockSyncService.shouldSync.mockResolvedValue(false)

      await server.start()

      expect(mockSyncService.performSyncDetailed).not.toHaveBeenCalled()
    })

    it('should start background sync', async () => {
      await server.start()

      expect(mockSyncService.startBackgroundSync).toHaveBeenCalledTimes(1)
    })

    it('should connect to MCP transport', async () => {
      await server.start()

      expect(mockMCPServer.connect).toHaveBeenCalledTimes(1)
    })
  })

  describe('stop method', () => {
    it('should close sync service', async () => {
      await server.stop()

      expect(mockSyncService.close).toHaveBeenCalledTimes(1)
    })

    it('should handle close errors gracefully', async () => {
      mockSyncService.close.mockRejectedValue(new Error('Close failed'))

      await expect(server.stop()).rejects.toThrow('Close failed')
    })
  })
})