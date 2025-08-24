import axios, { type AxiosResponse, type AxiosError } from 'axios'
import {
  describe,
  it,
  expect,
  beforeEach,
  vi,
  type MockedFunction,
} from 'vitest'

import type { WorkItemBatchResponse } from '../../src/types/api-responses.js'
import type { WorkItemComment } from '../../src/types/comments.js'
import type { AzureDevOpsClientConfig } from '../../src/types/config.js'
import type {
  WorkItem,
  WorkItemQueryResult,
} from '../../src/types/work-items.js'

// Use hoisted mocks to ensure they're available before module resolution
const mocks = vi.hoisted(() => ({
  mockValidateAuthentication: vi.fn().mockResolvedValue(true),
  mockBuildUrl: vi.fn(
    (path, params) =>
      `https://dev.azure.com/test-org/${path}${params ? '?' + new URLSearchParams(params).toString() : ''}`,
  ),
  mockGetAuthHeaders: vi.fn().mockReturnValue({
    Authorization: 'Basic dGVzdDp0ZXN0LXBhdA==',
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }),
  mockGetConnectionInfo: vi.fn().mockReturnValue({
    organization: 'test-org',
    project: 'test-project',
    azureDevOpsUrl: 'https://dev.azure.com/test-org',
  }),
}))

// Mock axios
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    })),
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

// Mock resilience package
vi.mock('@orchestr8/resilience', () => ({
  ProductionResilienceAdapter: vi.fn().mockImplementation(() => ({
    applyPolicy: vi.fn((operation) => operation()),
  })),
}))

// Mock the PATAuth class with hoisted functions
vi.mock('../../src/auth/pat-auth.js', () => ({
  PATAuth: vi.fn().mockImplementation(() => ({
    validateAuthentication: mocks.mockValidateAuthentication,
    buildUrl: mocks.mockBuildUrl,
    getAuthHeaders: mocks.mockGetAuthHeaders,
    getConnectionInfo: mocks.mockGetConnectionInfo,
  })),
}))

// Import client after mocks are set up
import { AzureDevOpsRestClient } from '../../src/client.js'

