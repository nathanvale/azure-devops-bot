import type { Logger } from '@orchestr8/logger'

import { ProductionResilienceAdapter } from '@orchestr8/resilience'

import type { AzureDevOpsPerson } from '../types/azure-devops-api.js'
import type { ResilienceTelemetryContext } from '../types/common.js'

import {
  AzureDevOpsProvider,
  type WorkItemData as RestWorkItemData,
  type WorkItemDataWithPersons as RestWorkItemDataWithPersons,
  type CommentData as RestCommentData,
  type AzureDevOpsClientConfig,
} from '../packages/azure-devops-client/dist/index.js'
import { LoggerFactory } from '../utils/logger.js'
import { ResiliencePolicySelector } from '../utils/resilience-policies.js'
import type {
  ComprehensiveWorkItemData,
  ComprehensiveWorkItemDataWithPersons,
} from '../types/database.js'

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

// Re-export comprehensive types for backward compatibility
export type WorkItemData = ComprehensiveWorkItemData
export type WorkItemDataWithPersons = ComprehensiveWorkItemDataWithPersons

// Legacy interface for internal mapping only
interface LegacyWorkItemData {
  id: number
  title: string
  state: string
  type: string
  assignedTo: string
  lastUpdatedAt: Date
  description?: string

  // Sprint/Board Info - Enhanced
  iterationPath?: string
  areaPath?: string
  boardColumn?: string
  boardColumnDone?: boolean
  boardLane?: string

  // Priority/Tags
  priority?: number
  severity?: string
  tags?: string

  // All the dates - Enhanced
  createdDate?: Date
  changedDate?: Date
  closedDate?: Date
  resolvedDate?: Date
  activatedDate?: Date
  stateChangeDate?: Date
  authorizedDate?: Date
  revisedDate?: Date

  // People - Enhanced
  createdBy?: string
  changedBy?: string
  closedBy?: string
  resolvedBy?: string
  activatedBy?: string
  authorizedAs?: string

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

  // Relationships - extracted from relations array
  relationships?: Array<{
    sourceId: number
    targetId: number
    relationshipType: string
    attributes?: string
  }>

  // Additional Azure DevOps fields found in real data - Enhanced
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
  risk?: string
  resolution?: string
  businessValue?: number
  timeCriticality?: number

  // Custom fields - JSON string of WEF extensions and custom fields
  customFields?: string

  // Complete raw JSON from Azure DevOps
  rawJson: string
}

export class AzureDevOpsClient {
  private static readonly ORGANIZATION = ORGANIZATION
  private static readonly PROJECT = PROJECT
  private static userEmails: string[] = []
  private restProvider: AzureDevOpsProvider
  private resilienceAdapter!: ProductionResilienceAdapter
  private logger?: Logger

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

