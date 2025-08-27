import { describe, it, expect, beforeEach } from 'vitest'
import { AzureDevOpsClient } from '../azure-devops.js'
import { server } from '@/mocks/server.js'
import { azureDevOpsHandlers } from '@/mocks/handlers/azure-devops.handlers.js'

/**
 * MSW Debug Test - Task 6.1
 * 
 * This test is specifically designed for debugging MSW interaction with @orchestr8/resilience.
 * We'll use this to understand why the mocks aren't working with the new resilience system.
 */
describe('MSW Debug Test', () => {
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

  it('should debug MSW mock interaction with @orchestr8/resilience', async () => {
    console.log('🔍 Starting MSW debug test...')
    
    // Let's intercept the provider to see what data it's actually receiving
    const originalProvider = (client as any).restProvider
    const originalFetchWorkItems = originalProvider.fetchWorkItems.bind(originalProvider)
    
    originalProvider.fetchWorkItems = async (query: any) => {
      console.log('🔍 Provider.fetchWorkItems called with query:', query)
      
      try {
        const result = await originalFetchWorkItems(query)
        console.log('✅ Provider.fetchWorkItems succeeded with result:', result)
        return result
      } catch (error) {
        console.log('❌ Provider.fetchWorkItems failed:', error)
        throw error
      }
    }
    
    // Also intercept the client.batchGetWorkItems to see the raw data
    const restClient = originalProvider.getClient()
    const originalBatchGetWorkItems = restClient.batchGetWorkItems.bind(restClient)
    
    restClient.batchGetWorkItems = async (ids: number[]) => {
      console.log('🔍 REST Client batchGetWorkItems called with IDs:', ids)
      
      try {
        const result = await originalBatchGetWorkItems(ids)
        console.log('✅ REST Client batchGetWorkItems succeeded:')
        console.log('📊 First work item structure:', JSON.stringify(result[0], null, 2))
        return result
      } catch (error) {
        console.log('❌ REST Client batchGetWorkItems failed:', error)
        throw error
      }
    }
    
    try {
      // This should hit the MSW mock for workItemsListHandler
      console.log('📡 Making fetchWorkItems request...')
      const result = await client.fetchWorkItems()
      
      console.log('✅ Request succeeded:', result)
      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
      
      // If we get here, MSW is working correctly
      console.log('🎉 MSW integration working correctly!')
      
    } catch (error) {
      console.log('❌ Request failed with error:', error)
      console.log('Error name:', (error as Error).name)
      console.log('Error message:', (error as Error).message)
      console.log('Error stack:', (error as Error).stack)
      
      // Check if this is a resilience-related error
      if ((error as Error).message.includes('Retry exhausted')) {
        console.log('🔁 This is a retry exhaustion error from @orchestr8/resilience')
        console.log('💭 This suggests an error during data transformation, not HTTP request')
      }
      
      // Re-throw to see the full error in Wallaby
      throw error
    }
  })

  it('should verify MSW server is running', async () => {
    console.log('🔍 Verifying MSW server status...')
    
    // The server should be started by vitest.setup.ts
    expect(server).toBeDefined()
    
    // Try to make a direct fetch to see if MSW intercepts it
    try {
      console.log('📡 Making direct fetch to Azure DevOps API...')
      const response = await fetch('https://dev.azure.com/fwcdev/Customer%20Services%20Platform/_apis/wit/workitems?$expand=all', {
        headers: {
          'Authorization': 'Basic ' + btoa(':test-pat-token-12345'),
          'Content-Type': 'application/json'
        }
      })
      
      console.log('✅ Direct fetch status:', response.status)
      
      if (response.ok) {
        const data = await response.json()
        console.log('📊 Direct fetch data:', data)
        expect(data).toBeDefined()
        expect(data.value).toBeDefined()
        expect(Array.isArray(data.value)).toBe(true)
      }
      
    } catch (error) {
      console.log('❌ Direct fetch failed:', error)
      throw error
    }
  })
})