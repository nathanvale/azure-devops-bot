import {
  describe,
  it,
  expect,
  beforeEach,
  vi,
  type MockedFunction,
} from 'vitest'

import type { WorkItemComment } from '../src/types/comments.js'
import type { AzureDevOpsClientConfig } from '../src/types/config.js'
import type {
  WorkItem,
  WorkItemQueryResult,
  AzureDevOpsPerson,
} from '../src/types/work-items.js'

import { AzureDevOpsRestClient } from '../src/client.js'
import { AzureDevOpsProvider } from '../src/provider.js'

// Mock the AzureDevOpsRestClient
vi.mock('../src/client.js', () => ({
  AzureDevOpsRestClient: vi.fn().mockImplementation(() => ({
    queryWorkItems: vi.fn(),
    batchGetWorkItems: vi.fn(),
    getWorkItem: vi.fn(),
    getWorkItemComments: vi.fn(),
  })),
}))

describe('AzureDevOpsProvider', () => {
  let provider: AzureDevOpsProvider
  let mockClient: any
  let config: AzureDevOpsClientConfig

  const mockPerson: AzureDevOpsPerson = {
    displayName: 'John Doe',
    url: 'https://dev.azure.com/test-org/_apis/Identities/user-123',
    id: 'user-123',
    uniqueName: 'john.doe@company.com',
    imageUrl: 'https://dev.azure.com/test-org/_api/_common/identityImage',
    descriptor: 'descriptor-123',
  }

  const mockWorkItem: WorkItem = {
    id: 123,
    rev: 5,
    url: 'https://dev.azure.com/test-org/test-project/_apis/wit/workItems/123',
    fields: {
      'System.Id': 123,
      'System.Title': 'Test Work Item',
      'System.State': 'Active',
      'System.WorkItemType': 'Task',
      'System.AssignedTo': mockPerson,
      'System.CreatedDate': '2023-01-01T00:00:00Z',
      'System.ChangedDate': '2023-01-02T00:00:00Z',
      'System.Description': 'Test description',
      'System.Tags': 'tag1; tag2; tag3',
      'System.AreaPath': 'MyProject\\Backend',
      'System.IterationPath': 'MyProject\\Sprint 1',
    },
    relations: [],
    _links: {
      self: {
        href: 'https://dev.azure.com/test-org/test-project/_apis/wit/workItems/123',
      },
      workItemUpdates: {
        href: 'https://dev.azure.com/test-org/test-project/_apis/wit/workItems/123/updates',
      },
      workItemRevisions: {
        href: 'https://dev.azure.com/test-org/test-project/_apis/wit/workItems/123/revisions',
      },
      workItemComments: {
        href: 'https://dev.azure.com/test-org/test-project/_apis/wit/workItems/123/comments',
      },
      html: {
        href: 'https://dev.azure.com/test-org/test-project/_workitems/edit/123',
      },
      workItemType: {
        href: 'https://dev.azure.com/test-org/test-project/_apis/wit/workItemTypes/Task',
      },
      fields: {
        href: 'https://dev.azure.com/test-org/test-project/_apis/wit/fields',
      },
    },
  }

  const mockComment: WorkItemComment = {
    id: 'comment-123',
    workItemId: 123,
    text: 'This is a test comment',
    version: 1,
    createdBy: mockPerson,
    createdDate: '2023-01-01T10:00:00Z',
    modifiedBy: mockPerson,
    modifiedDate: '2023-01-01T10:30:00Z',
  }

  beforeEach(() => {
    vi.clearAllMocks()

    config = {
      organization: 'test-org',
      project: 'test-project',
      pat: 'test-personal-access-token-123456789012345678901234567890',
    }

    mockClient = {
      queryWorkItems: vi.fn(),
      batchGetWorkItems: vi.fn(),
      getWorkItem: vi.fn(),
      getWorkItemComments: vi.fn(),
    }
    ;(AzureDevOpsRestClient as any).mockImplementation(() => mockClient)

    provider = new AzureDevOpsProvider(config)
  })

  describe('constructor', () => {
    it('should create instance with correct configuration', () => {
      expect(AzureDevOpsRestClient).toHaveBeenCalledWith(config)
      expect(provider).toBeInstanceOf(AzureDevOpsProvider)
    })
  })

  describe('getProviderInfo', () => {
    it('should return correct provider information', () => {
      const info = provider.getProviderInfo()

      expect(info).toEqual({
        name: 'Azure DevOps REST API Provider',
        version: '1.0.0',
        supports: {
          batchOperations: true,
          realTimeUpdates: false,
          customFields: true,
        },
      })
    })
  })

  describe('getClient', () => {
    it('should return the underlying REST client', () => {
      const client = provider.getClient()
      expect(client).toBe(mockClient)
    })
  })

  describe('fetchWorkItems', () => {
    it('should return empty array when no query provided', async () => {
      const result = await provider.fetchWorkItems()
      expect(result).toEqual([])
    })

    it('should fetch work items with query filters', async () => {
      const mockQueryResult: WorkItemQueryResult = {
        queryType: 'flat',
        queryResultType: 'workItem',
        asOf: '2023-01-01T00:00:00Z',
        columns: [],
        sortColumns: [],
        workItems: [{ id: 123, url: mockWorkItem.url }],
      }

      mockClient.queryWorkItems.mockResolvedValue(mockQueryResult)
      mockClient.batchGetWorkItems.mockResolvedValue([mockWorkItem])

      const query = {
        filters: {
          state: ['Active'],
          type: ['Task'],
        },
      }

      const result = await provider.fetchWorkItems(query)

      expect(mockClient.queryWorkItems).toHaveBeenCalledWith(
        expect.stringContaining("[System.State] = 'Active'"),
      )
      expect(mockClient.queryWorkItems).toHaveBeenCalledWith(
        expect.stringContaining("[System.WorkItemType] = 'Task'"),
      )
      expect(mockClient.batchGetWorkItems).toHaveBeenCalledWith([123])
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        id: 123,
        title: 'Test Work Item',
        state: 'Active',
        type: 'Task',
        assignedTo: 'John Doe',
        createdDate: '2023-01-01T00:00:00Z',
        changedDate: '2023-01-02T00:00:00Z',
        description: 'Test description',
        tags: ['tag1', 'tag2', 'tag3'],
        raw: expect.objectContaining({
          'System.Id': 123,
          'System.Title': 'Test Work Item',
        }),
      })
    })

    it('should return empty array when no work items match query', async () => {
      const mockQueryResult: WorkItemQueryResult = {
        queryType: 'flat',
        queryResultType: 'workItem',
        asOf: '2023-01-01T00:00:00Z',
        columns: [],
        sortColumns: [],
        workItems: [],
      }

      mockClient.queryWorkItems.mockResolvedValue(mockQueryResult)

      const query = {
        filters: {
          state: ['NonExistentState'],
        },
      }

      const result = await provider.fetchWorkItems(query)
      expect(result).toEqual([])
      expect(mockClient.batchGetWorkItems).not.toHaveBeenCalled()
    })

    it('should build correct WIQL query with multiple filters', async () => {
      const mockQueryResult: WorkItemQueryResult = {
        queryType: 'flat',
        queryResultType: 'workItem',
        asOf: '2023-01-01T00:00:00Z',
        columns: [],
        sortColumns: [],
        workItems: [],
      }

      mockClient.queryWorkItems.mockResolvedValue(mockQueryResult)

      const query = {
        filters: {
          state: ['Active', 'New'],
          type: ['Task', 'Bug'],
          assignedTo: ['john.doe@company.com'],
          area: ['MyProject\\Backend'],
          iteration: ['MyProject\\Sprint 1'],
        },
        orderBy: 'createdDate',
        orderDirection: 'desc' as const,
      }

      await provider.fetchWorkItems(query)

      const expectedWiql = expect.stringContaining(
        'ORDER BY [System.CreatedDate] DESC',
      )
      expect(mockClient.queryWorkItems).toHaveBeenCalledWith(expectedWiql)
    })

    it('should handle fetch work items errors', async () => {
      const query = {
        filters: { state: ['Active'] },
      }

      mockClient.queryWorkItems.mockRejectedValue(new Error('API Error'))

      await expect(provider.fetchWorkItems(query)).rejects.toThrow(
        'Failed to fetch work items: API Error',
      )
    })
  })

  describe('getWorkItem', () => {
    it('should get work item by numeric ID', async () => {
      mockClient.getWorkItem.mockResolvedValue(mockWorkItem)

      const result = await provider.getWorkItem(123)

      expect(mockClient.getWorkItem).toHaveBeenCalledWith(123, 'all')
      expect(result).toEqual({
        id: 123,
        title: 'Test Work Item',
        state: 'Active',
        type: 'Task',
        assignedTo: 'John Doe',
        createdDate: '2023-01-01T00:00:00Z',
        changedDate: '2023-01-02T00:00:00Z',
        description: 'Test description',
        tags: ['tag1', 'tag2', 'tag3'],
        raw: expect.any(Object),
      })
    })

    it('should get work item by string ID', async () => {
      mockClient.getWorkItem.mockResolvedValue(mockWorkItem)

      const result = await provider.getWorkItem('123')

      expect(mockClient.getWorkItem).toHaveBeenCalledWith(123, 'all')
      expect(result).not.toBeNull()
    })

    it('should return null for invalid ID', async () => {
      const result = await provider.getWorkItem('invalid')
      expect(result).toBeNull()
      expect(mockClient.getWorkItem).not.toHaveBeenCalled()
    })

    it('should return null for zero or negative ID', async () => {
      const result1 = await provider.getWorkItem(0)
      const result2 = await provider.getWorkItem(-1)

      expect(result1).toBeNull()
      expect(result2).toBeNull()
      expect(mockClient.getWorkItem).not.toHaveBeenCalled()
    })

    it('should return null when work item not found (404)', async () => {
      const error = new Error('Work item not found')
      error.message = 'HTTP 404: Work item not found'
      mockClient.getWorkItem.mockRejectedValue(error)

      const result = await provider.getWorkItem(999)
      expect(result).toBeNull()
    })

    it('should throw error for non-404 errors', async () => {
      mockClient.getWorkItem.mockRejectedValue(new Error('Server error'))

      await expect(provider.getWorkItem(123)).rejects.toThrow(
        'Failed to get work item 123: Server error',
      )
    })

    it('should handle work item with string assignedTo field', async () => {
      const workItemWithStringAssignee = {
        ...mockWorkItem,
        fields: {
          ...mockWorkItem.fields,
          'System.AssignedTo': 'john.doe@company.com',
        },
      }

      mockClient.getWorkItem.mockResolvedValue(workItemWithStringAssignee)

      const result = await provider.getWorkItem(123)
      expect(result?.assignedTo).toBe('john.doe@company.com')
    })

    it('should handle work item without tags', async () => {
      const workItemWithoutTags = {
        ...mockWorkItem,
        fields: {
          ...mockWorkItem.fields,
          'System.Tags': undefined,
        },
      }

      mockClient.getWorkItem.mockResolvedValue(workItemWithoutTags)

      const result = await provider.getWorkItem(123)
      expect(result?.tags).toBeUndefined()
    })
  })

  describe('getComments', () => {
    it('should get comments for work item by numeric ID', async () => {
      mockClient.getWorkItemComments.mockResolvedValue([mockComment])

      const result = await provider.getComments(123)

      expect(mockClient.getWorkItemComments).toHaveBeenCalledWith(123)
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        id: 'comment-123',
        workItemId: 123,
        text: 'This is a test comment',
        author: 'John Doe',
        createdDate: '2023-01-01T10:00:00Z',
        modifiedDate: '2023-01-01T10:30:00Z',
        raw: expect.objectContaining({
          version: 1,
          workItemId: 123,
        }),
      })
    })

    it('should get comments for work item by string ID', async () => {
      mockClient.getWorkItemComments.mockResolvedValue([mockComment])

      const result = await provider.getComments('123')

      expect(mockClient.getWorkItemComments).toHaveBeenCalledWith(123)
      expect(result).toHaveLength(1)
    })

    it('should return empty array for invalid ID', async () => {
      const result = await provider.getComments('invalid')
      expect(result).toEqual([])
      expect(mockClient.getWorkItemComments).not.toHaveBeenCalled()
    })

    it('should return empty array for zero or negative ID', async () => {
      const result1 = await provider.getComments(0)
      const result2 = await provider.getComments(-1)

      expect(result1).toEqual([])
      expect(result2).toEqual([])
      expect(mockClient.getWorkItemComments).not.toHaveBeenCalled()
    })

    it('should return empty array when comments cannot be fetched', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      mockClient.getWorkItemComments.mockRejectedValue(
        new Error('Comments error'),
      )

      const result = await provider.getComments(123)

      expect(result).toEqual([])
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to fetch comments for work item 123'),
        expect.any(Error),
      )

      consoleSpy.mockRestore()
    })

    it('should handle comments with different person formats', async () => {
      const commentWithStringAuthor = {
        ...mockComment,
        createdBy: 'string-author@company.com' as any,
      }

      mockClient.getWorkItemComments.mockResolvedValue([
        commentWithStringAuthor,
      ])

      const result = await provider.getComments(123)
      expect(result).toHaveLength(1)
      expect(result[0]!.author).toBe('string-author@company.com')
    })
  })

  describe('WIQL query building', () => {
    beforeEach(() => {
      const mockQueryResult: WorkItemQueryResult = {
        queryType: 'flat',
        queryResultType: 'workItem',
        asOf: '2023-01-01T00:00:00Z',
        columns: [],
        sortColumns: [],
        workItems: [],
      }
      mockClient.queryWorkItems.mockResolvedValue(mockQueryResult)
    })

    it('should build WIQL with state filter', async () => {
      await provider.fetchWorkItems({
        filters: { state: ['Active', 'Resolved'] },
      })

      expect(mockClient.queryWorkItems).toHaveBeenCalledWith(
        expect.stringContaining(
          "([System.State] = 'Active' OR [System.State] = 'Resolved')",
        ),
      )
    })

    it('should build WIQL with type filter', async () => {
      await provider.fetchWorkItems({
        filters: { type: ['Task', 'Bug'] },
      })

      expect(mockClient.queryWorkItems).toHaveBeenCalledWith(
        expect.stringContaining(
          "([System.WorkItemType] = 'Task' OR [System.WorkItemType] = 'Bug')",
        ),
      )
    })

    it('should build WIQL with assignedTo filter', async () => {
      await provider.fetchWorkItems({
        filters: { assignedTo: ['user1@company.com', 'user2@company.com'] },
      })

      expect(mockClient.queryWorkItems).toHaveBeenCalledWith(
        expect.stringContaining("[System.AssignedTo] = 'user1@company.com'"),
      )
    })

    it('should build WIQL with area filter', async () => {
      await provider.fetchWorkItems({
        filters: { area: ['MyProject\\Frontend'] },
      })

      expect(mockClient.queryWorkItems).toHaveBeenCalledWith(
        expect.stringContaining(
          "[System.AreaPath] UNDER 'MyProject\\Frontend'",
        ),
      )
    })

    it('should build WIQL with iteration filter', async () => {
      await provider.fetchWorkItems({
        filters: { iteration: ['MyProject\\Sprint 1'] },
      })

      expect(mockClient.queryWorkItems).toHaveBeenCalledWith(
        expect.stringContaining(
          "[System.IterationPath] UNDER 'MyProject\\Sprint 1'",
        ),
      )
    })

    it('should build WIQL with ordering', async () => {
      await provider.fetchWorkItems({
        filters: { state: ['Active'] },
        orderBy: 'title',
        orderDirection: 'asc',
      })

      expect(mockClient.queryWorkItems).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY [System.Title] ASC'),
      )
    })

    it('should use default ASC ordering when direction not specified', async () => {
      await provider.fetchWorkItems({
        filters: { state: ['Active'] },
        orderBy: 'changedDate',
      })

      expect(mockClient.queryWorkItems).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY [System.ChangedDate] ASC'),
      )
    })
  })

  describe('data mapping', () => {
    it('should map work item with minimal fields', async () => {
      const minimalWorkItem: WorkItem = {
        id: 456,
        rev: 1,
        url: 'https://dev.azure.com/test-org/test-project/_apis/wit/workItems/456',
        fields: {
          'System.Id': 456,
          'System.Title': 'Minimal Item',
          'System.State': 'New',
          'System.WorkItemType': 'Bug',
          'System.CreatedDate': '2023-01-01T00:00:00Z',
          'System.ChangedDate': '2023-01-01T00:00:00Z',
        },
      }

      mockClient.getWorkItem.mockResolvedValue(minimalWorkItem)

      const result = await provider.getWorkItem(456)

      expect(result).toEqual({
        id: 456,
        title: 'Minimal Item',
        state: 'New',
        type: 'Bug',
        assignedTo: undefined,
        createdDate: '2023-01-01T00:00:00Z',
        changedDate: '2023-01-01T00:00:00Z',
        description: undefined,
        tags: undefined,
        raw: expect.objectContaining({
          'System.Id': 456,
          url: minimalWorkItem.url,
          rev: 1,
        }),
      })
    })

    it('should parse empty tags string', async () => {
      const workItemWithEmptyTags = {
        ...mockWorkItem,
        fields: {
          ...mockWorkItem.fields,
          'System.Tags': '  ;  ; ',
        },
      }

      mockClient.getWorkItem.mockResolvedValue(workItemWithEmptyTags)

      const result = await provider.getWorkItem(123)
      expect(result?.tags).toEqual([])
    })

    it('should handle person object with minimal fields', async () => {
      const minimalPerson: AzureDevOpsPerson = {
        displayName: '',
        url: '',
        id: 'user-456',
        uniqueName: 'jane.doe@company.com',
        imageUrl: '',
        descriptor: '',
      }

      const workItemWithMinimalPerson = {
        ...mockWorkItem,
        fields: {
          ...mockWorkItem.fields,
          'System.AssignedTo': minimalPerson,
        },
      }

      mockClient.getWorkItem.mockResolvedValue(workItemWithMinimalPerson)

      const result = await provider.getWorkItem(123)
      expect(result?.assignedTo).toBe('jane.doe@company.com') // Falls back to uniqueName
    })
  })
})
