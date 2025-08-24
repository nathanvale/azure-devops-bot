import {
  ProductionResilienceAdapter,
  type ResiliencePolicy,
} from '@orchestr8/resilience'
import axios, { type AxiosInstance, type AxiosError } from 'axios'

import type { IAzureDevOpsClient } from './interfaces/client.js'
import type { WorkItemBatchResponse } from './types/api-responses.js'
import type {
  WorkItemComment,
  WorkItemCommentsResponse,
} from './types/comments.js'
import type {
  AzureDevOpsClientConfig,
  WorkItemExpand,
  BatchOptions,
} from './types/config.js'
import type {
  WorkItem,
  WorkItemQueryResult,
} from './types/work-items.js'
import type {
  BatchProcessor} from './utils/batch-processor.js';

import { PATAuth } from './auth/pat-auth.js'
import {
  createBatchProcessor,
  removeDuplicates,
  validateBatchInput,
} from './utils/batch-processor.js'
import { ErrorHandler, ValidationError } from './utils/error-handler.js'
import { RateLimiter } from './utils/rate-limiter.js'

export class AzureDevOpsRestClient implements IAzureDevOpsClient {
  private readonly auth: PATAuth
  private readonly httpClient: AxiosInstance
  private readonly rateLimiter: RateLimiter
  private readonly resilience: ProductionResilienceAdapter
  private readonly batchProcessor: BatchProcessor<number, WorkItem>

  constructor(config: AzureDevOpsClientConfig) {
    this.auth = new PATAuth(config)
    this.rateLimiter = new RateLimiter(config.rateLimit)
    this.resilience = new ProductionResilienceAdapter()
    this.httpClient = this.createHttpClient(config)
    this.batchProcessor = createBatchProcessor<number, WorkItem>(
      {
        batchSize: 200, // Azure DevOps batch limit
        maxConcurrency: 3,
      },
      this.rateLimiter,
    )

    this.setupInterceptors()

    // Validate authentication works (async, but don't block constructor)
    this.validateConfiguration().catch((error) => {
      console.error(
        'Azure DevOps client configuration validation failed:',
        error,
      )
      console.error(
        'Please check your AZURE_DEVOPS_PAT and network connectivity',
      )
    })
  }

  /**
   * Validates that the configuration is correct and authentication works
   */
  private async validateConfiguration(): Promise<void> {
    if (!(await this.auth.validateAuthentication())) {
      throw new Error(
        'Azure DevOps authentication validation failed. Please check:\n' +
          '1. Your PAT token is valid and not expired\n' +
          '2. The token has "Work items (read & write)" permissions\n' +
          '3. You have access to the organization and project\n' +
          '4. Your network connection is working',
      )
    }
  }

  /**
   * Gets a single work item by ID
   */
  async getWorkItem(id: number, expand?: WorkItemExpand): Promise<WorkItem> {
    this.validateWorkItemId(id)

    const queryParams: Record<string, string> = {}
    if (expand) {
      queryParams['$expand'] = expand
    }

    const url = this.auth.buildUrl(`/_apis/wit/workitems/${id}`, queryParams)

    try {
      return await this.executeWithResilience('single', async () => {
        const response = await this.httpClient.get<WorkItem>(url)
        return response.data
      })
    } catch (error) {
      ErrorHandler.handleAxiosError(error as AxiosError)
    }
  }

  /**
   * Gets multiple work items by IDs
   */
  async getWorkItemsBatch(
    ids?: number[],
    options?: BatchOptions,
  ): Promise<WorkItem[]> {
    if (!ids || ids.length === 0) {
      return []
    }

    // Validate and clean IDs
    const validIds = this.validateAndCleanIds(ids)

    const queryParams: Record<string, string> = {
      ids: validIds.join(','),
    }

    if (options?.expand) {
      queryParams['$expand'] = options.expand
    }

    if (options?.fields) {
      queryParams['fields'] = options.fields.join(',')
    }

    if (options?.asOf) {
      queryParams['asOf'] = options.asOf
    }

    const url = this.auth.buildUrl('/_apis/wit/workitems', queryParams)

    try {
      return await this.executeWithResilience('batch', async () => {
        const response = await this.httpClient.get<WorkItemBatchResponse>(url)
        return response.data.value
      })
    } catch (error) {
      if (options?.errorPolicy === 'omit') {
        // Return empty array on error if omit policy is specified
        return []
      }
      ErrorHandler.handleAxiosError(error as AxiosError)
    }
  }