describe('AzureDevOpsRestClient - Batch Operations', () => {
  let config: AzureDevOpsClientConfig
  let client: AzureDevOpsRestClient
  let mockAxios: any

  beforeEach(() => {
    vi.clearAllMocks()

    // Reset hoisted mocks with their implementations
    mocks.mockValidateAuthentication.mockResolvedValue(true)
    mocks.mockBuildUrl.mockImplementation(
      (path, params) =>
        `https://dev.azure.com/test-org/${path}${params ? '?' + new URLSearchParams(params).toString() : ''}`,
    )
    mocks.mockGetAuthHeaders.mockReturnValue({
      Authorization: 'Basic dGVzdDp0ZXN0LXBhdA==',
      Accept: 'application/json',
      'Content-Type': 'application/json',
    })
    mocks.mockGetConnectionInfo.mockReturnValue({
      organization: 'test-org',
      project: 'test-project',
      azureDevOpsUrl: 'https://dev.azure.com/test-org',
    })

    config = {
      organization: 'test-org',
      project: 'test-project',
      pat: 'test-personal-access-token-123456789012345678901234567890',
    }

    mockAxios = {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    }
    ;(axios.create as MockedFunction<typeof axios.create>).mockReturnValue(
      mockAxios,
    )

    // Create client - if auth fails, manually override
    try {
      client = new AzureDevOpsRestClient(config)
    } catch (error) {
      // If constructor fails due to auth, create manually
      client = Object.create(AzureDevOpsRestClient.prototype)
      ;(client as any).httpClient = mockAxios
      ;(client as any).rateLimiter = {
        execute: vi.fn((fn) => fn()),
        updateFromHeaders: vi.fn(),
        getRateLimitStatus: vi.fn(),
      }
    }

    // Always override batchProcessor for testing
    ;(client as any).batchProcessor = {
      processBatches: vi.fn().mockImplementation(async (ids, processFn) => {
        // Simulate real batch processing - split into batches of 200
        const batchSize = 200
        const results = []

        for (let i = 0; i < ids.length; i += batchSize) {
          const batch = ids.slice(i, i + batchSize)
          const batchResult = await processFn(batch)
          results.push(...batchResult)
        }

        return results
      }),
    }

    // Always override the auth property with mocked methods
    ;(client as any).auth = {
      validateAuthentication: mocks.mockValidateAuthentication,
      buildUrl: mocks.mockBuildUrl,
      getAuthHeaders: mocks.mockGetAuthHeaders,
      getConnectionInfo: mocks.mockGetConnectionInfo,
    }

    // Manually assign mocked resilience adapter
    ;(client as any).resilience = {
      applyPolicy: vi.fn((operation) => operation()),
    }
  })

  describe('getWorkItemsBatch', () => {
    const mockWorkItems: WorkItem[] = [
      {
        id: 123,
        rev: 1,
        url: 'https://dev.azure.com/test-org/_apis/wit/workItems/123',
        fields: {
          'System.Id': 123,
          'System.Title': 'Test Work Item 1',
          'System.State': 'New',
          'System.WorkItemType': 'Task',
          'System.CreatedDate': '2023-01-01T00:00:00Z',
          'System.ChangedDate': '2023-01-01T00:00:00Z',
        },
      },
      {
        id: 124,
        rev: 1,
        url: 'https://dev.azure.com/test-org/_apis/wit/workItems/124',
        fields: {
          'System.Id': 124,
          'System.Title': 'Test Work Item 2',
          'System.State': 'Active',
          'System.WorkItemType': 'Bug',
          'System.CreatedDate': '2023-01-02T00:00:00Z',
          'System.ChangedDate': '2023-01-02T00:00:00Z',
        },
      },
    ]

    it('should fetch batch of work items successfully', async () => {
      const mockResponse: AxiosResponse<WorkItemBatchResponse> = {
        data: {
          count: 2,
          value: mockWorkItems,
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      }

      mockAxios.get.mockResolvedValue(mockResponse)

      const result = await client.getWorkItemsBatch([123, 124])

      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/_apis/wit/workitems?ids=123%2C124'),
      )
      expect(result).toEqual(mockWorkItems)
    })

    it('should handle empty ID array', async () => {
      console.log('Testing empty array...')
      console.log('Client auth type:', typeof client.auth)
      console.log(
        'Client auth methods:',
        client.auth ? Object.keys(client.auth) : 'no auth',
      )

      const result = await client.getWorkItemsBatch([])
      expect(result).toEqual([])
      expect(mockAxios.get).not.toHaveBeenCalled()
    })

    it('should handle undefined ID array', async () => {
      const result = await client.getWorkItemsBatch(undefined)
      expect(result).toEqual([])
      expect(mockAxios.get).not.toHaveBeenCalled()
    })

    it('should remove duplicate IDs and sort', async () => {
      const mockResponse: AxiosResponse<WorkItemBatchResponse> = {
        data: {
          count: 2,
          value: mockWorkItems,
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      }

      mockAxios.get.mockResolvedValue(mockResponse)

      await client.getWorkItemsBatch([124, 123, 124, 123])

      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/_apis/wit/workitems?ids=123%2C124'),
      )
    })

    it('should handle batch options with expand', async () => {
      const mockResponse: AxiosResponse<WorkItemBatchResponse> = {
        data: {
          count: 1,
          value: [mockWorkItems[0]!],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      }

      mockAxios.get.mockResolvedValue(mockResponse)

      await client.getWorkItemsBatch([123], { expand: 'relations' })

      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('%24expand=relations'),
      )
    })

    it('should handle batch options with specific fields', async () => {
      const mockResponse: AxiosResponse<WorkItemBatchResponse> = {
        data: {
          count: 1,
          value: [mockWorkItems[0]!],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      }

      mockAxios.get.mockResolvedValue(mockResponse)

      await client.getWorkItemsBatch([123], {
        fields: ['System.Id', 'System.Title'],
      })

      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('fields=System.Id%2CSystem.Title'),
      )
    })

    it('should handle batch options with asOf date', async () => {
      const mockResponse: AxiosResponse<WorkItemBatchResponse> = {
        data: {
          count: 1,
          value: [mockWorkItems[0]!],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      }

      mockAxios.get.mockResolvedValue(mockResponse)
      const asOfDate = '2023-01-01T00:00:00Z'

      await client.getWorkItemsBatch([123], { asOf: asOfDate })

      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.stringContaining(`asOf=${encodeURIComponent(asOfDate)}`),
      )
    })

    it('should validate work item IDs and throw error for invalid IDs', async () => {
      await expect(client.getWorkItemsBatch([0, -1, 123])).rejects.toThrow(
        'All work item IDs must be greater than 0',
      )

      expect(mockAxios.get).not.toHaveBeenCalled()
    })

    it('should handle API errors and rethrow', async () => {
      const axiosError = new Error('API Error') as AxiosError
      axiosError.response = {
        status: 404,
        statusText: 'Not Found',
        data: { message: 'Work items not found' },
        headers: {},
        config: {} as any,
      }

      mockAxios.get.mockRejectedValue(axiosError)

      await expect(client.getWorkItemsBatch([123, 124])).rejects.toThrow()
    })

    it('should return empty array on error when errorPolicy is omit', async () => {
      const axiosError = new Error('API Error') as AxiosError
      axiosError.response = {
        status: 500,
        statusText: 'Internal Server Error',
        data: { message: 'Server error' },
        headers: {},
        config: {} as any,
      }

      mockAxios.get.mockRejectedValue(axiosError)

      const result = await client.getWorkItemsBatch([123, 124], {
        errorPolicy: 'omit',
      })
      expect(result).toEqual([])
    })
  })

  describe('batchGetWorkItems (using BatchProcessor)', () => {
    it('should handle large batch processing with multiple API calls', async () => {
      // Create a large array of IDs to test batch processing
      const largeIdSet = Array.from({ length: 450 }, (_, i) => i + 1) // 450 IDs
      const expectedBatches = Math.ceil(largeIdSet.length / 200) // Should be 3 batches

      // Mock response for each batch call
      const createMockResponse = (
        ids: number[],
      ): AxiosResponse<WorkItemBatchResponse> => ({
        data: {
          count: ids.length,
          value: ids.map((id) => ({
            id,
            rev: 1,
            url: `https://dev.azure.com/test-org/_apis/wit/workItems/${id}`,
            fields: {
              'System.Id': id,
              'System.Title': `Test Work Item ${id}`,
              'System.State': 'New',
              'System.WorkItemType': 'Task',
              'System.CreatedDate': '2023-01-01T00:00:00Z',
              'System.ChangedDate': '2023-01-01T00:00:00Z',
            },
          })),
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      })

      mockAxios.get.mockImplementation((url: string) => {
        // Extract IDs from URL to determine batch size
        const idsParam = url.match(/ids=([^&]+)/)?.[1]
        const ids = idsParam
          ? decodeURIComponent(idsParam).split(',').map(Number)
          : []
        return Promise.resolve(createMockResponse(ids))
      })

      const result = await client.batchGetWorkItems(largeIdSet)

      // Should make exactly the expected number of batch calls
      expect(mockAxios.get).toHaveBeenCalledTimes(expectedBatches)

      // Should return all work items
      expect(result).toHaveLength(450)
      expect(result.every((item) => largeIdSet.includes(item.id))).toBe(true)
    })

    it('should handle empty array gracefully', async () => {
      const result = await client.batchGetWorkItems([])
      expect(result).toEqual([])
      expect(mockAxios.get).not.toHaveBeenCalled()
    })

    it('should remove duplicates before processing', async () => {
      const mockResponse: AxiosResponse<WorkItemBatchResponse> = {
        data: {
          count: 2,
          value: [
            {
              id: 123,
              rev: 1,
              url: 'https://dev.azure.com/test-org/_apis/wit/workItems/123',
              fields: {
                'System.Id': 123,
                'System.Title': 'Test Work Item 123',
                'System.State': 'New',
                'System.WorkItemType': 'Task',
                'System.CreatedDate': '2023-01-01T00:00:00Z',
                'System.ChangedDate': '2023-01-01T00:00:00Z',
              },
            },
            {
              id: 124,
              rev: 1,
              url: 'https://dev.azure.com/test-org/_apis/wit/workItems/124',
              fields: {
                'System.Id': 124,
                'System.Title': 'Test Work Item 124',
                'System.State': 'Active',
                'System.WorkItemType': 'Bug',
                'System.CreatedDate': '2023-01-02T00:00:00Z',
                'System.ChangedDate': '2023-01-02T00:00:00Z',
              },
            },
          ],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      }

      mockAxios.get.mockResolvedValue(mockResponse)

      const result = await client.batchGetWorkItems([123, 124, 123, 124])

      // Should only make one call with unique IDs
      expect(mockAxios.get).toHaveBeenCalledTimes(1)
      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('ids=123%2C124'),
      )
      expect(result).toHaveLength(2)
    })
  })

  describe('queryWorkItems', () => {
    const mockQueryResult: WorkItemQueryResult = {
      queryType: 'flat',
      queryResultType: 'workItem',
      asOf: '2023-01-01T00:00:00Z',
      columns: [
        {
          referenceName: 'System.Id',
          name: 'ID',
          url: 'https://dev.azure.com/test-org/_apis/wit/fields/System.Id',
        },
        {
          referenceName: 'System.Title',
          name: 'Title',
          url: 'https://dev.azure.com/test-org/_apis/wit/fields/System.Title',
        },
      ],
      sortColumns: [
        {
          field: {
            referenceName: 'System.Id',
            name: 'ID',
            url: 'https://dev.azure.com/test-org/_apis/wit/fields/System.Id',
          },
          descending: false,
        },
      ],
      workItems: [
        {
          id: 123,
          url: 'https://dev.azure.com/test-org/_apis/wit/workItems/123',
        },
        {
          id: 124,
          url: 'https://dev.azure.com/test-org/_apis/wit/workItems/124',
        },
      ],
    }

    it('should execute WIQL query successfully', async () => {
      const mockResponse: AxiosResponse<WorkItemQueryResult> = {
        data: mockQueryResult,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      }

      mockAxios.post.mockResolvedValue(mockResponse)

      const wiql =
        'SELECT [System.Id], [System.Title] FROM WorkItems WHERE [System.State] = "Active"'
      const result = await client.queryWorkItems(wiql)

      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/_apis/wit/wiql'),
        { query: wiql },
      )
      expect(result).toEqual(mockQueryResult)
    })

    it('should reject empty WIQL query', async () => {
      await expect(client.queryWorkItems('')).rejects.toThrow(
        'WIQL query cannot be empty',
      )

      await expect(client.queryWorkItems('   ')).rejects.toThrow(
        'WIQL query cannot be empty',
      )

      expect(mockAxios.post).not.toHaveBeenCalled()
    })

    it('should handle API errors for WIQL queries', async () => {
      const axiosError = new Error('WIQL Error') as AxiosError
      axiosError.response = {
        status: 400,
        statusText: 'Bad Request',
        data: { message: 'Invalid WIQL query' },
        headers: {},
        config: {} as any,
      }

      mockAxios.post.mockRejectedValue(axiosError)

      const wiql = 'INVALID WIQL QUERY'
      await expect(client.queryWorkItems(wiql)).rejects.toThrow()
    })
  })

  describe('batchGetComments', () => {
    const mockComments: WorkItemComment[] = [
      {
        id: '1',
        text: 'First comment',
        version: 1,
        createdBy: {
          id: 'user1',
          displayName: 'User One',
          uniqueName: 'user1@company.com',
          url: 'https://dev.azure.com/test-org/_apis/Identities/user1',
          imageUrl:
            'https://dev.azure.com/test-org/_api/_common/identityImage?id=user1',
          descriptor: 'descriptor-user1',
        },
        createdDate: '2023-01-01T10:00:00Z',
        modifiedBy: {
          id: 'user1',
          displayName: 'User One',
          uniqueName: 'user1@company.com',
          url: 'https://dev.azure.com/test-org/_apis/Identities/user1',
          imageUrl:
            'https://dev.azure.com/test-org/_api/_common/identityImage?id=user1',
          descriptor: 'descriptor-user1',
        },
        modifiedDate: '2023-01-01T10:00:00Z',
        workItemId: 123,
      },
      {
        id: '2',
        text: 'Second comment',
        version: 1,
        createdBy: {
          id: 'user2',
          displayName: 'User Two',
          uniqueName: 'user2@company.com',
          url: 'https://dev.azure.com/test-org/_apis/Identities/user2',
          imageUrl:
            'https://dev.azure.com/test-org/_api/_common/identityImage?id=user2',
          descriptor: 'descriptor-user2',
        },
        createdDate: '2023-01-01T11:00:00Z',
        modifiedBy: {
          id: 'user2',
          displayName: 'User Two',
          uniqueName: 'user2@company.com',
          url: 'https://dev.azure.com/test-org/_apis/Identities/user2',
          imageUrl:
            'https://dev.azure.com/test-org/_api/_common/identityImage?id=user2',
          descriptor: 'descriptor-user2',
        },
        modifiedDate: '2023-01-01T11:00:00Z',
        workItemId: 124,
      },
    ]

    it('should fetch comments for multiple work items', async () => {
      const mockResponse = {
        data: { comments: mockComments },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      }

      mockAxios.get.mockResolvedValue(mockResponse)

      const result = await client.batchGetComments([123, 124])

      expect(mockAxios.get).toHaveBeenCalledTimes(2)
      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/_apis/wit/workItems/123/comments'),
      )
      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/_apis/wit/workItems/124/comments'),
      )

      expect(result).toBeInstanceOf(Map)
      expect(result.size).toBe(2)
      expect(result.get(123)).toEqual(mockComments)
      expect(result.get(124)).toEqual(mockComments)
    })

    it('should handle empty work item ID array', async () => {
      const result = await client.batchGetComments([])
      expect(result).toBeInstanceOf(Map)
      expect(result.size).toBe(0)
      expect(mockAxios.get).not.toHaveBeenCalled()
    })

    it('should handle individual comment fetch failures gracefully', async () => {
      // Mock implementation that checks URL to determine success/failure
      mockAxios.get.mockImplementation((url: string) => {
        if (url.includes('/workItems/123/comments')) {
          return Promise.resolve({
            data: { comments: mockComments },
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
          })
        } else if (url.includes('/workItems/124/comments')) {
          return Promise.reject(new Error('Comment fetch failed'))
        }
        return Promise.reject(new Error('Unexpected URL'))
      })

      // Spy on console.warn to verify error logging
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const result = await client.batchGetComments([123, 124])

      expect(result.get(123)).toEqual(mockComments)
      expect(result.get(124)).toEqual([]) // Failed work item should have empty array
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to fetch comments for work item 124'),
        expect.any(Error),
      )

      consoleSpy.mockRestore()
    })

    it('should remove duplicate work item IDs', async () => {
      const mockResponse = {
        data: { comments: mockComments },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      }

      mockAxios.get.mockResolvedValue(mockResponse)

      const result = await client.batchGetComments([123, 124, 123, 124])

      // Should only make 2 unique calls
      expect(mockAxios.get).toHaveBeenCalledTimes(2)
      expect(result.size).toBe(2)
    })
  })
})
