import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DatabaseService } from '../database'
import { mockPrismaClient, resetPrismaMocks } from '@/mocks/prisma.mock'
import { createTestWorkItem } from '../../../tests/utils/test-helpers'
import { WorkItemData } from '../azure-devops'

// Mock the database module
vi.mock('../database', async () => {
  const actual = await vi.importActual('../database')
  return actual
})

describe('DatabaseService', () => {
  let service: DatabaseService

  beforeEach(() => {
    resetPrismaMocks()
    service = new DatabaseService()
  })

  describe('syncWorkItems', () => {
    it('should upsert work items successfully', async () => {
      const workItems: WorkItemData[] = [
        {
          id: 1234,
          title: 'Test User Story',
          state: 'Active',
          type: 'User Story',
          assignedTo: 'nathan.vale@example.com',
          lastUpdatedAt: new Date('2025-01-08T10:00:00Z')
        }
      ]

      const mockUpsertedItem = {
        id: 1234,
        title: 'Test User Story',
        state: 'Active',
        type: 'User Story',
        assignedTo: 'nathan.vale@example.com',
        lastUpdatedAt: new Date('2025-01-08T10:00:00Z'),
        azureUrl: 'https://dev.azure.com/fwcdev/Customer%20Services%20Platform/_workitems/edit/1234',
        lastSyncedAt: expect.any(Date)
      }

      mockPrismaClient.workItem.upsert.mockResolvedValue(mockUpsertedItem)

      await service.syncWorkItems(workItems)

      expect(mockPrismaClient.workItem.upsert).toHaveBeenCalledTimes(1)
      expect(mockPrismaClient.workItem.upsert).toHaveBeenCalledWith({
        where: { id: 1234 },
        update: expect.objectContaining({
          title: 'Test User Story',
          state: 'Active',
          type: 'User Story',
          assignedTo: 'nathan.vale@example.com',
          lastUpdatedAt: new Date('2025-01-08T10:00:00Z'),
          azureUrl: 'https://dev.azure.com/fwcdev/Customer%20Services%20Platform/_workitems/edit/1234',
          lastSyncedAt: expect.any(Date),
        }),
        create: expect.objectContaining({
          id: 1234,
          title: 'Test User Story',
          state: 'Active',
          type: 'User Story',
          assignedTo: 'nathan.vale@example.com',
          lastUpdatedAt: new Date('2025-01-08T10:00:00Z'),
          azureUrl: 'https://dev.azure.com/fwcdev/Customer%20Services%20Platform/_workitems/edit/1234',
          lastSyncedAt: expect.any(Date),
        })
      })
    })

    it('should handle multiple work items', async () => {
      const workItems: WorkItemData[] = [
        {
          id: 1234,
          title: 'First Item',
          state: 'Active',
          type: 'User Story',
          assignedTo: 'nathan.vale@example.com',
          lastUpdatedAt: new Date('2025-01-08T10:00:00Z')
        },
        {
          id: 5678,
          title: 'Second Item',
          state: 'Done',
          type: 'Task',
          assignedTo: 'nathan.vale@example.com',
          lastUpdatedAt: new Date('2025-01-07T10:00:00Z')
        }
      ]

      mockPrismaClient.workItem.upsert.mockResolvedValue({} as any)

      await service.syncWorkItems(workItems)

      expect(mockPrismaClient.workItem.upsert).toHaveBeenCalledTimes(2)
    })

    it('should handle database errors during sync', async () => {
      const workItems: WorkItemData[] = [
        {
          id: 1234,
          title: 'Test Item',
          state: 'Active',
          type: 'User Story',
          assignedTo: 'nathan.vale@example.com',
          lastUpdatedAt: new Date()
        }
      ]

      mockPrismaClient.workItem.upsert.mockRejectedValue(
        new Error('Database connection failed')
      )

      await expect(service.syncWorkItems(workItems))
        .rejects.toThrow('Database connection failed')
    })

    it('should generate correct Azure URLs for work items', async () => {
      const workItems: WorkItemData[] = [
        {
          id: 9999,
          title: 'URL Test Item',
          state: 'Active',
          type: 'User Story',
          assignedTo: 'nathan.vale@example.com',
          lastUpdatedAt: new Date()
        }
      ]

      mockPrismaClient.workItem.upsert.mockResolvedValue({} as any)

      await service.syncWorkItems(workItems)

      expect(mockPrismaClient.workItem.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            azureUrl: 'https://dev.azure.com/fwcdev/Customer%20Services%20Platform/_workitems/edit/9999'
          }),
          update: expect.objectContaining({
            azureUrl: 'https://dev.azure.com/fwcdev/Customer%20Services%20Platform/_workitems/edit/9999'
          })
        })
      )
    })
  })

  describe('getAllWorkItems', () => {
    it('should return all work items ordered by last updated date', async () => {
      const mockWorkItems = [
        createTestWorkItem({ id: 1, lastUpdatedAt: new Date('2025-01-08T10:00:00Z') }),
        createTestWorkItem({ id: 2, lastUpdatedAt: new Date('2025-01-07T10:00:00Z') })
      ]

      mockPrismaClient.workItem.findMany.mockResolvedValue(mockWorkItems)

      const result = await service.getAllWorkItems()

      expect(result).toEqual(mockWorkItems)
      expect(mockPrismaClient.workItem.findMany).toHaveBeenCalledWith({
        orderBy: { lastUpdatedAt: 'desc' }
      })
    })

    it('should return empty array when no work items exist', async () => {
      mockPrismaClient.workItem.findMany.mockResolvedValue([])

      const result = await service.getAllWorkItems()

      expect(result).toEqual([])
    })

    it('should handle database errors', async () => {
      mockPrismaClient.workItem.findMany.mockRejectedValue(
        new Error('Database query failed')
      )

      await expect(service.getAllWorkItems())
        .rejects.toThrow('Database query failed')
    })
  })

  describe('getWorkItemsByState', () => {
    it('should return work items filtered by state', async () => {
      const activeItems = [
        createTestWorkItem({ id: 1, state: 'Active' }),
        createTestWorkItem({ id: 2, state: 'Active' })
      ]

      mockPrismaClient.workItem.findMany.mockResolvedValue(activeItems)

      const result = await service.getWorkItemsByState('Active')

      expect(result).toEqual(activeItems)
      expect(mockPrismaClient.workItem.findMany).toHaveBeenCalledWith({
        where: { state: 'Active' },
        orderBy: { lastUpdatedAt: 'desc' }
      })
    })

    it('should return empty array for non-existent state', async () => {
      mockPrismaClient.workItem.findMany.mockResolvedValue([])

      const result = await service.getWorkItemsByState('NonExistentState')

      expect(result).toEqual([])
    })

    it('should handle different states correctly', async () => {
      const doneItems = [createTestWorkItem({ state: 'Done' })]
      mockPrismaClient.workItem.findMany.mockResolvedValue(doneItems)

      const result = await service.getWorkItemsByState('Done')

      expect(mockPrismaClient.workItem.findMany).toHaveBeenCalledWith({
        where: { state: 'Done' },
        orderBy: { lastUpdatedAt: 'desc' }
      })
    })
  })

  describe('getWorkItemsByType', () => {
    it('should return work items filtered by type', async () => {
      const userStories = [
        createTestWorkItem({ id: 1, type: 'User Story' }),
        createTestWorkItem({ id: 2, type: 'User Story' })
      ]

      mockPrismaClient.workItem.findMany.mockResolvedValue(userStories)

      const result = await service.getWorkItemsByType('User Story')

      expect(result).toEqual(userStories)
      expect(mockPrismaClient.workItem.findMany).toHaveBeenCalledWith({
        where: { type: 'User Story' },
        orderBy: { lastUpdatedAt: 'desc' }
      })
    })

    it('should handle different work item types', async () => {
      const tasks = [createTestWorkItem({ type: 'Task' })]
      mockPrismaClient.workItem.findMany.mockResolvedValue(tasks)

      const result = await service.getWorkItemsByType('Task')

      expect(mockPrismaClient.workItem.findMany).toHaveBeenCalledWith({
        where: { type: 'Task' },
        orderBy: { lastUpdatedAt: 'desc' }
      })
    })

    it('should return empty array for non-existent type', async () => {
      mockPrismaClient.workItem.findMany.mockResolvedValue([])

      const result = await service.getWorkItemsByType('NonExistentType')

      expect(result).toEqual([])
    })
  })

  describe('getLastSyncTime', () => {
    it('should return the most recent sync time', async () => {
      const lastSyncDate = new Date('2025-01-08T15:30:00Z')
      const mockItem = { lastSyncedAt: lastSyncDate }

      mockPrismaClient.workItem.findFirst.mockResolvedValue(mockItem)

      const result = await service.getLastSyncTime()

      expect(result).toEqual(lastSyncDate)
      expect(mockPrismaClient.workItem.findFirst).toHaveBeenCalledWith({
        orderBy: { lastSyncedAt: 'desc' },
        select: { lastSyncedAt: true }
      })
    })

    it('should return null when no work items exist', async () => {
      mockPrismaClient.workItem.findFirst.mockResolvedValue(null)

      const result = await service.getLastSyncTime()

      expect(result).toBeNull()
    })

    it('should return null when sync time is not available', async () => {
      mockPrismaClient.workItem.findFirst.mockResolvedValue({ lastSyncedAt: null })

      const result = await service.getLastSyncTime()

      expect(result).toBeNull()
    })

    it('should handle database errors', async () => {
      mockPrismaClient.workItem.findFirst.mockRejectedValue(
        new Error('Database query failed')
      )

      await expect(service.getLastSyncTime())
        .rejects.toThrow('Database query failed')
    })
  })

  describe('close', () => {
    it('should disconnect from Prisma', async () => {
      mockPrismaClient.$disconnect.mockResolvedValue(undefined)

      await service.close()

      expect(mockPrismaClient.$disconnect).toHaveBeenCalledTimes(1)
    })

    it('should handle disconnect errors gracefully', async () => {
      mockPrismaClient.$disconnect.mockRejectedValue(
        new Error('Disconnect failed')
      )

      await expect(service.close()).rejects.toThrow('Disconnect failed')
    })
  })
})