  /**
   * Executes a WIQL query to get work item references
   */
  async queryWorkItems(wiql: string): Promise<WorkItemQueryResult> {
    if (!wiql?.trim()) {
      throw new ValidationError('WIQL query cannot be empty')
    }

    const url = this.auth.buildUrl('/_apis/wit/wiql')

    try {
      return await this.executeWithResilience('query', async () => {
        const response = await this.httpClient.post<WorkItemQueryResult>(url, {
          query: wiql,
        })
        return response.data
      })
    } catch (error) {
      ErrorHandler.handleAxiosError(error as AxiosError)
    }
  }

  /**
   * Gets work item comments
   */
  async getWorkItemComments(workItemId: number): Promise<WorkItemComment[]> {
    this.validateWorkItemId(workItemId)

    const url = this.auth.buildUrl(
      `/_apis/wit/workItems/${workItemId}/comments`,
    )

    try {
      return await this.executeWithResilience('comment', async () => {
        const response =
          await this.httpClient.get<WorkItemCommentsResponse>(url)
        return response.data.comments
      })
    } catch (error) {
      ErrorHandler.handleAxiosError(error as AxiosError)
    }
  }

  /**
   * Adds a comment to a work item
   */
  async addWorkItemComment(
    workItemId: number,
    text: string,
  ): Promise<WorkItemComment> {
    this.validateWorkItemId(workItemId)

    if (!text?.trim()) {
      throw new ValidationError('Comment text cannot be empty')
    }

    const url = this.auth.buildUrl(
      `/_apis/wit/workItems/${workItemId}/comments`,
    )

    try {
      return await this.executeWithResilience('comment', async () => {
        const response = await this.httpClient.post<WorkItemComment>(url, {
          text: text.trim(),
        })
        return response.data
      })
    } catch (error) {
      ErrorHandler.handleAxiosError(error as AxiosError)
    }
  }

  /**
   * Links a work item to a pull request by adding a hyperlink relation
   */
  async linkWorkItemToPullRequest(
    workItemId: number,
    pullRequestUrl: string,
  ): Promise<void> {
    this.validateWorkItemId(workItemId)

    if (!pullRequestUrl?.trim()) {
      throw new ValidationError('Pull request URL cannot be empty')
    }

    // Validate URL format
    try {
      new URL(pullRequestUrl.trim())
    } catch {
      throw new ValidationError('Invalid pull request URL format')
    }

    // JSON patch format for Azure DevOps API
    const patchBody = [
      {
        op: 'add',
        path: '/relations/-',
        value: {
          rel: 'Hyperlink',
          url: pullRequestUrl.trim(),
          attributes: {
            comment: 'Pull Request',
          },
        },
      },
    ]

    const url = this.auth.buildUrl(`/_apis/wit/workItems/${workItemId}`)

    try {
      await this.executeWithResilience('workitem-update', async () => {
        await this.httpClient.patch(url, patchBody, {
          headers: {
            'Content-Type': 'application/json-patch+json',
          },
        })
      })
    } catch (error) {
      ErrorHandler.handleAxiosError(error as AxiosError)
    }
  }

  /**
   * Batch gets multiple work items using the batch processor
   */
  async batchGetWorkItems(ids: number[]): Promise<WorkItem[]> {
    if (ids.length === 0) {
      return []
    }

    const validIds = this.validateAndCleanIds(ids)

    return this.batchProcessor.processBatches(
      validIds,
      async (batch: number[]) => {
        const workItems = await this.getWorkItemsBatch(batch, { expand: 'all' })
        return workItems
      },
    )
  }

  /**
   * Batch gets comments for multiple work items
   */
  async batchGetComments(
    workItemIds: number[],
  ): Promise<Map<number, WorkItemComment[]>> {
    const commentsMap = new Map<number, WorkItemComment[]>()

    if (workItemIds.length === 0) {
      return commentsMap
    }

    const validIds = this.validateAndCleanIds(workItemIds)

    // Process in smaller batches for comments (no batch API available)
    const batchProcessor = createBatchProcessor<
      number,
      { id: number; comments: WorkItemComment[] }
    >(
      {
        batchSize: 10, // Smaller batches for individual API calls
        maxConcurrency: 3,
      },
      this.rateLimiter,
    )

    const results = await batchProcessor.processBatches(
      validIds,
      async (batch: number[]) => {
        const batchResults = await Promise.all(
          batch.map(async (id) => {
            try {
              const comments = await this.getWorkItemComments(id)
              return { id, comments }
            } catch (error) {
              // Skip failed work items but log the error
              console.warn(
                `Failed to fetch comments for work item ${id}:`,
                error,
              )
              return { id, comments: [] }
            }
          }),
        )
        return batchResults
      },
    )

    // Build the map from results
    results.forEach(({ id, comments }) => {
      commentsMap.set(id, comments)
    })

    return commentsMap
  }

