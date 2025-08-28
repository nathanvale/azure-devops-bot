import { describe, it, expect, beforeEach } from 'vitest'

import { azureDevOpsHandlers } from '@/mocks/handlers/azure-devops.handlers.js'
import { server } from '@/mocks/server.js'

import { AzureDevOpsClient } from '../azure-devops.js'

/**
 * Integration Fix Test - Task 6.1
 *
 * This test verifies that the integration works after fixing the double resilience issue.
 * We'll test the AzureDevOpsClient methods that were originally failing.
 */
describe('Integration Fix Test', () => {
  let client: AzureDevOpsClient

  beforeEach(() => {
    // Set required environment variables
    process.env.AZURE_DEVOPS_PAT = 'test-pat-token-12345'
    process.env.AZURE_DEVOPS_ORG = 'fwcdev'
    process.env.AZURE_DEVOPS_PROJECT = 'Customer Services Platform'

    // Reset MSW to ensure clean state
    server.resetHandlers(...azureDevOpsHandlers)

    client = new AzureDevOpsClient()
  })

  it('should test AzureDevOpsClient fetchWorkItems after fixing resilience issue', async () => {
    console.log('🔍 Testing AzureDevOpsClient fetchWorkItems...')

    try {
      const result = await client.fetchWorkItems()

      console.log(
        '✅ fetchWorkItems succeeded with result length:',
        result.length,
      )
      console.log('📊 First work item:', JSON.stringify(result[0], null, 2))

      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)

      // Verify the structure matches expected WorkItemData format
      const firstItem = result[0]!
      expect(firstItem).toHaveProperty('id')
      expect(firstItem).toHaveProperty('title')
      expect(firstItem).toHaveProperty('state')
      expect(firstItem).toHaveProperty('type')
      expect(firstItem).toHaveProperty('assignedTo')

      console.log('🎉 AzureDevOpsClient integration working correctly!')
    } catch (error) {
      console.log('❌ fetchWorkItems failed:', error)
      console.log('Error name:', (error as Error).name)
      console.log('Error message:', (error as Error).message)
      console.log('Error stack:', (error as Error).stack)

      throw error
    }
  })

  it('should test fetchSingleWorkItem method', async () => {
    console.log('🔍 Testing fetchSingleWorkItem...')

    try {
      const result = await client.fetchSingleWorkItem(1234)

      console.log(
        '✅ fetchSingleWorkItem succeeded:',
        JSON.stringify(result, null, 2),
      )

      expect(result).toBeDefined()
      expect(result.id).toBe(1234)
    } catch (error) {
      console.log('❌ fetchSingleWorkItem failed:', error)
      throw error
    }
  })

  it('should test fetchWorkItemComments method', async () => {
    console.log('🔍 Testing fetchWorkItemComments...')

    try {
      const result = await client.fetchWorkItemComments(1234)

      console.log(
        '✅ fetchWorkItemComments succeeded with length:',
        result.length,
      )

      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
    } catch (error) {
      console.log('❌ fetchWorkItemComments failed:', error)
      throw error
    }
  })
})
