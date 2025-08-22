import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { createTestWorkItem } from '../../tests/utils/test-helpers'
import { DatabaseService } from '../services/database'
import { QueryEngine } from '../services/query-engine'
import { SyncService } from '../services/sync-service'
import { MockedFunction } from '../types/test-utils'

// Mock all dependencies
vi.mock('../services/sync-service')
vi.mock('../services/database')
vi.mock('../services/query-engine')
vi.mock('@modelcontextprotocol/sdk/server/index.js')

import { AzureDevOpsMCPServer } from '../mcp-server'

describe('AzureDevOpsMCPServer', () => {
  let server: any
  let mockSyncService: SyncService
  let mockDb: DatabaseService
  let mockQueryEngine: QueryEngine
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
    }) as any)

    // Mock the MCP Server
    mockMCPServer = {
      setRequestHandler: vi.fn(),
      connect: vi.fn(),
      close: vi.fn(),
    }
    vi.mocked(Server).mockImplementation(() => mockMCPServer)

    // Create server instance
    server = new AzureDevOpsMCPServer()

    // Set user emails for testing
    server.userEmails = ['test@example.com', 'test2@example.com']

    // Get mocked dependencies
    mockSyncService = server.syncService
    mockDb = server.db
    mockQueryEngine = server.queryEngine

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

    mockQueryEngine.processQuery = vi
      .fn()
      .mockResolvedValue('Mock query response')
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
      expect(QueryEngine).toHaveBeenCalledWith(expect.any(Object))
    })

    it('should setup request handlers', () => {
      expect(mockMCPServer.setRequestHandler).toHaveBeenCalledTimes(2)
    })
  })

  describe('tool registration', () => {
    it('should register ListToolsRequestSchema handler', () => {
      const calls = mockMCPServer.setRequestHandler.mock.calls
      const listToolsCall = calls.find((call: any) => {
        const schema = call[0]
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
    let listToolsHandler: Function

    beforeEach(() => {
      const calls = mockMCPServer.setRequestHandler.mock.calls
      // The first call should be the ListToolsRequestSchema handler
      listToolsHandler = calls[0][1]
    })

    it('should return all available tools', async () => {
      const result = await listToolsHandler()

      expect(result.tools).toHaveLength(4)

      const toolNames = result.tools.map((tool: any) => tool.name)
      expect(toolNames).toContain('get_work_items')
      expect(toolNames).toContain('query_work')
      expect(toolNames).toContain('sync_data')
      expect(toolNames).toContain('get_work_item_url')
    })

    it('should have properly defined tool schemas', async () => {
      const result = await listToolsHandler()

      result.tools.forEach((tool: any) => {
        expect(tool).toHaveProperty('name')
        expect(tool).toHaveProperty('description')
        expect(tool).toHaveProperty('inputSchema')
        expect(tool.inputSchema).toHaveProperty('type', 'object')
      })
    })

    it('should define get_work_items tool correctly', async () => {
      const result = await listToolsHandler()
      const tool = result.tools.find((t: any) => t.name === 'get_work_items')

      expect(tool.description).toContain('Get all work items')
      expect(tool.inputSchema.properties).toHaveProperty('filter')
      expect(tool.inputSchema.properties.filter.enum).toEqual([
        'active',
        'open',
        'user-stories',
        'bugs',
        'tasks',
        'all',
      ])
    })

    it('should define query_work tool correctly', async () => {
      const result = await listToolsHandler()
      const tool = result.tools.find((t: any) => t.name === 'query_work')

      expect(tool.description).toContain(
        'Query work items using natural language',
      )
      expect(tool.inputSchema.properties).toHaveProperty('query')
      expect(tool.inputSchema.required).toContain('query')
    })

    it('should define sync_data tool correctly', async () => {
      const result = await listToolsHandler()
      const tool = result.tools.find((t: any) => t.name === 'sync_data')

      expect(tool.description).toContain(
        'Manually sync all work items with detailed metadata',
      )
      expect(tool.inputSchema.properties).toHaveProperty('concurrency')
    })

    it('should define get_work_item_url tool correctly', async () => {
      const result = await listToolsHandler()
      const tool = result.tools.find((t: any) => t.name === 'get_work_item_url')

      expect(tool.description).toContain('Get direct Azure DevOps URL')
      expect(tool.inputSchema.properties).toHaveProperty('id')
      expect(tool.inputSchema.properties.id.type).toBe('number')
      expect(tool.inputSchema.required).toContain('id')
    })
  })

  describe('call tool handler', () => {
    let callToolHandler: Function

    beforeEach(() => {
      const calls = mockMCPServer.setRequestHandler.mock.calls
      // The second call should be the CallToolRequestSchema handler
      callToolHandler = calls[1][1]
    })

    describe('get_work_items tool', () => {
      it('should handle "active" filter', async () => {
        const mockItems = [createTestWorkItem({ state: 'Active' })]
        mockDb.getWorkItemsByStateForUsers.mockResolvedValue(mockItems)

        const result = await callToolHandler({
          params: {
            name: 'get_work_items',
            arguments: { filter: 'active' },
          },
        })

        expect(mockDb.getWorkItemsByStateForUsers).toHaveBeenCalledWith(
          'Active',
          ['test@example.com', 'test2@example.com'],
        )
        expect(result.content[0].type).toBe('text')
        const parsedResult = JSON.parse(result.content[0].text)
        expect(parsedResult).toHaveLength(1)
        expect(parsedResult[0]).toMatchObject({
          id: mockItems[0].id,
          azureId: mockItems[0].azureId,
          title: mockItems[0].title,
          state: mockItems[0].state,
          type: mockItems[0].type,
          assignedTo: mockItems[0].assignedTo,
          areaPath: mockItems[0].areaPath,
          iterationPath: mockItems[0].iterationPath,
          priority: mockItems[0].priority,
          severity: mockItems[0].severity,
          description: mockItems[0].description,
        })
      })

      it('should handle "open" filter', async () => {
        const newItems = [createTestWorkItem({ state: 'New' })]
        const activeItems = [createTestWorkItem({ state: 'Active' })]
        const inProgressItems = [createTestWorkItem({ state: 'In Progress' })]

        mockDb.getWorkItemsByStateForUsers.mockImplementation(
          (state: string, emails: string[]) => {
            if (state === 'New') return Promise.resolve(newItems)
            if (state === 'Active') return Promise.resolve(activeItems)
            if (state === 'In Progress') return Promise.resolve(inProgressItems)
            return Promise.resolve([])
          },
        )

        const result = await callToolHandler({
          params: {
            name: 'get_work_items',
            arguments: { filter: 'open' },
          },
        })

        expect(mockDb.getWorkItemsByStateForUsers).toHaveBeenCalledWith('New', [
          'test@example.com',
          'test2@example.com',
        ])
        expect(mockDb.getWorkItemsByStateForUsers).toHaveBeenCalledWith(
          'Active',
          ['test@example.com', 'test2@example.com'],
        )
        expect(mockDb.getWorkItemsByStateForUsers).toHaveBeenCalledWith(
          'In Progress',
          ['test@example.com', 'test2@example.com'],
        )

        const returnedItems = JSON.parse(result.content[0].text)
        expect(returnedItems).toHaveLength(3)
      })

      it('should handle "user-stories" filter', async () => {
        const userStories = [createTestWorkItem({ type: 'User Story' })]
        mockDb.getWorkItemsByTypeForUsers.mockResolvedValue(userStories)

        const result = await callToolHandler({
          params: {
            name: 'get_work_items',
            arguments: { filter: 'user-stories' },
          },
        })

        expect(mockDb.getWorkItemsByTypeForUsers).toHaveBeenCalledWith(
          'User Story',
          ['test@example.com', 'test2@example.com'],
        )
        const parsedResult = JSON.parse(result.content[0].text)
        expect(parsedResult).toHaveLength(1)
        expect(parsedResult[0]).toMatchObject({
          id: userStories[0].id,
          azureId: userStories[0].azureId,
          title: userStories[0].title,
          state: userStories[0].state,
          type: userStories[0].type,
          assignedTo: userStories[0].assignedTo,
          areaPath: userStories[0].areaPath,
          iterationPath: userStories[0].iterationPath,
          priority: userStories[0].priority,
          severity: userStories[0].severity,
          description: userStories[0].description,
        })
      })

      it('should handle default/all filter', async () => {
        const allItems = [createTestWorkItem()]
        mockDb.getWorkItemsForUsers.mockResolvedValue(allItems)

        const result = await callToolHandler({
          params: {
            name: 'get_work_items',
            arguments: { filter: 'all' },
          },
        })

        expect(mockDb.getWorkItemsForUsers).toHaveBeenCalledWith([
          'test@example.com',
          'test2@example.com',
        ])
        const parsedResult = JSON.parse(result.content[0].text)
        expect(parsedResult).toHaveLength(1)
        expect(parsedResult[0]).toMatchObject({
          id: allItems[0].id,
          azureId: allItems[0].azureId,
          title: allItems[0].title,
          state: allItems[0].state,
          type: allItems[0].type,
          assignedTo: allItems[0].assignedTo,
          areaPath: allItems[0].areaPath,
          iterationPath: allItems[0].iterationPath,
          priority: allItems[0].priority,
          severity: allItems[0].severity,
          description: allItems[0].description,
        })
      })

      it('should handle "bugs" filter', async () => {
        const bugs = [createTestWorkItem({ type: 'Bug' })]
        mockDb.getWorkItemsByTypeForUsers.mockResolvedValue(bugs)

        const result = await callToolHandler({
          params: {
            name: 'get_work_items',
            arguments: { filter: 'bugs' },
          },
        })

        expect(mockDb.getWorkItemsByTypeForUsers).toHaveBeenCalledWith('Bug', [
          'test@example.com',
          'test2@example.com',
        ])
        expect(result.content[0].text).toBe(JSON.stringify(bugs, null, 2))
      })

      it('should handle "tasks" filter', async () => {
        const tasks = [createTestWorkItem({ type: 'Task' })]
        mockDb.getWorkItemsByTypeForUsers.mockResolvedValue(tasks)

        const result = await callToolHandler({
          params: {
            name: 'get_work_items',
            arguments: { filter: 'tasks' },
          },
        })

        expect(mockDb.getWorkItemsByTypeForUsers).toHaveBeenCalledWith('Task', [
          'test@example.com',
          'test2@example.com',
        ])
        expect(result.content[0].text).toBe(JSON.stringify(tasks, null, 2))
      })

      it('should handle missing filter argument', async () => {
        const allItems = [createTestWorkItem()]
        mockDb.getWorkItemsForUsers.mockResolvedValue(allItems)

        const result = await callToolHandler({
          params: {
            name: 'get_work_items',
            arguments: {},
          },
        })

        expect(mockDb.getWorkItemsForUsers).toHaveBeenCalledWith([
          'test@example.com',
          'test2@example.com',
        ])
      })
    })

    describe('query_work tool', () => {
      it('should process natural language queries', async () => {
        const activeItems = [{ id: 1, title: 'Active Item', state: 'Active' }]
        const inProgressItems = [
          { id: 2, title: 'In Progress Item', state: 'In Progress' },
        ]
        const expectedItems = [...activeItems, ...inProgressItems]

        mockDb.getWorkItemsByStateForUsers.mockImplementation(
          (state: string) => {
            if (state === 'Active') return Promise.resolve(activeItems)
            if (state === 'In Progress') return Promise.resolve(inProgressItems)
            return Promise.resolve([])
          },
        )

        const result = await callToolHandler({
          params: {
            name: 'query_work',
            arguments: { query: 'show me my active work' },
          },
        })

        expect(mockDb.getWorkItemsByStateForUsers).toHaveBeenCalledWith(
          'Active',
          ['test@example.com', 'test2@example.com'],
        )
        expect(mockDb.getWorkItemsByStateForUsers).toHaveBeenCalledWith(
          'In Progress',
          ['test@example.com', 'test2@example.com'],
        )
        expect(result.content[0].text).toBe(
          JSON.stringify(expectedItems, null, 2),
        )
      })

      it('should handle missing query argument', async () => {
        const result = await callToolHandler({
          params: {
            name: 'query_work',
            arguments: {},
          },
        })

        expect(result.content[0].text).toContain('Error')
        expect(result.content[0].text).toContain('Query is required')
      })

      it('should handle database errors', async () => {
        mockDb.getWorkItemsForUsers.mockRejectedValue(
          new Error('Database failed'),
        )

        const result = await callToolHandler({
          params: {
            name: 'query_work',
            arguments: { query: 'test query' },
          },
        })

        expect(result.content[0].text).toContain('Error')
        expect(result.content[0].text).toContain('Database failed')
      })
    })

    describe('sync_data tool', () => {
      it('should perform manual sync', async () => {
        mockSyncService.performSyncDetailed.mockResolvedValue(undefined)

        const result = await callToolHandler({
          params: {
            name: 'sync_data',
            arguments: {},
          },
        })

        expect(mockSyncService.performSyncDetailed).toHaveBeenCalledTimes(1)
        expect(result.content[0].text).toBe(
          'Successfully synced work items with detailed metadata from Azure DevOps (concurrency: 5)',
        )
      })

      it('should handle sync errors', async () => {
        mockSyncService.performSyncDetailed.mockRejectedValue(
          new Error('Sync failed'),
        )

        const result = await callToolHandler({
          params: {
            name: 'sync_data',
            arguments: {},
          },
        })

        expect(result.content[0].text).toContain('Error')
        expect(result.content[0].text).toContain('Sync failed')
      })
    })

    describe('get_work_item_url tool', () => {
      it('should generate work item URL', async () => {
        const result = await callToolHandler({
          params: {
            name: 'get_work_item_url',
            arguments: { id: 1234 },
          },
        })

        expect(result.content[0].text).toBe(
          'https://dev.azure.com/fwcdev/Customer%20Services%20Platform/_workitems/edit/1234',
        )
      })

      it('should handle missing id argument', async () => {
        const result = await callToolHandler({
          params: {
            name: 'get_work_item_url',
            arguments: {},
          },
        })

        expect(result.content[0].text).toContain('Error')
        expect(result.content[0].text).toContain('Work item ID is required')
      })

      it('should handle different work item IDs', async () => {
        const result = await callToolHandler({
          params: {
            name: 'get_work_item_url',
            arguments: { id: 5678 },
          },
        })

        expect(result.content[0].text).toContain('5678')
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
            name: 'get_work_items',
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
