import { describe, it, expect, beforeEach, vi } from 'vitest'

import type { WorkItem, IAzureDevOpsClient } from '../../packages/azure-devops-client/dist/index.js'

import { FieldDiscoveryService } from '../field-discovery'

describe('FieldDiscoveryService', () => {
  let service: FieldDiscoveryService
  let mockClient: IAzureDevOpsClient

  beforeEach(() => {
    vi.resetAllMocks()
    
    mockClient = {
      getWorkItem: vi.fn(),
      getWorkItemsBatch: vi.fn(),
      queryWorkItems: vi.fn(),
      getWorkItemComments: vi.fn(),
      addWorkItemComment: vi.fn(),
      batchGetWorkItems: vi.fn(),
      batchGetComments: vi.fn(),
    }
    
    service = new FieldDiscoveryService(mockClient)
  })

  describe('fetchWorkItemWithAllFields', () => {
    it('should fetch work item with --expand all flag', async () => {
      const mockExpandAllResponse: WorkItem = {
        id: 1234,
        rev: 15,
        fields: {
          'System.Title': 'Comprehensive Test Work Item',
          'System.State': 'Active',
          'System.WorkItemType': 'User Story',
          'System.AssignedTo': {
            displayName: 'Nathan Vale',
            uniqueName: 'nathan.vale@example.com',
          },
          'System.ChangedDate': '2025-08-21T10:30:00Z',
          'System.CreatedDate': '2025-08-15T09:00:00Z',
          'System.Description':
            '<div>This is a test work item description</div>',
          'System.Reason': 'New',
          'System.Watermark': 987654,
          'System.CommentCount': 3,
          'System.TeamProject': 'Customer Services Platform',
          'System.AreaPath': 'Customer Services Platform\\Stage 3 Team',
          'System.IterationPath': 'Customer Services Platform\\S3-Sprint 15',
          'System.AreaId': 123,
          'System.IterationId': 456,
          'System.BoardColumn': '2. Build',
          'System.BoardColumnDone': false,
          'System.Tags': 'frontend; ui; priority-high',
          'System.CreatedBy': {
            displayName: 'Product Owner',
            uniqueName: 'po@example.com',
          },
          'System.ChangedBy': {
            displayName: 'Nathan Vale',
            uniqueName: 'nathan.vale@example.com',
          },
          'Microsoft.VSTS.Common.Priority': 1,
          'Microsoft.VSTS.Common.Severity': '2 - High',
          'Microsoft.VSTS.Common.ClosedDate': null,
          'Microsoft.VSTS.Common.ResolvedDate': null,
          'Microsoft.VSTS.Common.ActivatedDate': '2025-08-15T09:30:00Z',
          'Microsoft.VSTS.Common.StateChangeDate': '2025-08-20T14:15:00Z',
          'Microsoft.VSTS.Common.ClosedBy': null,
          'Microsoft.VSTS.Common.ResolvedBy': null,
          'Microsoft.VSTS.Common.ResolvedReason': null,
          'Microsoft.VSTS.Common.StackRank': 1000.5,
          'Microsoft.VSTS.Common.ValueArea': 'Business',
          'Microsoft.VSTS.Scheduling.StoryPoints': 5.0,
          'Microsoft.VSTS.Scheduling.Effort': 8.0,
          'Microsoft.VSTS.Scheduling.RemainingWork': 2.5,
          'Microsoft.VSTS.Scheduling.CompletedWork': 5.5,
          'Microsoft.VSTS.Scheduling.OriginalEstimate': 8.0,
          'Microsoft.VSTS.Common.AcceptanceCriteria':
            'Given when then criteria',
          'Microsoft.VSTS.TCM.ReproSteps': 'Steps to reproduce bug',
          'Microsoft.VSTS.TCM.SystemInfo': 'Windows 11, Chrome',
          'System.Parent': 5678,
          // Custom fields that might exist
          'Custom.BusinessValue': 'High',
          'Custom.RiskLevel': 'Medium',
        },
        url: 'https://dev.azure.com/fwcdev/_apis/wit/workItems/1234',
        relations: [
          {
            rel: 'System.LinkTypes.Hierarchy-Reverse',
            url: 'https://dev.azure.com/fwcdev/_apis/wit/workItems/5678',
            attributes: {
              isLocked: false,
            },
          },
          {
            rel: 'AttachedFile',
            url: 'https://dev.azure.com/fwcdev/_apis/wit/attachments/abc-123',
            attributes: {
              name: 'screenshot.png',
            },
          },
        ],
        _links: {
          self: {
            href: 'https://dev.azure.com/fwcdev/_apis/wit/workItems/1234',
          },
        },
      }

      vi.mocked(mockClient.getWorkItem).mockResolvedValue(mockExpandAllResponse)

      const result = await service.fetchWorkItemWithAllFields(1234)

      expect(result).toEqual(mockExpandAllResponse)
      expect(mockClient.getWorkItem).toHaveBeenCalledWith(1234, 'all')
    })

    it('should handle REST API errors when fetching work item', async () => {
      vi.mocked(mockClient.getWorkItem).mockRejectedValue(new Error('Work item not found'))

      await expect(service.fetchWorkItemWithAllFields(9999)).rejects.toThrow(
        'Work item not found',
      )
    })

    it('should handle REST API client errors', async () => {
      vi.mocked(mockClient.getWorkItem).mockRejectedValue(new Error('Invalid response'))

      await expect(service.fetchWorkItemWithAllFields(1234)).rejects.toThrow('Invalid response')
    })
  })

  describe('analyzeFields', () => {
    it('should analyze and categorize all fields from work item data', () => {
      const sampleWorkItem: WorkItem = {
        id: 1234,
        rev: 15,
        fields: {
          'System.Id': 1234,
          'System.Title': 'Test Work Item',
          'System.State': 'Active',
          'System.WorkItemType': 'User Story',
          'System.AssignedTo': {
            displayName: 'Nathan Vale',
            uniqueName: 'nathan.vale@example.com',
          },
          'System.CreatedDate': '2025-08-21T09:00:00Z',
          'System.ChangedDate': '2025-08-21T10:30:00Z',
          'System.CommentCount': 3,
          'System.TeamProject': 'Customer Services Platform',
          'Microsoft.VSTS.Common.Priority': 1,
          'Microsoft.VSTS.Common.StackRank': 1000.5,
          'Microsoft.VSTS.Scheduling.StoryPoints': 5.0,
          'Microsoft.VSTS.Common.ValueArea': 'Business',
          'Custom.BusinessValue': 'High',
        },
        url: 'https://dev.azure.com/fwcdev/_apis/wit/workItems/1234',
        relations: [],
        _links: {
          self: {
            href: 'https://dev.azure.com/fwcdev/_apis/wit/workItems/1234',
          },
        },
      }

      const result = service.analyzeFields(sampleWorkItem)

      expect(result.totalFields).toBe(19) // 9 system + 4 vsts + 1 custom + 5 metadata fields
      expect(result.systemFields).toHaveLength(9)
      expect(result.vstsFields).toHaveLength(4)
      expect(result.customFields).toHaveLength(1)
      expect(result.metadataFields).toHaveLength(5) // id, rev, url, relations, _links

      // Check field type detection
      expect(result.fieldTypes['System.Title']).toBe('string')
      expect(result.fieldTypes['System.CommentCount']).toBe('number')
      expect(result.fieldTypes['Microsoft.VSTS.Scheduling.StoryPoints']).toBe(
        'number',
      )
      expect(result.fieldTypes['System.AssignedTo']).toBe('object')
      expect(result.fieldTypes['Custom.BusinessValue']).toBe('string')
    })

    it('should handle work items with minimal fields', () => {
      const minimalWorkItem: WorkItem = {
        id: 1234,
        rev: 1,
        fields: {
          'System.Id': 1234,
          'System.Title': 'Minimal Item',
          'System.State': 'New',
          'System.WorkItemType': 'Task',
          'System.CreatedDate': '2025-08-21T09:00:00Z',
          'System.ChangedDate': '2025-08-21T09:00:00Z',
        },
        url: 'https://dev.azure.com/fwcdev/_apis/wit/workItems/1234',
        _links: {
          self: {
            href: 'https://dev.azure.com/fwcdev/_apis/wit/workItems/1234',
          },
        },
      }

      const result = service.analyzeFields(minimalWorkItem)

      expect(result.totalFields).toBe(10) // 6 system + 0 vsts + 0 custom + 4 metadata fields
      expect(result.systemFields).toHaveLength(6)
      expect(result.vstsFields).toHaveLength(0)
      expect(result.customFields).toHaveLength(0)
      expect(result.metadataFields).toHaveLength(4) // id, rev, url, _links
    })

    it('should detect different field types correctly', () => {
      const workItem: WorkItem = {
        id: 1234,
        rev: 1,
        fields: {
          'System.Id': 1234,
          'System.Title': 'String field',
          'System.CreatedDate': '2025-08-21T09:00:00Z',
          'System.ChangedDate': '2025-08-21T09:00:00Z',
          'System.State': 'Active',
          'System.WorkItemType': 'User Story',
          'System.CommentCount': 5,
          'Microsoft.VSTS.Scheduling.StoryPoints': 3.5,
          'System.BoardColumnDone': true,
          'System.AssignedTo': { displayName: 'User' },
          'System.Tags': null,
          'System.Description': '',
          'Custom.Array': [1, 2, 3],
        },
        url: 'https://dev.azure.com/fwcdev/_apis/wit/workItems/1234',
        _links: {
          self: {
            href: 'https://dev.azure.com/fwcdev/_apis/wit/workItems/1234',
          },
        },
      }

      const result = service.analyzeFields(workItem)

      expect(result.fieldTypes['System.Title']).toBe('string')
      expect(result.fieldTypes['System.CommentCount']).toBe('number')
      expect(result.fieldTypes['Microsoft.VSTS.Scheduling.StoryPoints']).toBe(
        'number',
      )
      expect(result.fieldTypes['System.BoardColumnDone']).toBe('boolean')
      expect(result.fieldTypes['System.AssignedTo']).toBe('object')
      expect(result.fieldTypes['System.Tags']).toBe('null')
      expect(result.fieldTypes['System.Description']).toBe('string')
      expect(result.fieldTypes['Custom.Array']).toBe('array')
    })
  })

  describe('generateFieldDocumentation', () => {
    it('should generate comprehensive field documentation', () => {
      const analysisResults = [
        {
          totalFields: 12,
          systemFields: ['System.Title', 'System.State', 'System.Id'],
          vstsFields: [
            'Microsoft.VSTS.Common.Priority',
            'Microsoft.VSTS.Scheduling.StoryPoints',
          ],
          customFields: ['Custom.BusinessValue'],
          metadataFields: ['id', 'rev', 'url'],
          fieldTypes: {
            'System.Title': 'string',
            'System.State': 'string',
            'System.Id': 'number',
            'Microsoft.VSTS.Common.Priority': 'number',
            'Microsoft.VSTS.Scheduling.StoryPoints': 'number',
            'Custom.BusinessValue': 'string',
            id: 'number',
            rev: 'number',
            url: 'string',
          },
        },
      ]

      const documentation = service.generateFieldDocumentation(analysisResults)

      expect(documentation).toContain('# Azure DevOps Field Discovery Report')
      expect(documentation).toContain('## Summary')
      expect(documentation).toContain('**Total Unique Fields Found:** 9')
      expect(documentation).toContain('**System Fields:** 3')
      expect(documentation).toContain('**VSTS Fields:** 2')
      expect(documentation).toContain('**Custom Fields:** 1')
      expect(documentation).toContain('**Metadata Fields:** 3')

      expect(documentation).toContain('## Field Categories')
      expect(documentation).toContain('### System Fields')
      expect(documentation).toContain('- System.Id (number)')
      expect(documentation).toContain('- System.State (string)')
      expect(documentation).toContain('- System.Title (string)')

      expect(documentation).toContain('### Microsoft VSTS Fields')
      expect(documentation).toContain(
        '- Microsoft.VSTS.Common.Priority (number)',
      )
      expect(documentation).toContain(
        '- Microsoft.VSTS.Scheduling.StoryPoints (number)',
      )

      expect(documentation).toContain('### Custom Fields')
      expect(documentation).toContain('- Custom.BusinessValue (string)')

      expect(documentation).toContain('### Metadata Fields')
      expect(documentation).toContain('- id (number)')
      expect(documentation).toContain('- rev (number)')
      expect(documentation).toContain('- url (string)')
    })

    it('should handle empty analysis results', () => {
      const documentation = service.generateFieldDocumentation([])

      expect(documentation).toContain('# Azure DevOps Field Discovery Report')
      expect(documentation).toContain('**Total Unique Fields Found:** 0')
      expect(documentation).toContain('No fields discovered')
    })
  })

  describe('discoverAllFields', () => {
    it('should discover fields from multiple work items', async () => {
      const workItem1: WorkItem = {
        id: 1234,
        rev: 15,
        fields: {
          'System.Title': 'Work Item 1',
          'System.State': 'Active',
          'Microsoft.VSTS.Common.Priority': 1,
        },
        url: 'https://dev.azure.com/test/1234',
        _links: { self: { href: 'https://dev.azure.com/test/1234' } },
      }

      const workItem2: WorkItem = {
        id: 5678,
        rev: 8,
        fields: {
          'System.Title': 'Work Item 2',
          'System.WorkItemType': 'Bug',
          'Microsoft.VSTS.Scheduling.StoryPoints': 3.0,
          'Custom.RiskLevel': 'Low',
        },
        url: 'https://dev.azure.com/test/5678',
        _links: { self: { href: 'https://dev.azure.com/test/5678' } },
      }

      vi.mocked(mockClient.getWorkItem)
        .mockResolvedValueOnce(workItem1)
        .mockResolvedValueOnce(workItem2)

      const documentation = await service.discoverAllFields([1234, 5678])

      expect(documentation).toContain('# Azure DevOps Field Discovery Report')
      expect(documentation).toContain('**Total Work Items Analyzed:** 2')
      // Should find unique fields from both work items
      expect(documentation).toContain('System.Title')
      expect(documentation).toContain('System.State')
      expect(documentation).toContain('System.WorkItemType')
      expect(documentation).toContain('Microsoft.VSTS.Common.Priority')
      expect(documentation).toContain('Microsoft.VSTS.Scheduling.StoryPoints')
      expect(documentation).toContain('Custom.RiskLevel')
    })

    it('should handle errors when fetching individual work items', async () => {
      const successWorkItem: WorkItem = {
        id: 1234,
        fields: { 'System.Title': 'Success' },
        rev: 1,
        url: 'https://dev.azure.com/test/1234',
        _links: { self: { href: 'https://dev.azure.com/test/1234' } },
      }

      vi.mocked(mockClient.getWorkItem)
        .mockResolvedValueOnce(successWorkItem)
        .mockRejectedValueOnce(new Error('Work item not found'))

      const documentation = await service.discoverAllFields([1234, 9999])

      expect(documentation).toContain('# Azure DevOps Field Discovery Report')
      expect(documentation).toContain('**Total Work Items Analyzed:** 1')
      expect(documentation).toContain('**Failed to Fetch:** 1')
      expect(documentation).toContain('System.Title')
    })
  })
})
