import type { IWorkItemProvider, ProviderInfo } from './interfaces/provider.js'
import type { CommentData, WorkItemComment } from './types/comments.js'
import type { AzureDevOpsClientConfig } from './types/config.js'
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
   * Fetches work items based on query filters
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
      // Re-throw with additional context
      throw new Error(
        `Failed to fetch work items: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * Gets a single work item by ID
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
      throw new Error(
        `Failed to get work item ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
   * Maps Azure DevOps WorkItem to standardized WorkItemData
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
   * Extracts display name from Azure DevOps person object
   */
  private extractPersonName(
    person: AzureDevOpsPerson | string | undefined,
  ): string | undefined {
    if (!person) return undefined
    if (typeof person === 'string') return person
    return person.displayName || person.uniqueName || person.id
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
