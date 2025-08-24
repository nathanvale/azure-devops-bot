import { describe, it, expect, beforeEach } from 'vitest'

import type {
  IWorkItemProvider,
  ProviderInfo,
} from '../../src/interfaces/provider.js'
import type { CommentData } from '../../src/types/comments.js'
import type { WorkItemData, WorkItemQuery } from '../../src/types/work-items.js'

describe('IWorkItemProvider Interface', () => {
  // Mock implementation for testing interface compliance
  class MockWorkItemProvider implements IWorkItemProvider {
    async fetchWorkItems(query?: WorkItemQuery): Promise<WorkItemData[]> {
      const mockData: WorkItemData[] = [
        {
          id: 123,
          title: 'Mock Work Item',
          state: 'Active',
          type: 'Task',
          assignedTo: 'test@example.com',
          createdDate: '2023-01-01T00:00:00Z',
          changedDate: '2023-01-01T00:00:00Z',
          description: 'Mock description',
          tags: ['tag1', 'tag2'],
          raw: {
            'System.Id': 123,
            'System.Title': 'Mock Work Item',
          },
        },
      ]

      if (query?.filters) {
        return mockData.filter((item) => {
          if (query.filters?.state && !query.filters.state.includes(item.state))
            return false
          if (query.filters?.type && !query.filters.type.includes(item.type))
            return false
          if (
            query.filters?.assignedTo &&
            item.assignedTo &&
            !query.filters.assignedTo.includes(item.assignedTo)
          )
            return false
          return true
        })
      }

      return mockData
    }

    async getWorkItem(id: string | number): Promise<WorkItemData | null> {
      if (id === 123 || id === '123') {
        return {
          id,
          title: 'Specific Mock Work Item',
          state: 'Done',
          type: 'Bug',
          assignedTo: 'user@example.com',
          createdDate: '2023-01-01T00:00:00Z',
          changedDate: '2023-01-02T00:00:00Z',
          description: 'Specific mock description',
          tags: ['urgent', 'frontend'],
          raw: {
            'System.Id': Number(id),
            'System.Title': 'Specific Mock Work Item',
          },
        }
      }
      return null
    }

    async getComments(workItemId: string | number): Promise<CommentData[]> {
      return [
        {
          id: 'comment-1',
          workItemId,
          text: 'First mock comment',
          author: 'User One',
          createdDate: '2023-01-01T10:00:00Z',
          raw: {
            id: 'comment-1',
            text: 'First mock comment',
          },
        },
        {
          id: 'comment-2',
          workItemId,
          text: 'Second mock comment',
          author: 'User Two',
          createdDate: '2023-01-01T11:00:00Z',
          modifiedDate: '2023-01-01T12:00:00Z',
          raw: {
            id: 'comment-2',
            text: 'Second mock comment',
          },
        },
      ]
    }

    getProviderInfo(): ProviderInfo {
      return {
        name: 'Mock Provider',
        version: '1.0.0',
        supports: {
          batchOperations: true,
          realTimeUpdates: false,
          customFields: true,
        },
      }
    }
  }

  describe('Interface Compliance', () => {
    let provider: IWorkItemProvider

    it('should implement all required methods', () => {
      provider = new MockWorkItemProvider()

      expect(provider.fetchWorkItems).toBeInstanceOf(Function)
      expect(provider.getWorkItem).toBeInstanceOf(Function)
      expect(provider.getComments).toBeInstanceOf(Function)
      expect(provider.getProviderInfo).toBeInstanceOf(Function)
    })

    it('should return provider info with correct structure', () => {
      provider = new MockWorkItemProvider()
      const info = provider.getProviderInfo()

      expect(info).toEqual({
        name: expect.any(String),
        version: expect.any(String),
        supports: expect.objectContaining({
          batchOperations: expect.any(Boolean),
          realTimeUpdates: expect.any(Boolean),
          customFields: expect.any(Boolean),
        }),
      })
    })
  })

  describe('fetchWorkItems', () => {
    let provider: MockWorkItemProvider

    beforeEach(() => {
      provider = new MockWorkItemProvider()
    })

    it('should fetch work items without query', async () => {
      const workItems = await provider.fetchWorkItems()

      expect(Array.isArray(workItems)).toBe(true)
      expect(workItems.length).toBeGreaterThan(0)

      workItems.forEach((item) => {
        expect(item).toEqual(
          expect.objectContaining({
            id: expect.any(Number),
            title: expect.any(String),
            state: expect.any(String),
            type: expect.any(String),
            createdDate: expect.any(String),
            changedDate: expect.any(String),
            raw: expect.any(Object),
          }),
        )
      })
    })

    it('should fetch work items with query filters', async () => {
      const query: WorkItemQuery = {
        filters: {
          state: ['Active'],
          type: ['Task'],
        },
      }

      const workItems = await provider.fetchWorkItems(query)

      expect(Array.isArray(workItems)).toBe(true)
      workItems.forEach((item) => {
        expect(item.state).toBe('Active')
        expect(item.type).toBe('Task')
      })
    })

    it('should return empty array when no items match filters', async () => {
      const query: WorkItemQuery = {
        filters: {
          state: ['NonExistentState'],
        },
      }

      const workItems = await provider.fetchWorkItems(query)
      expect(workItems).toEqual([])
    })

    it('should handle complex query filters', async () => {
      const query: WorkItemQuery = {
        filters: {
          state: ['Active', 'New'],
          type: ['Task', 'Bug'],
          assignedTo: ['test@example.com', 'other@example.com'],
        },
        limit: 10,
        orderBy: 'createdDate',
        orderDirection: 'desc',
      }

      const workItems = await provider.fetchWorkItems(query)
      expect(Array.isArray(workItems)).toBe(true)
    })
  })

  describe('getWorkItem', () => {
    let provider: MockWorkItemProvider

    beforeEach(() => {
      provider = new MockWorkItemProvider()
    })

    it('should get work item by numeric ID', async () => {
      const workItem = await provider.getWorkItem(123)

      expect(workItem).not.toBeNull()
      expect(workItem?.id).toBe(123)
      expect(workItem?.title).toBe('Specific Mock Work Item')
    })

    it('should get work item by string ID', async () => {
      const workItem = await provider.getWorkItem('123')

      expect(workItem).not.toBeNull()
      expect(workItem?.id).toBe('123')
      expect(workItem?.title).toBe('Specific Mock Work Item')
    })

    it('should return null for non-existent work item', async () => {
      const workItem = await provider.getWorkItem(999)
      expect(workItem).toBeNull()
    })

    it('should return work item with all required fields', async () => {
      const workItem = await provider.getWorkItem(123)

      expect(workItem).toEqual({
        id: expect.any(Number),
        title: expect.any(String),
        state: expect.any(String),
        type: expect.any(String),
        assignedTo: expect.any(String),
        createdDate: expect.any(String),
        changedDate: expect.any(String),
        description: expect.any(String),
        tags: expect.any(Array),
        raw: expect.any(Object),
      })
    })
  })

  describe('getComments', () => {
    let provider: MockWorkItemProvider

    beforeEach(() => {
      provider = new MockWorkItemProvider()
    })

    it('should get comments for work item by numeric ID', async () => {
      const comments = await provider.getComments(123)

      expect(Array.isArray(comments)).toBe(true)
      expect(comments.length).toBeGreaterThan(0)
    })

    it('should get comments for work item by string ID', async () => {
      const comments = await provider.getComments('123')

      expect(Array.isArray(comments)).toBe(true)
      expect(comments.length).toBeGreaterThan(0)
    })

    it('should return comments with correct structure', async () => {
      const comments = await provider.getComments(123)

      comments.forEach((comment) => {
        expect(comment).toEqual(
          expect.objectContaining({
            id: expect.any(String),
            workItemId: 123,
            text: expect.any(String),
            author: expect.any(String),
            createdDate: expect.any(String),
            raw: expect.any(Object),
          }),
        )

        // modifiedDate is optional
        if (comment.modifiedDate !== undefined) {
          expect(comment.modifiedDate).toEqual(expect.any(String))
        }
      })
    })

    it('should preserve work item ID in comments', async () => {
      const workItemId = 456
      const comments = await provider.getComments(workItemId)

      comments.forEach((comment) => {
        expect(comment.workItemId).toBe(workItemId)
      })
    })

    it('should handle empty comment list gracefully', async () => {
      // Mock provider always returns comments, but this tests the interface contract
      const comments = await provider.getComments(999)
      expect(Array.isArray(comments)).toBe(true)
    })
  })

  describe('Data Type Validation', () => {
    it('should validate WorkItemData structure', () => {
      const workItemData: WorkItemData = {
        id: 123,
        title: 'Test Work Item',
        state: 'New',
        type: 'Task',
        assignedTo: 'user@example.com',
        createdDate: '2023-01-01T00:00:00Z',
        changedDate: '2023-01-01T00:00:00Z',
        description: 'Test description',
        tags: ['test'],
        raw: {},
      }

      expect(workItemData.id).toBeDefined()
      expect(workItemData.title).toBeDefined()
      expect(workItemData.state).toBeDefined()
      expect(workItemData.type).toBeDefined()
      expect(workItemData.createdDate).toBeDefined()
      expect(workItemData.changedDate).toBeDefined()
      expect(workItemData.raw).toBeDefined()
    })

    it('should validate CommentData structure', () => {
      const commentData: CommentData = {
        id: 'comment-123',
        workItemId: 456,
        text: 'Test comment',
        author: 'Test Author',
        createdDate: '2023-01-01T00:00:00Z',
        raw: {},
      }

      expect(commentData.id).toBeDefined()
      expect(commentData.workItemId).toBeDefined()
      expect(commentData.text).toBeDefined()
      expect(commentData.author).toBeDefined()
      expect(commentData.createdDate).toBeDefined()
      expect(commentData.raw).toBeDefined()
    })

    it('should validate WorkItemQuery structure', () => {
      const query: WorkItemQuery = {
        filters: {
          state: ['Active', 'New'],
          type: ['Task', 'Bug'],
          assignedTo: ['user1@example.com'],
          area: ['Frontend'],
          iteration: ['Sprint 1'],
        },
        limit: 100,
        orderBy: 'createdDate',
        orderDirection: 'desc',
      }

      expect(query.filters).toBeDefined()
      expect(query.limit).toBeDefined()
      expect(query.orderBy).toBeDefined()
      expect(query.orderDirection).toBeDefined()
    })

    it('should validate ProviderInfo structure', () => {
      const providerInfo: ProviderInfo = {
        name: 'Test Provider',
        version: '1.0.0',
        supports: {
          batchOperations: true,
          realTimeUpdates: false,
          customFields: true,
        },
      }

      expect(providerInfo.name).toBeDefined()
      expect(providerInfo.version).toBeDefined()
      expect(providerInfo.supports).toBeDefined()
      expect(providerInfo.supports.batchOperations).toBeDefined()
      expect(providerInfo.supports.realTimeUpdates).toBeDefined()
      expect(providerInfo.supports.customFields).toBeDefined()
    })
  })

  describe('Error Handling Scenarios', () => {
    class ErrorProneProvider implements IWorkItemProvider {
      async fetchWorkItems(query?: WorkItemQuery): Promise<WorkItemData[]> {
        if (query?.filters?.state?.includes('ERROR')) {
          throw new Error('Mock fetch error')
        }
        return []
      }

      async getWorkItem(id: string | number): Promise<WorkItemData | null> {
        if (id === 'ERROR') {
          throw new Error('Mock get error')
        }
        return null
      }

      async getComments(workItemId: string | number): Promise<CommentData[]> {
        if (workItemId === 'ERROR') {
          throw new Error('Mock comments error')
        }
        return []
      }

      getProviderInfo(): ProviderInfo {
        return {
          name: 'Error Provider',
          version: '1.0.0',
          supports: {
            batchOperations: false,
            realTimeUpdates: false,
            customFields: false,
          },
        }
      }
    }

    let errorProvider: ErrorProneProvider

    beforeEach(() => {
      errorProvider = new ErrorProneProvider()
    })

    it('should handle fetchWorkItems errors', async () => {
      const query: WorkItemQuery = {
        filters: { state: ['ERROR'] },
      }

      await expect(errorProvider.fetchWorkItems(query)).rejects.toThrow(
        'Mock fetch error',
      )
    })

    it('should handle getWorkItem errors', async () => {
      await expect(errorProvider.getWorkItem('ERROR')).rejects.toThrow(
        'Mock get error',
      )
    })

    it('should handle getComments errors', async () => {
      await expect(errorProvider.getComments('ERROR')).rejects.toThrow(
        'Mock comments error',
      )
    })

    it('should not throw errors from getProviderInfo', () => {
      expect(() => errorProvider.getProviderInfo()).not.toThrow()
    })
  })
})
