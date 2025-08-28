// import type { ProductionResilienceAdapter } from '@orchestr8/resilience'

import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest'

import { AzureDevOpsClient } from '../azure-devops.js'

/**
 * Azure DevOps Client Resilience Integration Tests
 *
 * Tests for Task 5.1: AzureDevOpsClient using ProductionResilienceAdapter
 *
 * These tests verify that the AzureDevOpsClient properly integrates with
 * @orchestr8/resilience system instead of throwing generic error messages.
 */
describe('AzureDevOpsClient - @orchestr8/resilience Integration', () => {
  let client: AzureDevOpsClient

  beforeEach(() => {
    // Clear any previous environment
    delete process.env.AZURE_DEVOPS_PAT

    // Set valid PAT for testing
    process.env.AZURE_DEVOPS_PAT = 'test-pat-token-12345'

    client = new AzureDevOpsClient()
  })

  afterEach(() => {
    vi.clearAllMocks()

    // Reset circuit breaker state between tests to prevent cross-test contamination
    if (client) {
      try {
        // Try to reset circuit breakers if the method exists
        // Since resilienceAdapter is private, we access it through type assertion
        if (
          typeof (client as any).resilienceAdapter?.resetCircuitBreakers ===
          'function'
        ) {
          ;((client as any).resilienceAdapter as any).resetCircuitBreakers()
        }
      } catch (error) {
        // Ignore reset errors to avoid test contamination
        console.warn('Failed to reset circuit breakers:', error)
      }
    }
  })

  describe('ProductionResilienceAdapter Integration', () => {
    it('should initialize with ProductionResilienceAdapter', () => {
      // The client should be able to initialize without throwing
      expect(client).toBeDefined()
      expect(client.getRestClient).toBeDefined()
    })

    it('should have access to resilience adapter through rest provider', () => {
      const restClient = client.getRestClient()
      expect(restClient).toBeDefined()

      // The REST client should be using ProductionResilienceAdapter internally
      // We can't directly access it, but we can verify the client exists
      expect(typeof restClient.getCurrentUserProfile).toBe('function')
      expect(typeof restClient.getWorkItem).toBe('function')
      expect(typeof restClient.getWorkItemsBatch).toBe('function')
      expect(typeof restClient.queryWorkItems).toBe('function')
      expect(typeof restClient.addWorkItemComment).toBe('function')
    })
  })

  describe('Error Handling with @orchestr8/resilience', () => {
    it('should not wrap resilience errors in generic error messages', async () => {
      // Mock the underlying rest provider to simulate a resilience error
      const mockRestProvider = client['restProvider']

      // Simulate an error that would come from @orchestr8/resilience
      const resilienceError = new Error('Retry exhausted after 3 attempts')
      resilienceError.name = 'ResilienceError'

      const originalGetWorkItem = mockRestProvider.getWorkItem
      mockRestProvider.getWorkItem = vi.fn().mockRejectedValue(resilienceError)

      try {
        await client.fetchSingleWorkItem(1234)
        expect.fail('Should have thrown an error')
      } catch (error) {
        // The error should NOT be wrapped in "Azure DevOps single work item fetch failed"
        // Instead, it should bubble up from the resilience system
        expect(error).toBe(resilienceError)
        expect((error as Error).message).toBe(
          'Retry exhausted after 3 attempts',
        )
        expect((error as Error).name).toBe('ResilienceError')
      }

      // Restore original method
      mockRestProvider.getWorkItem = originalGetWorkItem
    }, 15000) // Increased timeout for resilience policy testing

    it('should preserve @orchestr8/resilience error telemetry context', async () => {
      // When @orchestr8/resilience throws errors, they often contain telemetry
      const mockRestProvider = client['restProvider']

      const resilienceError = new Error('Circuit breaker is OPEN') as any
      resilienceError.name = 'CircuitBreakerError'
      resilienceError.circuitBreakerState = 'OPEN'
      resilienceError.failureCount = 5

      mockRestProvider.getWorkItem = vi.fn().mockRejectedValue(resilienceError)

      try {
        await client.fetchSingleWorkItem(1234)
        expect.fail('Should have thrown an error')
      } catch (error) {
        // Verify the resilience error context is preserved
        expect(error).toBe(resilienceError)
        expect((error as any).circuitBreakerState).toBe('OPEN')
        expect((error as any).failureCount).toBe(5)
      }
    }, 15000) // Increased timeout for resilience policy testing

    it('should handle authentication errors without retry wrapping', async () => {
      const mockRestProvider = client['restProvider']

      // Authentication errors should come through cleanly from @orchestr8/resilience
      const authError = new Error(
        'Authentication failed - invalid PAT token',
      ) as any
      authError.name = 'AuthenticationError'
      authError.statusCode = 401

      mockRestProvider.getWorkItem = vi.fn().mockRejectedValue(authError)

      try {
        await client.fetchSingleWorkItem(1234)
        expect.fail('Should have thrown an error')
      } catch (error) {
        // Should be the original authentication error, not wrapped
        expect(error).toBe(authError)
        expect((error as any).statusCode).toBe(401)
        expect((error as Error).name).toBe('AuthenticationError')
      }
    }, 15000) // Increased timeout for resilience policy testing

    it('should handle rate limiting errors with proper @orchestr8 context', async () => {
      const mockRestProvider = client['restProvider']

      // Rate limit errors should preserve Azure DevOps rate limit context
      const rateLimitError = new Error('Rate limit exceeded') as any
      rateLimitError.name = 'RateLimitError'
      rateLimitError.retryAfter = 300 // 5 minutes
      rateLimitError.remainingRequests = 0

      mockRestProvider.fetchWorkItems = vi
        .fn()
        .mockRejectedValue(rateLimitError)

      try {
        await client.fetchWorkItems()
        expect.fail('Should have thrown an error')
      } catch (error) {
        // Should preserve rate limiting context from @orchestr8/resilience
        expect(error).toBe(rateLimitError)
        expect((error as any).retryAfter).toBe(300)
        expect((error as any).remainingRequests).toBe(0)
      }
    })
  })

  describe('Resilience Policy Application', () => {
    it('should use appropriate policies for different operation types', async () => {
      // This is more of a behavioral test - verify that different operations
      // behave differently under failure scenarios

      const mockRestProvider = client['restProvider']

      // Create a spy to track how operations are handled differently
      const getWorkItemSpy = vi.spyOn(mockRestProvider, 'getWorkItem')
      const fetchWorkItemsSpy = vi.spyOn(mockRestProvider, 'fetchWorkItems')

      // Set up both to succeed for this test
      getWorkItemSpy.mockResolvedValue({
        id: '1234',
        title: 'Test Work Item',
        state: 'Active',
        type: 'User Story',
        assignedTo: 'Test User',
        createdDate: '2025-08-26T00:00:00Z',
        changedDate: '2025-08-26T00:00:00Z',
        description: 'Test description',
        raw: {},
      })

      fetchWorkItemsSpy.mockResolvedValue([])

      // Execute operations - they should use different resilience policies
      await client.fetchSingleWorkItem(1234)
      await client.fetchWorkItems()

      // Verify the operations were called (indicating resilience policies were applied)
      expect(getWorkItemSpy).toHaveBeenCalledWith(1234)
      expect(fetchWorkItemsSpy).toHaveBeenCalled()
    })

    it('should apply sync policy for single work item operations', async () => {
      // Individual work item fetches should use sync operations policy
      // (5 retries, exponential backoff, intelligent retry predicate)
      const mockRestProvider = client['restProvider']
      const getWorkItemSpy = vi.spyOn(mockRestProvider, 'getWorkItem')

      getWorkItemSpy.mockResolvedValue({
        id: '1234',
        title: 'Test Work Item',
        state: 'Active',
        type: 'User Story',
        assignedTo: 'Test User',
        createdDate: '2025-08-26T00:00:00Z',
        changedDate: '2025-08-26T00:00:00Z',
        description: 'Test description',
        raw: {},
      })

      const result = await client.fetchSingleWorkItem(1234)

      expect(result).toBeDefined()
      expect(result.id).toBe(1234)
      expect(getWorkItemSpy).toHaveBeenCalledWith(1234)
    })

    it('should apply batch policy for bulk operations', async () => {
      // Batch operations should use batch operations policy
      // (3 retries, shorter delays, optimized for bulk processing)
      const mockRestProvider = client['restProvider']
      const restClient = mockRestProvider.getClient()
      const batchGetWorkItemsSpy = vi.spyOn(restClient, 'batchGetWorkItems')

      // Mock successful batch response
      batchGetWorkItemsSpy.mockResolvedValue([
        {
          id: 1234,
          fields: {
            'System.Id': 1234,
            'System.Title': 'Test Work Item 1',
            'System.State': 'Active',
            'System.WorkItemType': 'User Story',
            'System.AssignedTo': {
              displayName: 'Test User',
              url: 'https://test.dev.azure.com/user1',
              id: '123',
              uniqueName: 'test.user@test.com',
              imageUrl: 'https://test.dev.azure.com/avatar1',
              descriptor: 'descriptor123'
            },
            'System.ChangedDate': '2025-08-26T00:00:00Z',
            'System.CreatedDate': '2025-08-25T00:00:00Z',
            'System.Description': 'Test description 1',
          },
          _links: {
            self: { href: 'https://test.dev.azure.com/wi/1' },
            workItemUpdates: { href: 'https://test.dev.azure.com/wi/1/updates' },
            workItemRevisions: { href: 'https://test.dev.azure.com/wi/1/revisions' },
            workItemComments: { href: 'https://test.dev.azure.com/wi/1/comments' },
            html: { href: 'https://test.dev.azure.com/wi/1/html' },
            workItemType: { href: 'https://test.dev.azure.com/wi/1/type' },
            fields: { href: 'https://test.dev.azure.com/wi/1/fields' }
          },
          url: '',
          rev: 1,
        },
        {
          id: 5678,
          fields: {
            'System.Id': 5678,
            'System.Title': 'Test Work Item 2',
            'System.State': 'Active',
            'System.WorkItemType': 'User Story',
            'System.AssignedTo': {
              displayName: 'Test User',
              url: 'https://test.dev.azure.com/user1',
              id: '123',
              uniqueName: 'test.user@test.com',
              imageUrl: 'https://test.dev.azure.com/avatar1',
              descriptor: 'descriptor123'
            },
            'System.ChangedDate': '2025-08-26T00:00:00Z',
            'System.CreatedDate': '2025-08-25T00:00:00Z',
            'System.Description': 'Test description 2',
          },
          _links: {
            self: { href: 'https://test.dev.azure.com/wi/1' },
            workItemUpdates: { href: 'https://test.dev.azure.com/wi/1/updates' },
            workItemRevisions: { href: 'https://test.dev.azure.com/wi/1/revisions' },
            workItemComments: { href: 'https://test.dev.azure.com/wi/1/comments' },
            html: { href: 'https://test.dev.azure.com/wi/1/html' },
            workItemType: { href: 'https://test.dev.azure.com/wi/1/type' },
            fields: { href: 'https://test.dev.azure.com/wi/1/fields' }
          },
          url: '',
          rev: 1,
        },
      ])

      const result = await client.fetchWorkItemsDetailed([1234, 5678])

      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(2)
      // Should have called batchGetWorkItems once with both IDs
      expect(batchGetWorkItemsSpy).toHaveBeenCalledTimes(1)
      expect(batchGetWorkItemsSpy).toHaveBeenCalledWith([1234, 5678])
    })
  })

  describe('Logger Integration', () => {
    it('should integrate with @orchestr8/logger for structured logging', async () => {
      // The client should use @orchestr8/logger internally through its rest provider
      // We can't directly test the logger output, but we can verify operations execute

      const mockRestProvider = client['restProvider']
      const getWorkItemSpy = vi.spyOn(mockRestProvider, 'getWorkItem')

      getWorkItemSpy.mockResolvedValue({
        id: '1234',
        title: 'Test Work Item',
        state: 'Active',
        type: 'User Story',
        assignedTo: 'Test User',
        createdDate: '2025-08-26T00:00:00Z',
        changedDate: '2025-08-26T00:00:00Z',
        description: 'Test description',
        raw: {},
      })

      // Execute operation that should generate logs
      await client.fetchSingleWorkItem(1234)

      // Verify the operation executed (logs would be generated internally)
      expect(getWorkItemSpy).toHaveBeenCalled()
    })
  })

  describe('Backward Compatibility', () => {
    it('should maintain same method signatures', () => {
      // Verify all expected methods exist with correct signatures
      expect(typeof client.fetchWorkItems).toBe('function')
      expect(typeof client.fetchSingleWorkItem).toBe('function')
      expect(typeof client.fetchWorkItemComments).toBe('function')
      expect(typeof client.fetchWorkItemsDetailed).toBe('function')
      expect(typeof client.addWorkItemComment).toBe('function')
      expect(typeof client.linkWorkItemToPullRequest).toBe('function')

      // Static methods
      expect(typeof AzureDevOpsClient.buildWorkItemUrl).toBe('function')
      expect(typeof AzureDevOpsClient.setUserEmails).toBe('function')
      expect(typeof AzureDevOpsClient.getUserEmails).toBe('function')
    })

    it('should maintain same return types for successful operations', async () => {
      const mockRestProvider = client['restProvider']

      // Mock successful responses
      vi.spyOn(mockRestProvider, 'getWorkItem').mockResolvedValue({
        id: '1234',
        title: 'Test Work Item',
        state: 'Active',
        type: 'User Story',
        assignedTo: 'Test User',
        createdDate: '2025-08-26T00:00:00Z',
        changedDate: '2025-08-26T00:00:00Z',
        description: 'Test description',
        raw: {},
      })

      vi.spyOn(mockRestProvider, 'fetchWorkItems').mockResolvedValue([])
      vi.spyOn(mockRestProvider, 'getComments').mockResolvedValue([])

      // Test return types
      const workItem = await client.fetchSingleWorkItem(1234)
      const workItems = await client.fetchWorkItems()
      const comments = await client.fetchWorkItemComments(1234)

      expect(typeof workItem).toBe('object')
      expect(workItem).toHaveProperty('id')
      expect(workItem).toHaveProperty('title')

      expect(Array.isArray(workItems)).toBe(true)
      expect(Array.isArray(comments)).toBe(true)
    })
  })
})
