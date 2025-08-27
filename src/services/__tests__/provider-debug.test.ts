import { describe, it, expect, beforeEach } from 'vitest'
import { AzureDevOpsProvider } from '@/packages/azure-devops-client/src/provider.js'
import { AzureDevOpsRestClient } from '@/packages/azure-devops-client/src/client.js'
import { server } from '@/mocks/server.js'
import { azureDevOpsHandlers } from '@/mocks/handlers/azure-devops.handlers.js'

/**
 * Provider Debug Test - Task 6.1
 * 
 * This test specifically targets the AzureDevOpsRestProvider layer to find
 * where the data transformation is failing between the REST client and the provider.
 */
describe('Provider Debug Test', () => {
  let provider: AzureDevOpsProvider
  let client: AzureDevOpsRestClient

  beforeEach(async () => {
    // Set required environment variables
    process.env.AZURE_DEVOPS_PAT = 'test-pat-token-12345'
    process.env.AZURE_DEVOPS_ORG = 'fwcdev'
    process.env.AZURE_DEVOPS_PROJECT = 'Customer Services Platform'
    
    // Reset MSW to ensure clean state
    server.resetHandlers(...azureDevOpsHandlers)
    
    // Create config
    const config = {
      organization: 'fwcdev',
      project: 'Customer Services Platform',
      pat: 'test-pat-token-12345',
      apiVersion: '7.0'
    }
    
    // Create REST client (we know this works from previous test)
    client = new AzureDevOpsRestClient(config)
    
    // Create provider that uses the same config
    provider = new AzureDevOpsProvider(config)
  })

  it('should debug provider fetchWorkItems method', async () => {
    console.log('🔍 Testing provider fetchWorkItems...')
    
    try {
      // This uses the provider layer which transforms REST client data -> WorkItemData
      console.log('📡 Calling provider.fetchWorkItems with query...')
      
      const query = {
        filters: {
          type: ['User Story', 'Product Backlog Item', 'Bug', 'Task'],
          state: [], // Will exclude removed items by default
        },
        orderBy: 'changedDate',
        orderDirection: 'desc' as const,
      }
      
      const result = await provider.fetchWorkItems(query)
      
      console.log('✅ Provider fetchWorkItems succeeded with result length:', result.length)
      console.log('📊 First work item from provider:', JSON.stringify(result[0], null, 2))
      
      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
      
      console.log('🎉 Provider layer working correctly!')
      
    } catch (error) {
      console.log('❌ Provider fetchWorkItems failed with error:', error)
      console.log('Error name:', (error as Error).name)
      console.log('Error message:', (error as Error).message)
      console.log('Error stack:', (error as Error).stack)
      
      // Re-throw to see the full error
      throw error
    }
  })

  it('should debug provider getWorkItem method', async () => {
    console.log('🔍 Testing provider getWorkItem...')
    
    try {
      console.log('📡 Calling provider.getWorkItem(1234)...')
      
      const result = await provider.getWorkItem(1234)
      
      console.log('✅ Provider getWorkItem succeeded:', JSON.stringify(result, null, 2))
      
      expect(result).toBeDefined()
      expect(result?.id).toBe(1234)
      
    } catch (error) {
      console.log('❌ Provider getWorkItem failed:', error)
      throw error
    }
  })

  it('should test the data mapping function directly', async () => {
    console.log('🔍 Testing data mapping function directly...')
    
    try {
      // Get raw work item from REST client
      console.log('📡 Getting raw work item from REST client...')
      const rawWorkItem = await client.getWorkItem(1234)
      console.log('📊 Raw work item structure:', JSON.stringify(rawWorkItem, null, 2))
      
      // Now try to map it through the provider's mapping function
      console.log('🔄 Trying to map through provider...')
      
      // Access the private mapWorkItemToData method to test it directly
      const mappedResult = (provider as any).mapWorkItemToData(rawWorkItem)
      console.log('📊 Mapped result:', JSON.stringify(mappedResult, null, 2))
      
      expect(mappedResult).toBeDefined()
      expect(mappedResult.id).toBe(1234)
      
      console.log('🎉 Data mapping working correctly!')
      
    } catch (error) {
      console.log('❌ Data mapping failed:', error)
      throw error
    }
  })
})