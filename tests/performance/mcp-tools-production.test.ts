import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

import path from 'path'

import { describe, it, expect, beforeAll, afterAll } from 'vitest'

import { TestMCPClient } from '../../../tests/utils/mcp-client'

/**
 * MCP Tools Production Validation Tests
 * 
 * These tests validate all 8 MCP tools with real Azure DevOps data from the Customer Services Platform project.
 * They require a valid AZURE_DEVOPS_PAT environment variable and test against actual work items.
 * 
 * Requirements:
 * - AZURE_DEVOPS_PAT: Personal Access Token with work items read & write permissions
 * - Organization: fwcdev  
 * - Project: Customer Services Platform
 * - Real work item data (1,056+ items expected)
 * 
 * Performance Requirements:
 * - Queries ≤ 100ms response time
 * - JSON responses must be valid MCP protocol format
 * - No mocking - all tests use real Azure DevOps connections
 */

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

// Helper function to parse JSON response safely
function expectValidJSON(result: CallToolResult): any {
  const textContent = expectTextContent(result)
  try {
    return JSON.parse(textContent)
  } catch (error) {
    throw new Error(`Invalid JSON response: ${textContent}`)
  }
}

describe('MCP Tools Production Validation', () => {
  let client: TestMCPClient
  let realWorkItemIds: number[] = []
  let testUserEmail: string

  // Helper function to connect to MCP client if not already connected
  async function ensureClientConnected(): Promise<void> {
    if (!client || !client.isConnected()) {
      if (client) {
        await client.close()
      }
      client = new TestMCPClient()
      const tsServerPath = path.resolve(__dirname, '../../../src/mcp-server.ts')
      // Use the full npx path to avoid shell resolution issues
      const command = '/Users/nathanvale/.nvm/versions/node/v20.18.0/bin/npx'
      const args = ['tsx', tsServerPath, `--emails=${testUserEmail}`]
      console.log('DEBUG: Connecting with command:', command, ', args:', args)
      await client.connect(command, args)
      
      // Give the MCP server a moment to fully initialize
      console.log('DEBUG: Waiting for server to fully initialize...')
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }

  const hasProductionPAT = !!process.env.AZURE_DEVOPS_PAT
  const timeout = 30000 // 30 seconds for real API calls
  
  console.log('DEBUG: Production PAT check:', {
    hasProductionPAT,
    envPAT: process.env.AZURE_DEVOPS_PAT ? 'SET' : 'NOT_SET',
    length: process.env.AZURE_DEVOPS_PAT?.length || 0
  })

  beforeAll(async () => {
    // Only set up testUserEmail - connection happens in individual tests if needed
    testUserEmail = process.env.TEST_USER_EMAIL || 'test@fwcdev.com'
  })

  afterAll(async () => {
    if (client) {
      await client.close()
    }
  })

  describe('MCP Server Connection and Tool Discovery', () => {
    it.skipIf(!hasProductionPAT)('should connect successfully to MCP server', async () => {
      await ensureClientConnected()
      expect(client.isConnected()).toBe(true)
      expect(client.getProcessId()).toBeTypeOf('number')
    }, timeout)

    it.skipIf(!hasProductionPAT)('should list all 8 expected MCP tools', async () => {
      await ensureClientConnected()
      const tools = await client.listTools()
      
      expect(tools.tools).toHaveLength(8)
      
      const expectedTools = [
        'wit_force_sync_work_items',
        'wit_my_work_items', 
        'wit_get_work_item',
        'wit_get_work_items_batch_by_ids',
        'wit_list_work_item_comments',
        'wit_get_work_items_for_iteration',
        'wit_add_work_item_comment',
        'wit_link_work_item_to_pull_request'
      ]
      
      const toolNames = tools.tools.map(t => t.name).sort()
      expect(toolNames).toEqual(expectedTools.sort())
      
      console.log(`✅ Found all 8 expected MCP tools`)
    })

    it.skipIf(!hasProductionPAT)('should have properly defined tool schemas', async () => {
      const tools = await client.listTools()
      
      tools.tools.forEach(tool => {
        expect(tool.name).toBeTypeOf('string')
        expect(tool.description).toBeTypeOf('string')
        expect(tool.inputSchema).toBeDefined()
        expect(tool.inputSchema.type).toBe('object')
      })
    })
  })

  describe('wit_force_sync_work_items Tool', () => {
    it.skipIf(!hasProductionPAT)('should force sync all work items from production', async () => {
      await ensureClientConnected()
      const startTime = Date.now()
      
      const result = await client.callTool('wit_force_sync_work_items', {
        concurrency: 10 // Higher concurrency for faster testing
      })
      
      const duration = Date.now() - startTime
      const textContent = expectTextContent(result)
      
      expect(textContent).toContain('Successfully synced work items')
      expect(textContent).toContain('concurrency: 10')
      
      // Sync should complete within 30 seconds
      expect(duration).toBeLessThan(30000)
      
      console.log(`✅ Force sync completed in ${duration}ms`)
    }, timeout)

    it.skipIf(!hasProductionPAT)('should handle concurrency parameter validation', async () => {
      await ensureClientConnected()
      const result = await client.callTool('wit_force_sync_work_items', {
        concurrency: 5
      })
      
      const textContent = expectTextContent(result)
      expect(textContent).toContain('Successfully synced work items')
      expect(textContent).toContain('concurrency: 5')
    })
  })

  describe('wit_my_work_items Tool', () => {
    it.skipIf(!hasProductionPAT)('should retrieve work items with "all" filter', async () => {
      await ensureClientConnected()
      const startTime = Date.now()
      
      const result = await client.callTool('wit_my_work_items', {
        filter: 'all'
      })
      
      const duration = Date.now() - startTime
      const workItems = expectValidJSON(result)
      
      expect(Array.isArray(workItems)).toBe(true)
      expect(workItems.length).toBeGreaterThan(0)
      
      // Store real work item IDs for other tests
      realWorkItemIds = workItems.map((item: any) => item.id).slice(0, 10)
      
      // Performance validation
      expect(duration).toBeLessThan(100)
      
      // Validate work item structure
      const firstItem = workItems[0]
      expect(firstItem).toHaveProperty('id')
      expect(firstItem).toHaveProperty('title')
      expect(firstItem).toHaveProperty('state')
      expect(typeof firstItem.id).toBe('number')
      expect(typeof firstItem.title).toBe('string')
      
      console.log(`✅ Retrieved ${workItems.length} work items in ${duration}ms`)
    })

    it.skipIf(!hasProductionPAT)('should filter work items by "active" state', async () => {
      await ensureClientConnected()
      const result = await client.callTool('wit_my_work_items', {
        filter: 'active'
      })
      
      const workItems = expectValidJSON(result)
      expect(Array.isArray(workItems)).toBe(true)
      
      // Validate all items are Active state
      if (workItems.length > 0) {
        workItems.forEach((item: any) => {
          expect(item.state).toBe('Active')
        })
      }
    })

    it.skipIf(!hasProductionPAT)('should filter work items by "open" state', async () => {
      await ensureClientConnected()
      const result = await client.callTool('wit_my_work_items', {
        filter: 'open'
      })
      
      const workItems = expectValidJSON(result)
      expect(Array.isArray(workItems)).toBe(true)
      
      // Validate all items are open states (New, Active, In Progress)
      if (workItems.length > 0) {
        const validOpenStates = ['New', 'Active', 'In Progress']
        workItems.forEach((item: any) => {
          expect(validOpenStates).toContain(item.state)
        })
      }
    })

    it.skipIf(!hasProductionPAT)('should filter work items by "closed" state', async () => {
      await ensureClientConnected()
      const result = await client.callTool('wit_my_work_items', {
        filter: 'closed'
      })
      
      const workItems = expectValidJSON(result)
      expect(Array.isArray(workItems)).toBe(true)
      
      // Validate all items are Closed state
      if (workItems.length > 0) {
        workItems.forEach((item: any) => {
          expect(item.state).toBe('Closed')
        })
      }
    })
  })

  describe('wit_get_work_item Tool', () => {
    it.skipIf(!hasProductionPAT)('should get single work item by ID with complete details', async () => {
      await ensureClientConnected()
      // Ensure we have work item IDs
      if (realWorkItemIds.length === 0) {
        const result = await client.callTool('wit_my_work_items', { filter: 'all' })
        const workItems = expectValidJSON(result)
        realWorkItemIds = workItems.map((item: any) => item.id).slice(0, 5)
      }
      
      expect(realWorkItemIds.length).toBeGreaterThan(0)
      
      const workItemId = realWorkItemIds[0]
      const startTime = Date.now()
      
      const result = await client.callTool('wit_get_work_item', {
        id: workItemId
      })
      
      const duration = Date.now() - startTime
      const workItem = expectValidJSON(result)
      
      // Performance validation
      expect(duration).toBeLessThan(100)
      
      // Validate work item structure
      expect(workItem.id).toBe(workItemId)
      expect(workItem).toHaveProperty('title')
      expect(workItem).toHaveProperty('state')
      expect(workItem).toHaveProperty('type')
      expect(workItem).toHaveProperty('assignedTo')
      
      console.log(`✅ Retrieved work item ${workItemId} in ${duration}ms`)
    })

    it.skipIf(!hasProductionPAT)('should handle invalid work item ID', async () => {
      await ensureClientConnected()
      const result = await client.callTool('wit_get_work_item', {
        id: 999999999 // Invalid ID
      })
      
      const textContent = expectTextContent(result)
      expect(textContent).toContain('Error')
      expect(textContent).toContain('not found')
    })

    it.skipIf(!hasProductionPAT)('should require work item ID parameter', async () => {
      await ensureClientConnected()
      try {
        await client.callTool('wit_get_work_item', {})
        expect.fail('Should have thrown an error')
      } catch (error) {
        expect(String(error)).toContain('required')
      }
    })
  })

  describe('wit_get_work_items_batch_by_ids Tool', () => {
    it.skipIf(!hasProductionPAT)('should retrieve multiple work items by IDs in batch', async () => {
      await ensureClientConnected()
      // Ensure we have work item IDs
      if (realWorkItemIds.length === 0) {
        const result = await client.callTool('wit_my_work_items', { filter: 'all' })
        const workItems = expectValidJSON(result)
        realWorkItemIds = workItems.map((item: any) => item.id).slice(0, 5)
      }
      
      const testIds = realWorkItemIds.slice(0, 3)
      const startTime = Date.now()
      
      const result = await client.callTool('wit_get_work_items_batch_by_ids', {
        ids: testIds
      })
      
      const duration = Date.now() - startTime
      const workItems = expectValidJSON(result)
      
      // Performance validation
      expect(duration).toBeLessThan(100)
      
      // Validate batch response
      expect(Array.isArray(workItems)).toBe(true)
      expect(workItems.length).toBe(testIds.length)
      
      // Validate each work item
      workItems.forEach((item: any, index: number) => {
        expect(item.id).toBe(testIds[index])
        expect(item).toHaveProperty('title')
        expect(item).toHaveProperty('state')
      })
      
      console.log(`✅ Batch retrieved ${workItems.length} work items in ${duration}ms`)
    })

    it.skipIf(!hasProductionPAT)('should require ids array parameter', async () => {
      await ensureClientConnected()
      const result = await client.callTool('wit_get_work_items_batch_by_ids', {})
      
      const textContent = expectTextContent(result)
      expect(textContent).toContain('Error')
      expect(textContent).toContain('required')
    })

    it.skipIf(!hasProductionPAT)('should handle empty ids array', async () => {
      await ensureClientConnected()
      const result = await client.callTool('wit_get_work_items_batch_by_ids', {
        ids: []
      })
      
      const textContent = expectTextContent(result)
      expect(textContent).toContain('Error')
      expect(textContent).toContain('required')
    })
  })

  describe('wit_list_work_item_comments Tool', () => {
    it.skipIf(!hasProductionPAT)('should retrieve comments for work item', async () => {
      await ensureClientConnected()
      // Get a work item to test comments
      if (realWorkItemIds.length === 0) {
        const result = await client.callTool('wit_my_work_items', { filter: 'all' })
        const workItems = expectValidJSON(result)
        realWorkItemIds = workItems.map((item: any) => item.id).slice(0, 5)
      }
      
      const workItemId = realWorkItemIds[0]
      const startTime = Date.now()
      
      const result = await client.callTool('wit_list_work_item_comments', {
        id: workItemId
      })
      
      const duration = Date.now() - startTime
      const comments = expectValidJSON(result)
      
      // Performance validation
      expect(duration).toBeLessThan(100)
      
      // Validate comments structure
      expect(Array.isArray(comments)).toBe(true)
      
      // Comments may be empty, but structure should be valid
      if (comments.length > 0) {
        const firstComment = comments[0]
        expect(firstComment).toHaveProperty('text')
        expect(firstComment).toHaveProperty('createdDate')
      }
      
      console.log(`✅ Retrieved ${comments.length} comments for work item ${workItemId} in ${duration}ms`)
    })

    it.skipIf(!hasProductionPAT)('should require work item ID parameter', async () => {
      await ensureClientConnected()
      const result = await client.callTool('wit_list_work_item_comments', {})
      
      const textContent = expectTextContent(result)
      expect(textContent).toContain('Error')
      expect(textContent).toContain('required')
    })
  })

  describe('wit_get_work_items_for_iteration Tool', () => {
    it.skipIf(!hasProductionPAT)('should retrieve work items for specific iteration', async () => {
      await ensureClientConnected()
      // Test with a common iteration path
      const iterationPath = 'Customer Services Platform\\Sprint 1'
      const startTime = Date.now()
      
      const result = await client.callTool('wit_get_work_items_for_iteration', {
        iterationPath: iterationPath
      })
      
      const duration = Date.now() - startTime
      
      // This might return an error if the iteration doesn't exist, which is fine
      const textContent = expectTextContent(result)
      
      // Performance validation
      expect(duration).toBeLessThan(100)
      
      try {
        const workItems = JSON.parse(textContent)
        if (Array.isArray(workItems)) {
          console.log(`✅ Retrieved ${workItems.length} work items for iteration "${iterationPath}" in ${duration}ms`)
        }
      } catch {
        // If it's not JSON, it might be an error message, which is also valid
        console.log(`⚠️ Iteration "${iterationPath}" may not exist or be accessible`)
      }
    })

    it.skipIf(!hasProductionPAT)('should require iteration path parameter', async () => {
      await ensureClientConnected()
      const result = await client.callTool('wit_get_work_items_for_iteration', {})
      
      const textContent = expectTextContent(result)
      expect(textContent).toContain('Error')
      expect(textContent).toContain('required')
    })
  })

  describe('wit_add_work_item_comment Tool', () => {
    it.skipIf(!hasProductionPAT)('should add comment to work item successfully', async () => {
      await ensureClientConnected()
      // Get a work item to add comment to
      if (realWorkItemIds.length === 0) {
        const result = await client.callTool('wit_my_work_items', { filter: 'all' })
        const workItems = expectValidJSON(result)
        realWorkItemIds = workItems.map((item: any) => item.id).slice(0, 5)
      }
      
      const workItemId = realWorkItemIds[0]
      const testComment = `Test comment from MCP production validation - ${new Date().toISOString()}`
      
      const startTime = Date.now()
      
      const result = await client.callTool('wit_add_work_item_comment', {
        id: workItemId,
        comment: testComment
      })
      
      const duration = Date.now() - startTime
      const textContent = expectTextContent(result)
      
      // Performance validation (this involves API write + sync)
      expect(duration).toBeLessThan(10000) // 10 seconds for write operation
      
      expect(textContent).toContain('Successfully added comment')
      expect(textContent).toContain(workItemId.toString())
      
      console.log(`✅ Added comment to work item ${workItemId} in ${duration}ms`)
    }, timeout)

    it.skipIf(!hasProductionPAT)('should require work item ID parameter', async () => {
      await ensureClientConnected()
      const result = await client.callTool('wit_add_work_item_comment', {
        comment: 'Test comment'
      })
      
      const textContent = expectTextContent(result)
      expect(textContent).toContain('Error')
      expect(textContent).toContain('Work item ID is required')
    })

    it.skipIf(!hasProductionPAT)('should require comment text parameter', async () => {
      await ensureClientConnected()
      const result = await client.callTool('wit_add_work_item_comment', {
        id: 1234
      })
      
      const textContent = expectTextContent(result)
      expect(textContent).toContain('Error')
      expect(textContent).toContain('Comment text is required')
    })
  })

  describe('wit_link_work_item_to_pull_request Tool', () => {
    it.skipIf(!hasProductionPAT)('should link work item to pull request successfully', async () => {
      await ensureClientConnected()
      // Get a work item to link
      if (realWorkItemIds.length === 0) {
        const result = await client.callTool('wit_my_work_items', { filter: 'all' })
        const workItems = expectValidJSON(result)
        realWorkItemIds = workItems.map((item: any) => item.id).slice(0, 5)
      }
      
      const workItemId = realWorkItemIds[0]
      const testPRUrl = 'https://github.com/fwcdev/test-repo/pull/123'
      
      const startTime = Date.now()
      
      const result = await client.callTool('wit_link_work_item_to_pull_request', {
        id: workItemId,
        pullRequestUrl: testPRUrl
      })
      
      const duration = Date.now() - startTime
      const textContent = expectTextContent(result)
      
      // Performance validation
      expect(duration).toBeLessThan(5000) // 5 seconds for link operation
      
      expect(textContent).toContain('Successfully linked work item')
      expect(textContent).toContain(workItemId.toString())
      expect(textContent).toContain(testPRUrl)
      
      console.log(`✅ Linked work item ${workItemId} to PR in ${duration}ms`)
    }, timeout)

    it.skipIf(!hasProductionPAT)('should require work item ID parameter', async () => {
      await ensureClientConnected()
      const result = await client.callTool('wit_link_work_item_to_pull_request', {
        pullRequestUrl: 'https://github.com/test/test/pull/123'
      })
      
      const textContent = expectTextContent(result)
      expect(textContent).toContain('Error')
      expect(textContent).toContain('Work item ID is required')
    })

    it.skipIf(!hasProductionPAT)('should require pull request URL parameter', async () => {
      await ensureClientConnected()
      const result = await client.callTool('wit_link_work_item_to_pull_request', {
        id: 1234
      })
      
      const textContent = expectTextContent(result)
      expect(textContent).toContain('Error')
      expect(textContent).toContain('Pull request URL is required')
    })
  })

  describe('Error Handling Scenarios', () => {
    it.skipIf(!hasProductionPAT)('should handle network connectivity issues gracefully', async () => {
      await ensureClientConnected()
      // This test can be enhanced to simulate network issues if needed
      // For now, we'll test with a known invalid work item ID
      const result = await client.callTool('wit_get_work_item', {
        id: 999999999
      })
      
      const textContent = expectTextContent(result)
      expect(textContent).toContain('Error')
      expect(textContent).not.toContain('undefined')
      expect(textContent.length).toBeGreaterThan(5) // Should have meaningful error message
    })

    it.skipIf(!hasProductionPAT)('should handle unknown tool calls', async () => {
      await ensureClientConnected()
      try {
        await client.callTool('unknown_tool')
        expect.fail('Should have thrown an error')
      } catch (error) {
        expect(error).toBeDefined()
        expect(String(error)).toContain('unknown_tool')
      }
    })

    it.skipIf(!hasProductionPAT)('should handle malformed arguments gracefully', async () => {
      await ensureClientConnected()
      const result = await client.callTool('wit_get_work_items_batch_by_ids', {
        ids: 'not-an-array'
      })
      
      const textContent = expectTextContent(result)
      expect(textContent).toContain('Error')
    })
  })

  describe('Performance Validation', () => {
    it.skipIf(!hasProductionPAT)('should meet query performance requirements across all tools', async () => {
      await ensureClientConnected()
      // Get work items for testing
      if (realWorkItemIds.length === 0) {
        const result = await client.callTool('wit_my_work_items', { filter: 'all' })
        const workItems = expectValidJSON(result)
        realWorkItemIds = workItems.map((item: any) => item.id).slice(0, 3)
      }
      
      const performanceTests = [
        { tool: 'wit_my_work_items', args: { filter: 'all' } },
        { tool: 'wit_get_work_item', args: { id: realWorkItemIds[0] } },
        { tool: 'wit_get_work_items_batch_by_ids', args: { ids: realWorkItemIds.slice(0, 2) } },
        { tool: 'wit_list_work_item_comments', args: { id: realWorkItemIds[0] } },
      ]
      
      for (const test of performanceTests) {
        const startTime = Date.now()
        const result = await client.callTool(test.tool, test.args)
        const duration = Date.now() - startTime
        
        expect(result.content).toHaveLength(1)
        expect(duration).toBeLessThan(100) // 100ms requirement
        
        console.log(`✅ ${test.tool}: ${duration}ms`)
      }
    })
  })

  describe('Environment Configuration', () => {
    it('should validate production environment setup', () => {
      if (hasProductionPAT) {
        expect(process.env.AZURE_DEVOPS_PAT).toBeDefined()
        expect(process.env.AZURE_DEVOPS_PAT!.length).toBeGreaterThan(30)
        console.log('✅ Production PAT configured')
      } else {
        console.log('⚠️ AZURE_DEVOPS_PAT not configured - production MCP tools tests skipped')
        console.log('📝 To run production MCP tools tests:')
        console.log('   1. Set AZURE_DEVOPS_PAT environment variable')
        console.log('   2. Set TEST_USER_EMAIL environment variable (optional)')
        console.log('   3. Run: npm test -- mcp-tools-production')
      }
    })
  })
})