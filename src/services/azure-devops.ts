import type { AzureDevOpsPerson } from '../types/azure-devops-api.js'

import {
  AzureDevOpsProvider,
  type WorkItemData as RestWorkItemData,
  type CommentData as RestCommentData,
  type AzureDevOpsClientConfig,
} from '../packages/azure-devops-client/dist/index.js'

// Configuration constants
const ORGANIZATION = 'fwcdev'
const PROJECT = 'Customer Services Platform'

export interface WorkItemCommentData {
  id: string
  workItemId: number
  text: string
  createdBy: string
  createdDate: Date
  modifiedBy: string | null
  modifiedDate: Date | null
}

export interface WorkItemData {
  id: number
  title: string
  state: string
  type: string
  assignedTo: string
  lastUpdatedAt: Date
  description?: string

  // Sprint/Board Info
  iterationPath?: string
  areaPath?: string
  boardColumn?: string
  boardColumnDone?: boolean

  // Priority/Tags
  priority?: number
  severity?: string
  tags?: string

  // All the dates
  createdDate?: Date
  changedDate?: Date
  closedDate?: Date
  resolvedDate?: Date
  activatedDate?: Date
  stateChangeDate?: Date

  // People
  createdBy?: string
  changedBy?: string
  closedBy?: string
  resolvedBy?: string

  // Work tracking
  storyPoints?: number
  effort?: number
  remainingWork?: number
  completedWork?: number
  originalEstimate?: number

  // Content
  acceptanceCriteria?: string
  reproSteps?: string
  systemInfo?: string

  // Related items
  parentId?: number

  // Additional Azure DevOps fields found in real data
  rev?: number
  reason?: string
  watermark?: number
  url?: string
  commentCount?: number
  hasAttachments?: boolean
  teamProject?: string
  areaId?: number
  nodeId?: number
  stackRank?: number
  valueArea?: string

  // Complete raw JSON from Azure DevOps
  rawJson: string
}

export class AzureDevOpsClient {
  private static readonly ORGANIZATION = ORGANIZATION
  private static readonly PROJECT = PROJECT
  private static userEmails: string[] = []
  private restProvider: AzureDevOpsProvider

  constructor() {
    // Validate required environment variables
    const pat = process.env.AZURE_DEVOPS_PAT
    if (!pat || pat.trim().length === 0) {
      throw new Error(
        'AZURE_DEVOPS_PAT environment variable is required.\n\n' +
          'Please create a Personal Access Token:\n' +
          '1. Go to https://dev.azure.com/' +
          ORGANIZATION +
          '/_usersSettings/tokens\n' +
          '2. Create a new token with "Work items (read & write)" permission\n' +
          '3. Set environment variable: export AZURE_DEVOPS_PAT="your-token-here"\n' +
          '4. Restart the service',
      )
    }

    // Initialize REST provider with validated configuration
    const config: AzureDevOpsClientConfig = {
      organization: ORGANIZATION,
      project: PROJECT,
      pat: pat,
      apiVersion: '7.0',
      rateLimit: {
        maxConcurrent: 10,
        requestsPerSecond: 100,
        respectHeaders: true,
      },
    }

    this.restProvider = new AzureDevOpsProvider(config)
  }

  static setUserEmails(emails: string[]): void {
    this.userEmails = emails
  }

  static getUserEmails(): string[] {
    return this.userEmails
  }

  /**
   * Get the underlying REST client for advanced operations
   */
  getRestClient() {
    return this.restProvider.getClient()
  }

