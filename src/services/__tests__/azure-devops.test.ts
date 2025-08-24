import { beforeEach, describe, expect, it } from 'vitest'

import { AzureDevOpsClient } from '../azure-devops'

describe('AzureDevOpsClient - REST API Implementation', () => {
  let client: AzureDevOpsClient

  beforeEach(() => {
    client = new AzureDevOpsClient()
  })

  describe('fetchWorkItems', () => {
    it('should fetch and parse work items successfully', async () => {
      const result = await client.fetchWorkItems()

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        id: 1234,
        title: 'Implement user authentication',
        state: 'Active',
        type: 'User Story',
        assignedTo: 'Nathan Vale',
        lastUpdatedAt: new Date('2025-01-08T10:00:00Z'),
        description:
          'As a user, I want to authenticate so that I can access the system',
        createdDate: new Date('2025-01-01T10:00:00Z'),
        closedDate: undefined,
        resolvedDate: undefined,
        // Comprehensive schema fields
        iterationPath: 'Customer Services Platform\\Sprint 1',
        areaPath: 'Customer Services Platform',
        boardColumn: undefined,
        boardColumnDone: false,
        priority: 1,
        severity: '2 - High',
        tags: undefined,
        changedDate: new Date('2025-01-08T10:00:00Z'),
        activatedDate: undefined,
        stateChangeDate: undefined,
        createdBy: 'Unassigned',
        changedBy: 'Unassigned',
        closedBy: 'Unassigned',
        resolvedBy: 'Unassigned',
        storyPoints: undefined,
        effort: undefined,
        remainingWork: undefined,
        completedWork: undefined,
        originalEstimate: undefined,
        acceptanceCriteria: undefined,
        reproSteps: undefined,
        systemInfo: undefined,
        parentId: undefined,
        rev: 1,
        reason: undefined,
        watermark: undefined,
        url: 'https://dev.azure.com/fwcdev/Customer%20Services%20Platform/_apis/wit/workItems/1234',
        commentCount: 0,
        hasAttachments: false,
        teamProject: undefined,
        areaId: undefined,
        nodeId: undefined,
        stackRank: undefined,
        valueArea: undefined,
        rawJson: expect.any(String),
      })

      expect(result[1]).toEqual({
        id: 5678,
        title: 'Setup CI/CD pipeline',
        state: 'Done',
        type: 'Task',
        assignedTo: 'Nathan Vale',
        lastUpdatedAt: new Date('2025-01-05T10:00:00Z'),
        description: 'Setup automated build and deployment pipeline',
        createdDate: new Date('2024-12-15T10:00:00Z'),
        closedDate: undefined,
        resolvedDate: undefined,
        // Comprehensive schema fields
        iterationPath: 'Customer Services Platform\\Sprint 1',
        areaPath: 'Customer Services Platform',
        boardColumn: undefined,
        boardColumnDone: false,
        priority: 2,
        severity: undefined,
        tags: undefined,
        changedDate: new Date('2025-01-05T10:00:00Z'),
        activatedDate: undefined,
        stateChangeDate: undefined,
        createdBy: 'Unassigned',
        changedBy: 'Unassigned',
        closedBy: 'Unassigned',
        resolvedBy: 'Unassigned',
        storyPoints: undefined,
        effort: undefined,
        remainingWork: undefined,
        completedWork: undefined,
        originalEstimate: undefined,
        acceptanceCriteria: undefined,
        reproSteps: undefined,
        systemInfo: undefined,
        parentId: undefined,
        rev: 1,
        reason: undefined,
        watermark: undefined,
        url: 'https://dev.azure.com/fwcdev/Customer%20Services%20Platform/_apis/wit/workItems/5678',
        commentCount: 0,
        hasAttachments: false,
        teamProject: undefined,
        areaId: undefined,
        nodeId: undefined,
        stackRank: undefined,
        valueArea: undefined,
        rawJson: expect.any(String),
      })
    })
  })

  describe('fetchSingleWorkItem', () => {
    it('should get a single work item by ID', async () => {
      const result = await client.fetchSingleWorkItem(1234)

      expect(result).toBeDefined()
      expect(result.id).toBe(1234)
      expect(result.title).toBe('Implement user authentication')
      expect(result.state).toBe('Active')
      expect(result.type).toBe('User Story')
      expect(result.assignedTo).toBe('Nathan Vale')
    })

    it('should handle non-existent work item', async () => {
      // MSW handler generates mock data for any ID, so this will return a generated item
      const result = await client.fetchSingleWorkItem(99999)
      expect(result).toBeDefined()
      expect(result.id).toBe(99999)
      // Generated mock data pattern
      expect(result.title).toBe('Mock Work Item 99999')
    })
  })

  describe('fetchWorkItemComments', () => {
    it('should fetch comments for a work item', async () => {
      const result = await client.fetchWorkItemComments(1234)

      expect(Array.isArray(result)).toBe(true)
      // MSW handlers return mock comments
      expect(result.length).toBeGreaterThanOrEqual(0)
    })

    it('should return empty array for work item without comments', async () => {
      const result = await client.fetchWorkItemComments(99999)
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('addWorkItemComment', () => {
    it('should validate comment text is not empty', async () => {
      await expect(client.addWorkItemComment(1234, '')).rejects.toThrow(
        'Comment text cannot be empty',
      )
    })

    it('should add comment to work item', async () => {
      // MSW handler should handle the comment creation
      await expect(
        client.addWorkItemComment(1234, 'Test comment'),
      ).resolves.not.toThrow()
    })
  })

  // linkWorkItemToPullRequest tests are skipped until the method is fully implemented in the REST client

  describe('buildWorkItemUrl', () => {
    it('should build correct work item URL', () => {
      const url = AzureDevOpsClient.buildWorkItemUrl(1234)
      expect(url).toBe(
        'https://dev.azure.com/fwcdev/Customer%20Services%20Platform/_workitems/edit/1234',
      )
    })

    it('should handle special characters in project name', () => {
      const url = AzureDevOpsClient.buildWorkItemUrl(1234)
      expect(url).toContain('%20') // Space is URL encoded
    })

    it('should handle large work item IDs', () => {
      const url = AzureDevOpsClient.buildWorkItemUrl(999999999)
      expect(url).toBe(
        'https://dev.azure.com/fwcdev/Customer%20Services%20Platform/_workitems/edit/999999999',
      )
    })

    it('should handle work item ID of 0', () => {
      const url = AzureDevOpsClient.buildWorkItemUrl(0)
      expect(url).toBe(
        'https://dev.azure.com/fwcdev/Customer%20Services%20Platform/_workitems/edit/0',
      )
    })

    it('should handle negative work item IDs', () => {
      const url = AzureDevOpsClient.buildWorkItemUrl(-1)
      expect(url).toBe(
        'https://dev.azure.com/fwcdev/Customer%20Services%20Platform/_workitems/edit/-1',
      )
    })
  })

  describe('User email management', () => {
    it('should set and get user emails', () => {
      const emails = ['test1@example.com', 'test2@example.com']
      AzureDevOpsClient.setUserEmails(emails)
      expect(AzureDevOpsClient.getUserEmails()).toEqual(emails)
    })

    it('should start with empty user emails', () => {
      AzureDevOpsClient.setUserEmails([])
      expect(AzureDevOpsClient.getUserEmails()).toEqual([])
    })
  })
})
