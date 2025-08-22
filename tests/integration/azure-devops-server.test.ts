import path from 'path'

import { http, HttpResponse } from 'msw'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

import { server } from '@/mocks/server'

import { TestMCPClient } from '../utils/mcp-client'
import {
  createWorkItemsResponse,
  createAzureWorkItem,
} from '../utils/test-helpers'

describe('Azure DevOps MCP Server Integration', () => {
  let client: TestMCPClient
  const serverPath = path.resolve(__dirname, '../../dist/mcp-server.js')

  beforeAll(async () => {
    client = new TestMCPClient()
    // Note: In real tests, we'd need to build the server first
    // For now, we'll test against the TypeScript file directly
    const tsServerPath = path.resolve(__dirname, '../../src/mcp-server.ts')
    await client.connect('tsx', [tsServerPath])
  }, 30000)

  afterAll(async () => {
    if (client) {
      await client.close()
    }
  })

  describe('Server Connection', () => {
    it('should connect successfully', () => {
      expect(client.isConnected()).toBe(true)
    })

    it('should have a valid process ID', () => {
      expect(client.getProcessId()).toBeTypeOf('number')
    })
  })

  describe('Tool Discovery', () => {
    it('should list all available tools', async () => {
      const tools = await client.listTools()

      expect(tools.tools).toHaveLength(4)

      const toolNames = tools.tools.map((t) => t.name)
      expect(toolNames).toContain('get_work_items')
      expect(toolNames).toContain('query_work')
      expect(toolNames).toContain('sync_data')
      expect(toolNames).toContain('get_work_item_url')
    })

    it('should have properly defined tool schemas', async () => {
      const tools = await client.listTools()

      const getWorkItemsTool = tools.tools.find(
        (t) => t.name === 'get_work_items',
      )
      expect(getWorkItemsTool).toBeDefined()
      expect(getWorkItemsTool?.description).toContain('Get all work items')
      expect(getWorkItemsTool?.inputSchema).toBeDefined()
      expect(getWorkItemsTool?.inputSchema.type).toBe('object')
    })
  })

  describe('get_work_items Tool', () => {
    it('should get all work items successfully', async () => {
      // Mock the Azure DevOps API response
      const mockWorkItems = [
        createAzureWorkItem({ id: 1234 }),
        createAzureWorkItem({ id: 5678 }),
      ]

      server.use(
        http.get('https://dev.azure.com/*/wit/workitems', () =>
          HttpResponse.json(createWorkItemsResponse(mockWorkItems)),
        ),
      )

      const result = await client.callTool('get_work_items')

      expect(result.content).toHaveLength(1)
      expect(result.content[0].type).toBe('text')

      const workItems = JSON.parse(result.content[0].text)
      expect(Array.isArray(workItems)).toBe(true)
      expect(workItems).toHaveLength(2)
    })

    it('should filter work items by state', async () => {
      const activeWorkItem = createAzureWorkItem({
        id: 1234,
        fields: {
          ...createAzureWorkItem().fields,
          'System.State': 'Active',
        },
      })

      server.use(
        http.get('https://dev.azure.com/*/wit/workitems', () =>
          HttpResponse.json(createWorkItemsResponse([activeWorkItem])),
        ),
      )

      const result = await client.callTool('get_work_items', {
        filter: 'active',
      })

      expect(result.content).toHaveLength(1)
      const workItems = JSON.parse(result.content[0].text)
      expect(workItems).toHaveLength(1)
      expect(workItems[0].fields['System.State']).toBe('Active')
    })

    it('should handle API errors gracefully', async () => {
      server.use(
        http.get('https://dev.azure.com/*', () =>
          HttpResponse.json({ message: 'Unauthorized' }, { status: 401 }),
        ),
      )

      const result = await client.callTool('get_work_items')

      expect(result.content).toHaveLength(1)
      expect(result.content[0].text).toContain('Error')
    })
  })

  describe('query_work Tool', () => {
    it('should process natural language queries', async () => {
      const result = await client.callTool('query_work', {
        query: 'show me all active work items',
      })

      expect(result.content).toHaveLength(1)
      expect(result.content[0].type).toBe('text')
      expect(result.content[0].text).toBeTypeOf('string')
    })

    it('should require a query parameter', async () => {
      const result = await client.callTool('query_work', {})

      expect(result.content).toHaveLength(1)
      expect(result.content[0].text).toContain('Error')
      expect(result.content[0].text).toContain('Query is required')
    })
  })

  describe('get_work_item_url Tool', () => {
    it('should generate correct Azure DevOps URLs', async () => {
      const result = await client.callTool('get_work_item_url', { id: 1234 })

      expect(result.content).toHaveLength(1)
      expect(result.content[0].text).toContain('https://dev.azure.com')
      expect(result.content[0].text).toContain('1234')
    })

    it('should require an id parameter', async () => {
      const result = await client.callTool('get_work_item_url', {})

      expect(result.content).toHaveLength(1)
      expect(result.content[0].text).toContain('Error')
      expect(result.content[0].text).toContain('Work item ID is required')
    })
  })

  describe('sync_data Tool', () => {
    it('should sync data successfully', async () => {
      // Mock successful sync
      server.use(
        http.get('https://dev.azure.com/*', () =>
          HttpResponse.json(createWorkItemsResponse([])),
        ),
      )

      const result = await client.callTool('sync_data')

      expect(result.content).toHaveLength(1)
      expect(result.content[0].text).toContain('Successfully synced')
    })
  })

  describe('Error Handling', () => {
    it('should handle unknown tool calls', async () => {
      try {
        await client.callTool('unknown_tool')
        expect.fail('Should have thrown an error')
      } catch (error) {
        expect(error).toBeDefined()
        expect(String(error)).toContain('unknown_tool')
      }
    })

    it('should handle malformed arguments', async () => {
      const result = await client.callTool('get_work_items', {
        filter: 'invalid_filter',
      })

      // Should not throw, but might return filtered results or handle gracefully
      expect(result.content).toHaveLength(1)
      expect(result.content[0].type).toBe('text')
    })
  })
})