  async fetchWorkItems(): Promise<WorkItemData[]> {
    try {
      // Use REST provider to fetch all work items with comprehensive query
      const query = {
        filters: {
          type: ['User Story', 'Product Backlog Item', 'Bug', 'Task'],
          state: [], // Will exclude removed items by default
        },
        orderBy: 'changedDate',
        orderDirection: 'desc' as const,
      }

      const restWorkItems = await this.restProvider.fetchWorkItems(query)
      return restWorkItems.map((item) => this.transformRestWorkItem(item))
    } catch (error) {
      console.error('Failed to fetch work items:', error)

      // Provide actionable error messages based on error type
      if (error instanceof Error) {
        if (
          error.message.includes('401') ||
          error.message.includes('Unauthorized')
        ) {
          throw new Error(
            'Azure DevOps authentication failed. Please check your AZURE_DEVOPS_PAT environment variable.',
          )
        } else if (
          error.message.includes('rate limit') ||
          error.message.includes('429')
        ) {
          throw new Error(
            'Azure DevOps API rate limit exceeded. Please wait a few minutes before trying again.',
          )
        } else if (
          error.message.includes('timeout') ||
          error.message.includes('TIMEOUT')
        ) {
          throw new Error(
            'Azure DevOps API timeout. The request took too long to complete, please try again.',
          )
        } else if (
          error.message.includes('ENOTFOUND') ||
          error.message.includes('network')
        ) {
          throw new Error(
            'Network connection failed. Please check your internet connection and try again.',
          )
        }
      }

      throw new Error(
        `Azure DevOps work item fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  async fetchWorkItemComments(
    workItemId: number,
  ): Promise<WorkItemCommentData[]> {
    try {
      const restComments = await this.restProvider.getComments(workItemId)
      return restComments.map((comment) =>
        this.transformRestComment(comment, workItemId),
      )
    } catch (error) {
      console.error(
        `Failed to fetch comments for work item ${workItemId}:`,
        error,
      )

      // Provide actionable error messages based on error type
      if (error instanceof Error) {
        if (
          error.message.includes('401') ||
          error.message.includes('Unauthorized')
        ) {
          throw new Error(
            'Azure DevOps authentication failed. Please check your AZURE_DEVOPS_PAT environment variable.',
          )
        } else if (
          error.message.includes('rate limit') ||
          error.message.includes('429')
        ) {
          throw new Error(
            'Azure DevOps API rate limit exceeded. Please wait a few minutes before trying again.',
          )
        } else if (
          error.message.includes('timeout') ||
          error.message.includes('TIMEOUT')
        ) {
          throw new Error(
            'Azure DevOps API timeout. The request took too long to complete, please try again.',
          )
        } else if (
          error.message.includes('ENOTFOUND') ||
          error.message.includes('network')
        ) {
          throw new Error(
            'Network connection failed. Please check your internet connection and try again.',
          )
        }
      }

      throw new Error(
        `Azure DevOps comment fetch failed for work item ${workItemId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  async fetchSingleWorkItem(id: number): Promise<WorkItemData> {
    try {
      const restWorkItem = await this.restProvider.getWorkItem(id)

      if (!restWorkItem) {
        throw new Error(`Work item ${id} not found or returned null`)
      }

      return this.transformRestWorkItem(restWorkItem)
    } catch (error) {
      console.error(`Failed to fetch work item ${id}:`, error)

      // Provide actionable error messages based on error type
      if (error instanceof Error) {
        if (
          error.message.includes('401') ||
          error.message.includes('Unauthorized')
        ) {
          throw new Error(
            'Azure DevOps authentication failed. Please check your AZURE_DEVOPS_PAT environment variable.',
          )
        } else if (
          error.message.includes('rate limit') ||
          error.message.includes('429')
        ) {
          throw new Error(
            'Azure DevOps API rate limit exceeded. Please wait a few minutes before trying again.',
          )
        } else if (
          error.message.includes('timeout') ||
          error.message.includes('TIMEOUT')
        ) {
          throw new Error(
            'Azure DevOps API timeout. The request took too long to complete, please try again.',
          )
        } else if (
          error.message.includes('ENOTFOUND') ||
          error.message.includes('network')
        ) {
          throw new Error(
            'Network connection failed. Please check your internet connection and try again.',
          )
        }
      }

      throw new Error(
        `Azure DevOps single work item fetch failed for ID ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  async fetchWorkItemsDetailed(
    workItemIds: number[],
    concurrencyLimit: number = 5,
  ): Promise<WorkItemData[]> {
    if (!workItemIds || workItemIds.length === 0) {
      return []
    }

    // Create concurrency-controlled promises using a simple queue approach
    const results: WorkItemData[] = []
    const semaphore = new Array(concurrencyLimit).fill(null)
    let currentIndex = 0

    // Process items in batches respecting concurrency limit
    const processBatch = async (): Promise<void> => {
      const promises = semaphore.map(async () => {
        while (currentIndex < workItemIds.length) {
          const index = currentIndex++
          const workItemId = workItemIds[index]

          if (!workItemId) continue

          try {
            const workItem = await this.fetchSingleWorkItem(workItemId)
            results[index] = workItem
          } catch (error) {
            // Individual failures are handled gracefully - just log and continue
            console.warn(`Failed to fetch work item ${workItemId}:`, error)
          }
        }
      })

      await Promise.allSettled(promises)
    }

    await processBatch()

    // Filter out undefined values (failed fetches) and preserve order
    return results.filter((item) => item !== undefined)
  }

  async addWorkItemComment(workItemId: number, comment: string): Promise<void> {
    // Validate comment text
    const trimmedComment = comment.trim()
    if (!trimmedComment) {
      throw new Error('Comment text cannot be empty')
    }

    console.log(`💬 Adding comment to work item ${workItemId}`)

    try {
      const restClient = this.restProvider.getClient()
      await restClient.addWorkItemComment(workItemId, trimmedComment)
      console.log(`✅ Successfully added comment to work item ${workItemId}`)
    } catch (error) {
      console.error(`Failed to add comment to work item ${workItemId}:`, error)

      // Provide actionable error messages based on error type
      if (error instanceof Error) {
        if (
          error.message.includes('401') ||
          error.message.includes('Unauthorized')
        ) {
          throw new Error(
            'Azure DevOps authentication failed. Please check your AZURE_DEVOPS_PAT environment variable.',
          )
        } else if (
          error.message.includes('rate limit') ||
          error.message.includes('429')
        ) {
          throw new Error(
            'Azure DevOps API rate limit exceeded. Please wait a few minutes before trying again.',
          )
        } else if (
          error.message.includes('timeout') ||
          error.message.includes('ECONNRESET')
        ) {
          throw new Error(
            'Network timeout while adding comment. Please check your internet connection and try again.',
          )
        } else if (error.message.includes('not found')) {
          throw new Error(
            `Work item ${workItemId} not found. Please verify the work item ID is correct.`,
          )
        }
      }

      throw error
    }
  }

  async linkWorkItemToPullRequest(
    workItemId: number,
    pullRequestUrl: string,
  ): Promise<void> {
    const trimmedUrl = pullRequestUrl.trim()

    console.log(
      `🔗 Linking work item ${workItemId} to pull request: ${trimmedUrl}`,
    )

    try {
      const restClient = this.restProvider.getClient()
      await restClient.linkWorkItemToPullRequest(workItemId, trimmedUrl)

      console.log(
        `✅ Successfully linked work item ${workItemId} to pull request`,
      )
    } catch (error) {
      console.error(
        `Failed to link work item ${workItemId} to pull request:`,
        error,
      )

      // Provide actionable error messages based on error type
      if (error instanceof Error) {
        if (
          error.message.includes('401') ||
          error.message.includes('Unauthorized')
        ) {
          throw new Error(
            'Azure DevOps authentication failed. Please check your AZURE_DEVOPS_PAT environment variable.',
          )
        } else if (
          error.message.includes('rate limit') ||
          error.message.includes('429')
        ) {
          throw new Error(
            'Azure DevOps API rate limit exceeded. Please wait a few minutes before trying again.',
          )
        } else if (
          error.message.includes('timeout') ||
          error.message.includes('ECONNRESET')
        ) {
          throw new Error(
            'Network timeout while linking to pull request. Please check your internet connection and try again.',
          )
        } else if (error.message.includes('not found')) {
          throw new Error(
            `Work item ${workItemId} not found. Please verify the work item ID is correct.`,
          )
        } else if (error.message.includes('already exists')) {
          throw new Error(
            `Pull request link already exists for work item ${workItemId}. You may need to remove the existing link first.`,
          )
        }
      }

      throw error
    }
  }

  /**
   * Transforms REST provider WorkItemData to the existing WorkItemData format
   */
  private transformRestWorkItem(restWorkItem: RestWorkItemData): WorkItemData {
    const rawData = restWorkItem.raw as any

    return {
      id:
        typeof restWorkItem.id === 'string'
          ? parseInt(restWorkItem.id, 10)
          : restWorkItem.id,
      title: restWorkItem.title,
      state: restWorkItem.state,
      type: restWorkItem.type,
      assignedTo: restWorkItem.assignedTo || 'Unassigned',
      lastUpdatedAt: new Date(restWorkItem.changedDate),
      description: restWorkItem.description || '',

      // Sprint/Board Info
      iterationPath: rawData['System.IterationPath'],
      areaPath: rawData['System.AreaPath'],
      boardColumn: rawData['System.BoardColumn'],
      boardColumnDone: rawData['System.BoardColumnDone'] === true,

      // Priority/Tags
      priority: rawData['Microsoft.VSTS.Common.Priority'],
      severity: rawData['Microsoft.VSTS.Common.Severity'],
      tags: rawData['System.Tags'],

      // All the dates
      createdDate: rawData['System.CreatedDate']
        ? new Date(rawData['System.CreatedDate'])
        : undefined,
      changedDate: new Date(restWorkItem.changedDate),
      closedDate: rawData['Microsoft.VSTS.Common.ClosedDate']
        ? new Date(rawData['Microsoft.VSTS.Common.ClosedDate'])
        : undefined,
      resolvedDate: rawData['Microsoft.VSTS.Common.ResolvedDate']
        ? new Date(rawData['Microsoft.VSTS.Common.ResolvedDate'])
        : undefined,
      activatedDate: rawData['Microsoft.VSTS.Common.ActivatedDate']
        ? new Date(rawData['Microsoft.VSTS.Common.ActivatedDate'])
        : undefined,
      stateChangeDate: rawData['Microsoft.VSTS.Common.StateChangeDate']
        ? new Date(rawData['Microsoft.VSTS.Common.StateChangeDate'])
        : undefined,

      // People
      createdBy: this.extractPersonNameFromRaw(rawData['System.CreatedBy']),
      changedBy: this.extractPersonNameFromRaw(rawData['System.ChangedBy']),
      closedBy: this.extractPersonNameFromRaw(
        rawData['Microsoft.VSTS.Common.ClosedBy'],
      ),
      resolvedBy: this.extractPersonNameFromRaw(
        rawData['Microsoft.VSTS.Common.ResolvedBy'],
      ),

      // Work tracking
      storyPoints: this.parseFloat(
        rawData['Microsoft.VSTS.Scheduling.StoryPoints'],
      ),
      effort: this.parseFloat(rawData['Microsoft.VSTS.Scheduling.Effort']),
      remainingWork: this.parseFloat(
        rawData['Microsoft.VSTS.Scheduling.RemainingWork'],
      ),
      completedWork: this.parseFloat(
        rawData['Microsoft.VSTS.Scheduling.CompletedWork'],
      ),
      originalEstimate: this.parseFloat(
        rawData['Microsoft.VSTS.Scheduling.OriginalEstimate'],
      ),

      // Content
      acceptanceCriteria: rawData['Microsoft.VSTS.Common.AcceptanceCriteria'],
      reproSteps: rawData['Microsoft.VSTS.TCM.ReproSteps'],
      systemInfo: rawData['Microsoft.VSTS.TCM.SystemInfo'],

      // Related items (extract from relations in raw data)
      parentId: this.extractParentIdFromRaw(rawData.relations || []),

      // Additional Azure DevOps fields
      rev: rawData.rev,
      reason: rawData['System.Reason'],
      watermark: rawData['System.Watermark'],
      url: rawData.url,
      commentCount: rawData['System.CommentCount'] || 0,
      hasAttachments: this.hasAttachmentsFromRaw(rawData.relations || []),
      teamProject: rawData['System.TeamProject'],
      areaId: rawData['System.AreaId'],
      nodeId: rawData['System.IterationId'],
      stackRank: this.parseFloat(rawData['Microsoft.VSTS.Common.StackRank']),
      valueArea: rawData['Microsoft.VSTS.Common.ValueArea'],

      // Store complete raw JSON for backup
      rawJson: JSON.stringify(rawData),
    }
  }

  /**
   * Transforms REST provider CommentData to the existing WorkItemCommentData format
   */
  private transformRestComment(
    restComment: RestCommentData,
    workItemId: number,
  ): WorkItemCommentData {
    return {
      id: restComment.id,
      workItemId: workItemId,
      text: restComment.text,
      createdBy: restComment.author || 'Unknown',
      createdDate: new Date(restComment.createdDate),
      modifiedBy: restComment.raw.modifiedBy
        ? typeof restComment.raw.modifiedBy === 'object' &&
          restComment.raw.modifiedBy.displayName
          ? restComment.raw.modifiedBy.displayName
          : restComment.raw.modifiedBy
        : null,
      modifiedDate: restComment.modifiedDate
        ? new Date(restComment.modifiedDate)
        : null,
    }
  }

  /**
   * Helper methods for data extraction from raw REST data
   */
  private extractPersonNameFromRaw(person: any): string {
    if (!person) return 'Unassigned'
    if (typeof person === 'string') return person
    return person.uniqueName || person.displayName || 'Unassigned'
  }

  private extractParentIdFromRaw(relations: any[]): number | undefined {
    if (!relations || !Array.isArray(relations)) return undefined

    const parentRelation = relations.find(
      (rel) => rel.rel === 'System.LinkTypes.Hierarchy-Reverse',
    )

    if (parentRelation && parentRelation.url) {
      const match = parentRelation.url.match(/\/(\d+)$/)
      return match && match[1] ? parseInt(match[1], 10) : undefined
    }

    return undefined
  }

  private hasAttachmentsFromRaw(relations: any[]): boolean {
    if (!relations || !Array.isArray(relations)) return false
    return relations.some((rel) => rel.rel === 'AttachedFile')
  }

  static buildWorkItemUrl(id: number): string {
    return `https://dev.azure.com/${AzureDevOpsClient.ORGANIZATION}/${encodeURIComponent(AzureDevOpsClient.PROJECT)}/_workitems/edit/${id}`
  }

  private extractPersonName(
    person: AzureDevOpsPerson | string | undefined,
  ): string {
    if (!person) return 'Unassigned'
    if (typeof person === 'string') return person
    return person.uniqueName || person.displayName || 'Unassigned'
  }

  private parseDate(dateString: string | undefined): Date | undefined {
    if (!dateString) return undefined
    return new Date(dateString)
  }

  private parseFloat(
    value: string | number | undefined | null,
  ): number | undefined {
    if (value === null || value === undefined) return undefined
    const parsed = parseFloat(String(value))
    return isNaN(parsed) ? undefined : parsed
  }

  async validateUserEmails(
    emails: string[],
  ): Promise<{ valid: string[]; invalid: string[] }> {
    const valid: string[] = []
    const invalid: string[] = []

    for (const email of emails) {
      try {
        // Use REST client to query work items for this user
        const wiql = `SELECT [System.Id] FROM WorkItems WHERE [System.AssignedTo] = '${email}' OR [System.CreatedBy] = '${email}' OR [System.ChangedBy] = '${email}'`
        const restClient = this.restProvider.getClient()
        const result = await restClient.queryWorkItems(wiql)

        if (result && result.workItems.length > 0) {
          valid.push(email)
        } else {
          // If no work items found, assume the email is invalid
          // Note: We can't easily validate users via REST API without additional permissions
          invalid.push(email)
        }
      } catch (error) {
        // If query fails, mark as invalid
        console.warn(`Failed to validate email ${email}:`, error)
        invalid.push(email)
      }
    }

    return { valid, invalid }
  }
}
