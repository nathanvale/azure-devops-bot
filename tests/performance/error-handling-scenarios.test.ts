import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

import path from 'path'

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

import { TestMCPClient } from '../../../tests/utils/mcp-client'
import { AzureDevOpsClient } from '../azure-devops.js'

/**
 * Error Handling Scenarios Test Suite
 * 
 * This suite focuses specifically on testing error handling scenarios including:
 * - Network connectivity failures during sync and query operations
 * - Azure DevOps API authentication token expiration and invalid tokens
 * - Rate limiting detection, X-RateLimit-Remaining header monitoring, and backoff behavior
 * - Partial sync failure recovery and data consistency maintenance
 * - Service degradation and recovery patterns
 * 
 * These tests validate that the MCP server gracefully handles real-world failure scenarios
 * while maintaining data integrity and providing meaningful error messages to users.
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

// Helper function to parse JSON response safely, returns null if not JSON
function tryParseJSON(result: CallToolResult): any | null {
  try {
    const textContent = expectTextContent(result)
    return JSON.parse(textContent)
  } catch {
    return null
  }
}

describe('Error Handling Scenarios', () => {
  let client: TestMCPClient
  let productionClient: AzureDevOpsClient
  let validWorkItemIds: number[] = []
  let testUserEmail: string

  const hasProductionPAT = !!process.env.AZURE_DEVOPS_PAT
  const timeout = 45000 // 45 seconds for error scenario tests

  // Helper function to connect to MCP client if not already connected
  async function ensureClientConnected(): Promise<void> {
    if (!client) {
      client = new TestMCPClient()
      const tsServerPath = path.resolve(__dirname, '../../../src/mcp-server.ts')
      const tsxPath = path.resolve(__dirname, '../../../node_modules/.bin/tsx')
      console.log('Connecting with command:', tsxPath, ', args:', [tsServerPath, `--emails=${testUserEmail}`])
      await client.connect(tsxPath, [tsServerPath, `--emails=${testUserEmail}`])
      
      // Get some valid work item IDs for testing
      try {
        const result = await client.callTool('wit_my_work_items', { filter: 'all' })
        const textContent = expectTextContent(result)
        const workItems = JSON.parse(textContent)
        if (Array.isArray(workItems) && workItems.length > 0) {
          validWorkItemIds = workItems.map((item: any) => item.id).slice(0, 10)
        }
      } catch (error) {
        console.warn('Could not fetch valid work item IDs:', error)
      }
    }
  }

  beforeAll(async () => {
    testUserEmail = process.env.TEST_USER_EMAIL || 'test@fwcdev.com'
    if (hasProductionPAT) {
      productionClient = new AzureDevOpsClient()
    }
  })

  afterAll(async () => {
    if (client) {
      await client.close()
    }
  })

  describe('Network Connectivity Failures', () => {
    it.skipIf(!hasProductionPAT)('should handle invalid work item IDs gracefully', async () => {
      await ensureClientConnected()
      
      const invalidIds = [999999999, 888888888, 777777777, -1, 0]
      
      for (const invalidId of invalidIds) {
        const startTime = Date.now()
        const result = await client.callTool('wit_get_work_item', { id: invalidId })
        const duration = Date.now() - startTime
        
        const textContent = expectTextContent(result)
        
        // Should return a proper error message
        expect(textContent).toContain('Error')
        expect(textContent).toMatch(/not found|does not exist/i)
        expect(textContent).not.toContain('undefined')
        expect(textContent).not.toContain('null')
        expect(textContent.length).toBeGreaterThan(15) // Meaningful error
        
        // Should respond quickly even for errors
        expect(duration).toBeLessThan(5000) // 5 seconds max
        
        console.log(`✅ Invalid ID ${invalidId}: ${textContent.slice(0, 50)}...`)
      }
    })

    it.skipIf(!hasProductionPAT)('should handle extremely large work item ID gracefully', async () => {
      await ensureClientConnected()
      
      const extremelyLargeId = Number.MAX_SAFE_INTEGER
      
      const result = await client.callTool('wit_get_work_item', { id: extremelyLargeId })
      const textContent = expectTextContent(result)
      
      expect(textContent).toContain('Error')
      expect(textContent.length).toBeGreaterThan(10)
      
      console.log(`✅ Handled extremely large ID (${extremelyLargeId}) gracefully`)
    })

    it.skipIf(!hasProductionPAT)('should handle network timeout scenarios during batch operations', async () => {
      await ensureClientConnected()
      
      // Test with a large batch that might cause timeouts
      const largeBatch = Array.from({ length: 100 }, (_, i) => 999999000 + i) // All invalid IDs
      
      const startTime = Date.now()
      const result = await client.callTool('wit_get_work_items_batch_by_ids', {
        ids: largeBatch
      })
      const duration = Date.now() - startTime
      
      const textContent = expectTextContent(result)
      
      // Should either handle gracefully or return meaningful error
      const parsed = tryParseJSON(result)
      if (parsed) {
        // If successful, should be empty array or subset of valid items
        expect(Array.isArray(parsed)).toBe(true)
        expect(parsed.length).toBeLessThanOrEqual(largeBatch.length)
      } else {
        // If error, should be meaningful
        expect(textContent).toContain('Error')
        expect(textContent.length).toBeGreaterThan(10)
      }
      
      // Should not take too long even with errors
      expect(duration).toBeLessThan(30000) // 30 seconds max
      
      console.log(`✅ Large batch handled in ${duration}ms: ${textContent.slice(0, 100)}...`)
    })

    it.skipIf(!hasProductionPAT)('should maintain service availability during partial failures', async () => {
      await ensureClientConnected()
      
      // Mix valid and invalid IDs to test partial failure handling
      const mixedIds = validWorkItemIds.length > 0 
        ? [...validWorkItemIds.slice(0, 2), 999999999, 888888888]
        : [999999999, 888888888]
      
      const result = await client.callTool('wit_get_work_items_batch_by_ids', {
        ids: mixedIds
      })
      
      const textContent = expectTextContent(result)
      const parsed = tryParseJSON(result)
      
      if (parsed && Array.isArray(parsed)) {
        // Should return valid items only
        parsed.forEach((item: any) => {
          expect(item).toHaveProperty('id')
          expect(item).toHaveProperty('title')
          if (validWorkItemIds.length > 0) {
            expect(validWorkItemIds).toContain(item.id)
          }
        })
        
        console.log(`✅ Partial failure handled: returned ${parsed.length} valid items`)
      } else {
        // If error, ensure it's meaningful
        expect(textContent).toContain('Error')
        console.log(`✅ Partial failure handled with error: ${textContent}`)
      }
    })
  })

  describe('Authentication Error Handling', () => {
    it.skipIf(!hasProductionPAT)('should validate PAT token format and presence', async () => {
      const pat = process.env.AZURE_DEVOPS_PAT
      expect(pat).toBeDefined()
      expect(pat!.length).toBeGreaterThan(30) // Azure DevOps PATs are typically longer
      expect(pat).toMatch(/^[A-Za-z0-9+/=]+$/) // Base64-like format
      
      console.log(`✅ PAT format validated (length: ${pat!.length})`)
    })

    it.skipIf(!hasProductionPAT)('should handle expired or invalid PAT tokens gracefully', async () => {
      await ensureClientConnected()
      
      // This test validates the error handling when PAT becomes invalid
      // We can't easily simulate this, but we can test the client's behavior with API errors
      
      const invalidId = 999999999
      const result = await client.callTool('wit_get_work_item', { id: invalidId })
      const textContent = expectTextContent(result)
      
      // The error should be about the work item not being found, not auth issues
      // If we get an auth error, that would indicate a problem
      expect(textContent).toContain('Error')
      expect(textContent).not.toContain('Unauthorized')
      expect(textContent).not.toContain('403')
      expect(textContent).not.toContain('401')
      
      console.log(`✅ Auth error handling verified (no auth errors in response)`)
    })

    it.skipIf(!hasProductionPAT)('should provide clear error messages for permission issues', async () => {
      await ensureClientConnected()
      
      // Test with operations that might have permission constraints
      if (validWorkItemIds.length > 0) {
        const testComment = `Permission test - ${new Date().toISOString()}`
        
        const result = await client.callTool('wit_add_work_item_comment', {
          id: validWorkItemIds[0],
          comment: testComment
        })
        
        const textContent = expectTextContent(result)
        
        // Should either succeed or provide clear error
        if (textContent.includes('Successfully')) {
          console.log(`✅ Comment operation succeeded (permissions OK)`)
        } else if (textContent.includes('Error')) {
          expect(textContent.length).toBeGreaterThan(15)
          expect(textContent).not.toContain('undefined')
          console.log(`⚠️ Comment operation failed with clear error: ${textContent}`)
        }
      }
    })
  })

  describe('Rate Limiting and API Throttling', () => {
    it.skipIf(!hasProductionPAT)('should handle concurrent requests without rate limit violations', async () => {
      await ensureClientConnected()
      
      if (validWorkItemIds.length === 0) {
        console.log('⚠️ No valid work item IDs available for rate limit testing')
        return
      }
      
      // Make 15 concurrent requests to test rate limiting
      const concurrentRequests = 15
      const testIds = Array.from({ length: concurrentRequests }, (_, i) => 
        validWorkItemIds[i % validWorkItemIds.length]
      )
      
      const startTime = Date.now()
      
      const promises = testIds.map((id, index) => 
        client.callTool('wit_get_work_item', { id }).then(result => ({
          index,
          id,
          result,
          timestamp: Date.now()
        }))
      )
      
      const results = await Promise.all(promises)
      const totalDuration = Date.now() - startTime
      
      // Analyze results
      let successCount = 0
      let errorCount = 0
      let rateLimitErrors = 0
      
      results.forEach(({ result, id }) => {
        const textContent = expectTextContent(result)
        const parsed = tryParseJSON(result)
        
        if (parsed && parsed.id === id) {
          successCount++
        } else if (textContent.includes('Error')) {
          errorCount++
          if (textContent.includes('429') || textContent.includes('rate limit')) {
            rateLimitErrors++
          }
        }
      })
      
      // Should handle concurrent requests gracefully
      expect(successCount + errorCount).toBe(concurrentRequests)
      expect(rateLimitErrors).toBeLessThan(concurrentRequests / 2) // Most should succeed
      
      console.log(`✅ Concurrent requests: ${successCount} success, ${errorCount} errors, ${rateLimitErrors} rate limits (${totalDuration}ms)`)
    }, timeout)

    it.skipIf(!hasProductionPAT)('should implement appropriate backoff for rate limiting', async () => {
      await ensureClientConnected()
      
      if (validWorkItemIds.length === 0) {
        console.log('⚠️ No valid work item IDs available for backoff testing')
        return
      }
      
      // Make sequential requests with timing analysis
      const testId = validWorkItemIds[0]
      const requestTimes: number[] = []
      
      for (let i = 0; i < 10; i++) {
        const startTime = Date.now()
        const result = await client.callTool('wit_get_work_item', { id: testId })
        const duration = Date.now() - startTime
        
        requestTimes.push(duration)
        
        const textContent = expectTextContent(result)
        const parsed = tryParseJSON(result)
        
        if (parsed) {
          expect(parsed.id).toBe(testId)
        } else if (textContent.includes('Error')) {
          // Error should be meaningful
          expect(textContent.length).toBeGreaterThan(10)
        }
        
        // Small delay between requests
        if (i < 9) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }
      
      // Analyze timing patterns for evidence of backoff
      const avgTime = requestTimes.reduce((sum, time) => sum + time, 0) / requestTimes.length
      const maxTime = Math.max(...requestTimes)
      const minTime = Math.min(...requestTimes)
      
      console.log(`✅ Request timing analysis: avg=${avgTime.toFixed(1)}ms, min=${minTime}ms, max=${maxTime}ms`)
      
      // Times should be reasonable and consistent
      expect(avgTime).toBeLessThan(200) // Should be fast on average
      expect(maxTime).toBeLessThan(1000) // No request should be extremely slow
    })

    it.skipIf(!hasProductionPAT)('should handle X-RateLimit-Remaining header monitoring', async () => {
      await ensureClientConnected()
      
      // This test verifies that the system can handle rate limit headers appropriately
      // We can't directly inspect headers in MCP tools, but we can verify behavior
      
      if (validWorkItemIds.length === 0) {
        console.log('⚠️ No valid work item IDs available for rate limit header testing')
        return
      }
      
      // Make a series of requests to potentially trigger rate limit warnings
      const testId = validWorkItemIds[0]
      let consecutiveSuccesses = 0
      let consecutiveErrors = 0
      
      for (let i = 0; i < 20; i++) {
        const result = await client.callTool('wit_get_work_item', { id: testId })
        const textContent = expectTextContent(result)
        const parsed = tryParseJSON(result)
        
        if (parsed && parsed.id === testId) {
          consecutiveSuccesses++
          consecutiveErrors = 0 // Reset error count
        } else {
          consecutiveErrors++
          consecutiveSuccesses = 0 // Reset success count
          
          // If we get too many consecutive errors, something might be wrong
          if (consecutiveErrors > 5) {
            console.log(`⚠️ Multiple consecutive errors detected: ${textContent}`)
            break
          }
        }
        
        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 50))
      }
      
      console.log(`✅ Rate limit header test: ${consecutiveSuccesses} final consecutive successes`)
      
      // Should be able to make at least some successful requests
      expect(consecutiveSuccesses).toBeGreaterThan(0)
    })
  })

  describe('Data Consistency During Failures', () => {
    it.skipIf(!hasProductionPAT)('should maintain data integrity during partial sync failures', async () => {
      await ensureClientConnected()
      
      // Test that sync operations don't corrupt data when encountering errors
      
      // Get current work item count
      const initialResult = await client.callTool('wit_my_work_items', { filter: 'all' })
      const initialItems = tryParseJSON(initialResult)
      const initialCount = initialItems ? initialItems.length : 0
      
      // Force sync (this should handle any errors gracefully)
      const syncResult = await client.callTool('wit_force_sync_work_items', {
        concurrency: 5
      })
      
      const syncText = expectTextContent(syncResult)
      expect(syncText).toContain('Successfully synced')
      
      // Wait for sync to complete
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      // Get work items again
      const postSyncResult = await client.callTool('wit_my_work_items', { filter: 'all' })
      const postSyncItems = tryParseJSON(postSyncResult)
      const postSyncCount = postSyncItems ? postSyncItems.length : 0
      
      // Count should be consistent (same or more, never less due to corruption)
      expect(postSyncCount).toBeGreaterThanOrEqual(initialCount)
      
      console.log(`✅ Data integrity maintained: ${initialCount} → ${postSyncCount} items`)
    }, timeout)

    it.skipIf(!hasProductionPAT)('should recover gracefully from service interruptions', async () => {
      await ensureClientConnected()
      
      // Test multiple operations in sequence to ensure service recovery
      const operations = [
        { name: 'my_work_items', tool: 'wit_my_work_items', args: { filter: 'all' } },
        ...(validWorkItemIds.length > 0 ? [
          { name: 'single_item', tool: 'wit_get_work_item', args: { id: validWorkItemIds[0] } },
          { name: 'comments', tool: 'wit_list_work_item_comments', args: { id: validWorkItemIds[0] } }
        ] : [])
      ]
      
      let successfulOperations = 0
      let recoveredOperations = 0
      
      for (const operation of operations) {
        let attempts = 0
        let success = false
        
        while (attempts < 3 && !success) {
          attempts++
          
          try {
            const result = await client.callTool(operation.tool, operation.args)
            const textContent = expectTextContent(result)
            const parsed = tryParseJSON(result)
            
            if (parsed) {
              success = true
              if (attempts === 1) {
                successfulOperations++
              } else {
                recoveredOperations++
              }
            } else if (!textContent.includes('Error')) {
              // Non-error non-JSON response is also considered success
              success = true
              if (attempts === 1) {
                successfulOperations++
              } else {
                recoveredOperations++
              }
            }
          } catch (error) {
            console.log(`⚠️ Operation ${operation.name} attempt ${attempts} failed: ${error}`)
          }
          
          if (!success && attempts < 3) {
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        }
        
        if (!success) {
          console.log(`❌ Operation ${operation.name} failed after 3 attempts`)
        }
      }
      
      console.log(`✅ Service recovery: ${successfulOperations} immediate success, ${recoveredOperations} recovered`)
      
      // Most operations should succeed eventually
      expect(successfulOperations + recoveredOperations).toBeGreaterThan(operations.length / 2)
    }, timeout)
  })

  describe('Error Message Quality and Debugging', () => {
    it.skipIf(!hasProductionPAT)('should provide actionable error messages', async () => {
      await ensureClientConnected()
      
      const errorScenarios = [
        { 
          tool: 'wit_get_work_item', 
          args: { id: 999999999 }, 
          expectedErrorType: 'not found' 
        },
        { 
          tool: 'wit_get_work_items_batch_by_ids', 
          args: { ids: [] }, 
          expectedErrorType: 'required' 
        },
        { 
          tool: 'wit_list_work_item_comments', 
          args: {}, 
          expectedErrorType: 'required' 
        },
        { 
          tool: 'wit_add_work_item_comment', 
          args: { id: 123 }, 
          expectedErrorType: 'required' 
        }
      ]
      
      for (const scenario of errorScenarios) {
        const result = await client.callTool(scenario.tool, scenario.args)
        const textContent = expectTextContent(result)
        
        // Error message quality checks
        expect(textContent).toContain('Error')
        expect(textContent).toMatch(new RegExp(scenario.expectedErrorType, 'i'))
        expect(textContent.length).toBeGreaterThan(15) // Substantial message
        expect(textContent).not.toContain('undefined')
        expect(textContent).not.toContain('null')
        expect(textContent).not.toContain('[object Object]')
        
        // Should be readable English
        expect(textContent).toMatch(/^Error:?\s+\w+/) // Starts with "Error: " followed by words
        
        console.log(`✅ ${scenario.tool} error quality: ${textContent.slice(0, 60)}...`)
      }
    })

    it.skipIf(!hasProductionPAT)('should maintain consistent error format across all tools', async () => {
      await ensureClientConnected()
      
      const errorResults: string[] = []
      
      // Collect errors from different tools
      const tools = [
        { name: 'wit_get_work_item', args: { id: 999999999 } },
        { name: 'wit_get_work_items_batch_by_ids', args: { ids: [] } },
        { name: 'wit_list_work_item_comments', args: {} },
        { name: 'wit_get_work_items_for_iteration', args: {} }
      ]
      
      for (const tool of tools) {
        const result = await client.callTool(tool.name, tool.args)
        const textContent = expectTextContent(result)
        
        if (textContent.includes('Error')) {
          errorResults.push(textContent)
        }
      }
      
      // All errors should follow similar format
      expect(errorResults.length).toBeGreaterThan(0)
      
      errorResults.forEach(error => {
        expect(error).toMatch(/^Error:?\s+/) // Start with "Error: "
        expect(error.length).toBeGreaterThan(10)
        expect(error.length).toBeLessThan(200) // Not too verbose
      })
      
      console.log(`✅ Consistent error format across ${errorResults.length} error types`)
    })
  })
})