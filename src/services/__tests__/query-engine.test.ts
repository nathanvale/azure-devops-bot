import { describe, it, expect, beforeEach, vi } from 'vitest'

import type { DatabaseService } from '../database'

import { createTestWorkItem } from '../../../tests/utils/test-helpers'
import { QueryEngine } from '../query-engine'

// Mock the DatabaseService
vi.mock('../database')

describe('QueryEngine', () => {
  let queryEngine: QueryEngine
  let mockDb: DatabaseService

  beforeEach(() => {
    const getWorkItemsByState = vi.fn().mockResolvedValue([])
    const getWorkItemsByType = vi.fn().mockResolvedValue([])
    const getAllWorkItems = vi.fn().mockResolvedValue([])

    mockDb = {
      getWorkItemsByState,
      getWorkItemsByType,
      getAllWorkItems,
      getWorkItemsForUsers: vi
        .fn()
        .mockImplementation((emails) => getAllWorkItems()),
      getWorkItemsByStateForUsers: vi
        .fn()
        .mockImplementation((state, emails) => getWorkItemsByState(state)),
      getWorkItemsByTypeForUsers: vi
        .fn()
        .mockImplementation((type, emails) => getWorkItemsByType(type)),
    } as any

    queryEngine = new QueryEngine(mockDb)
  })

  describe('processQuery', () => {
    describe('current work queries', () => {
      it('should process "today" queries', async () => {
        const activeItems = [
          createTestWorkItem({ state: 'Active', title: 'Active Item' }),
        ]
        const inProgressItems = [
          createTestWorkItem({
            state: 'In Progress',
            title: 'In Progress Item',
          }),
        ]

        mockDb.getWorkItemsByStateForUsers.mockImplementation(
          (state: string, emails: string[]) => {
            if (state === 'Active') return Promise.resolve(activeItems)
            if (state === 'In Progress') return Promise.resolve(inProgressItems)
            return Promise.resolve([])
          },
        )

        const result = await queryEngine.processQuery(
          'what am I working on today?',
        )

        expect(mockDb.getWorkItemsByStateForUsers).toHaveBeenCalledWith(
          'Active',
          [],
        )
        expect(mockDb.getWorkItemsByStateForUsers).toHaveBeenCalledWith(
          'In Progress',
          [],
        )
        expect(result).toContain("Here's what you're working on today:")
        expect(result).toContain('Active Item')
        expect(result).toContain('In Progress Item')
      })

      it('should process "working" queries', async () => {
        const activeItems = [createTestWorkItem({ state: 'Active' })]
        mockDb.getWorkItemsByState.mockResolvedValue(activeItems)

        const result = await queryEngine.processQuery('what am I working on?')

        expect(result).toContain("Here's what you're working on today:")
      })

      it('should process "current" queries', async () => {
        const activeItems = [createTestWorkItem({ state: 'Active' })]
        mockDb.getWorkItemsByState.mockResolvedValue(activeItems)

        const result = await queryEngine.processQuery(
          'show me my current tasks',
        )

        expect(result).toContain("Here's what you're working on today:")
      })

      it('should handle empty current work', async () => {
        mockDb.getWorkItemsByState.mockResolvedValue([])

        const result = await queryEngine.processQuery(
          'what am I working on today?',
        )

        expect(result).toBe("You don't have any active work items today.")
      })
    })

    describe('open work queries', () => {
      it('should process "open" queries', async () => {
        const newItems = [
          createTestWorkItem({ state: 'New', title: 'New Item' }),
        ]
        const activeItems = [
          createTestWorkItem({ state: 'Active', title: 'Active Item' }),
        ]
        const inProgressItems = [
          createTestWorkItem({
            state: 'In Progress',
            title: 'In Progress Item',
          }),
        ]

        mockDb.getWorkItemsByState.mockImplementation((state: string) => {
          if (state === 'New') return Promise.resolve(newItems)
          if (state === 'Active') return Promise.resolve(activeItems)
          if (state === 'In Progress') return Promise.resolve(inProgressItems)
          return Promise.resolve([])
        })

        const result = await queryEngine.processQuery('show me open work items')

        expect(mockDb.getWorkItemsByState).toHaveBeenCalledWith('New')
        expect(mockDb.getWorkItemsByState).toHaveBeenCalledWith('Active')
        expect(mockDb.getWorkItemsByState).toHaveBeenCalledWith('In Progress')
        expect(result).toContain('Here are your open work items:')
        expect(result).toContain('New Item')
        expect(result).toContain('Active Item')
        expect(result).toContain('In Progress Item')
      })

      it('should process "active" queries', async () => {
        const activeItems = [createTestWorkItem({ state: 'Active' })]
        mockDb.getWorkItemsByState.mockResolvedValue(activeItems)

        const result = await queryEngine.processQuery('show me active items')

        expect(result).toContain('Here are your open work items:')
      })

      it('should handle empty open work', async () => {
        mockDb.getWorkItemsByState.mockResolvedValue([])

        const result = await queryEngine.processQuery('show me open work')

        expect(result).toBe("You don't have any open work items.")
      })
    })

    describe('user story queries', () => {
      it('should process "user story" queries', async () => {
        const userStories = [
          createTestWorkItem({ type: 'User Story', title: 'User Story 1' }),
          createTestWorkItem({ type: 'User Story', title: 'User Story 2' }),
        ]

        mockDb.getWorkItemsByType.mockResolvedValue(userStories)

        const result = await queryEngine.processQuery('show me user stories')

        expect(mockDb.getWorkItemsByType).toHaveBeenCalledWith('User Story')
        expect(result).toContain('Here are your user stories:')
        expect(result).toContain('User Story 1')
        expect(result).toContain('User Story 2')
      })

      it('should process "stories" queries', async () => {
        const userStories = [createTestWorkItem({ type: 'User Story' })]
        mockDb.getWorkItemsByType.mockResolvedValue(userStories)

        const result = await queryEngine.processQuery('what stories do I have?')

        expect(mockDb.getWorkItemsByType).toHaveBeenCalledWith('User Story')
        expect(result).toContain('Here are your user stories:')
      })

      it('should handle empty user stories', async () => {
        mockDb.getWorkItemsByType.mockResolvedValue([])

        const result = await queryEngine.processQuery('show me user stories')

        expect(result).toBe("You don't have any user stories assigned.")
      })
    })

    describe('backlog summary queries', () => {
      it('should process "backlog" queries', async () => {
        const allItems = [
          createTestWorkItem({ title: 'Item 1' }),
          createTestWorkItem({ title: 'Item 2' }),
        ]

        mockDb.getAllWorkItems.mockResolvedValue(allItems)

        const result = await queryEngine.processQuery('show me my backlog')

        expect(mockDb.getAllWorkItems).toHaveBeenCalledTimes(1)
        expect(result).toContain("Here's your backlog summary:")
        expect(result).toContain('Item 1')
        expect(result).toContain('Item 2')
      })

      it('should process "summary" queries', async () => {
        const allItems = [createTestWorkItem()]
        mockDb.getAllWorkItems.mockResolvedValue(allItems)

        const result = await queryEngine.processQuery('give me a summary')

        expect(mockDb.getAllWorkItems).toHaveBeenCalledTimes(1)
        expect(result).toContain("Here's your backlog summary:")
      })

      it('should process "all" queries', async () => {
        const allItems = [createTestWorkItem()]
        mockDb.getAllWorkItems.mockResolvedValue(allItems)

        const result = await queryEngine.processQuery('show me all work items')

        expect(mockDb.getAllWorkItems).toHaveBeenCalledTimes(1)
        expect(result).toContain("Here's your backlog summary:")
      })

      it('should handle empty backlog', async () => {
        mockDb.getAllWorkItems.mockResolvedValue([])

        const result = await queryEngine.processQuery('show me my backlog')

        expect(result).toBe('Your backlog is empty.')
      })
    })

    describe('default behavior', () => {
      it('should default to backlog summary for unrecognized queries', async () => {
        const allItems = [createTestWorkItem({ title: 'Default Item' })]
        mockDb.getAllWorkItems.mockResolvedValue(allItems)

        const result = await queryEngine.processQuery('some random query')

        expect(mockDb.getAllWorkItems).toHaveBeenCalledTimes(1)
        expect(result).toContain("Here's your backlog summary:")
        expect(result).toContain('Default Item')
      })

      it('should handle empty queries by showing backlog', async () => {
        const allItems = [createTestWorkItem()]
        mockDb.getAllWorkItems.mockResolvedValue(allItems)

        const result = await queryEngine.processQuery('')

        expect(mockDb.getAllWorkItems).toHaveBeenCalledTimes(1)
        expect(result).toContain("Here's your backlog summary:")
      })

      it('should trim and normalize queries', async () => {
        const allItems = [createTestWorkItem()]
        mockDb.getAllWorkItems.mockResolvedValue(allItems)

        const result = await queryEngine.processQuery('  SUMMARY  ')

        expect(mockDb.getAllWorkItems).toHaveBeenCalledTimes(1)
        expect(result).toContain("Here's your backlog summary:")
      })
    })

    describe('case sensitivity', () => {
      it('should handle uppercase queries', async () => {
        const activeItems = [createTestWorkItem({ state: 'Active' })]
        mockDb.getWorkItemsByState.mockResolvedValue(activeItems)

        const result = await queryEngine.processQuery('SHOW ME ACTIVE ITEMS')

        expect(result).toContain('Here are your open work items:')
      })

      it('should handle mixed case queries', async () => {
        const userStories = [createTestWorkItem({ type: 'User Story' })]
        mockDb.getWorkItemsByType.mockResolvedValue(userStories)

        const result = await queryEngine.processQuery('Show Me User Stories')

        expect(result).toContain('Here are your user stories:')
      })
    })

    describe('keyword matching', () => {
      it('should match partial keywords', async () => {
        const activeItems = [createTestWorkItem({ state: 'Active' })]
        vi.mocked(mockDb.getWorkItemsByState).mockImplementation(
          (state: string) => {
            if (state === 'Active') return Promise.resolve(activeItems)
            if (state === 'In Progress') return Promise.resolve([])
            return Promise.resolve([])
          },
        )

        const result = await queryEngine.processQuery(
          'I need to see what is currently active',
        )

        expect(result).toContain("Here's what you're working on today:")
      })

      it('should match multiple keywords in same query', async () => {
        const activeItems = [createTestWorkItem({ state: 'Active' })]
        const inProgressItems = [createTestWorkItem({ state: 'In Progress' })]

        mockDb.getWorkItemsByState.mockImplementation((state: string) => {
          if (state === 'Active') return Promise.resolve(activeItems)
          if (state === 'In Progress') return Promise.resolve(inProgressItems)
          return Promise.resolve([])
        })

        // This should match "today" and "current" keywords
        const result = await queryEngine.processQuery(
          'what am I working on today and current tasks?',
        )

        expect(result).toContain("Here's what you're working on today:")
      })
    })

    describe('error handling', () => {
      it('should handle database errors gracefully', async () => {
        mockDb.getAllWorkItems.mockRejectedValue(new Error('Database error'))

        await expect(
          queryEngine.processQuery('show me all items'),
        ).rejects.toThrow('Database error')
      })

      it('should handle errors from specific state queries', async () => {
        mockDb.getWorkItemsByState.mockRejectedValue(
          new Error('State query failed'),
        )

        await expect(
          queryEngine.processQuery('show me active items'),
        ).rejects.toThrow('State query failed')
      })

      it('should handle errors from type queries', async () => {
        mockDb.getWorkItemsByType.mockRejectedValue(
          new Error('Type query failed'),
        )

        await expect(
          queryEngine.processQuery('show me user stories'),
        ).rejects.toThrow('Type query failed')
      })
    })
  })

  describe('formatWorkItems', () => {
    it('should format work items correctly', async () => {
      const testItems = [
        createTestWorkItem({
          id: 1234,
          title: 'Test Item 1',
          state: 'Active',
          azureUrl: 'https://dev.azure.com/test/1234',
        }),
        createTestWorkItem({
          id: 5678,
          title: 'Test Item 2',
          state: 'Done',
          azureUrl: 'https://dev.azure.com/test/5678',
        }),
      ]

      mockDb.getAllWorkItems.mockResolvedValue(testItems)

      const result = await queryEngine.processQuery('summary')

      expect(result).toContain("Here's your backlog summary:")
      expect(result).toContain('• [1234] Test Item 1 - Active')
      expect(result).toContain('https://dev.azure.com/test/1234')
      expect(result).toContain('• [5678] Test Item 2 - Done')
      expect(result).toContain('https://dev.azure.com/test/5678')
    })

    it('should handle items without Azure URLs', async () => {
      const testItems = [
        createTestWorkItem({
          id: 1234,
          title: 'Test Item',
          state: 'Active',
          azureUrl: undefined,
        }),
      ]

      mockDb.getAllWorkItems.mockResolvedValue(testItems)

      const result = await queryEngine.processQuery('summary')

      expect(result).toContain('• [1234] Test Item - Active')
      expect(result).toContain('undefined') // Should show undefined URL
    })

    it('should handle items with special characters in title', async () => {
      const testItems = [
        createTestWorkItem({
          id: 1234,
          title: 'Test & Item with "quotes" and special chars!',
          state: 'Active',
        }),
      ]

      mockDb.getAllWorkItems.mockResolvedValue(testItems)

      const result = await queryEngine.processQuery('summary')

      expect(result).toContain('Test & Item with "quotes" and special chars!')
    })
  })

  describe('private method matchesKeywords', () => {
    it('should match single keyword', async () => {
      const activeItems = [createTestWorkItem({ state: 'Active' })]
      mockDb.getWorkItemsByState.mockResolvedValue(activeItems)

      // Test that 'active' keyword matches
      const result = await queryEngine.processQuery('active')

      expect(result).toContain('Here are your open work items:')
    })

    it('should match any keyword in array', async () => {
      const activeItems = [createTestWorkItem({ state: 'Active' })]
      const inProgressItems = [createTestWorkItem({ state: 'In Progress' })]

      mockDb.getWorkItemsByState.mockImplementation((state: string) => {
        if (state === 'Active') return Promise.resolve(activeItems)
        if (state === 'In Progress') return Promise.resolve(inProgressItems)
        return Promise.resolve([])
      })

      // Test that 'current' keyword (from ['today', 'working', 'current']) matches
      const result = await queryEngine.processQuery('current work')

      expect(result).toContain("Here's what you're working on today:")
    })

    it('should not match when no keywords present', async () => {
      const allItems = [createTestWorkItem()]
      mockDb.getAllWorkItems.mockResolvedValue(allItems)

      // Query with no matching keywords should default to backlog
      const result = await queryEngine.processQuery(
        'random text with no keywords',
      )

      expect(result).toContain("Here's your backlog summary:")
    })
  })
})
