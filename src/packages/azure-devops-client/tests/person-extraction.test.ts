import { beforeEach, describe, expect, it } from 'vitest'

import type { AzureDevOpsClientConfig } from '../src/types/config.js'
import type { PersonData } from '../src/types/person.js'
import type { AzureDevOpsPerson, WorkItem } from '../src/types/work-items.js'

import { AzureDevOpsProvider } from '../src/provider.js'

describe('Person Data Extraction', () => {
  let provider: AzureDevOpsProvider

  beforeEach(() => {
    const config: AzureDevOpsClientConfig = {
      organization: 'test-org',
      project: 'test-project',
      pat: 'test-pat',
    }
    provider = new AzureDevOpsProvider(config)
  })

  describe('extractPersonData', () => {
    it('should extract complete person data from Azure DevOps person object', () => {
      const azurePerson: AzureDevOpsPerson = {
        id: 'fe71887b-c2c7-60bd-8688-00d137e0b5f5',
        displayName: 'Nathan Vale',
        uniqueName: 'Nathan.Vale@fwc.gov.au',
        url: 'https://spsprodcus2.vssps.visualstudio.com/_apis/Identities/fe71887b-c2c7-60bd-8688-00d137e0b5f5',
        imageUrl:
          'https://dev.azure.com/fwcdev/_api/_common/identityImage?id=fe71887b-c2c7-60bd-8688-00d137e0b5f5',
        descriptor: 'msa.ZmU3MTg4N2ItYzJjNy03MGJkLTg2ODgtMDBkMTM3ZTBiNWY1',
      }

      // @ts-expect-error - accessing private method for testing
      const personData = provider.extractPersonData(azurePerson)

      expect(personData).toEqual<PersonData>({
        id: 'fe71887b-c2c7-60bd-8688-00d137e0b5f5',
        displayName: 'Nathan Vale',
        uniqueName: 'Nathan.Vale@fwc.gov.au',
        url: 'https://spsprodcus2.vssps.visualstudio.com/_apis/Identities/fe71887b-c2c7-60bd-8688-00d137e0b5f5',
        imageUrl:
          'https://dev.azure.com/fwcdev/_api/_common/identityImage?id=fe71887b-c2c7-60bd-8688-00d137e0b5f5',
        descriptor: 'msa.ZmU3MTg4N2ItYzJjNy03MGJkLTg2ODgtMDBkMTM3ZTBiNWY1',
        inactive: false, // Default value
      })
    })

    it('should handle undefined person gracefully', () => {
      // @ts-expect-error - accessing private method for testing
      const personData = provider.extractPersonData(undefined)
      expect(personData).toBeNull()
    })

    it('should handle string input by returning null', () => {
      // @ts-expect-error - accessing private method for testing
      const personData = provider.extractPersonData('Nathan Vale')
      expect(personData).toBeNull()
    })

    it('should handle partial person data with missing optional fields', () => {
      const partialPerson: Partial<AzureDevOpsPerson> = {
        id: 'user-id',
        displayName: 'Test User',
        uniqueName: 'test.user@example.com',
      }

      // @ts-expect-error - accessing private method for testing
      const personData = provider.extractPersonData(
        partialPerson as AzureDevOpsPerson,
      )

      expect(personData).toEqual<PersonData>({
        id: 'user-id',
        displayName: 'Test User',
        uniqueName: 'test.user@example.com',
        url: undefined,
        imageUrl: undefined,
        descriptor: undefined,
        inactive: false,
      })
    })

    it('should set inactive to false by default', () => {
      const person: AzureDevOpsPerson = {
        id: 'user-id',
        displayName: 'Active User',
        uniqueName: 'active@example.com',
        url: 'https://example.com',
        imageUrl: 'https://example.com/image.png',
        descriptor: 'descriptor-value',
      }

      // @ts-expect-error - accessing private method for testing
      const personData = provider.extractPersonData(person)

      expect(personData?.inactive).toBe(false)
    })
  })

  describe('mapWorkItemToData with Person objects', () => {
    it('should extract all person fields from work item', () => {
      const workItem: WorkItem = {
        id: 1234,
        rev: 1,
        url: 'https://dev.azure.com/test',
        fields: {
          'System.Id': 1234,
          'System.Title': 'Test Work Item',
          'System.State': 'Active',
          'System.WorkItemType': 'User Story',
          'System.CreatedDate': '2025-01-01T00:00:00Z',
          'System.ChangedDate': '2025-01-02T00:00:00Z',
          'System.AssignedTo': {
            id: 'assigned-person-id',
            displayName: 'Assigned Person',
            uniqueName: 'assigned@example.com',
            url: 'https://example.com/assigned',
            imageUrl: 'https://example.com/assigned.png',
            descriptor: 'assigned-descriptor',
          },
          'System.CreatedBy': {
            id: 'created-person-id',
            displayName: 'Created Person',
            uniqueName: 'created@example.com',
            url: 'https://example.com/created',
            imageUrl: 'https://example.com/created.png',
            descriptor: 'created-descriptor',
          },
          'System.ChangedBy': {
            id: 'changed-person-id',
            displayName: 'Changed Person',
            uniqueName: 'changed@example.com',
            url: 'https://example.com/changed',
            imageUrl: 'https://example.com/changed.png',
            descriptor: 'changed-descriptor',
          },
          'Microsoft.VSTS.Common.ClosedBy': {
            id: 'closed-person-id',
            displayName: 'Closed Person',
            uniqueName: 'closed@example.com',
            url: 'https://example.com/closed',
            imageUrl: 'https://example.com/closed.png',
            descriptor: 'closed-descriptor',
          },
          'Microsoft.VSTS.Common.ResolvedBy': {
            id: 'resolved-person-id',
            displayName: 'Resolved Person',
            uniqueName: 'resolved@example.com',
            url: 'https://example.com/resolved',
            imageUrl: 'https://example.com/resolved.png',
            descriptor: 'resolved-descriptor',
          },
        },
      }

      // @ts-expect-error - accessing private method for testing
      const workItemData = provider.mapWorkItemToDataWithPersons(workItem)

      // Check that all person objects are extracted
      expect(workItemData.assignedToPerson).toEqual<PersonData>({
        id: 'assigned-person-id',
        displayName: 'Assigned Person',
        uniqueName: 'assigned@example.com',
        url: 'https://example.com/assigned',
        imageUrl: 'https://example.com/assigned.png',
        descriptor: 'assigned-descriptor',
        inactive: false,
      })

      expect(workItemData.createdByPerson).toEqual<PersonData>({
        id: 'created-person-id',
        displayName: 'Created Person',
        uniqueName: 'created@example.com',
        url: 'https://example.com/created',
        imageUrl: 'https://example.com/created.png',
        descriptor: 'created-descriptor',
        inactive: false,
      })

      expect(workItemData.changedByPerson).toEqual<PersonData>({
        id: 'changed-person-id',
        displayName: 'Changed Person',
        uniqueName: 'changed@example.com',
        url: 'https://example.com/changed',
        imageUrl: 'https://example.com/changed.png',
        descriptor: 'changed-descriptor',
        inactive: false,
      })

      expect(workItemData.closedByPerson).toEqual<PersonData>({
        id: 'closed-person-id',
        displayName: 'Closed Person',
        uniqueName: 'closed@example.com',
        url: 'https://example.com/closed',
        imageUrl: 'https://example.com/closed.png',
        descriptor: 'closed-descriptor',
        inactive: false,
      })

      expect(workItemData.resolvedByPerson).toEqual<PersonData>({
        id: 'resolved-person-id',
        displayName: 'Resolved Person',
        uniqueName: 'resolved@example.com',
        url: 'https://example.com/resolved',
        imageUrl: 'https://example.com/resolved.png',
        descriptor: 'resolved-descriptor',
        inactive: false,
      })

      // Check that legacy string fields are still populated for backward compatibility
      expect(workItemData.assignedTo).toBe('Assigned Person')
      expect(workItemData.createdBy).toBe('Created Person')
      expect(workItemData.changedBy).toBe('Changed Person')
      expect(workItemData.closedBy).toBe('Closed Person')
      expect(workItemData.resolvedBy).toBe('Resolved Person')
    })

    it('should handle work items with no person fields', () => {
      const workItem: WorkItem = {
        id: 5678,
        rev: 1,
        url: 'https://dev.azure.com/test',
        fields: {
          'System.Id': 5678,
          'System.Title': 'Unassigned Work Item',
          'System.State': 'New',
          'System.WorkItemType': 'Bug',
          'System.CreatedDate': '2025-01-01T00:00:00Z',
          'System.ChangedDate': '2025-01-01T00:00:00Z',
        },
      }

      // @ts-expect-error - accessing private method for testing
      const workItemData = provider.mapWorkItemToDataWithPersons(workItem)

      expect(workItemData.assignedToPerson).toBeNull()
      expect(workItemData.createdByPerson).toBeNull()
      expect(workItemData.changedByPerson).toBeNull()
      expect(workItemData.closedByPerson).toBeNull()
      expect(workItemData.resolvedByPerson).toBeNull()
      expect(workItemData.activatedByPerson).toBeNull()
      expect(workItemData.authorizedAsPerson).toBeNull()

      // Legacy string fields should be undefined
      expect(workItemData.assignedTo).toBeUndefined()
      expect(workItemData.createdBy).toBeUndefined()
      expect(workItemData.changedBy).toBeUndefined()
      expect(workItemData.closedBy).toBeUndefined()
      expect(workItemData.resolvedBy).toBeUndefined()
    })

    it('should extract activated and authorized person fields', () => {
      const workItem: WorkItem = {
        id: 9999,
        rev: 1,
        url: 'https://dev.azure.com/test',
        fields: {
          'System.Id': 9999,
          'System.Title': 'Full Person Fields',
          'System.State': 'Active',
          'System.WorkItemType': 'Task',
          'System.CreatedDate': '2025-01-01T00:00:00Z',
          'System.ChangedDate': '2025-01-01T00:00:00Z',
          'Microsoft.VSTS.Common.ActivatedBy': {
            id: 'activated-person-id',
            displayName: 'Activated Person',
            uniqueName: 'activated@example.com',
            url: 'https://example.com/activated',
            imageUrl: 'https://example.com/activated.png',
            descriptor: 'activated-descriptor',
          },
          'System.AuthorizedAs': {
            id: 'authorized-person-id',
            displayName: 'Authorized Person',
            uniqueName: 'authorized@example.com',
            url: 'https://example.com/authorized',
            imageUrl: 'https://example.com/authorized.png',
            descriptor: 'authorized-descriptor',
          },
        },
      }

      // @ts-expect-error - accessing private method for testing
      const workItemData = provider.mapWorkItemToDataWithPersons(workItem)

      expect(workItemData.activatedByPerson).toEqual<PersonData>({
        id: 'activated-person-id',
        displayName: 'Activated Person',
        uniqueName: 'activated@example.com',
        url: 'https://example.com/activated',
        imageUrl: 'https://example.com/activated.png',
        descriptor: 'activated-descriptor',
        inactive: false,
      })

      expect(workItemData.authorizedAsPerson).toEqual<PersonData>({
        id: 'authorized-person-id',
        displayName: 'Authorized Person',
        uniqueName: 'authorized@example.com',
        url: 'https://example.com/authorized',
        imageUrl: 'https://example.com/authorized.png',
        descriptor: 'authorized-descriptor',
        inactive: false,
      })
    })
  })
})
