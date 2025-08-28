import { describe, it, expect, beforeEach } from 'vitest'

import { azureDevOpsHandlers } from '@/mocks/handlers/azure-devops.handlers.js'
import { server } from '@/mocks/server.js'
import { AzureDevOpsRestClient } from '@/packages/azure-devops-client/src/client.js'

/**
 * Simple MSW Debug Test - Task 6.1
 *
 * This test directly tests the AzureDevOpsRestClient to see if MSW mocks work
 * at the lowest level before any transformation layers.
 */
describe('Simple MSW Debug Test', () => {
  let client: AzureDevOpsRestClient

  beforeEach(async () => {
    // Set required environment variables
    process.env.AZURE_DEVOPS_PAT = 'test-pat-token-12345'
    process.env.AZURE_DEVOPS_ORG = 'fwcdev'
    process.env.AZURE_DEVOPS_PROJECT = 'Customer Services Platform'

    // Reset MSW to ensure clean state
    server.resetHandlers(...azureDevOpsHandlers)

    // Create client with explicit config to avoid validation issues
    client = new AzureDevOpsRestClient({
      organization: 'fwcdev',
      project: 'Customer Services Platform',
      pat: 'test-pat-token-12345',
      apiVersion: '7.0',
    })
  })

  it('should test direct REST client getWorkItemsBatch call', async () => {
    console.log('🔍 Testing direct REST client call...')

    try {
      // This should directly call MSW without any provider transformation
      console.log('📡 Calling getWorkItemsBatch([1234, 5678])...')
      const result = await client.getWorkItemsBatch([1234, 5678])

      console.log(
        '✅ getWorkItemsBatch succeeded with result length:',
        result.length,
      )
      console.log('📊 First work item:', JSON.stringify(result[0], null, 2))

      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(2)

      console.log('🎉 Direct REST client call working correctly!')
    } catch (error) {
      console.log('❌ getWorkItemsBatch failed with error:', error)
      console.log('Error name:', (error as Error).name)
      console.log('Error message:', (error as Error).message)
      console.log('Error stack:', (error as Error).stack)

      // Re-throw to see the full error
      throw error
    }
  })

  it('should test single work item call', async () => {
    console.log('🔍 Testing single work item call...')

    try {
      console.log('📡 Calling getWorkItem(1234)...')
      const result = await client.getWorkItem(1234)

      console.log('✅ getWorkItem succeeded:', JSON.stringify(result, null, 2))

      expect(result).toBeDefined()
      expect(result.id).toBe(1234)
    } catch (error) {
      console.log('❌ getWorkItem failed:', error)
      throw error
    }
  })
})
