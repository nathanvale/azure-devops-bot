import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { MockInstance } from 'vitest'

import type { AzureAuth } from '../auth'
import type { AzureDevOpsClient } from '../azure-devops'
import type { DatabaseService } from '../database'

import { SyncService } from '../sync-service'

// Mock the dependencies
vi.mock('../auth')
vi.mock('../azure-devops')
vi.mock('../database')

// Mock the resilience package
vi.mock('@orchestr8/resilience', () => ({
  ProductionResilienceAdapter: vi.fn().mockImplementation(() => ({
    applyPolicy: vi.fn().mockImplementation((operation, policy) => operation()),
  })),
}))

describe('SyncService', () => {
  let service: SyncService
  let mockAuth: any
  let mockClient: any
  let mockDb: any

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()

    // Create service instance
    service = new SyncService()

    // Get the mocked instances
    mockAuth = service['auth'] as any
    mockClient = service['client'] as any
    mockDb = service['db'] as any

    // Setup default mock implementations
    mockAuth.ensureAuth = vi.fn().mockResolvedValue(undefined)
    mockClient.fetchWorkItems = vi.fn().mockResolvedValue([])
    mockClient.fetchWorkItemsDetailed = vi.fn().mockResolvedValue([])
    mockDb.syncWorkItems = vi.fn().mockResolvedValue(undefined)
    mockDb.getLastSyncTime = vi.fn().mockResolvedValue(null)
    mockDb.close = vi.fn().mockResolvedValue(undefined)
    mockDb.needsCommentSync = vi.fn().mockResolvedValue(false)
    mockDb.storeWorkItemComments = vi.fn().mockResolvedValue(undefined)
    mockClient.fetchWorkItemComments = vi.fn().mockResolvedValue([])

    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    // Clear any intervals
    service.stopBackgroundSync()
  })

  describe('performSync', () => {
    it('should sync work items successfully', async () => {
      const testWorkItems1: any[] = [
        {
          id: 1234,
          title: 'Test Item',
          state: 'Active',
          type: 'User Story',
          assignedTo: 'nathan.vale@example.com',
          lastUpdatedAt: new Date(),
        },
      ]

      (mockClient.fetchWorkItems as MockInstance).mockResolvedValue(testWorkItems1)

      await service.performSync()

      expect(mockAuth.ensureAuth).toHaveBeenCalledTimes(1)
      expect(mockClient.fetchWorkItems).toHaveBeenCalledTimes(1)
      expect(mockDb.syncWorkItems).toHaveBeenCalledWith(testWorkItems1)
      expect(console.log).toHaveBeenCalledWith('✅ Synced 1 work items')
    })

    it('should handle authentication failure', async () => {
      (mockAuth.ensureAuth as MockInstance).mockRejectedValue(new Error('Authentication failed'))

      await expect(service.performSync()).rejects.toThrow(
        'Authentication failed',
      )

      expect(mockAuth.ensureAuth).toHaveBeenCalledTimes(1)
      expect(mockClient.fetchWorkItems).not.toHaveBeenCalled()
      expect(mockDb.syncWorkItems).not.toHaveBeenCalled()
      expect(console.error).toHaveBeenCalledWith(
        '❌ Sync failed:',
        expect.any(Error),
      )
    })

    it('should handle work items fetch failure', async () => {
      (mockClient.fetchWorkItems as MockInstance).mockRejectedValue(new Error('Fetch failed'))

      await expect(service.performSync()).rejects.toThrow('Fetch failed')

      expect(mockAuth.ensureAuth).toHaveBeenCalledTimes(1)
      expect(mockClient.fetchWorkItems).toHaveBeenCalledTimes(1)
      expect(mockDb.syncWorkItems).not.toHaveBeenCalled()
      expect(console.error).toHaveBeenCalledWith(
        '❌ Sync failed:',
        expect.any(Error),
      )
    })

    it('should handle database sync failure', async () => {
      const testWorkItems2: any[] = [
        {
          id: 1234,
          title: 'Test Item',
          state: 'Active',
          type: 'User Story',
          assignedTo: 'nathan.vale@example.com',
          lastUpdatedAt: new Date(),
        },
      ]

      (mockClient.fetchWorkItems as MockInstance).mockResolvedValue(testWorkItems2)
      (mockDb.syncWorkItems as MockInstance).mockRejectedValue(new Error('Database sync failed'))

      await expect(service.performSync()).rejects.toThrow(
        'Database sync failed',
      )

      expect(mockAuth.ensureAuth).toHaveBeenCalledTimes(1)
      expect(mockClient.fetchWorkItems).toHaveBeenCalledTimes(1)
      expect(mockDb.syncWorkItems).toHaveBeenCalledWith(testWorkItems2)
      expect(console.error).toHaveBeenCalledWith(
        '❌ Sync failed:',
        expect.any(Error),
      )
    })

    it('should log correct number of synced items', async () => {
      const testWorkItems3: any[] = [
        {
          id: 1234,
          title: 'Item 1',
          state: 'Active',
          type: 'User Story',
          assignedTo: 'nathan.vale@example.com',
          lastUpdatedAt: new Date(),
        },
        {
          id: 5678,
          title: 'Item 2',
          state: 'Done',
          type: 'Task',
          assignedTo: 'nathan.vale@example.com',
          lastUpdatedAt: new Date(),
        },
      ]

      (mockClient.fetchWorkItems as MockInstance).mockResolvedValue(testWorkItems3)

      await service.performSync()

      expect(console.log).toHaveBeenCalledWith('✅ Synced 2 work items')
    })

    it('should handle empty work items list', async () => {
      (mockClient.fetchWorkItems as MockInstance).mockResolvedValue([])

      await service.performSync()

      expect(mockDb.syncWorkItems).toHaveBeenCalledWith([])
      expect(console.log).toHaveBeenCalledWith('✅ Synced 0 work items')
    })
  })

  describe('startBackgroundSync', () => {
    it('should start background sync with correct interval', async () => {
      const setIntervalSpy = vi.spyOn(global, 'setInterval')

      await service.startBackgroundSync()

      expect(setIntervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        5 * 60 * 1000, // 5 minutes (default)
      )
      expect(console.log).toHaveBeenCalledWith(
        '🔄 Background detailed sync started (every 5 minutes)',
      )
    })

    it('should use custom interval from environment variable', async () => {
      const originalEnv = process.env.AZURE_DEVOPS_SYNC_INTERVAL_MINUTES
      process.env.AZURE_DEVOPS_SYNC_INTERVAL_MINUTES = '10'

      const setIntervalSpy = vi.spyOn(global, 'setInterval')

      await service.startBackgroundSync()

      expect(setIntervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        10 * 60 * 1000, // 10 minutes
      )
      expect(console.log).toHaveBeenCalledWith(
        '🔄 Background detailed sync started (every 10 minutes)',
      )

      // Restore original environment
      if (originalEnv) {
        process.env.AZURE_DEVOPS_SYNC_INTERVAL_MINUTES = originalEnv
      } else {
        delete process.env.AZURE_DEVOPS_SYNC_INTERVAL_MINUTES
      }
    })

    it('should handle invalid environment variable and use default', async () => {
      const originalEnv = process.env.AZURE_DEVOPS_SYNC_INTERVAL_MINUTES
      process.env.AZURE_DEVOPS_SYNC_INTERVAL_MINUTES = 'invalid'

      const setIntervalSpy = vi.spyOn(global, 'setInterval')
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {})

      await service.startBackgroundSync()

      expect(setIntervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        5 * 60 * 1000, // 5 minutes (default fallback)
      )
      expect(console.log).toHaveBeenCalledWith(
        '🔄 Background detailed sync started (every 5 minutes)',
      )
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '⚠️  Invalid AZURE_DEVOPS_SYNC_INTERVAL_MINUTES value: invalid. Using default 5 minutes.',
      )

      consoleWarnSpy.mockRestore()

      // Restore original environment
      if (originalEnv) {
        process.env.AZURE_DEVOPS_SYNC_INTERVAL_MINUTES = originalEnv
      } else {
        delete process.env.AZURE_DEVOPS_SYNC_INTERVAL_MINUTES
      }
    })

    it('should perform detailed sync when interval triggers by default', async () => {
      vi.useFakeTimers()

      const performSyncDetailedSpy = vi
        .spyOn(service, 'performSyncDetailed')
        .mockResolvedValue()

      await service.startBackgroundSync()

      // Fast-forward time by 5 minutes
      vi.advanceTimersByTime(5 * 60 * 1000)

      expect(performSyncDetailedSpy).toHaveBeenCalledTimes(1)

      vi.useRealTimers()
    })

    it('should perform basic sync when useDetailedSync is false', async () => {
      vi.useFakeTimers()

      const performSyncSpy = vi
        .spyOn(service, 'performSync')
        .mockResolvedValue()

      await service.startBackgroundSync(false)

      // Fast-forward time by 5 minutes
      vi.advanceTimersByTime(5 * 60 * 1000)

      expect(performSyncSpy).toHaveBeenCalledTimes(1)
      expect(console.log).toHaveBeenCalledWith(
        '🔄 Background sync started (every 5 minutes)',
      )

      vi.useRealTimers()
    })

    it('should handle sync errors in background without throwing', async () => {
      vi.useFakeTimers()

      const performSyncDetailedSpy = vi
        .spyOn(service, 'performSyncDetailed')
        .mockRejectedValue(new Error('Background sync failed'))

      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      await service.startBackgroundSync()

      // Fast-forward time by 5 minutes to trigger the interval
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000)

      expect(performSyncDetailedSpy).toHaveBeenCalledTimes(1)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Background sync failed:',
        expect.any(Error),
      )

      consoleErrorSpy.mockRestore()
      vi.useRealTimers()
    })

    it('should continue background sync after errors', async () => {
      vi.useFakeTimers()

      const performSyncDetailedSpy = vi
        .spyOn(service, 'performSyncDetailed')
        .mockRejectedValueOnce(new Error('First sync failed'))
        .mockResolvedValueOnce()

      await service.startBackgroundSync()

      // First interval - should fail
      vi.advanceTimersByTime(5 * 60 * 1000)
      expect(performSyncDetailedSpy).toHaveBeenCalledTimes(1)

      // Second interval - should succeed
      vi.advanceTimersByTime(5 * 60 * 1000)
      expect(performSyncDetailedSpy).toHaveBeenCalledTimes(2)

      vi.useRealTimers()
    })
  })

  describe('stopBackgroundSync', () => {
    it('should stop background sync when running', async () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval')

      await service.startBackgroundSync()
      service.stopBackgroundSync()

      expect(clearIntervalSpy).toHaveBeenCalledTimes(1)
      expect(console.log).toHaveBeenCalledWith('⏹️  Background sync stopped')
    })

    it('should handle stopping when not running', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval')

      service.stopBackgroundSync()

      expect(clearIntervalSpy).not.toHaveBeenCalled()
    })

    it('should clear the interval reference', async () => {
      await service.startBackgroundSync()
      expect(service['syncInterval']).not.toBeNull()

      service.stopBackgroundSync()
      expect(service['syncInterval']).toBeNull()
    })
  })

  describe('shouldSync', () => {
    it('should return true when no previous sync exists', async () => {
      (mockDb.getLastSyncTime as MockInstance).mockResolvedValue(null)

      const result = await service.shouldSync()

      expect(result).toBe(true)
      expect(mockDb.getLastSyncTime).toHaveBeenCalledTimes(1)
    })

    it('should return true when last sync was more than 5 minutes ago', async () => {
      const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000)
      (mockDb.getLastSyncTime as MockInstance).mockResolvedValue(sixMinutesAgo)

      const result = await service.shouldSync()

      expect(result).toBe(true)
    })

    it('should return false when last sync was less than 5 minutes ago', async () => {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000)
      (mockDb.getLastSyncTime as MockInstance).mockResolvedValue(twoMinutesAgo)

      const result = await service.shouldSync()

      expect(result).toBe(false)
    })

    it('should return false when last sync was exactly 5 minutes ago', async () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
      (mockDb.getLastSyncTime as MockInstance).mockResolvedValue(fiveMinutesAgo)

      const result = await service.shouldSync()

      expect(result).toBe(false)
    })

    it('should handle database errors when checking last sync time', async () => {
      (mockDb.getLastSyncTime as MockInstance).mockRejectedValue(new Error('Database error'))

      await expect(service.shouldSync()).rejects.toThrow('Database error')
    })
  })

  describe('close', () => {
    it('should stop background sync and close database connection', async () => {
      const stopBackgroundSyncSpy = vi.spyOn(service, 'stopBackgroundSync')

      await service.close()

      expect(stopBackgroundSyncSpy).toHaveBeenCalledTimes(1)
      expect(mockDb.close).toHaveBeenCalledTimes(1)
    })

    it('should handle database close errors', async () => {
      (mockDb.close as MockInstance).mockRejectedValue(new Error('Database close failed'))

      await expect(service.close()).rejects.toThrow('Database close failed')
    })

    it('should stop background sync even if database close fails', async () => {
      const stopBackgroundSyncSpy = vi.spyOn(service, 'stopBackgroundSync')
      (mockDb.close as MockInstance).mockRejectedValue(new Error('Database close failed'))

      try {
        await service.close()
      } catch (error) {
        // Expected to throw
      }

      expect(stopBackgroundSyncSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('performSyncDetailed', () => {
    it('should sync work items using detailed fetching workflow', async () => {
      const mockWorkItemIds = [{ id: 1234 }, { id: 5678 }]
      const mockDetailedWorkItems = [
        {
          id: 1234,
          title: 'Detailed Item 1',
          state: 'Active',
          type: 'User Story',
          assignedTo: 'nathan.vale@example.com',
          lastUpdatedAt: new Date(),
          iterationPath: 'Sprint 1',
          storyPoints: 5,
          rawJson: '{"id": 1234, "expanded": true}',
        },
        {
          id: 5678,
          title: 'Detailed Item 2',
          state: 'Done',
          type: 'Task',
          assignedTo: 'john.doe@example.com',
          lastUpdatedAt: new Date(),
          iterationPath: 'Sprint 1',
          effort: 3,
          rawJson: '{"id": 5678, "expanded": true}',
        },
      ]

      (mockClient.fetchWorkItems as MockInstance).mockResolvedValue(mockWorkItemIds)
      (mockClient.fetchWorkItemsDetailed as MockInstance).mockResolvedValue(mockDetailedWorkItems)

      await service.performSyncDetailed()

      expect(mockAuth.ensureAuth).toHaveBeenCalledTimes(1)
      expect(mockClient.fetchWorkItems).toHaveBeenCalledTimes(1)
      expect(mockClient.fetchWorkItemsDetailed).toHaveBeenCalledWith(
        [1234, 5678],
        5,
      )
      expect(mockDb.syncWorkItems).toHaveBeenCalledWith(mockDetailedWorkItems)
      expect(console.log).toHaveBeenCalledWith(
        '✅ Synced 2 work items with detailed data',
      )
    })

    it('should handle custom concurrency limit', async () => {
      const mockWorkItemIds = [{ id: 1234 }, { id: 5678 }, { id: 9012 }]
      const mockDetailedWorkItems = []

      (mockClient.fetchWorkItems as MockInstance).mockResolvedValue(mockWorkItemIds)
      (mockClient.fetchWorkItemsDetailed as MockInstance).mockResolvedValue(mockDetailedWorkItems)

      await service.performSyncDetailed(10)

      expect(mockClient.fetchWorkItemsDetailed).toHaveBeenCalledWith(
        [1234, 5678, 9012],
        10,
      )
    })

    it('should handle empty work items list in detailed sync', async () => {
      (mockClient.fetchWorkItems as MockInstance).mockResolvedValue([])
      (mockClient.fetchWorkItemsDetailed as MockInstance).mockResolvedValue([])

      await service.performSyncDetailed()

      expect(mockClient.fetchWorkItems).toHaveBeenCalledTimes(1)
      expect(mockClient.fetchWorkItemsDetailed).toHaveBeenCalledWith([], 5)
      expect(mockDb.syncWorkItems).toHaveBeenCalledWith([])
      expect(console.log).toHaveBeenCalledWith(
        '✅ Synced 0 work items with detailed data',
      )
    })

    it('should handle partial failures in detailed fetching', async () => {
      const mockWorkItemIds = [{ id: 1234 }, { id: 5678 }, { id: 9012 }]
      const mockDetailedWorkItems = [
        {
          id: 1234,
          title: 'Success Item',
          state: 'Active',
          type: 'User Story',
          assignedTo: 'nathan.vale@example.com',
          lastUpdatedAt: new Date(),
          rawJson: '{"id": 1234}',
        },
        // Note: 5678 and 9012 failed to fetch
      ]

      (mockClient.fetchWorkItems as MockInstance).mockResolvedValue(mockWorkItemIds)
      (mockClient.fetchWorkItemsDetailed as MockInstance).mockResolvedValue(mockDetailedWorkItems)

      await service.performSyncDetailed()

      expect(mockClient.fetchWorkItemsDetailed).toHaveBeenCalledWith(
        [1234, 5678, 9012],
        5,
      )
      expect(mockDb.syncWorkItems).toHaveBeenCalledWith(mockDetailedWorkItems)
      expect(console.log).toHaveBeenCalledWith(
        '✅ Synced 1 work items with detailed data',
      )
    })

    it('should log performance metrics for detailed sync', async () => {
      const mockWorkItemIds = [{ id: 1234 }, { id: 5678 }]
      const mockDetailedWorkItems = []

      (mockClient.fetchWorkItems as MockInstance).mockResolvedValue(mockWorkItemIds)
      (mockClient.fetchWorkItemsDetailed as MockInstance).mockResolvedValue(mockDetailedWorkItems)

      const startTime = Date.now()
      await service.performSyncDetailed()
      const endTime = Date.now()

      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(/⏱️ {2}Detailed sync completed in \d+ms/),
      )
      expect(console.log).toHaveBeenCalledWith(
        `📊 Work items: 2 discovered, 0 detailed fetched with concurrency 5`,
      )
    })

    it('should handle authentication failure in detailed sync', async () => {
      (mockAuth.ensureAuth as MockInstance).mockRejectedValue(new Error('Authentication failed'))

      await expect(service.performSyncDetailed()).rejects.toThrow(
        'Authentication failed',
      )

      expect(mockAuth.ensureAuth).toHaveBeenCalledTimes(1)
      expect(mockClient.fetchWorkItems).not.toHaveBeenCalled()
      expect(mockClient.fetchWorkItemsDetailed).not.toHaveBeenCalled()
      expect(mockDb.syncWorkItems).not.toHaveBeenCalled()
    })

    it('should handle work item discovery failure in detailed sync', async () => {
      (mockClient.fetchWorkItems as MockInstance).mockRejectedValue(new Error('Discovery failed'))

      await expect(service.performSyncDetailed()).rejects.toThrow(
        'Discovery failed',
      )

      expect(mockAuth.ensureAuth).toHaveBeenCalledTimes(1)
      expect(mockClient.fetchWorkItems).toHaveBeenCalledTimes(1)
      expect(mockClient.fetchWorkItemsDetailed).not.toHaveBeenCalled()
      expect(mockDb.syncWorkItems).not.toHaveBeenCalled()
    })

    it('should handle detailed fetch failure', async () => {
      const mockWorkItemIds = [{ id: 1234 }]

      (mockClient.fetchWorkItems as MockInstance).mockResolvedValue(mockWorkItemIds)
      (mockClient.fetchWorkItemsDetailed as MockInstance).mockRejectedValue(
        new Error('Detailed fetch failed'),
      )

      await expect(service.performSyncDetailed()).rejects.toThrow(
        'Detailed fetch failed',
      )

      expect(mockAuth.ensureAuth).toHaveBeenCalledTimes(1)
      expect(mockClient.fetchWorkItems).toHaveBeenCalledTimes(1)
      expect(mockClient.fetchWorkItemsDetailed).toHaveBeenCalledWith([1234], 5)
      expect(mockDb.syncWorkItems).not.toHaveBeenCalled()
    })

    it('should handle database sync failure in detailed sync', async () => {
      const mockWorkItemIds = [{ id: 1234 }]
      const mockDetailedWorkItems = [
        {
          id: 1234,
          title: 'Test Item',
          state: 'Active',
          type: 'User Story',
          assignedTo: 'nathan.vale@example.com',
          lastUpdatedAt: new Date(),
          rawJson: '{"id": 1234}',
        },
      ]

      (mockClient.fetchWorkItems as MockInstance).mockResolvedValue(mockWorkItemIds)
      (mockClient.fetchWorkItemsDetailed as MockInstance).mockResolvedValue(mockDetailedWorkItems)
      (mockDb.syncWorkItems as MockInstance).mockRejectedValue(new Error('Database sync failed'))

      await expect(service.performSyncDetailed()).rejects.toThrow(
        'Database sync failed',
      )

      expect(mockAuth.ensureAuth).toHaveBeenCalledTimes(1)
      expect(mockClient.fetchWorkItems).toHaveBeenCalledTimes(1)
      expect(mockClient.fetchWorkItemsDetailed).toHaveBeenCalledWith([1234], 5)
      expect(mockDb.syncWorkItems).toHaveBeenCalledWith(mockDetailedWorkItems)
    })
  })

  describe('integration scenarios', () => {
    it('should handle complete sync lifecycle', async () => {
      // Setup initial state
      (mockDb.getLastSyncTime as MockInstance).mockResolvedValue(null)

      // Check if sync is needed
      const shouldSync = await service.shouldSync()
      expect(shouldSync).toBe(true)

      // Perform sync
      const testWorkItems4: any[] = [
        {
          id: 1234,
          title: 'Integration Test Item',
          state: 'Active',
          type: 'User Story',
          assignedTo: 'nathan.vale@example.com',
          lastUpdatedAt: new Date(),
        },
      ]
      (mockClient.fetchWorkItems as MockInstance).mockResolvedValue(testWorkItems4)

      await service.performSync()

      expect(mockAuth.ensureAuth).toHaveBeenCalledTimes(1)
      expect(mockClient.fetchWorkItems).toHaveBeenCalledTimes(1)
      expect(mockDb.syncWorkItems).toHaveBeenCalledWith(testWorkItems4)
    })

    it('should skip sync when recently synced', async () => {
      const recentSync = new Date(Date.now() - 2 * 60 * 1000) // 2 minutes ago
      (mockDb.getLastSyncTime as MockInstance).mockResolvedValue(recentSync)

      const shouldSync = await service.shouldSync()
      expect(shouldSync).toBe(false)

      // If we still performed sync, it should work
      await service.performSync()
      expect(mockAuth.ensureAuth).toHaveBeenCalledTimes(1)
    })
  })

  describe('comment sync integration', () => {
    it('should sync comments for work items that need comment sync', async () => {
      const mockWorkItemIds = [{ id: 1234 }, { id: 5678 }]
      const mockDetailedWorkItems = [
        {
          id: 1234,
          title: 'Item with comments',
          state: 'Active',
          type: 'User Story',
          assignedTo: 'nathan.vale@example.com',
          lastUpdatedAt: new Date(),
          commentCount: 3,
          changedDate: new Date(),
          rawJson: '{"id": 1234}',
        },
        {
          id: 5678,
          title: 'Item without comments',
          state: 'Done',
          type: 'Task',
          assignedTo: 'john.doe@example.com',
          lastUpdatedAt: new Date(),
          commentCount: 0,
          changedDate: new Date(),
          rawJson: '{"id": 5678}',
        },
      ]

      const mockComments = [
        {
          id: 1,
          workItemId: 1234,
          text: 'First comment',
          createdBy: 'nathan.vale@example.com',
          createdDate: new Date(),
          modifiedBy: 'nathan.vale@example.com',
          modifiedDate: new Date(),
        },
        {
          id: 2,
          workItemId: 1234,
          text: 'Second comment',
          createdBy: 'john.doe@example.com',
          createdDate: new Date(),
          modifiedBy: 'john.doe@example.com',
          modifiedDate: new Date(),
        },
      ]

      (mockClient.fetchWorkItems as MockInstance).mockResolvedValue(mockWorkItemIds)
      (mockClient.fetchWorkItemsDetailed as MockInstance).mockResolvedValue(mockDetailedWorkItems)
      ;(mockDb.needsCommentSync as MockInstance)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
      (mockClient.fetchWorkItemComments as MockInstance).mockResolvedValue(mockComments)

      const syncService = service as any
      await syncService.performSyncDetailed()

      expect(mockDb.needsCommentSync).toHaveBeenCalledTimes(2)
      expect(mockDb.needsCommentSync).toHaveBeenCalledWith(
        1234,
        3,
        expect.any(Date),
        null,
      )
      expect(mockDb.needsCommentSync).toHaveBeenCalledWith(
        5678,
        0,
        expect.any(Date),
        null,
      )
      expect(mockClient.fetchWorkItemComments).toHaveBeenCalledTimes(1)
      expect(mockClient.fetchWorkItemComments).toHaveBeenCalledWith(1234)
      expect(mockDb.storeWorkItemComments).toHaveBeenCalledTimes(1)
      expect(mockDb.storeWorkItemComments).toHaveBeenCalledWith(mockComments)
    })

    it('should handle comment sync failures gracefully', async () => {
      const mockWorkItemIds = [{ id: 1234 }]
      const mockDetailedWorkItems = [
        {
          id: 1234,
          title: 'Item with failed comment sync',
          state: 'Active',
          type: 'User Story',
          assignedTo: 'nathan.vale@example.com',
          lastUpdatedAt: new Date(),
          commentCount: 2,
          changedDate: new Date(),
          rawJson: '{"id": 1234}',
        },
      ]

      (mockClient.fetchWorkItems as MockInstance).mockResolvedValue(mockWorkItemIds)
      (mockClient.fetchWorkItemsDetailed as MockInstance).mockResolvedValue(mockDetailedWorkItems)
      (mockDb.needsCommentSync as MockInstance).mockResolvedValue(true)
      (mockClient.fetchWorkItemComments as MockInstance).mockRejectedValue(
        new Error('Comment fetch failed'),
      )

      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {})

      const syncService = service as any
      await syncService.performSyncDetailed()

      expect(mockDb.syncWorkItems).toHaveBeenCalledWith(mockDetailedWorkItems)
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '⚠️  Failed to sync comments for work item 1234:',
        expect.any(Error),
      )

      consoleWarnSpy.mockRestore()
    })

    it('should track comment sync performance metrics', async () => {
      const mockWorkItemIds = [{ id: 1234 }, { id: 5678 }]
      const mockDetailedWorkItems = [
        {
          id: 1234,
          title: 'Item 1',
          state: 'Active',
          type: 'User Story',
          assignedTo: 'nathan.vale@example.com',
          lastUpdatedAt: new Date(),
          commentCount: 2,
          changedDate: new Date(),
          rawJson: '{"id": 1234}',
        },
        {
          id: 5678,
          title: 'Item 2',
          state: 'Done',
          type: 'Task',
          assignedTo: 'john.doe@example.com',
          lastUpdatedAt: new Date(),
          commentCount: 1,
          changedDate: new Date(),
          rawJson: '{"id": 5678}',
        },
      ]

      const mockCommentsForItem1 = [
        {
          id: 1,
          workItemId: 1234,
          text: 'Comment 1',
          createdBy: 'user@example.com',
          createdDate: new Date(),
          modifiedBy: 'user@example.com',
          modifiedDate: new Date(),
        },
      ]

      const mockCommentsForItem2 = [
        {
          id: 2,
          workItemId: 5678,
          text: 'Comment 2',
          createdBy: 'user@example.com',
          createdDate: new Date(),
          modifiedBy: 'user@example.com',
          modifiedDate: new Date(),
        },
      ]

      (mockClient.fetchWorkItems as MockInstance).mockResolvedValue(mockWorkItemIds)
      (mockClient.fetchWorkItemsDetailed as MockInstance).mockResolvedValue(mockDetailedWorkItems)
      (mockDb.needsCommentSync as MockInstance).mockResolvedValue(true)
      ;(mockClient.fetchWorkItemComments as MockInstance)
        .mockResolvedValueOnce(mockCommentsForItem1)
        .mockResolvedValueOnce(mockCommentsForItem2)

      const syncService = service as any
      await syncService.performSyncDetailed()

      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(
          /📝 Comment sync complete: 2 work items checked, 2 had comments synced \(.* total comments\) in \d+ms/,
        ),
      )
    })

    it('should skip comment sync when work items have no comments', async () => {
      const mockWorkItemIds = [{ id: 1234 }]
      const mockDetailedWorkItems = [
        {
          id: 1234,
          title: 'Item without comments',
          state: 'Active',
          type: 'User Story',
          assignedTo: 'nathan.vale@example.com',
          lastUpdatedAt: new Date(),
          commentCount: 0,
          changedDate: new Date(),
          rawJson: '{"id": 1234}',
        },
      ]

      (mockClient.fetchWorkItems as MockInstance).mockResolvedValue(mockWorkItemIds)
      (mockClient.fetchWorkItemsDetailed as MockInstance).mockResolvedValue(mockDetailedWorkItems)
      (mockDb.needsCommentSync as MockInstance).mockResolvedValue(false)

      const syncService = service as any
      await syncService.performSyncDetailed()

      expect(mockDb.needsCommentSync).toHaveBeenCalledWith(
        1234,
        0,
        expect.any(Date),
        null,
      )
      expect(mockClient.fetchWorkItemComments).not.toHaveBeenCalled()
      expect(mockDb.storeWorkItemComments).not.toHaveBeenCalled()
    })

    it('should use last sync time for comment sync decisions', async () => {
      const lastSyncTime = new Date(Date.now() - 10 * 60 * 1000) // 10 minutes ago
      const mockWorkItemIds = [{ id: 1234 }]
      const mockDetailedWorkItems = [
        {
          id: 1234,
          title: 'Item to check',
          state: 'Active',
          type: 'User Story',
          assignedTo: 'nathan.vale@example.com',
          lastUpdatedAt: new Date(),
          commentCount: 1,
          changedDate: new Date(),
          rawJson: '{"id": 1234}',
        },
      ]

      (mockClient.fetchWorkItems as MockInstance).mockResolvedValue(mockWorkItemIds)
      (mockClient.fetchWorkItemsDetailed as MockInstance).mockResolvedValue(mockDetailedWorkItems)
      (mockDb.getLastSyncTime as MockInstance).mockResolvedValue(lastSyncTime)
      (mockDb.needsCommentSync as MockInstance).mockResolvedValue(false)

      const syncService = service as any
      await syncService.performSyncDetailed()

      expect(mockDb.needsCommentSync).toHaveBeenCalledWith(
        1234,
        1,
        expect.any(Date),
        lastSyncTime,
      )
    })
  })
})