    // Initialize @orchestr8/resilience integration
    this.initializeResilienceServices()
  }

  /**
   * Initialize resilience services with @orchestr8/logger integration
   */
  private initializeResilienceServices(): void {
    // Initialize logger for resilience telemetry using shared logger infrastructure
    try {
      this.logger = LoggerFactory.createForComponent('azure-devops-client')
    } catch (error) {
      // Logger is optional - continue without it if creation fails
      console.warn('Failed to initialize logger for AzureDevOpsClient:', error)
      this.logger = undefined
    }

    // Initialize ProductionResilienceAdapter with telemetry
    this.resilienceAdapter = new ProductionResilienceAdapter({
      telemetry: this.createResilienceTelemetry() as any,
    })
  }

  /**
   * Create telemetry callbacks for @orchestr8/resilience
   */
  private createResilienceTelemetry() {
    return {
      logEvent: (
        type: string,
        context: ResilienceTelemetryContext,
        metadata?: Record<string, unknown>,
      ) => {
        if (this.logger && typeof this.logger.info === 'function') {
          this.logger.info(`Azure DevOps resilience event: ${type}`, {
            context,
            metadata,
          })
        }
      },

      createCircuitBreakerObserver: () => ({
        onStateChange: (
          key: string,
          state: 'closed' | 'open' | 'half-open',
        ) => {
          if (state === 'open') {
            if (this.logger && typeof this.logger.error === 'function') {
              this.logger.error(
                'Azure DevOps circuit breaker opened - API failures detected',
                {
                  circuitKey: key,
                  action: 'blocking_further_attempts',
                },
              )
            }
          } else if (state === 'closed') {
            if (this.logger && typeof this.logger.info === 'function') {
              this.logger.info(
                'Azure DevOps circuit breaker closed - API operations recovered',
                {
                  circuitKey: key,
                },
              )
            }
          } else if (state === 'half-open') {
            if (this.logger && typeof this.logger.warn === 'function') {
              this.logger.warn(
                'Azure DevOps circuit breaker half-open - testing recovery',
                {
                  circuitKey: key,
                },
              )
            }
          }
        },
      }),

      onRetry: (attempt: number, error: unknown) => {
        if (this.logger && typeof this.logger.warn === 'function') {
          this.logger.warn('Azure DevOps operation retry', {
            event: 'retry_attempt',
            attempt,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      },
      onCircuitBreakerOpen: (key: string, failureRate: number) => {
        if (this.logger && typeof this.logger.error === 'function') {
          this.logger.error('Azure DevOps circuit breaker opened', {
            event: 'circuit_breaker_open',
            key,
            failureRate,
          })
        }
      },
      onTimeout: (operation: string, duration: number) => {
        if (this.logger && typeof this.logger.warn === 'function') {
          this.logger.warn('Azure DevOps operation timeout', {
            event: 'operation_timeout',
            operation,
            duration,
          })
        }
      },
      onSuccess: (operation: string, duration: number, attempt?: number) => {
        if (this.logger && typeof this.logger.info === 'function') {
          this.logger.info('Azure DevOps operation success', {
            event: 'operation_success',
            operation,
            duration,
            attempt,
          })
        }
      },
      onFailure: (operation: string, error: unknown, duration: number) => {
        if (this.logger && typeof this.logger.error === 'function') {
          this.logger.error('Azure DevOps operation failed', {
            event: 'operation_failure',
            operation,
            error: error instanceof Error ? error.message : String(error),
            duration,
          })
        }
      },

      startTimer: (operation: string) => {
        const start = performance.now()
        return () => {
          const duration = performance.now() - start
          if (this.logger && typeof this.logger.debug === 'function') {
            this.logger.debug('Azure DevOps operation timing', {
              operation,
              durationMs: duration,
            })
          }
          return duration
        }
      },

      getLogger: () => this.logger,
    }
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

  async fetchWorkItems(): Promise<WorkItemDataWithPersons[]> {
    if (this.logger)
      this.logger.debug('🚀 Starting comprehensive work items sync...')

    // Apply resilience policy for batch work item operations
    return await this.resilienceAdapter.applyNormalizedPolicy(
      async () => {
        // Get validated user emails to filter work items
        const userEmails = AzureDevOpsClient.getUserEmails()

        // Use REST provider to fetch all work items with comprehensive query
        const query = {
          filters: {
            type: ['User Story', 'Product Backlog Item', 'Bug', 'Task'],
            state: [], // Will exclude removed items by default
            // Include assignedTo filter if user emails are configured
            ...(userEmails.length > 0 ? { assignedTo: userEmails } : {}),
          },
          orderBy: 'changedDate',
          orderDirection: 'desc' as const,
        }

        if (this.logger)
          this.logger.debug(
            '📋 Fetching work items with query:',
            { query },
          )
        const startTime = Date.now()

        // Use fetchWorkItemsWithPersons to get complete person data per DEC-009
        // Return directly without transformation to preserve Person objects
        const restWorkItems =
          await this.restProvider.fetchWorkItemsWithPersons(query)

        const fetchDuration = Date.now() - startTime
        if (this.logger)
          this.logger.debug(
            `✅ Fetched ${restWorkItems.length} work items from Azure DevOps in ${fetchDuration}ms`,
          )

        // Log summary of extracted data (adapted for WorkItemDataWithPersons)
        const summary = {
          totalItems: restWorkItems.length,
          withAssignedTo: restWorkItems.filter((item) => item.assignedToPerson)
            .length,
          withCreatedBy: restWorkItems.filter((item) => item.createdByPerson)
            .length,
          byType: restWorkItems.reduce(
            (acc, item) => {
              acc[item.type] = (acc[item.type] || 0) + 1
              return acc
            },
            {} as Record<string, number>,
          ),
          byState: restWorkItems.reduce(
            (acc, item) => {
              acc[item.state] = (acc[item.state] || 0) + 1
              return acc
            },
            {} as Record<string, number>,
          ),
        }

        if (this.logger)
          this.logger.debug(
            '📈 Work items sync summary:',
            { summary },
          )

        // Return WorkItemDataWithPersons directly to preserve Person objects
        return restWorkItems
      },
      ResiliencePolicySelector.getPolicy('batch'),
      'retry-cb-timeout',
    )
  }

  async fetchWorkItemComments(
    workItemId: number,
  ): Promise<WorkItemCommentData[]> {
    // Apply resilience policy for comment operations
    try {
      return await this.resilienceAdapter.applyNormalizedPolicy(
        async () => {
          const restComments = await this.restProvider.getComments(workItemId)
          return restComments.map((comment) =>
            this.transformRestComment(comment, workItemId),
          )
        },
        ResiliencePolicySelector.getPolicy('sync'),
        'retry-cb-timeout',
      )
    } catch (error) {
      // Check if this is a RetryExhaustedError that wraps another error
      if (
        error instanceof Error &&
        error.name === 'RetryExhaustedError' &&
        'lastError' in error
      ) {
        const lastError = (error as { lastError?: Error }).lastError
        // If the last error is a resilience-specific error, throw that instead
        if (
          lastError &&
          lastError.name &&
          (lastError.name.includes('ResilienceError') ||
            lastError.name.includes('CircuitBreakerError') ||
            lastError.name.includes('RateLimitError'))
        ) {
          throw lastError
        }
      }

      // For all other errors, throw as-is
      throw error
    }
  }

  async fetchSingleWorkItem(id: number): Promise<WorkItemData> {
    // Apply resilience policy for single work item operations
    return await this.resilienceAdapter.applyNormalizedPolicy(
      async () => {
        const restWorkItem = await this.restProvider.getWorkItem(id)

        if (!restWorkItem) {
          throw new Error(`Work item ${id} not found or returned null`)
        }

        return this.transformRestWorkItem(restWorkItem)
      },
      ResiliencePolicySelector.getPolicy('sync'),
      'retry-cb-timeout',
    )
  }

  async fetchWorkItemsDetailed(
    workItemIds: number[],
    _concurrencyLimit: number = 5,
  ): Promise<WorkItemDataWithPersons[]> {
    if (!workItemIds || workItemIds.length === 0) {
      return []
    }

    // Apply resilience policy for batch operations
    return await this.resilienceAdapter.applyNormalizedPolicy(
      async () => {
        // Use the provider's method which extracts Person data per DEC-009
        return await this.restProvider.getWorkItemsBatch(workItemIds)
      },
      ResiliencePolicySelector.getPolicy('batch'),
      'retry-cb-timeout',
    )
  }

  /**
   * Batch fetch work items using the REST client's optimized batch API
   * This reduces API calls from N individual calls to ~N/200 batch calls
   */
  async fetchWorkItemsBatch(
    workItemIds: number[],
  ): Promise<WorkItemDataWithPersons[]> {
    if (!workItemIds || workItemIds.length === 0) {
      return []
    }

    // Use console.log since logger might not be initialized yet
    if (this.logger)
      this.logger.debug(
        `🔄 Starting batch work item fetch: ${workItemIds.length} items (${Math.ceil(workItemIds.length / 200)} batches)`,
      )

    // Apply resilience policy for batch operations
    return await this.resilienceAdapter.applyNormalizedPolicy(
      async () => {
        // Use the provider's method which extracts Person data per DEC-009
        // This will fetch work items and extract all Person objects
        const workItemsWithPersons =
          await this.restProvider.getWorkItemsBatch(workItemIds)

        if (this.logger)
          this.logger.debug(
            `✅ Batch work item fetch completed: ${workItemsWithPersons.length}/${workItemIds.length} items retrieved`,
          )

        // Return WorkItemDataWithPersons directly to preserve Person objects
        return workItemsWithPersons
      },
      ResiliencePolicySelector.getPolicy('batch'),
      'retry-cb-timeout',
    )
  }

  async addWorkItemComment(
    workItemId: number,
    comment: string,
  ): Promise<{ id: string; version: number; text: string; url: string }> {
    // Validate comment text
    const trimmedComment = comment.trim()
    if (!trimmedComment) {
      throw new Error('Comment text cannot be empty')
    }

    if (this.logger)
      this.logger.debug(`💬 Adding comment to work item ${workItemId}`)

    // The REST client already has its own resilience policies, so we don't need to wrap it again
    const restClient = this.restProvider.getClient()
    const result = await restClient.addWorkItemComment(
      workItemId,
      trimmedComment,
    )
    if (this.logger)
      this.logger.debug(
        `✅ Successfully added comment to work item ${workItemId}`,
      )
    return {
      ...result,
      url: (result as any).url || `https://dev.azure.com/${(this.restProvider as any).organization}/_apis/wit/workItems/${workItemId}/comments/${result.id}`,
    }
  }

  async linkWorkItemToPullRequest(
    workItemId: number,
    pullRequestUrl: string,
  ): Promise<void> {
    const trimmedUrl = pullRequestUrl.trim()

    if (this.logger)
      this.logger.debug(
        `🔗 Linking work item ${workItemId} to pull request: ${trimmedUrl}`,
      )

    // The REST client already has its own resilience policies, so we don't need to wrap it again
    const restClient = this.restProvider.getClient()
    await restClient.linkWorkItemToPullRequest(workItemId, trimmedUrl)
    if (this.logger)
      this.logger.debug(
        `✅ Successfully linked work item ${workItemId} to pull request`,
      )
  }

  /**
   * Transforms REST provider WorkItemData to the existing WorkItemData format
   * Updated to handle WorkItemDataWithPersons which includes Person objects
   */
  private transformRestWorkItem(
    restWorkItem: RestWorkItemData | WorkItemDataWithPersons,
  ): WorkItemData {
    const rawData = restWorkItem.raw as Record<string, unknown>
    const fields = rawData.fields || rawData // Handle both nested and flat field structures
    const fieldsAny = fields as any // Type assertion for Azure DevOps field access
    const workItemId =
      typeof restWorkItem.id === 'string'
        ? parseInt(restWorkItem.id, 10)
        : restWorkItem.id

    if (this.logger)
      this.logger.debug(
        `🔄 Transforming work item ${workItemId} (${restWorkItem.type}: ${restWorkItem.title})`,
      )

    // Log field extraction details for debugging
    const extractedFields = {
      basicFields: ['id', 'title', 'state', 'type', 'assignedTo'],
      sprintFields: ['iterationPath', 'areaPath', 'boardColumn', 'boardLane'],
      dateFields: [
        'createdDate',
        'changedDate',
        'closedDate',
        'resolvedDate',
        'activatedDate',
      ],
      peopleFields: [
        'createdBy',
        'changedBy',
        'closedBy',
        'resolvedBy',
        'activatedBy',
      ],
      workFields: ['storyPoints', 'effort', 'remainingWork', 'completedWork'],
      contentFields: ['acceptanceCriteria', 'reproSteps', 'systemInfo'],
      relationshipCount: Array.isArray(rawData.relations) ? rawData.relations.length : 0,
    }

    if (this.logger)
      this.logger.debug(
        `  📊 Field extraction summary for work item ${workItemId}:`,
        {
          relationshipCount: extractedFields.relationshipCount,
          hasAcceptanceCriteria:
            !!fieldsAny['Microsoft.VSTS.Common.AcceptanceCriteria'],
          hasDescription: !!(
            restWorkItem.description || fieldsAny['System.Description']
          ),
          hasStoryPoints: !!fieldsAny['Microsoft.VSTS.Scheduling.StoryPoints'],
          boardColumn: fieldsAny['System.BoardColumn'] || 'N/A',
        },
      )

    return {
      id:
        typeof restWorkItem.id === 'string'
          ? parseInt(restWorkItem.id, 10)
          : restWorkItem.id,
      title: restWorkItem.title,
      state: restWorkItem.state,
      type: restWorkItem.type,
      assignedTo: restWorkItem.assignedTo || 'Unassigned',
      // lastUpdatedAt: new Date(restWorkItem.changedDate), // Not in ComprehensiveWorkItemData interface
      description:
        restWorkItem.description || fieldsAny['System.Description'] || '',

      // Sprint/Board Info - Enhanced with additional fields from test.json
      iterationPath: fieldsAny['System.IterationPath'],
      areaPath: fieldsAny['System.AreaPath'],
      boardColumn: fieldsAny['System.BoardColumn'],
      boardColumnDone: fieldsAny['System.BoardColumnDone'] === true,
      boardLane:
        fieldsAny['System.BoardLane'] ||
        fieldsAny['WEF_352AABABD92A469BB5F1976D53DB379D_Kanban.Lane'],

      // Priority/Tags
      priority: fieldsAny['Microsoft.VSTS.Common.Priority'],
      severity: fieldsAny['Microsoft.VSTS.Common.Severity'],
      tags: fieldsAny['System.Tags'],

      // All the dates - Enhanced with more date fields
      createdDate: fieldsAny['System.CreatedDate']
        ? new Date(fieldsAny['System.CreatedDate']).toISOString()
        : '',
      changedDate: restWorkItem.changedDate ? new Date(restWorkItem.changedDate).toISOString() : '',
      closedDate: fieldsAny['Microsoft.VSTS.Common.ClosedDate']
        ? new Date(fieldsAny['Microsoft.VSTS.Common.ClosedDate']).toISOString()
        : undefined,
      resolvedDate: fieldsAny['Microsoft.VSTS.Common.ResolvedDate']
        ? new Date(fieldsAny['Microsoft.VSTS.Common.ResolvedDate']).toISOString()
        : undefined,
      activatedDate: fieldsAny['Microsoft.VSTS.Common.ActivatedDate']
        ? new Date(fieldsAny['Microsoft.VSTS.Common.ActivatedDate']).toISOString()
        : undefined,
      stateChangeDate: fieldsAny['Microsoft.VSTS.Common.StateChangeDate']
        ? new Date(fieldsAny['Microsoft.VSTS.Common.StateChangeDate']).toISOString()
        : undefined,
      authorizedDate: fieldsAny['System.AuthorizedDate']
        ? new Date(fieldsAny['System.AuthorizedDate']).toISOString()
        : undefined,
      revisedDate: fieldsAny['System.RevisedDate']
        ? new Date(fieldsAny['System.RevisedDate']).toISOString()
        : undefined,

      // People - Enhanced with more person fields
      createdBy: this.extractPersonNameFromRaw(fieldsAny['System.CreatedBy']),
      changedBy: this.extractPersonNameFromRaw(fieldsAny['System.ChangedBy']),
      closedBy: this.extractPersonNameFromRaw(
        fieldsAny['Microsoft.VSTS.Common.ClosedBy'],
      ),
      resolvedBy: this.extractPersonNameFromRaw(
        fieldsAny['Microsoft.VSTS.Common.ResolvedBy'],
      ),
      activatedBy: this.extractPersonNameFromRaw(
        fieldsAny['Microsoft.VSTS.Common.ActivatedBy'],
      ),
      authorizedAs: this.extractPersonNameFromRaw(
        fieldsAny['System.AuthorizedAs'],
      ),

      // Work tracking - Enhanced with schedule fields
      storyPoints: this.parseFloat(
        fieldsAny['Microsoft.VSTS.Scheduling.StoryPoints'],
      ),
      effort: this.parseFloat(fieldsAny['Microsoft.VSTS.Scheduling.Effort']),
      remainingWork: this.parseFloat(
        fieldsAny['Microsoft.VSTS.Scheduling.RemainingWork'],
      ),
      completedWork: this.parseFloat(
        fieldsAny['Microsoft.VSTS.Scheduling.CompletedWork'],
      ),
      originalEstimate: this.parseFloat(
        fieldsAny['Microsoft.VSTS.Scheduling.OriginalEstimate'],
      ),

      // Content
      acceptanceCriteria: fieldsAny['Microsoft.VSTS.Common.AcceptanceCriteria'],
      reproSteps: fieldsAny['Microsoft.VSTS.TCM.ReproSteps'],
      systemInfo: fieldsAny['Microsoft.VSTS.TCM.SystemInfo'],

      // Related items (extract from relations in raw data)
      parentId: this.extractParentIdFromRaw(Array.isArray(rawData.relations) ? rawData.relations : []),

      // Extract all relationships for future relationship table storage
      relationships: this.extractAllRelationshipsFromRaw(
        typeof restWorkItem.id === 'string'
          ? parseInt(restWorkItem.id, 10)
          : restWorkItem.id,
        Array.isArray(rawData.relations) ? rawData.relations : [],
      ) as any,

      // Additional Azure DevOps fields - Enhanced from test.json structure
      rev: typeof rawData.rev === 'number' ? rawData.rev : undefined,
      reason: fieldsAny['System.Reason'],
      watermark: typeof rawData.watermark === 'number' ? rawData.watermark : undefined,
      url: typeof rawData.url === 'string' ? rawData.url : undefined,
      commentCount: fieldsAny['System.CommentCount'] || 0,
      hasAttachments: this.hasAttachmentsFromRaw(Array.isArray(rawData.relations) ? rawData.relations : []),
      teamProject: fieldsAny['System.TeamProject'],
      areaId: fieldsAny['System.AreaId'],
      nodeId: fieldsAny['System.IterationId'],
      stackRank: this.parseFloat(fieldsAny['Microsoft.VSTS.Common.StackRank']),
      valueArea: fieldsAny['Microsoft.VSTS.Common.ValueArea'],

      // Additional comprehensive fields from test.json
      risk: fieldsAny['Microsoft.VSTS.Common.Risk'],
      resolution: fieldsAny['Microsoft.VSTS.Common.Resolution'],
      businessValue: this.parseFloat(
        fieldsAny['Microsoft.VSTS.Common.BusinessValue'],
      ),
      timeCriticality: this.parseFloat(
        fieldsAny['Microsoft.VSTS.Common.TimeCriticality'],
      ),

      // Custom fields - Extract all WEF (Work item Extension Framework) fields as JSON
      customFields: this.extractCustomFields(rawData) || undefined,

      // Store complete raw JSON for backup
      rawJson: JSON.stringify(rawData),
    }
  }

  /**
   * Extract all relationships from relations array in raw data
   */
  private extractAllRelationshipsFromRaw(
    workItemId: number,
    relations: Array<{
      rel: string
      url: string
      attributes?: Record<string, unknown>
    }>,
  ): Array<{
    sourceId: number
    targetId: number
    relationshipType: string
    attributes?: string
  }> {
    if (!relations || !Array.isArray(relations)) {
      return []
    }

    const relationships: Array<{
      sourceId: number
      targetId: number
      relationshipType: string
      attributes?: string
    }> = []

    relations.forEach((relation) => {
      if (relation.rel && relation.url) {
        // Extract target work item ID from URL
        const urlMatch = relation.url.match(/workItems\/(\d+)$/)
        if (urlMatch && urlMatch[1]) {
          const targetId = parseInt(urlMatch[1], 10)
          if (!isNaN(targetId)) {
            relationships.push({
              sourceId: workItemId,
              targetId: targetId,
              relationshipType: relation.rel,
              attributes: relation.attributes
                ? JSON.stringify(relation.attributes)
                : undefined,
            })
          }
        }
      }
    })

    if (relationships.length > 0) {
      if (this.logger)
        this.logger.debug(
          `📊 Extracted ${relationships.length} relationships for work item ${workItemId}`,
        )
    }
    return relationships
  }

  /**
   * Extract custom fields (WEF extensions and other non-standard fields) as JSON string
   */
  private extractCustomFields(rawData: Record<string, unknown>): string | null {
    const customFields: Record<string, unknown> = {}

    // Extract all WEF (Work item Extension Framework) fields
    Object.keys(rawData).forEach((key) => {
      if (
        key.startsWith('WEF_') ||
        key.startsWith('Custom.') ||
        key.startsWith('Microsoft.VSTS.Scheduling.StartDate') ||
        key.startsWith('Microsoft.VSTS.Scheduling.FinishDate') ||
        (key.includes('_') &&
          !key.startsWith('System.') &&
          !key.startsWith('Microsoft.VSTS.Common.') &&
          !key.startsWith('Microsoft.VSTS.Scheduling.'))
      ) {
        customFields[key] = rawData[key]
      }
    })

    return Object.keys(customFields).length > 0
      ? JSON.stringify(customFields)
      : null
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
          (restComment.raw.modifiedBy as any).displayName
          ? (restComment.raw.modifiedBy as any).displayName
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
  private extractPersonNameFromRaw(person: unknown): string {
    if (!person) return 'Unassigned'
    if (typeof person === 'string') return person
    const personObj = person as any
    return personObj.uniqueName || personObj.displayName || 'Unassigned'
  }

  private extractParentIdFromRaw(
    relations: Array<{ rel: string; url: string }>,
  ): number | undefined {
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

  private hasAttachmentsFromRaw(relations: Array<{ rel: string }>): boolean {
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
        // Apply resilience policy for user validation queries
        await this.resilienceAdapter.applyNormalizedPolicy(
          async () => {
            // Use REST client to query work items for this user
            const wiql = `SELECT [System.Id] FROM WorkItems WHERE [System.AssignedTo] = '${email}' OR [System.CreatedBy] = '${email}' OR [System.ChangedBy] = '${email}'`
            const restClient = this.restProvider.getClient()
            const result = await restClient.queryWorkItems(wiql)

            if (result && result.workItems && result.workItems.length > 0) {
              valid.push(email)
            } else {
              // If no work items found, assume the email is invalid
              // Note: We can't easily validate users via REST API without additional permissions
              invalid.push(email)
            }
          },
          ResiliencePolicySelector.getPolicy('auth'),
          'retry-cb-timeout',
        )
      } catch (error) {
        // If query fails, mark as invalid
        if (this.logger)
          this.logger.warn(`Failed to validate email ${email}:`, error as any)
        invalid.push(email)
      }
    }

    return { valid, invalid }
  }
}
