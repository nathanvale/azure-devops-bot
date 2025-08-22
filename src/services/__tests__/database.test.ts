import type { MockInstance } from 'vitest'

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock the @orchestr8/resilience package before any imports
vi.mock('@orchestr8/resilience', () => ({
  ProductionResilienceAdapter: vi.fn().mockImplementation(() => ({
    applyPolicy: vi.fn(),
  })),
}))

import type { WorkItemData, WorkItemCommentData } from '../azure-devops'

import { createWorkItemData } from '../../../tests/utils/test-helpers'
import { mockPrismaClient, resetPrismaMocks } from '../../mocks/prisma.mock'
import { DatabaseService } from '../database'

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
          lastUpdatedAt: new Date('2025-01-08T10:00:00Z'),
          rawJson: '{"id": 1234}',
        },
      ]

      const mockUpsertedItem = {
        id: 1234,
        title: 'Test User Story',
        state: 'Active',
        type: 'User Story',
        assignedTo: 'nathan.vale@example.com',
        lastUpdatedAt: new Date('2025-01-08T10:00:00Z'),
        azureUrl:
          'https://dev.azure.com/fwcdev/Customer%20Services%20Platform/_workitems/edit/1234',
        lastSyncedAt: expect.any(Date),
      }

      ;(
        mockPrismaClient.workItem.upsert as unknown as MockInstance
      ).mockResolvedValue(mockUpsertedItem)

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
          azureUrl:
            'https://dev.azure.com/fwcdev/Customer%20Services%20Platform/_workitems/edit/1234',
          lastSyncedAt: expect.any(Date),
        }),
        create: expect.objectContaining({
          id: 1234,
          title: 'Test User Story',
          state: 'Active',
          type: 'User Story',
          assignedTo: 'nathan.vale@example.com',
          lastUpdatedAt: new Date('2025-01-08T10:00:00Z'),
          azureUrl:
            'https://dev.azure.com/fwcdev/Customer%20Services%20Platform/_workitems/edit/1234',
          lastSyncedAt: expect.any(Date),
        }),
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
          lastUpdatedAt: new Date('2025-01-08T10:00:00Z'),
          rawJson: '{"id": 1234}',
        },
        {
          id: 5678,
          title: 'Second Item',
          state: 'Done',
          type: 'Task',
          assignedTo: 'nathan.vale@example.com',
          lastUpdatedAt: new Date('2025-01-07T10:00:00Z'),
          rawJson: '{"id": 5678}',
        },
      ]

      const mockUpsert = mockPrismaClient.workItem
        .upsert as unknown as MockInstance
      mockUpsert.mockResolvedValue({} as any)

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
          lastUpdatedAt: new Date(),
          rawJson: '{"id": 1234}',
        },
      ]

      const mockTransaction =
        mockPrismaClient.$transaction as unknown as MockInstance
      mockTransaction.mockRejectedValue(new Error('Database connection failed'))

      await expect(service.syncWorkItems(workItems)).rejects.toThrow(
        'Database connection failed',
      )
    })

    it('should generate correct Azure URLs for work items', async () => {
      const workItems: WorkItemData[] = [
        {
          id: 9999,
          title: 'URL Test Item',
          state: 'Active',
          type: 'User Story',
          assignedTo: 'nathan.vale@example.com',
          lastUpdatedAt: new Date(),
          rawJson: '{"id": 9999}',
        },
      ]

      const mockWorkItemUpsert = mockPrismaClient.workItem
        .upsert as unknown as MockInstance
      mockWorkItemUpsert.mockResolvedValue({} as any)

      await service.syncWorkItems(workItems)

      expect(mockPrismaClient.workItem.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            azureUrl:
              'https://dev.azure.com/fwcdev/Customer%20Services%20Platform/_workitems/edit/9999',
          }),
          update: expect.objectContaining({
            azureUrl:
              'https://dev.azure.com/fwcdev/Customer%20Services%20Platform/_workitems/edit/9999',
          }),
        }),
      )
    })

    it('should store all comprehensive fields during sync', async () => {
      const comprehensiveWorkItem: WorkItemData = {
        id: 12345,
        title: 'Comprehensive Test Item',
        state: 'Active',
        type: 'User Story',
        assignedTo: 'nathan.vale@fwc.gov.au',
        lastUpdatedAt: new Date('2025-01-08T14:30:00Z'),
        description: 'Test description',

        // Sprint/Board Info
        iterationPath: 'Customer Services Platform\\Sprint 23',
        areaPath: 'Customer Services Platform\\Feature Team A',
        boardColumn: 'In Progress',
        boardColumnDone: false,

        // Priority/Tags
        priority: 2,
        severity: '2 - High',
        tags: 'bug-fix; high-priority',

        // All the dates
        createdDate: new Date('2025-01-01T08:00:00Z'),
        changedDate: new Date('2025-08-21T10:30:00Z'),
        closedDate: new Date('2025-01-10T16:00:00Z'),
        resolvedDate: new Date('2025-01-09T12:00:00Z'),
        activatedDate: new Date('2025-01-02T09:00:00Z'),
        stateChangeDate: new Date('2025-01-08T14:30:00Z'),

        // People
        createdBy: 'john.doe@fwc.gov.au',
        changedBy: 'jane.smith@fwc.gov.au',
        closedBy: 'bob.wilson@fwc.gov.au',
        resolvedBy: 'alice.johnson@fwc.gov.au',

        // Work tracking
        storyPoints: 8,
        effort: 16,
        remainingWork: 4,
        completedWork: 12,
        originalEstimate: 16,

        // Content
        acceptanceCriteria: 'Given when then acceptance criteria',
        reproSteps: 'Steps to reproduce the issue',
        systemInfo: 'Windows 11, Chrome 120',

        // Related items
        parentId: 5678,

        // Additional fields
        rev: 5,
        reason: 'New',
        watermark: 123456,
        url: 'https://dev.azure.com/fwcdev/_apis/wit/workItems/12345',
        commentCount: 3,
        hasAttachments: true,
        teamProject: 'Customer Services Platform',
        areaId: 789,
        nodeId: 101112,
        stackRank: 1000000.5,
        valueArea: 'Business',

        // Raw JSON backup
        rawJson:
          '{"id": 12345, "fields": {"System.Title": "Comprehensive Test Item"}}',
      }

      const mockUpsertComprehensive = mockPrismaClient.workItem
        .upsert as unknown as MockInstance
      mockUpsertComprehensive.mockResolvedValue({} as any)

      await service.syncWorkItems([comprehensiveWorkItem])

      expect(mockPrismaClient.workItem.upsert).toHaveBeenCalledWith({
        where: { id: 12345 },
        update: expect.objectContaining({
          // Basic fields
          title: 'Comprehensive Test Item',
          state: 'Active',
          type: 'User Story',
          assignedTo: 'nathan.vale@fwc.gov.au',
          description: 'Test description',

          // Sprint/Board Info
          iterationPath: 'Customer Services Platform\\Sprint 23',
          areaPath: 'Customer Services Platform\\Feature Team A',
          boardColumn: 'In Progress',
          boardColumnDone: false,

          // Priority/Tags
          priority: 2,
          severity: '2 - High',
          tags: 'bug-fix; high-priority',

          // Dates
          createdDate: new Date('2025-01-01T08:00:00Z'),
          lastUpdatedAt: new Date('2025-01-08T14:30:00Z'),
          closedDate: new Date('2025-01-10T16:00:00Z'),
          resolvedDate: new Date('2025-01-09T12:00:00Z'),
          activatedDate: new Date('2025-01-02T09:00:00Z'),
          stateChangeDate: new Date('2025-01-08T14:30:00Z'),

          // People
          createdBy: 'john.doe@fwc.gov.au',
          changedBy: 'jane.smith@fwc.gov.au',
          closedBy: 'bob.wilson@fwc.gov.au',
          resolvedBy: 'alice.johnson@fwc.gov.au',

          // Work tracking
          storyPoints: 8,
          effort: 16,
          remainingWork: 4,
          completedWork: 12,
          originalEstimate: 16,

          // Content
          acceptanceCriteria: 'Given when then acceptance criteria',
          reproSteps: 'Steps to reproduce the issue',
          systemInfo: 'Windows 11, Chrome 120',

          // Related items
          parentId: 5678,

          // Additional fields
          rev: 5,
          reason: 'New',
          watermark: 123456,
          url: 'https://dev.azure.com/fwcdev/_apis/wit/workItems/12345',
          commentCount: 3,
          hasAttachments: true,
          teamProject: 'Customer Services Platform',
          areaId: 789,
          nodeId: 101112,
          stackRank: 1000000.5,
          valueArea: 'Business',

          // Raw JSON backup
          rawJson:
            '{"id": 12345, "fields": {"System.Title": "Comprehensive Test Item"}}',

          // Generated fields
          azureUrl:
            'https://dev.azure.com/fwcdev/Customer%20Services%20Platform/_workitems/edit/12345',
          lastSyncedAt: expect.any(Date),
        }),
        create: expect.objectContaining({
          id: 12345,
          title: 'Comprehensive Test Item',
          rawJson:
            '{"id": 12345, "fields": {"System.Title": "Comprehensive Test Item"}}',
        }),
      })
    })

    it('should preserve complete Azure DevOps response in rawJson field', async () => {
      const completeAzureResponse = {
        id: 54321,
        rev: 7,
        fields: {
          'System.Title': 'Complete Response Test',
          'System.State': 'In Progress',
          'System.WorkItemType': 'Bug',
          'System.AssignedTo': {
            displayName: 'Test User',
            uniqueName: 'test.user@example.com',
          },
          'System.Description':
            '<div>HTML description with <b>formatting</b></div>',
          'Microsoft.VSTS.Common.Priority': 1,
          'System.Tags': 'critical; production',
          'System.CreatedDate': '2025-01-01T08:00:00Z',
          'System.ChangedDate': '2025-01-08T14:30:00Z',
        },
        relations: [
          {
            rel: 'System.LinkTypes.Hierarchy-Reverse',
            url: 'https://dev.azure.com/fwcdev/_apis/wit/workItems/12345',
            attributes: { name: 'Parent' },
          },
          {
            rel: 'AttachedFile',
            url: 'https://dev.azure.com/fwcdev/_apis/wit/attachments/abc123',
            attributes: { name: 'screenshot.png' },
          },
        ],
        url: 'https://dev.azure.com/fwcdev/_apis/wit/workItems/54321',
        _links: {
          self: {
            href: 'https://dev.azure.com/fwcdev/_apis/wit/workItems/54321',
          },
          workItemUpdates: {
            href: 'https://dev.azure.com/fwcdev/_apis/wit/workItems/54321/updates',
          },
        },
      }

      const workItemData: WorkItemData = {
        id: 54321,
        title: 'Complete Response Test',
        state: 'In Progress',
        type: 'Bug',
        assignedTo: 'test.user@example.com',
        lastUpdatedAt: new Date('2025-01-08T14:30:00Z'),
        rawJson: JSON.stringify(completeAzureResponse),
      }

      const mockUpsertRawJson = mockPrismaClient.workItem
        .upsert as unknown as MockInstance
      mockUpsertRawJson.mockResolvedValue({} as any)

      await service.syncWorkItems([workItemData])

      expect(mockPrismaClient.workItem.upsert).toHaveBeenCalledWith({
        where: { id: 54321 },
        update: expect.objectContaining({
          rawJson: JSON.stringify(completeAzureResponse),
        }),
        create: expect.objectContaining({
          id: 54321,
          rawJson: JSON.stringify(completeAzureResponse),
        }),
      })

      // Verify that rawJson contains complete original response structure
      const storedRawJson = JSON.stringify(completeAzureResponse)
      const parsedResponse = JSON.parse(storedRawJson)

      expect(parsedResponse).toHaveProperty('id', 54321)
      expect(parsedResponse).toHaveProperty('rev', 7)
      expect(parsedResponse).toHaveProperty('fields')
      expect(parsedResponse).toHaveProperty('relations')
      expect(parsedResponse).toHaveProperty('url')
      expect(parsedResponse).toHaveProperty('_links')
      expect(parsedResponse.fields['System.AssignedTo']).toHaveProperty(
        'displayName',
        'Test User',
      )
      expect(parsedResponse.relations).toHaveLength(2)
      expect(parsedResponse._links).toHaveProperty('self')
    })

    it('should handle null and undefined fields gracefully in rawJson', async () => {
      const responseWithNulls = {
        id: 99999,
        rev: 1,
        fields: {
          'System.Title': 'Null Fields Test',
          'System.State': 'New',
          'System.WorkItemType': 'Task',
          'System.AssignedTo': null,
          'System.Description': undefined,
          'Microsoft.VSTS.Common.Priority': null,
          'System.Tags': '',
          'Microsoft.VSTS.Scheduling.StoryPoints': undefined,
        },
        relations: null,
        url: 'https://dev.azure.com/fwcdev/_apis/wit/workItems/99999',
      }

      const workItemData: WorkItemData = {
        id: 99999,
        title: 'Null Fields Test',
        state: 'New',
        type: 'Task',
        assignedTo: 'Unassigned',
        lastUpdatedAt: new Date(),
        rawJson: JSON.stringify(responseWithNulls),
      }

      const mockUpsertNulls = mockPrismaClient.workItem
        .upsert as unknown as MockInstance
      mockUpsertNulls.mockResolvedValue({} as any)

      await service.syncWorkItems([workItemData])

      const storedCall = (
        mockPrismaClient.workItem.upsert as unknown as MockInstance
      ).mock.calls[0]?.[0]
      const storedRawJson = storedCall?.create.rawJson
      const parsedResponse = JSON.parse(storedRawJson)

      expect(parsedResponse.fields['System.AssignedTo']).toBeNull()
      expect(parsedResponse.fields).not.toHaveProperty('System.Description')
      expect(parsedResponse.fields['Microsoft.VSTS.Common.Priority']).toBeNull()
      expect(parsedResponse.fields['System.Tags']).toBe('')
      expect(parsedResponse.relations).toBeNull()
    })

    it('should maintain data completeness across all comprehensive fields', async () => {
      // Create a work item with ALL possible fields populated to test complete data flow
      const completeWorkItem: WorkItemData = {
        // Core fields
        id: 88888,
        title: 'Data Completeness Integration Test',
        state: 'In Progress',
        type: 'Product Backlog Item',
        assignedTo: 'integration.test@fwc.gov.au',
        lastUpdatedAt: new Date('2025-08-21T10:30:00Z'),
        description:
          '<div>Rich HTML description with <em>formatting</em> and <a href="#">links</a></div>',

        // Sprint/Board Info - all fields
        iterationPath: 'Customer Services Platform\\Phase 2\\Sprint 25',
        areaPath: 'Customer Services Platform\\Integration Team',
        boardColumn: 'Active (2 - In Progress)',
        boardColumnDone: false,

        // Priority/Tags - all variations
        priority: 2,
        severity: '2 - High',
        tags: 'integration-test; data-completeness; automated-testing; bug-fix',

        // All date fields populated
        createdDate: new Date('2025-01-01T08:00:00Z'),
        changedDate: new Date('2025-08-21T10:30:00Z'),
        closedDate: new Date('2025-01-10T16:00:00Z'),
        resolvedDate: new Date('2025-01-09T12:00:00Z'),
        activatedDate: new Date('2025-01-02T09:00:00Z'),
        stateChangeDate: new Date('2025-01-08T14:30:00Z'),

        // All people fields populated
        createdBy: 'john.doe@fwc.gov.au',
        changedBy: 'jane.smith@fwc.gov.au',
        closedBy: 'bob.wilson@fwc.gov.au',
        resolvedBy: 'alice.johnson@fwc.gov.au',

        // All work tracking fields
        storyPoints: 8,
        effort: 16,
        remainingWork: 4,
        completedWork: 12,
        originalEstimate: 16,

        // All content fields
        acceptanceCriteria: 'Given when then acceptance criteria',
        reproSteps:
          'Steps to reproduce the issue:\n1. Execute comprehensive test\n2. Verify all fields\n3. Confirm data integrity',
        systemInfo:
          'Windows 11, macOS 14.6, Node.js 20.18.0, Vitest 3.2.4, TypeScript 5.8.4',

        // Related items
        parentId: 5678,

        // All additional Azure DevOps fields
        rev: 5,
        reason: 'New',
        watermark: 123456,
        url: 'https://dev.azure.com/fwcdev/_apis/wit/workItems/88888',
        commentCount: 3,
        hasAttachments: true,
        teamProject: 'Customer Services Platform',
        areaId: 789,
        nodeId: 101112,
        stackRank: 1000000.5,
        valueArea: 'Business',

        // Complete raw JSON with nested structures
        rawJson: JSON.stringify({
          id: 88888,
          rev: 15,
          fields: {
            'System.Title': 'Data Completeness Integration Test',
            'System.State': 'In Progress',
            'System.WorkItemType': 'Product Backlog Item',
            'System.AssignedTo': {
              displayName: 'Integration Tester',
              uniqueName: 'integration.test@fwc.gov.au',
              id: 'test-user-id-123',
            },
            'System.Description':
              '<div>Rich HTML description with <em>formatting</em> and <a href="#">links</a></div>',
            'System.IterationPath':
              'Customer Services Platform\\Phase 2\\Sprint 25',
            'System.AreaPath': 'Customer Services Platform\\Integration Team',
          },
          relations: [
            {
              rel: 'System.LinkTypes.Hierarchy-Reverse',
              url: 'https://dev.azure.com/fwcdev/_apis/wit/workItems/77777',
              attributes: { name: 'Parent' },
            },
          ],
          _links: {
            self: {
              href: 'https://dev.azure.com/fwcdev/_apis/wit/workItems/88888',
            },
            workItemHistory: {
              href: 'https://dev.azure.com/fwcdev/_apis/wit/workItems/88888/history',
            },
          },
        }),
      }

      const mockUpsertCompleteness = mockPrismaClient.workItem
        .upsert as unknown as MockInstance
      mockUpsertCompleteness.mockResolvedValue({} as any)

      await service.syncWorkItems([completeWorkItem])

      // Verify that ALL fields are stored correctly
      const upsertCall = (
        mockPrismaClient.workItem.upsert as unknown as MockInstance
      ).mock.calls[0]?.[0]
      const createData = upsertCall?.create
      const updateData = upsertCall?.update

      // Test core field mapping
      expect(createData.id).toBe(88888)
      expect(createData.title).toBe('Data Completeness Integration Test')
      expect(createData.state).toBe('In Progress')
      expect(createData.type).toBe('Product Backlog Item')
      expect(createData.assignedTo).toBe('integration.test@fwc.gov.au')
      expect(createData.description).toContain('Rich HTML description')

      // Test sprint/board fields
      expect(createData.iterationPath).toBe(
        'Customer Services Platform\\Phase 2\\Sprint 25',
      )
      expect(createData.areaPath).toBe(
        'Customer Services Platform\\Integration Team',
      )
      expect(createData.boardColumn).toBe('Active (2 - In Progress)')
      expect(createData.boardColumnDone).toBe(false)

      // Test priority/tag fields
      expect(createData.priority).toBe(2)
      expect(createData.severity).toBe('2 - High')
      expect(createData.tags).toContain('bug-fix')

      // Test all date fields
      expect(createData.createdDate).toEqual(new Date('2025-01-01T08:00:00Z'))
      expect(createData.changedDate).toEqual(new Date('2025-08-21T10:30:00Z'))
      expect(createData.closedDate).toEqual(new Date('2025-01-10T16:00:00Z'))
      expect(createData.resolvedDate).toEqual(new Date('2025-01-09T12:00:00Z'))
      expect(createData.activatedDate).toEqual(new Date('2025-01-02T09:00:00Z'))
      expect(createData.stateChangeDate).toEqual(
        new Date('2025-01-08T14:30:00Z'),
      )

      // Test all people fields
      expect(createData.createdBy).toBe('john.doe@fwc.gov.au')
      expect(createData.changedBy).toBe('jane.smith@fwc.gov.au')
      expect(createData.closedBy).toBe('bob.wilson@fwc.gov.au')
      expect(createData.resolvedBy).toBe('alice.johnson@fwc.gov.au')

      // Test all work tracking fields
      expect(createData.storyPoints).toBe(8)
      expect(createData.effort).toBe(16)
      expect(createData.remainingWork).toBe(4)
      expect(createData.completedWork).toBe(12)
      expect(createData.originalEstimate).toBe(16)

      // Test content fields
      expect(createData.acceptanceCriteria).toContain(
        'Given when then acceptance criteria',
      )
      expect(createData.reproSteps).toContain('Steps to reproduce the issue')
      expect(createData.systemInfo).toContain('Windows 11')

      // Test related items
      expect(createData.parentId).toBe(5678)

      // Test additional Azure DevOps fields
      expect(createData.rev).toBe(5)
      expect(createData.reason).toBe('New')
      expect(createData.watermark).toBe(123456)
      expect(createData.url).toBe(
        'https://dev.azure.com/fwcdev/_apis/wit/workItems/88888',
      )
      expect(createData.commentCount).toBe(3)
      expect(createData.hasAttachments).toBe(true)
      expect(createData.teamProject).toBe('Customer Services Platform')
      expect(createData.areaId).toBe(789)
      expect(createData.nodeId).toBe(101112)
      expect(createData.stackRank).toBe(1000000.5)
      expect(createData.valueArea).toBe('Business')

      // Test rawJson completeness
      const rawJsonData = JSON.parse(createData.rawJson)
      expect(rawJsonData.id).toBe(88888)
      expect(rawJsonData.rev).toBe(15)
      expect(rawJsonData.fields['System.AssignedTo'].displayName).toBe(
        'Integration Tester',
      )
      expect(rawJsonData.relations).toHaveLength(1)
      expect(rawJsonData._links).toHaveProperty('self')

      // Verify update data matches create data for all critical fields
      expect(updateData.title).toBe(createData.title)
      expect(updateData.stackRank).toBe(createData.stackRank)
      expect(updateData.rawJson).toBe(createData.rawJson)
      expect(updateData.iterationPath).toBe(createData.iterationPath)

      // Verify Azure URL generation
      expect(createData.azureUrl).toBe(
        'https://dev.azure.com/fwcdev/Customer%20Services%20Platform/_workitems/edit/88888',
      )

      // Verify sync metadata
      expect(createData.lastSyncedAt).toEqual(expect.any(Date))
      expect(createData.lastUpdatedAt).toEqual(new Date('2025-08-21T10:30:00Z'))
    })
  })

  describe('getAllWorkItems', () => {
    it('should return all work items ordered by last updated date', async () => {
      const mockWorkItems = [
        createWorkItemData({
          id: 1,
          lastUpdatedAt: new Date('2025-01-08T10:00:00Z'),
        }),
        createWorkItemData({
          id: 2,
          lastUpdatedAt: new Date('2025-01-07T10:00:00Z'),
        }),
      ]

      const mockFindMany = mockPrismaClient.workItem
        .findMany as unknown as MockInstance
      mockFindMany.mockResolvedValue(mockWorkItems)

      const result = await service.getAllWorkItems()

      expect(result).toEqual(mockWorkItems)
      expect(mockPrismaClient.workItem.findMany).toHaveBeenCalledWith({
        orderBy: { lastUpdatedAt: 'desc' },
      })
    })

    it('should return empty array when no work items exist', async () => {
      ;(
        mockPrismaClient.workItem.findMany as unknown as MockInstance
      ).mockResolvedValue([])

      const result = await service.getAllWorkItems()

      expect(result).toEqual([])
    })

    it('should handle database errors', async () => {
      ;(
        mockPrismaClient.workItem.findMany as unknown as MockInstance
      ).mockRejectedValue(new Error('Database query failed'))

      await expect(service.getAllWorkItems()).rejects.toThrow(
        'Database query failed',
      )
    })
  })

  describe('getWorkItemsByState', () => {
    it('should return work items filtered by state', async () => {
      const activeItems = [
        createWorkItemData({ id: 1, state: 'Active' }),
        createWorkItemData({ id: 2, state: 'Active' }),
      ]

      const mockFindManyActive = mockPrismaClient.workItem
        .findMany as unknown as MockInstance
      mockFindManyActive.mockResolvedValue(activeItems)

      const result = await service.getWorkItemsByState('Active')

      expect(result).toEqual(activeItems)
      expect(mockPrismaClient.workItem.findMany).toHaveBeenCalledWith({
        where: { state: 'Active' },
        orderBy: { lastUpdatedAt: 'desc' },
      })
    })

    it('should return empty array for non-existent state', async () => {
      ;(
        mockPrismaClient.workItem.findMany as unknown as MockInstance
      ).mockResolvedValue([])

      const result = await service.getWorkItemsByState('NonExistentState')

      expect(result).toEqual([])
    })

    it('should handle different states correctly', async () => {
      const doneItems = [createWorkItemData({ state: 'Done' })]
      const mockFindManyDone = mockPrismaClient.workItem
        .findMany as unknown as MockInstance
      mockFindManyDone.mockResolvedValue(doneItems)

      await service.getWorkItemsByState('Done')

      expect(mockPrismaClient.workItem.findMany).toHaveBeenCalledWith({
        where: { state: 'Done' },
        orderBy: { lastUpdatedAt: 'desc' },
      })
    })
  })

  describe('getWorkItemsByType', () => {
    it('should return work items filtered by type', async () => {
      const userStories = [
        createWorkItemData({ id: 1, type: 'User Story' }),
        createWorkItemData({ id: 2, type: 'User Story' }),
      ]

      const mockFindManyStories = mockPrismaClient.workItem
        .findMany as unknown as MockInstance
      mockFindManyStories.mockResolvedValue(userStories)

      const result = await service.getWorkItemsByType('User Story')

      expect(result).toEqual(userStories)
      expect(mockPrismaClient.workItem.findMany).toHaveBeenCalledWith({
        where: { type: 'User Story' },
        orderBy: { lastUpdatedAt: 'desc' },
      })
    })

    it('should handle different work item types', async () => {
      const tasks = [createWorkItemData({ type: 'Task' })]
      const mockFindManyTasks = mockPrismaClient.workItem
        .findMany as unknown as MockInstance
      mockFindManyTasks.mockResolvedValue(tasks)

      await service.getWorkItemsByType('Task')

      expect(mockPrismaClient.workItem.findMany).toHaveBeenCalledWith({
        where: { type: 'Task' },
        orderBy: { lastUpdatedAt: 'desc' },
      })
    })

    it('should return empty array for non-existent type', async () => {
      ;(
        mockPrismaClient.workItem.findMany as unknown as MockInstance
      ).mockResolvedValue([])

      const result = await service.getWorkItemsByType('NonExistentType')

      expect(result).toEqual([])
    })
  })

  describe('getLastSyncTime', () => {
    it('should return the most recent sync time', async () => {
      const lastSyncDate = new Date('2025-01-08T15:30:00Z')
      const mockItem = { lastSyncedAt: lastSyncDate }

      const mockFindFirst = mockPrismaClient.workItem
        .findFirst as unknown as MockInstance
      mockFindFirst.mockResolvedValue(mockItem)

      const result = await service.getLastSyncTime()

      expect(result).toEqual(lastSyncDate)
      expect(mockPrismaClient.workItem.findFirst).toHaveBeenCalledWith({
        orderBy: { lastSyncedAt: 'desc' },
        select: { lastSyncedAt: true },
      })
    })

    it('should return null when no work items exist', async () => {
      ;(
        mockPrismaClient.workItem.findFirst as unknown as MockInstance
      ).mockResolvedValue(null)

      const result = await service.getLastSyncTime()

      expect(result).toBeNull()
    })

    it('should return null when sync time is not available', async () => {
      ;(
        mockPrismaClient.workItem.findFirst as unknown as MockInstance
      ).mockResolvedValue({
        lastSyncedAt: null,
      })

      const result = await service.getLastSyncTime()

      expect(result).toBeNull()
    })

    it('should handle database errors', async () => {
      ;(
        mockPrismaClient.workItem.findFirst as unknown as MockInstance
      ).mockRejectedValue(new Error('Database query failed'))

      await expect(service.getLastSyncTime()).rejects.toThrow(
        'Database query failed',
      )
    })
  })

  describe('storeWorkItemComments', () => {
    it('should store comments for a work item successfully', async () => {
      const comments: WorkItemCommentData[] = [
        {
          id: '1',
          workItemId: 1234,
          text: 'First comment on the work item',
          createdBy: 'nathan.vale@fwc.gov.au',
          createdDate: new Date('2025-01-08T10:00:00Z'),
          modifiedBy: 'nathan.vale@fwc.gov.au',
          modifiedDate: new Date('2025-01-08T10:30:00Z'),
        },
        {
          id: '2',
          workItemId: 1234,
          text: 'Second comment with more details',
          createdBy: 'jane.smith@fwc.gov.au',
          createdDate: new Date('2025-01-08T14:00:00Z'),
          modifiedBy: null,
          modifiedDate: null,
        },
      ]

      const mockCommentUpsert = mockPrismaClient.workItemComment
        .upsert as unknown as MockInstance
      mockCommentUpsert.mockResolvedValue({} as any)

      await service.storeWorkItemComments(comments)

      expect(mockPrismaClient.workItemComment.upsert).toHaveBeenCalledTimes(2)
      expect(mockPrismaClient.workItemComment.upsert).toHaveBeenNthCalledWith(
        1,
        {
          where: { id: 1 },
          update: {
            text: 'First comment on the work item',
            createdBy: 'nathan.vale@fwc.gov.au',
            createdDate: new Date('2025-01-08T10:00:00Z'),
            modifiedBy: 'nathan.vale@fwc.gov.au',
            modifiedDate: new Date('2025-01-08T10:30:00Z'),
          },
          create: {
            id: 1,
            workItemId: 1234,
            text: 'First comment on the work item',
            createdBy: 'nathan.vale@fwc.gov.au',
            createdDate: new Date('2025-01-08T10:00:00Z'),
            modifiedBy: 'nathan.vale@fwc.gov.au',
            modifiedDate: new Date('2025-01-08T10:30:00Z'),
          },
        },
      )
    })

    it('should handle empty comments array', async () => {
      await service.storeWorkItemComments([])

      expect(mockPrismaClient.workItemComment.upsert).not.toHaveBeenCalled()
    })

    it('should handle database errors during comment storage', async () => {
      const comments: WorkItemCommentData[] = [
        {
          id: '999',
          workItemId: 1234,
          text: 'Test comment',
          createdBy: 'test@example.com',
          createdDate: new Date(),
          modifiedBy: null,
          modifiedDate: null,
        },
      ]

      const mockTransactionConstraint =
        mockPrismaClient.$transaction as unknown as MockInstance
      mockTransactionConstraint.mockRejectedValue(
        new Error('Database constraint violation'),
      )

      await expect(service.storeWorkItemComments(comments)).rejects.toThrow(
        'Database constraint violation',
      )
    })

    it('should handle comments with null modified fields', async () => {
      const comments: WorkItemCommentData[] = [
        {
          id: '3',
          workItemId: 5678,
          text: 'Unmodified comment',
          createdBy: 'original.author@fwc.gov.au',
          createdDate: new Date('2025-01-08T09:00:00Z'),
          modifiedBy: null,
          modifiedDate: null,
        },
      ]

      const mockNullCommentUpsert = mockPrismaClient.workItemComment
        .upsert as unknown as MockInstance
      mockNullCommentUpsert.mockResolvedValue({} as any)

      await service.storeWorkItemComments(comments)

      expect(mockPrismaClient.workItemComment.upsert).toHaveBeenCalledWith({
        where: { id: 3 },
        update: {
          text: 'Unmodified comment',
          createdBy: 'original.author@fwc.gov.au',
          createdDate: new Date('2025-01-08T09:00:00Z'),
          modifiedBy: null,
          modifiedDate: null,
        },
        create: {
          id: 3,
          workItemId: 5678,
          text: 'Unmodified comment',
          createdBy: 'original.author@fwc.gov.au',
          createdDate: new Date('2025-01-08T09:00:00Z'),
          modifiedBy: null,
          modifiedDate: null,
        },
      })
    })
  })

  describe('getWorkItemComments', () => {
    it('should retrieve comments for a work item', async () => {
      const mockComments = [
        {
          id: '1',
          workItemId: 1234,
          text: 'First comment',
          createdBy: 'user1@fwc.gov.au',
          createdDate: new Date('2025-01-08T10:00:00Z'),
          modifiedBy: null,
          modifiedDate: null,
        },
        {
          id: '2',
          workItemId: 1234,
          text: 'Second comment',
          createdBy: 'user2@fwc.gov.au',
          createdDate: new Date('2025-01-08T11:00:00Z'),
          modifiedBy: null,
          modifiedDate: null,
        },
      ]

      const mockCommentFind = mockPrismaClient.workItemComment
        .findMany as unknown as MockInstance
      mockCommentFind.mockResolvedValue(mockComments)

      const result = await service.getWorkItemComments(1234)

      expect(result).toEqual(mockComments)
      expect(mockPrismaClient.workItemComment.findMany).toHaveBeenCalledWith({
        where: { workItemId: 1234 },
        orderBy: { createdDate: 'asc' },
      })
    })

    it('should return empty array when no comments exist', async () => {
      ;(
        mockPrismaClient.workItemComment.findMany as unknown as MockInstance
      ).mockResolvedValue([])

      const result = await service.getWorkItemComments(9999)

      expect(result).toEqual([])
    })

    it('should handle database errors during comment retrieval', async () => {
      ;(
        mockPrismaClient.workItemComment.findMany as unknown as MockInstance
      ).mockRejectedValue(new Error('Database query failed'))

      await expect(service.getWorkItemComments(1234)).rejects.toThrow(
        'Database query failed',
      )
    })
  })

  describe('getRecentComments', () => {
    it('should retrieve recent comments across all work items', async () => {
      const mockComments = [
        {
          id: 'recent-1',
          workItemId: 1234,
          text: 'Latest comment',
          createdBy: 'user1@fwc.gov.au',
          createdDate: new Date('2025-01-08T15:00:00Z'),
          modifiedBy: null,
          modifiedDate: null,
        },
        {
          id: 'recent-2',
          workItemId: 5678,
          text: 'Earlier comment',
          createdBy: 'user2@fwc.gov.au',
          createdDate: new Date('2025-01-08T14:00:00Z'),
          modifiedBy: null,
          modifiedDate: null,
        },
      ]

      const mockRecentCommentFind = mockPrismaClient.workItemComment
        .findMany as unknown as MockInstance
      mockRecentCommentFind.mockResolvedValue(mockComments)

      const result = await service.getRecentComments(10)

      expect(result).toEqual(mockComments)
      expect(mockPrismaClient.workItemComment.findMany).toHaveBeenCalledWith({
        orderBy: { createdDate: 'desc' },
        take: 10,
      })
    })

    it('should use default limit when not specified', async () => {
      ;(
        mockPrismaClient.workItemComment.findMany as unknown as MockInstance
      ).mockResolvedValue([])

      await service.getRecentComments()

      expect(mockPrismaClient.workItemComment.findMany).toHaveBeenCalledWith({
        orderBy: { createdDate: 'desc' },
        take: 50,
      })
    })

    it('should handle large limit values', async () => {
      ;(
        mockPrismaClient.workItemComment.findMany as unknown as MockInstance
      ).mockResolvedValue([])

      await service.getRecentComments(1000)

      expect(mockPrismaClient.workItemComment.findMany).toHaveBeenCalledWith({
        orderBy: { createdDate: 'desc' },
        take: 1000,
      })
    })
  })

  describe('needsCommentSync', () => {
    it('should return true when work item has comments and was recently changed', async () => {
      const result = await service.needsCommentSync(
        1234,
        5,
        new Date('2025-01-08T14:00:00Z'),
      )

      expect(result).toBe(true)
    })

    it('should return false when work item has no comments', async () => {
      const result = await service.needsCommentSync(
        1234,
        0,
        new Date('2025-01-08T14:00:00Z'),
      )

      expect(result).toBe(false)
    })

    it('should return true when last sync time is null', async () => {
      const result = await service.needsCommentSync(1234, 3, null)

      expect(result).toBe(true)
    })

    it('should return false when work item has not changed since last sync', async () => {
      const lastSync = new Date('2025-01-08T15:00:00Z')
      const changedDate = new Date('2025-01-08T14:00:00Z')

      const result = await service.needsCommentSync(
        1234,
        2,
        changedDate,
        lastSync,
      )

      expect(result).toBe(false)
    })

    it('should return true when work item changed after last sync', async () => {
      const lastSync = new Date('2025-01-08T14:00:00Z')
      const changedDate = new Date('2025-01-08T15:00:00Z')

      const result = await service.needsCommentSync(
        1234,
        2,
        changedDate,
        lastSync,
      )

      expect(result).toBe(true)
    })
  })

  describe('close', () => {
    it('should disconnect from Prisma', async () => {
      ;(
        mockPrismaClient.$disconnect as unknown as MockInstance
      ).mockResolvedValue(undefined)

      await service.close()

      expect(mockPrismaClient.$disconnect).toHaveBeenCalledTimes(1)
    })

    it('should handle disconnect errors gracefully', async () => {
      ;(
        mockPrismaClient.$disconnect as unknown as MockInstance
      ).mockRejectedValue(new Error('Disconnect failed'))

      await expect(service.close()).rejects.toThrow('Disconnect failed')
    })
  })
})
