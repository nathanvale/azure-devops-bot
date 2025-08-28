import type { IWorkItemProvider, ProviderInfo } from './interfaces/provider.js'
import type { CommentData, WorkItemComment } from './types/comments.js'
import type { AzureDevOpsClientConfig } from './types/config.js'
import type { PersonData, WorkItemDataWithPersons } from './types/person.js'
import type {
  WorkItemData,
  WorkItemQuery,
  WorkItem,
  AzureDevOpsPerson,
} from './types/work-items.js'

import { AzureDevOpsRestClient } from './client.js'

/**
 * Azure DevOps implementation of the IWorkItemProvider interface
 * Provides a standardized abstraction over Azure DevOps work item operations
 */
export class AzureDevOpsProvider implements IWorkItemProvider {
  private readonly client: AzureDevOpsRestClient

  constructor(config: AzureDevOpsClientConfig) {
    this.client = new AzureDevOpsRestClient(config)
  }

  /**
   * Fetches work items based on query filters (legacy method)
   */
  async fetchWorkItems(query?: WorkItemQuery): Promise<WorkItemData[]> {
    try {
      let workItems: WorkItem[]

      if (query?.filters) {
        // Build WIQL query from filters
        const wiql = this.buildWiqlFromQuery(query)
        const queryResult = await this.client.queryWorkItems(wiql)

        if (queryResult.workItems.length === 0) {
          return []
        }

        // Get full work item details
        const workItemIds = queryResult.workItems.map((wi) => wi.id)
        workItems = await this.client.batchGetWorkItems(workItemIds)
      } else {
        // For now, return empty array if no query is provided
        // In a real implementation, you might want to fetch recent items
        workItems = []
      }

      return workItems.map((workItem) => this.mapWorkItemToData(workItem))
    } catch (error) {
      // Preserve RetryExhaustedError for proper error handling
      if (error instanceof Error && error.name === 'RetryExhaustedError') {
        throw error
      }
      // Re-throw with additional context for other errors
      throw new Error(
        `Failed to fetch work items: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * Fetches work items with complete Person data
   * Per DEC-009: Extract all person fields for normalized storage
   */
  async fetchWorkItemsWithPersons(
    query?: WorkItemQuery,
  ): Promise<WorkItemDataWithPersons[]> {
    try {
      let workItems: WorkItem[]

      if (query?.filters) {
        // Build WIQL query from filters
        const wiql = this.buildWiqlFromQuery(query)
        const queryResult = await this.client.queryWorkItems(wiql)

        if (queryResult.workItems.length === 0) {
          return []
        }

        // Get full work item details with expanded fields
        const workItemIds = queryResult.workItems.map((wi) => wi.id)
        workItems = await this.client.batchGetWorkItems(workItemIds)
      } else {
        // For now, return empty array if no query is provided
        workItems = []
      }

      return workItems.map((workItem) =>
        this.mapWorkItemToDataWithPersons(workItem),
      )
    } catch (error) {
      // Preserve RetryExhaustedError for proper error handling
      if (error instanceof Error && error.name === 'RetryExhaustedError') {
        throw error
      }
      // Re-throw with additional context for other errors
      throw new Error(
        `Failed to fetch work items with persons: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * Batch fetch work items with Person data
   * Per DEC-009: Extract all person fields for normalized storage
   */
  async getWorkItemsBatch(
    workItemIds: number[],
  ): Promise<WorkItemDataWithPersons[]> {
    if (!workItemIds || workItemIds.length === 0) {
      return []
    }

    try {
      // Use the REST client's batch API which handles chunking into 200-item batches
      const workItems = await this.client.batchGetWorkItems(workItemIds)

      // Map to WorkItemDataWithPersons format with Person objects
      return workItems.map((workItem) =>
        this.mapWorkItemToDataWithPersons(workItem),
      )
    } catch (error) {
      // Preserve RetryExhaustedError for proper error handling
      if (error instanceof Error && error.name === 'RetryExhaustedError') {
        throw error
      }
      // Re-throw with additional context for other errors
      throw new Error(
        `Failed to batch fetch work items with persons: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * Gets a single work item by ID (legacy method)
   */
  async getWorkItem(id: string | number): Promise<WorkItemData | null> {
    try {
      const numericId = typeof id === 'string' ? parseInt(id, 10) : id

      if (isNaN(numericId) || numericId <= 0) {
        return null
      }

      const workItem = await this.client.getWorkItem(numericId, 'all')
      return workItem ? this.mapWorkItemToData(workItem) : null
    } catch (error) {
      // If work item doesn't exist, return null instead of throwing
      if (error instanceof Error && error.message.includes('404')) {
        return null
      }
      // Preserve RetryExhaustedError for proper error handling
      if (error instanceof Error && error.name === 'RetryExhaustedError') {
        throw error
      }
      throw new Error(
        `Failed to get work item ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * Gets a single work item with complete Person data
   * Per DEC-009: Extract all person fields for normalized storage
   */
  async getWorkItemWithPersons(
    id: string | number,
  ): Promise<WorkItemDataWithPersons | null> {
    try {
      const numericId = typeof id === 'string' ? parseInt(id, 10) : id

      if (isNaN(numericId) || numericId <= 0) {
        return null
      }

      const workItem = await this.client.getWorkItem(numericId, 'all')
      return workItem ? this.mapWorkItemToDataWithPersons(workItem) : null
    } catch (error) {
      // If work item doesn't exist, return null instead of throwing
      if (error instanceof Error && error.message.includes('404')) {
        return null
      }
      // Preserve RetryExhaustedError for proper error handling
      if (error instanceof Error && error.name === 'RetryExhaustedError') {
        throw error
      }
      throw new Error(
        `Failed to get work item with persons ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * Gets comments for a work item
   */
  async getComments(workItemId: string | number): Promise<CommentData[]> {
    try {
      const numericId =
        typeof workItemId === 'string' ? parseInt(workItemId, 10) : workItemId

      if (isNaN(numericId) || numericId <= 0) {
        return []
      }

      const comments = await this.client.getWorkItemComments(numericId)
      return comments.map((comment) =>
        this.mapCommentToData(comment, workItemId),
      )
    } catch (error) {
      // Return empty array if comments can't be fetched
      console.warn(
        `Failed to fetch comments for work item ${workItemId}:`,
        error,
      )
      return []
    }
  }

  /**
   * Gets provider information and capabilities
   */
  getProviderInfo(): ProviderInfo {
    return {
      name: 'Azure DevOps REST API Provider',
      version: '1.0.0',
      supports: {
        batchOperations: true,
        realTimeUpdates: false,
        customFields: true,
      },
    }
  }

  /**
   * Gets the underlying REST client for advanced operations
   */
  getClient(): AzureDevOpsRestClient {
    return this.client
  }

  /**
   * Builds a WIQL query from query filters
   */
  private buildWiqlFromQuery(query: WorkItemQuery): string {
    const conditions: string[] = []

    if (query.filters?.state && query.filters.state.length > 0) {
      const stateConditions = query.filters.state
        .map((state) => `[System.State] = '${state}'`)
        .join(' OR ')
      conditions.push(`(${stateConditions})`)
    }

    if (query.filters?.type && query.filters.type.length > 0) {
      const typeConditions = query.filters.type
        .map((type) => `[System.WorkItemType] = '${type}'`)
        .join(' OR ')
      conditions.push(`(${typeConditions})`)
    }

    if (query.filters?.assignedTo && query.filters.assignedTo.length > 0) {
      const assignedToConditions = query.filters.assignedTo
        .map((user) => `[System.AssignedTo] = '${user}'`)
        .join(' OR ')
      conditions.push(`(${assignedToConditions})`)
    }

    if (query.filters?.area && query.filters.area.length > 0) {
      const areaConditions = query.filters.area
        .map((area) => `[System.AreaPath] UNDER '${area}'`)
        .join(' OR ')
      conditions.push(`(${areaConditions})`)
    }

    if (query.filters?.iteration && query.filters.iteration.length > 0) {
      const iterationConditions = query.filters.iteration
        .map((iteration) => `[System.IterationPath] UNDER '${iteration}'`)
        .join(' OR ')
      conditions.push(`(${iterationConditions})`)
    }

    let wiql =
      'SELECT [System.Id], [System.Title], [System.State], [System.WorkItemType], [System.AssignedTo] FROM WorkItems'

    if (conditions.length > 0) {
      wiql += ` WHERE ${conditions.join(' AND ')}`
    }

    if (query.orderBy) {
      const direction = query.orderDirection === 'desc' ? 'DESC' : 'ASC'
      const fieldMap: Record<string, string> = {
        createdDate: '[System.CreatedDate]',
        changedDate: '[System.ChangedDate]',
        title: '[System.Title]',
        state: '[System.State]',
        id: '[System.Id]',
      }
      const field = fieldMap[query.orderBy] || `[${query.orderBy}]`
      wiql += ` ORDER BY ${field} ${direction}`
    }

    return wiql
  }

  /**
   * Maps Azure DevOps WorkItem to standardized WorkItemData (legacy method)
   */
  private mapWorkItemToData(workItem: WorkItem): WorkItemData {
    const fields = workItem.fields

    return {
      id: workItem.id,
      title: fields['System.Title'] || '',
      state: fields['System.State'] || '',
      type: fields['System.WorkItemType'] || '',
      assignedTo: this.extractPersonName(fields['System.AssignedTo']),
      createdDate: fields['System.CreatedDate'] || '',
      changedDate: fields['System.ChangedDate'] || '',
      description: fields['System.Description'],
      tags: this.parseTags(fields['System.Tags']),
      raw: {
        ...fields,
        _links: workItem._links,
        relations: workItem.relations,
        url: workItem.url,
        rev: workItem.rev,
      },
    }
  }

  /**
   * Maps Azure DevOps WorkItem to WorkItemData with complete Person objects
   * Per DEC-009: Extract all person fields for normalized storage
   */
  private mapWorkItemToDataWithPersons(
    workItem: WorkItem,
  ): WorkItemDataWithPersons {
    const fields = workItem.fields

    return {
      id: workItem.id,
      title: fields['System.Title'] || '',
      state: fields['System.State'] || '',
      type: fields['System.WorkItemType'] || '',

      // Legacy string fields for backward compatibility
      assignedTo: this.extractPersonName(
        fields['System.AssignedTo'] as AzureDevOpsPerson | undefined,
      ),
      createdBy: this.extractPersonName(
        fields['System.CreatedBy'] as AzureDevOpsPerson | undefined,
      ),
      changedBy: this.extractPersonName(
        fields['System.ChangedBy'] as AzureDevOpsPerson | undefined,
      ),
      closedBy: this.extractPersonName(
        fields['Microsoft.VSTS.Common.ClosedBy'] as
          | AzureDevOpsPerson
          | undefined,
      ),
      resolvedBy: this.extractPersonName(
        fields['Microsoft.VSTS.Common.ResolvedBy'] as
          | AzureDevOpsPerson
          | undefined,
      ),
      activatedBy: this.extractPersonName(
        fields['Microsoft.VSTS.Common.ActivatedBy'] as
          | AzureDevOpsPerson
          | undefined,
      ),
      authorizedAs: this.extractPersonName(
        fields['System.AuthorizedAs'] as AzureDevOpsPerson | undefined,
      ),

      // New Person object fields with complete data
      assignedToPerson: this.extractPersonData(
        fields['System.AssignedTo'] as AzureDevOpsPerson | undefined,
      ),
      createdByPerson: this.extractPersonData(
        fields['System.CreatedBy'] as AzureDevOpsPerson | undefined,
      ),
      changedByPerson: this.extractPersonData(
        fields['System.ChangedBy'] as AzureDevOpsPerson | undefined,
      ),
      closedByPerson: this.extractPersonData(
        fields['Microsoft.VSTS.Common.ClosedBy'] as
          | AzureDevOpsPerson
          | undefined,
      ),
      resolvedByPerson: this.extractPersonData(
        fields['Microsoft.VSTS.Common.ResolvedBy'] as
          | AzureDevOpsPerson
          | undefined,
      ),
      activatedByPerson: this.extractPersonData(
        fields['Microsoft.VSTS.Common.ActivatedBy'] as
          | AzureDevOpsPerson
          | undefined,
      ),
      authorizedAsPerson: this.extractPersonData(
        fields['System.AuthorizedAs'] as AzureDevOpsPerson | undefined,
      ),

      // Date fields
      createdDate: fields['System.CreatedDate'] || '',
      changedDate: fields['System.ChangedDate'] || '',
      closedDate: fields['Microsoft.VSTS.Common.ClosedDate'] as
        | string
        | undefined,
      resolvedDate: fields['Microsoft.VSTS.Common.ResolvedDate'] as
        | string
        | undefined,
      activatedDate: fields['Microsoft.VSTS.Common.ActivatedDate'] as
        | string
        | undefined,
      authorizedDate: fields['Microsoft.VSTS.Common.AuthorizedDate'] as
        | string
        | undefined,

      // Other fields
      description: fields['System.Description'],
      tags: this.parseTags(fields['System.Tags']),

      // Raw data for future-proofing (per DEC-003)
      raw: {
        ...fields,
        _links: workItem._links,
        relations: workItem.relations,
        url: workItem.url,
        rev: workItem.rev,
      },
    }
  }

  /**
   * Maps Azure DevOps WorkItemComment to standardized CommentData
   */
  private mapCommentToData(
    comment: WorkItemComment,
    workItemId: string | number,
  ): CommentData {
    return {
      id: comment.id,
      workItemId,
      text: comment.text,
      author: this.extractPersonName(comment.createdBy) || 'Unknown',
      createdDate: comment.createdDate,
      modifiedDate: comment.modifiedDate,
      raw: {
        version: comment.version,
        workItemId: comment.workItemId,
        modifiedBy: comment.modifiedBy,
      },
    }
  }

  /**
   * Extracts display name from Azure DevOps person object (legacy method)
   */
  private extractPersonName(
    person: AzureDevOpsPerson | string | undefined,
  ): string | undefined {
    if (!person) return undefined
    if (typeof person === 'string') return person
    return person.displayName || person.uniqueName || person.id
  }

  /**
   * Extracts complete person data from Azure DevOps person object
   * Per DEC-003: Store everything from Azure DevOps
   */
  private extractPersonData(
    person: AzureDevOpsPerson | string | undefined,
  ): PersonData | null {
    if (!person || typeof person === 'string') return null

    return {
      id: person.id,
      displayName: person.displayName,
      uniqueName: person.uniqueName,
      url: person.url,
      imageUrl: person.imageUrl,
      descriptor: person.descriptor,
      inactive: false, // Default value - Azure DevOps doesn't always provide this
    }
  }

  /**
   * Parses tags string into array
   */
  private parseTags(tagsString?: string): string[] | undefined {
    if (!tagsString) return undefined
    return tagsString
      .split(';')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0)
  }
}
