import { describe, it, expect, beforeEach, vi } from 'vitest'
import axios from 'axios'
import { AzureDevOpsRestClient } from '../src/client.js'
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
describe('AzureDevOpsRestClient', () => {
  let config
  let client
  let mockAxios
  beforeEach(() => {
    vi.clearAllMocks()
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
    axios.create.mockReturnValue(mockAxios)
    client = new AzureDevOpsRestClient(config)
  })
  describe('constructor', () => {
    it('should initialize with valid config', () => {
      expect(client).toBeInstanceOf(AzureDevOpsRestClient)
    })
    it('should create axios instance with correct configuration', () => {
      expect(axios.create).toHaveBeenCalledWith({
        timeout: 30000,
        headers: {
          Authorization: expect.stringContaining('Basic '),
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': 'azure-devops-client/1.0.0',
        },
      })
    })
    it('should setup request and response interceptors', () => {
      expect(mockAxios.interceptors.request.use).toHaveBeenCalled()
      expect(mockAxios.interceptors.response.use).toHaveBeenCalled()
    })
    it('should throw error for invalid config', () => {
      const invalidConfig = { ...config, pat: '' }
      expect(() => new AzureDevOpsRestClient(invalidConfig)).toThrow()
    })
    it('should use custom rate limit config if provided', () => {
      const configWithRateLimit = {
        ...config,
        rateLimit: {
          maxConcurrent: 5,
          requestsPerSecond: 10,
          respectHeaders: true,
        },
      }
      const clientWithRateLimit = new AzureDevOpsRestClient(configWithRateLimit)
      expect(clientWithRateLimit).toBeInstanceOf(AzureDevOpsRestClient)
    })
    it('should use custom retry config if provided', () => {
      const configWithRetry = {
        ...config,
        retry: {
          maxAttempts: 5,
          baseDelay: 2000,
          maxDelay: 30000,
          backoffFactor: 2,
        },
      }
      const clientWithRetry = new AzureDevOpsRestClient(configWithRetry)
      expect(clientWithRetry).toBeInstanceOf(AzureDevOpsRestClient)
    })
  })
  describe('getWorkItem', () => {
    const mockWorkItem = {
      id: 123,
      rev: 1,
      url: 'https://dev.azure.com/test-org/_apis/wit/workItems/123',
      fields: {
        'System.Id': 123,
        'System.Title': 'Test Work Item',
        'System.State': 'New',
        'System.WorkItemType': 'Task',
        'System.CreatedDate': '2023-01-01T00:00:00Z',
        'System.ChangedDate': '2023-01-01T00:00:00Z',
      },
    }
    it('should fetch single work item successfully', async () => {
      const mockResponse = {
        data: mockWorkItem,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      }
      mockAxios.get.mockResolvedValue(mockResponse)
      const result = await client.getWorkItem(123)
      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/_apis/wit/workitems/123'),
      )
      expect(result).toEqual(mockWorkItem)
    })
    it('should handle expand parameter', async () => {
      const mockResponse = {
        data: mockWorkItem,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      }
      mockAxios.get.mockResolvedValue(mockResponse)
      await client.getWorkItem(123, 'all')
      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('$expand=all'),
      )
    })
    it('should throw error for invalid work item ID', async () => {
      await expect(client.getWorkItem(0)).rejects.toThrow(
        'Work item ID must be greater than 0',
      )
      await expect(client.getWorkItem(-1)).rejects.toThrow(
        'Work item ID must be greater than 0',
      )
    })
    it('should handle 404 errors gracefully', async () => {
      const error = {
        response: {
          status: 404,
          data: { message: 'Work item not found' },
          statusText: 'Not Found',
          headers: {},
          config: {},
        },
      }
      mockAxios.get.mockRejectedValue(error)
      await expect(client.getWorkItem(999)).rejects.toThrow(
        'Work item 999 not found',
      )
    })
    it('should handle network errors', async () => {
      const error = {
        code: 'NETWORK_ERROR',
        message: 'Network Error',
      }
      mockAxios.get.mockRejectedValue(error)
      await expect(client.getWorkItem(123)).rejects.toThrow(
        'Network error occurred',
      )
    })
  })
  describe('queryWorkItems', () => {
    const mockQueryResult = {
      queryType: 'flat',
      queryResultType: 'workItem',
      asOf: '2023-01-01T00:00:00Z',
      columns: [],
      sortColumns: [],
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
      const mockResponse = {
        data: mockQueryResult,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      }
      mockAxios.post.mockResolvedValue(mockResponse)
      const wiql =
        "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'"
      const result = await client.queryWorkItems(wiql)
      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/_apis/wit/wiql'),
        { query: wiql },
      )
      expect(result).toEqual(mockQueryResult)
    })
    it('should validate WIQL query is not empty', async () => {
      await expect(client.queryWorkItems('')).rejects.toThrow(
        'WIQL query cannot be empty',
      )
      await expect(client.queryWorkItems('   ')).rejects.toThrow(
        'WIQL query cannot be empty',
      )
    })
    it('should handle malformed WIQL queries', async () => {
      const error = {
        response: {
          status: 400,
          data: {
            message: 'Invalid WIQL query syntax',
            typeKey: 'InvalidQueryException',
          },
          statusText: 'Bad Request',
          headers: {},
          config: {},
        },
      }
      mockAxios.post.mockRejectedValue(error)
      const invalidWiql = 'INVALID QUERY SYNTAX'
      await expect(client.queryWorkItems(invalidWiql)).rejects.toThrow(
        'Invalid WIQL query',
      )
    })
  })
  describe('batchGetWorkItems', () => {
    const mockWorkItems = [
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
          'System.CreatedDate': '2023-01-01T00:00:00Z',
          'System.ChangedDate': '2023-01-01T00:00:00Z',
        },
      },
    ]
    it('should fetch multiple work items in batch', async () => {
      const mockResponse = {
        data: { value: mockWorkItems },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      }
      mockAxios.get.mockResolvedValue(mockResponse)
      const result = await client.batchGetWorkItems([123, 124])
      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('ids=123%2C124'),
      )
      expect(result).toEqual(mockWorkItems)
    })
    it('should handle empty IDs array', async () => {
      const result = await client.batchGetWorkItems([])
      expect(result).toEqual([])
      expect(mockAxios.get).not.toHaveBeenCalled()
    })
    it('should split large batches into multiple requests', async () => {
      const largeIdArray = Array.from({ length: 300 }, (_, i) => i + 1)
      const mockResponse = {
        data: { value: [] },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      }
      mockAxios.get.mockResolvedValue(mockResponse)
      await client.batchGetWorkItems(largeIdArray)
      // Should make 2 requests (200 + 100 items)
      expect(mockAxios.get).toHaveBeenCalledTimes(2)
    })
    it('should validate work item IDs are positive', async () => {
      await expect(client.batchGetWorkItems([1, 0, 3])).rejects.toThrow(
        'All work item IDs must be greater than 0',
      )
      await expect(client.batchGetWorkItems([1, -1, 3])).rejects.toThrow(
        'All work item IDs must be greater than 0',
      )
    })
    it('should remove duplicate IDs', async () => {
      const mockResponse = {
        data: { value: [mockWorkItems[0]] },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      }
      mockAxios.get.mockResolvedValue(mockResponse)
      await client.batchGetWorkItems([123, 123, 123])
      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('ids=123'),
      )
    })
  })
  describe('getWorkItemComments', () => {
    const mockComments = [
      {
        id: 'comment-1',
        workItemId: 123,
        text: 'Test comment 1',
        createdBy: {
          displayName: 'Test User',
          url: 'https://dev.azure.com/_apis/Identities/user-1',
          id: 'user-1',
          uniqueName: 'test@example.com',
          imageUrl:
            'https://dev.azure.com/_apis/GraphProfile/MemberAvatars/user-1',
          descriptor: 'descriptor-1',
        },
        createdDate: '2023-01-01T00:00:00Z',
        version: 1,
      },
    ]
    it('should fetch work item comments successfully', async () => {
      const mockResponse = {
        data: {
          comments: mockComments,
          count: 1,
          totalCount: 1,
          fromRevisionCount: 1,
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      }
      mockAxios.get.mockResolvedValue(mockResponse)
      const result = await client.getWorkItemComments(123)
      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/_apis/wit/workItems/123/comments'),
      )
      expect(result).toEqual(mockComments)
    })
    it('should validate work item ID', async () => {
      await expect(client.getWorkItemComments(0)).rejects.toThrow(
        'Work item ID must be greater than 0',
      )
      await expect(client.getWorkItemComments(-1)).rejects.toThrow(
        'Work item ID must be greater than 0',
      )
    })
    it('should handle work items with no comments', async () => {
      const mockResponse = {
        data: { comments: [], count: 0, totalCount: 0, fromRevisionCount: 0 },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      }
      mockAxios.get.mockResolvedValue(mockResponse)
      const result = await client.getWorkItemComments(123)
      expect(result).toEqual([])
    })
  })
  describe('addWorkItemComment', () => {
    const mockComment = {
      id: 'comment-new',
      workItemId: 123,
      text: 'New test comment',
      createdBy: {
        displayName: 'Test User',
        url: 'https://dev.azure.com/_apis/Identities/user-1',
        id: 'user-1',
        uniqueName: 'test@example.com',
        imageUrl:
          'https://dev.azure.com/_apis/GraphProfile/MemberAvatars/user-1',
        descriptor: 'descriptor-1',
      },
      createdDate: '2023-01-01T00:00:00Z',
      version: 1,
    }
    it('should add comment to work item successfully', async () => {
      const mockResponse = {
        data: mockComment,
        status: 201,
        statusText: 'Created',
        headers: {},
        config: {},
      }
      mockAxios.post.mockResolvedValue(mockResponse)
      const result = await client.addWorkItemComment(123, 'New test comment')
      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/_apis/wit/workItems/123/comments'),
        { text: 'New test comment' },
      )
      expect(result).toEqual(mockComment)
    })
    it('should validate work item ID', async () => {
      await expect(client.addWorkItemComment(0, 'test')).rejects.toThrow(
        'Work item ID must be greater than 0',
      )
      await expect(client.addWorkItemComment(-1, 'test')).rejects.toThrow(
        'Work item ID must be greater than 0',
      )
    })
    it('should validate comment text is not empty', async () => {
      await expect(client.addWorkItemComment(123, '')).rejects.toThrow(
        'Comment text cannot be empty',
      )
      await expect(client.addWorkItemComment(123, '   ')).rejects.toThrow(
        'Comment text cannot be empty',
      )
    })
    it('should handle comments that are too long', async () => {
      const longComment = 'x'.repeat(10000) // Assume there's a length limit
      const error = {
        response: {
          status: 400,
          data: { message: 'Comment text is too long' },
          statusText: 'Bad Request',
          headers: {},
          config: {},
        },
      }
      mockAxios.post.mockRejectedValue(error)
      await expect(client.addWorkItemComment(123, longComment)).rejects.toThrow(
        'Comment text is too long',
      )
    })
  })
  describe('error handling', () => {
    it('should handle authentication errors', async () => {
      const error = {
        response: {
          status: 401,
          data: { message: 'Unauthorized' },
          statusText: 'Unauthorized',
          headers: {},
          config: {},
        },
      }
      mockAxios.get.mockRejectedValue(error)
      await expect(client.getWorkItem(123)).rejects.toThrow(
        'Authentication failed',
      )
    })
    it('should handle rate limiting errors', async () => {
      const error = {
        response: {
          status: 429,
          data: { message: 'Rate limit exceeded' },
          statusText: 'Too Many Requests',
          headers: {
            'x-ratelimit-reset': '60',
            'x-ratelimit-remaining': '0',
          },
          config: {},
        },
      }
      mockAxios.get.mockRejectedValue(error)
      await expect(client.getWorkItem(123)).rejects.toThrow(
        'Rate limit exceeded',
      )
    })
    it('should handle server errors', async () => {
      const error = {
        response: {
          status: 500,
          data: { message: 'Internal Server Error' },
          statusText: 'Internal Server Error',
          headers: {},
          config: {},
        },
      }
      mockAxios.get.mockRejectedValue(error)
      await expect(client.getWorkItem(123)).rejects.toThrow(
        'Azure DevOps server error',
      )
    })
    it('should handle timeout errors', async () => {
      const error = {
        code: 'ECONNABORTED',
        message: 'timeout of 30000ms exceeded',
      }
      mockAxios.get.mockRejectedValue(error)
      await expect(client.getWorkItem(123)).rejects.toThrow('Request timeout')
    })
  })
})
//# sourceMappingURL=client.test.js.map
