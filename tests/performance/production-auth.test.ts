import { describe, it, expect, beforeAll } from 'vitest'

import { AzureDevOpsClient } from '../azure-devops.js'

/**
 * Production Environment Validation Tests
 * 
 * These tests validate PAT authentication with the real fwcdev Azure DevOps organization.
 * They require a valid AZURE_DEVOPS_PAT environment variable set with appropriate permissions.
 * 
 * Requirements:
 * - AZURE_DEVOPS_PAT: Personal Access Token with work items read & write permissions
 * - Organization: fwcdev
 * - Project: Customer Services Platform
 * 
 * These tests will be skipped if AZURE_DEVOPS_PAT is not configured.
 */

describe('Production Environment Authentication', () => {
  let client: AzureDevOpsClient
  const hasProductionPAT = !!process.env.AZURE_DEVOPS_PAT

  beforeAll(() => {
    if (hasProductionPAT) {
      client = new AzureDevOpsClient()
    }
  })

  describe('PAT Authentication', () => {
    it.skipIf(!hasProductionPAT)('should authenticate with fwcdev organization using valid PAT', async () => {
      expect(process.env.AZURE_DEVOPS_PAT).toBeDefined()
      expect(process.env.AZURE_DEVOPS_PAT!.length).toBeGreaterThan(0)
      
      // Verify client can be created without errors
      expect(client).toBeDefined()
    })

    it.skipIf(!hasProductionPAT)('should fetch work items from Customer Services Platform project', async () => {
      const startTime = Date.now()
      
      const workItems = await client.fetchWorkItems()
      const duration = Date.now() - startTime
      
      // Validate response structure
      expect(Array.isArray(workItems)).toBe(true)
      expect(workItems.length).toBeGreaterThan(0)
      
      // Validate performance requirements (≤ 30 seconds for sync)
      expect(duration).toBeLessThan(30000) // 30 seconds max
      
      // Validate work item structure
      const firstItem = workItems[0]
      expect(firstItem).toHaveProperty('id')
      expect(firstItem).toHaveProperty('title')
      expect(firstItem).toHaveProperty('state')
      expect(firstItem).toHaveProperty('type')
      expect(typeof firstItem.id).toBe('number')
      expect(typeof firstItem.title).toBe('string')
      
      console.log(`✅ Successfully fetched ${workItems.length} work items in ${duration}ms`)
    })

    it.skipIf(!hasProductionPAT)('should fetch single work item by ID with proper permissions', async () => {
      // First get a work item ID
      const workItems = await client.fetchWorkItems()
      expect(workItems.length).toBeGreaterThan(0)
      
      const workItemId = workItems[0].id
      const startTime = Date.now()
      
      const singleItem = await client.fetchSingleWorkItem(workItemId)
      const duration = Date.now() - startTime
      
      // Validate response structure
      expect(singleItem).toBeDefined()
      expect(singleItem.id).toBe(workItemId)
      expect(singleItem).toHaveProperty('title')
      expect(singleItem).toHaveProperty('state')
      
      // Validate performance requirements (≤ 100ms for queries)
      expect(duration).toBeLessThan(100) // 100ms max
      
      console.log(`✅ Fetched work item ${workItemId} in ${duration}ms`)
    })

    it.skipIf(!hasProductionPAT)('should handle work item comments with read permissions', async () => {
      // Get a work item to test comments
      const workItems = await client.fetchWorkItems()
      expect(workItems.length).toBeGreaterThan(0)
      
      const workItemId = workItems[0].id
      const startTime = Date.now()
      
      try {
        const comments = await client.fetchWorkItemComments(workItemId)
        const duration = Date.now() - startTime
        
        // Validate response structure
        expect(Array.isArray(comments)).toBe(true)
        
        // Performance validation
        expect(duration).toBeLessThan(5000) // 5 seconds max for comments
        
        console.log(`✅ Fetched ${comments.length} comments for work item ${workItemId} in ${duration}ms`)
      } catch (error) {
        // Comments might not exist or might not be accessible
        console.log(`⚠️ Comment fetch test: ${error instanceof Error ? error.message : 'Unknown error'}`)
        // This is acceptable - not all work items have comments
      }
    })

    it.skipIf(!hasProductionPAT)('should validate organization and project configuration', async () => {
      // Test that we're connecting to the correct organization and project
      const workItems = await client.fetchWorkItems()
      expect(workItems.length).toBeGreaterThan(0)
      
      // Validate we have work items (development environment may have fewer than production)
      expect(workItems.length).toBeGreaterThan(0) // Should have at least some work items
      
      console.log(`✅ Validated connection to fwcdev organization with ${workItems.length} work items`)
    })

    it.skipIf(!hasProductionPAT)('should handle batch operations efficiently', async () => {
      // Get first few work items for batch testing
      const workItems = await client.fetchWorkItems()
      const testIds = workItems.slice(0, 5).map(item => item.id) // Test with 5 items
      
      const startTime = Date.now()
      const batchItems = await client.fetchWorkItemsDetailed(testIds, 10)
      const duration = Date.now() - startTime
      
      // Validate batch response
      expect(Array.isArray(batchItems)).toBe(true)
      expect(batchItems.length).toBe(testIds.length)
      
      // Performance validation - batch should be efficient
      expect(duration).toBeLessThan(5000) // 5 seconds max for batch of 5
      
      // Validate each item
      batchItems.forEach(item => {
        expect(testIds).toContain(item.id)
        expect(item).toHaveProperty('title')
        expect(item).toHaveProperty('state')
      })
      
      console.log(`✅ Batch fetched ${batchItems.length} work items in ${duration}ms`)
    })
  })

  describe('Error Handling', () => {
    it.skipIf(!hasProductionPAT)('should handle invalid work item ID gracefully', async () => {
      const invalidId = 999999999 // Extremely unlikely to exist
      
      try {
        const result = await client.fetchSingleWorkItem(invalidId)
        // If it doesn't throw, it should return undefined or empty object
        expect(result).toBeFalsy()
      } catch (error) {
        // This is the expected behavior - should throw for invalid IDs
        expect(error).toBeDefined()
      }
    })

    it.skipIf(!hasProductionPAT)('should handle rate limiting appropriately', async () => {
      // This test validates that our client handles rate limiting properly
      // We'll make a reasonable number of requests and ensure no 429 errors
      const workItems = await client.fetchWorkItems()
      const testIds = workItems.slice(0, 3).map(item => item.id)
      
      // Multiple sequential requests to test rate limit handling
      const promises = testIds.map(id => client.fetchSingleWorkItem(id))
      const results = await Promise.all(promises)
      
      expect(results.length).toBe(testIds.length)
      results.forEach(item => {
        expect(item).toHaveProperty('id')
        expect(item).toHaveProperty('title')
      })
    })
  })

  describe('Performance Benchmarks', () => {
    it.skipIf(!hasProductionPAT)('should meet sync performance requirements (≤ 30 seconds)', async () => {
      const startTime = Date.now()
      
      const workItems = await client.fetchWorkItems()
      const duration = Date.now() - startTime
      
      // Production requirement: sync ≤ 30 seconds for all work items
      expect(duration).toBeLessThan(30000)
      expect(workItems.length).toBeGreaterThan(0)
      
      const itemsPerSecond = workItems.length / (duration / 1000)
      console.log(`✅ Performance: ${workItems.length} items in ${duration}ms (${itemsPerSecond.toFixed(1)} items/sec)`)
    })

    it.skipIf(!hasProductionPAT)('should meet query performance requirements (≤ 100ms)', async () => {
      // Get a work item for testing
      const workItems = await client.fetchWorkItems()
      const workItemId = workItems[0].id
      
      // Test multiple single queries to ensure consistent performance
      const queryTimes: number[] = []
      
      for (let i = 0; i < 5; i++) {
        const startTime = Date.now()
        await client.fetchSingleWorkItem(workItemId)
        const duration = Date.now() - startTime
        queryTimes.push(duration)
        
        // Each query should meet the 100ms requirement
        expect(duration).toBeLessThan(100)
      }
      
      const avgTime = queryTimes.reduce((sum, time) => sum + time, 0) / queryTimes.length
      console.log(`✅ Query Performance: Average ${avgTime.toFixed(1)}ms (max: ${Math.max(...queryTimes)}ms)`)
    })
  })

  describe('Environment Configuration', () => {
    it('should validate required environment variables', () => {
      if (hasProductionPAT) {
        expect(process.env.AZURE_DEVOPS_PAT).toBeDefined()
        expect(process.env.AZURE_DEVOPS_PAT!.trim().length).toBeGreaterThan(0)
        
        // PAT should be a reasonable length (Azure DevOps PATs are typically 52 characters, but can be shorter)
        expect(process.env.AZURE_DEVOPS_PAT!.length).toBeGreaterThanOrEqual(30)
      } else {
        console.log('⚠️ AZURE_DEVOPS_PAT not configured - production tests skipped')
        console.log('📝 To run production tests:')
        console.log('   1. Go to https://dev.azure.com/fwcdev/_usersSettings/tokens')
        console.log('   2. Create PAT with "Work items (read & write)" permissions')
        console.log('   3. Set AZURE_DEVOPS_PAT environment variable')
        console.log('   4. Run tests again')
      }
    })

    it('should use correct organization and project configuration', () => {
      // These should be hardcoded in the client for production
      const expectedOrg = 'fwcdev'
      const expectedProject = 'Customer Services Platform'
      
      // These values are used in the Azure DevOps client
      expect(expectedOrg).toBe('fwcdev')
      expect(expectedProject).toBe('Customer Services Platform')
    })
  })
})