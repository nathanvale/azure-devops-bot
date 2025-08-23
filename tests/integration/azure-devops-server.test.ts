import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

import path from 'path'

import { http, HttpResponse } from 'msw'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

import { server } from '@/mocks/server'

import { TestMCPClient } from '../utils/mcp-client'
import {
  createWorkItemsResponse,
  createAzureWorkItem,
} from '../utils/test-helpers'

// Helper function to safely extract text content from tool results
function expectTextContent(result: CallToolResult): string {
  expect(result.content).toHaveLength(1)
  expect(result.content[0]).toBeDefined()
  expect(result.content[0]?.type).toBe('text')

  const firstContent = result.content[0]
  if (!firstContent || firstContent.type !== 'text') {
    throw new Error('Expected text content')
  }
  return firstContent.text
}

describe('Azure DevOps MCP Server Integration', () => {
  let client: TestMCPClient

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

      expect(tools.tools).toHaveLength(6)

      const toolNames = tools.tools.map((t) => t.name)
      expect(toolNames).toContain('get_work_items')
      expect(toolNames).toContain('query_work')
      expect(toolNames).toContain('sync_data')
      expect(toolNames).toContain('get_work_item_url')
      expect(toolNames).toContain('wit_add_work_item_comment')
      expect(toolNames).toContain('wit_link_work_item_to_pull_request')
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
      expect(result.content[0]).toBeDefined()
      expect(result.content[0]?.type).toBe('text')

      const firstContent = result.content[0]
      if (!firstContent || firstContent.type !== 'text') {
        throw new Error('Expected text content')
      }
      const workItems = JSON.parse(firstContent.text)
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
      const workItems = JSON.parse(expectTextContent(result))
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
      expect(expectTextContent(result)).toContain('Error')
    })
  })

  describe('query_work Tool', () => {
    it('should process natural language queries', async () => {
      const result = await client.callTool('query_work', {
        query: 'show me all active work items',
      })

      expect(result.content).toHaveLength(1)
      expect(result.content[0]?.type).toBe('text')
      expect(expectTextContent(result)).toBeTypeOf('string')
    })

    it('should require a query parameter', async () => {
      const result = await client.callTool('query_work', {})

      expect(result.content).toHaveLength(1)
      expect(expectTextContent(result)).toContain('Error')
      expect(expectTextContent(result)).toContain('Query is required')
    })
  })

  describe('get_work_item_url Tool', () => {
    it('should generate correct Azure DevOps URLs', async () => {
      const result = await client.callTool('get_work_item_url', { id: 1234 })

      expect(result.content).toHaveLength(1)
      expect(expectTextContent(result)).toContain('https://dev.azure.com')
      expect(expectTextContent(result)).toContain('1234')
    })

    it('should require an id parameter', async () => {
      const result = await client.callTool('get_work_item_url', {})

      expect(result.content).toHaveLength(1)
      expect(expectTextContent(result)).toContain('Error')
      expect(expectTextContent(result)).toContain('Work item ID is required')
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
      expect(expectTextContent(result)).toContain('Successfully synced')
    })
  })

  describe('wit_add_work_item_comment Tool', () => {
    it('should add comment successfully', async () => {
      // Mock successful Azure CLI response for adding comment
      server.use(
        http.post('https://management.azure.com/subscriptions/*', () =>
          HttpResponse.json({ text: 'Test comment' }, { status: 201 }),
        ),
      )

      // Mock sync response to show updated data
      server.use(
        http.get('https://dev.azure.com/*/wit/workitems', () =>
          HttpResponse.json(createWorkItemsResponse([])),
        ),
      )

      const result = await client.callTool('wit_add_work_item_comment', {
        id: 1234,
        comment: 'Test comment from integration test',
      })

      expect(result.content).toHaveLength(1)
      expect(result.content[0]?.type).toBe('text')
      expect(expectTextContent(result)).toContain(
        'Successfully added comment to work item 1234',
      )
    })

    it('should require work item ID', async () => {
      const result = await client.callTool('wit_add_work_item_comment', {
        comment: 'Test comment',
      })

      expect(result.content).toHaveLength(1)
      expect(expectTextContent(result)).toContain('Error')
      expect(expectTextContent(result)).toContain('Work item ID is required')
    })

    it('should require comment text', async () => {
      const result = await client.callTool('wit_add_work_item_comment', {
        id: 1234,
      })

      expect(result.content).toHaveLength(1)
      expect(expectTextContent(result)).toContain('Error')
      expect(expectTextContent(result)).toContain('Comment text is required')
    })

    it('should handle API errors gracefully', async () => {
      server.use(
        http.post('https://management.azure.com/*', () =>
          HttpResponse.json({ message: 'Unauthorized' }, { status: 401 }),
        ),
      )

      const result = await client.callTool('wit_add_work_item_comment', {
        id: 1234,
        comment: 'Test comment',
      })

      expect(result.content).toHaveLength(1)
      expect(expectTextContent(result)).toContain('Error')
    })
  })

  describe('wit_link_work_item_to_pull_request Tool', () => {
    it('should link work item to pull request successfully', async () => {
      // Mock successful Azure CLI response for linking
      server.use(
        http.patch('https://management.azure.com/subscriptions/*', () =>
          HttpResponse.json({ id: 1234 }, { status: 200 }),
        ),
      )

      const result = await client.callTool(
        'wit_link_work_item_to_pull_request',
        {
          id: 1234,
          pullRequestUrl: 'https://github.com/user/repo/pull/123',
        },
      )

      expect(result.content).toHaveLength(1)
      expect(result.content[0]?.type).toBe('text')
      expect(expectTextContent(result)).toContain(
        'Successfully linked work item 1234 to pull request',
      )
      expect(expectTextContent(result)).toContain(
        'https://github.com/user/repo/pull/123',
      )
    })

    it('should require work item ID', async () => {
      const result = await client.callTool(
        'wit_link_work_item_to_pull_request',
        {
          pullRequestUrl: 'https://github.com/user/repo/pull/123',
        },
      )

      expect(result.content).toHaveLength(1)
      expect(expectTextContent(result)).toContain('Error')
      expect(expectTextContent(result)).toContain('Work item ID is required')
    })

    it('should require pull request URL', async () => {
      const result = await client.callTool(
        'wit_link_work_item_to_pull_request',
        {
          id: 1234,
        },
      )

      expect(result.content).toHaveLength(1)
      expect(expectTextContent(result)).toContain('Error')
      expect(expectTextContent(result)).toContain(
        'Pull request URL is required',
      )
    })

    it('should handle API errors gracefully', async () => {
      server.use(
        http.patch('https://management.azure.com/*', () =>
          HttpResponse.json({ message: 'Conflict' }, { status: 409 }),
        ),
      )

      const result = await client.callTool(
        'wit_link_work_item_to_pull_request',
        {
          id: 1234,
          pullRequestUrl: 'https://github.com/user/repo/pull/123',
        },
      )

      expect(result.content).toHaveLength(1)
      expect(expectTextContent(result)).toContain('Error')
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
      expect(result.content[0]?.type).toBe('text')
    })
  })
})