  /**
   * Creates and configures the HTTP client
   */
  private createHttpClient(_config: AzureDevOpsClientConfig): AxiosInstance {
    const client = axios.create({
      timeout: 30000,
      headers: this.auth.getAuthHeaders(),
    })

    return client
  }

  /**
   * Gets resilience policy for the given operation type
   */
  private getResiliencePolicy(
    operationType: 'batch' | 'single' | 'query' | 'comment',
  ): ResiliencePolicy {
    const basePolicy = {
      retry: {
        maxAttempts: 3,
        initialDelay: 500,
        maxDelay: 5000,
        backoffStrategy: 'exponential' as const,
        jitterStrategy: 'full-jitter' as const,
      },
      timeout: 30000,
    }

    switch (operationType) {
      case 'batch':
        return {
          ...basePolicy,
          retry: { ...basePolicy.retry, maxAttempts: 5, maxDelay: 10000 },
          timeout: 45000,
          circuitBreaker: {
            key: 'azure-devops-batch',
            failureThreshold: 3,
            recoveryTime: 30000,
            sampleSize: 5,
            halfOpenPolicy: 'single-probe',
          },
        }
      case 'query':
        return {
          ...basePolicy,
          circuitBreaker: {
            key: 'azure-devops-query',
            failureThreshold: 5,
            recoveryTime: 20000,
            sampleSize: 10,
            halfOpenPolicy: 'single-probe',
          },
        }
      case 'comment':
        return {
          ...basePolicy,
          retry: { ...basePolicy.retry, maxAttempts: 2 },
          circuitBreaker: {
            key: 'azure-devops-comment',
            failureThreshold: 3,
            recoveryTime: 15000,
            sampleSize: 5,
            halfOpenPolicy: 'single-probe',
          },
        }
      default: // 'single'
        return {
          ...basePolicy,
          circuitBreaker: {
            key: 'azure-devops-single',
            failureThreshold: 3,
            recoveryTime: 20000,
            sampleSize: 5,
            halfOpenPolicy: 'single-probe',
          },
        }
    }
  }

  /**
   * Executes an HTTP operation with both rate limiting and resilience policies
   */
  private async executeWithResilience<T>(
    operationType: 'batch' | 'single' | 'query' | 'comment',
    operation: () => Promise<T>,
  ): Promise<T> {
    const policy = this.getResiliencePolicy(operationType)

    return this.rateLimiter.execute(async () => {
      return this.resilience.applyPolicy(operation, policy)
    })
  }

  /**
   * Sets up request and response interceptors
   */
  private setupInterceptors(): void {
    // Request interceptor for logging
    this.httpClient.interceptors.request.use((config) => {
      console.debug(
        `Azure DevOps API Request: ${config.method?.toUpperCase()} ${config.url}`,
      )
      return config
    })

    // Response interceptor for rate limit tracking
    this.httpClient.interceptors.response.use(
      (response) => {
        this.rateLimiter.updateFromHeaders(
          response.headers as Record<string, string>,
        )
        console.debug(
          `Azure DevOps API Response: ${response.status} ${response.statusText}`,
        )
        return response
      },
      (error) => {
        if (error.response) {
          this.rateLimiter.updateFromHeaders(
            error.response.headers as Record<string, string>,
          )
          console.debug(
            `Azure DevOps API Error: ${error.response.status} ${error.response.statusText}`,
          )
        }
        return Promise.reject(error)
      },
    )
  }

  /**
   * Validates work item ID
   */
  private validateWorkItemId(id: number): void {
    if (!id || id <= 0) {
      throw new ValidationError('Work item ID must be greater than 0')
    }
  }

  /**
   * Validates and cleans array of work item IDs
   */
  private validateAndCleanIds(ids: number[]): number[] {
    validateBatchInput(
      ids,
      (id) => id > 0,
      'All work item IDs must be greater than 0',
    )

    // Remove duplicates and sort for consistent API calls
    return removeDuplicates(ids, (id) => id).sort((a, b) => a - b)
  }

  /**
   * Gets current rate limit status
   */
  getRateLimitStatus() {
    return this.rateLimiter.getRateLimitStatus()
  }

  /**
   * Gets connection information
   */
  getConnectionInfo() {
    return this.auth.getConnectionInfo()
  }
}
