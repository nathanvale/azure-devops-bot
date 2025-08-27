import {
  ProductionResilienceAdapter,
  type ResiliencePolicy,
} from '@orchestr8/resilience'
import { createPinoLogger } from '@orchestr8/logger'
import type { Logger } from '@orchestr8/logger'
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
import type { UserProfile } from './types/user-profile.js'
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

// Extend Axios config to include metadata for timing
declare module 'axios' {
  interface InternalAxiosRequestConfig {
    metadata?: {
      startTime: number
    }
  }
}

export class AzureDevOpsRestClient implements IAzureDevOpsClient {
  private static hasLoggedEnv = false
  private readonly auth: PATAuth
  private readonly httpClient: AxiosInstance
  private readonly rateLimiter: RateLimiter
  private readonly resilience: ProductionResilienceAdapter
  private readonly batchProcessor: BatchProcessor<number, WorkItem>
  private logger?: Logger
  private isValidated: boolean = false

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
    
    // Check environment to ensure we respect quiet mode
    const isSilent = process.env.LOG_SILENT === 'true'
    
    
    // If LOG_SILENT is true, create a no-op logger immediately to prevent any output
    if (isSilent) {
      const silentLogger: Logger = {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
        trace: () => {},
        fatal: () => {},
        child: () => silentLogger,
        level: 'silent',
      } as any
      this.logger = silentLogger
      // Don't call initializeLogger at all in silent mode
    } else {
      // Initialize logger asynchronously for non-silent mode
      this.initializeLogger()
    }

    this.setupInterceptors()

    // Validate authentication works (async, but don't block constructor)
    // Use setTimeout to ensure it doesn't block the event loop
    setTimeout(() => {
      this.validateConfiguration().catch((error) => {
        this.logger?.warn('Azure DevOps client configuration validation failed - will retry on first operation', {
          error: error instanceof Error ? error.message : String(error),
          operation: 'configuration_validation',
          retryable: true
        })
        
        // Don't log to console in production or quiet mode to avoid spam
        if (process.env.NODE_ENV !== 'production' && process.env.LOG_SILENT !== 'true') {
          console.warn('⚠️  Initial Azure DevOps authentication validation failed - will retry on first operation')
          console.warn('Please verify your AZURE_DEVOPS_PAT and network connectivity')
        }
      })
    }, 100)
  }

  /**
   * Initialize the logger asynchronously
   */
  private async initializeLogger() {
    // Don't initialize a real logger if we're in silent mode - already have no-op
    if (process.env.LOG_SILENT === 'true') {
      return;
    }
    
    try {
      const logLevel = process.env.LOG_LEVEL || 'info';
      
      // Check again for silent mode in case it was set after constructor
      if (process.env.LOG_SILENT === 'true') {
        this.logger = {
          debug: () => {},
          info: () => {},
          warn: () => {},
          error: () => {},
          trace: () => {},
          child: () => this.logger!,
        } as Logger
        return;
      }
      
      this.logger = await createPinoLogger({
        name: 'azure-devops-client',
        level: logLevel as any,
        pretty: process.env.NODE_ENV !== 'production',
        defaultFields: {
          component: 'azure-devops-client',
        },
        redactKeys: ['pat', 'authorization', 'token'],
      })
    } catch (error) {
      // Fallback to console if logger initialization fails
      console.warn('Failed to initialize logger, falling back to console:', error)
      // Create a minimal logger interface
      this.logger = {
        debug: console.debug.bind(console),
        info: console.info.bind(console),
        warn: console.warn.bind(console),
        error: console.error.bind(console),
        trace: console.trace.bind(console),
        child: () => this.logger,
      } as Logger
    }
  }

  /**
   * Validates that the configuration is correct and authentication works
   */
  private async validateConfiguration(): Promise<void> {
    try {
      const result = await this.auth.validateAuthentication()
      if (!result) {
        throw new Error(
          'Azure DevOps authentication validation failed. Please check:\n' +
            '1. Your PAT token is valid and not expired\n' +
            '2. The token has "Work items (read & write)" permissions\n' +
            '3. You have access to the organization and project\n' +
            '4. Your network connection is working',
        )
      }
    } catch (error) {
      // If validateAuthentication threw an error (HTTP error), re-throw it
      // so it can be properly classified instead of using generic error message
      throw error
    }
  }

  /**
   * Ensures authentication is validated before first operation
   */
  private async ensureValidated(): Promise<void> {
    if (!this.isValidated) {
      try {
        await this.validateConfiguration()
        this.isValidated = true
        this.logger?.info('Azure DevOps authentication validated successfully', {
          component: 'azure-devops-client',
          operation: 'authentication_validation',
        })
      } catch (error) {
        this.logger?.error('Azure DevOps authentication validation failed on operation', {
          component: 'azure-devops-client',
          error: error instanceof Error ? error.message : String(error),
          operation: 'authentication_validation',
        })
        throw error
      }
    }
  }

  /**
   * Gets the current user profile for authentication validation
   */
  async getCurrentUserProfile(): Promise<UserProfile> {
    await this.ensureValidated()
    
    // Use the VSSPs profile endpoint which is the correct one for user profiles
    const url = `https://vssps.dev.azure.com/${this.auth.organization}/_apis/profile/profiles/me?api-version=7.1-preview.3`

    try {
      return await this.executeWithResilience('single', async () => {
        const response = await this.httpClient.get<UserProfile>(url)
        return response.data
      })
    } catch (error) {
      ErrorHandler.handleAxiosError(error as AxiosError)
    }
  }

  /**
   * Gets the current user profile directly without validation - used for authentication validation
   */
  async getCurrentUserProfileDirect(): Promise<UserProfile> {
    // Use the VSSPs profile endpoint which is the correct one for user profiles
    const url = `https://vssps.dev.azure.com/${this.auth.organization}/_apis/profile/profiles/me?api-version=7.1-preview.3`

    try {
      const response = await this.httpClient.get<UserProfile>(url)
      return response.data
    } catch (error) {
      // Don't use ErrorHandler here - let the raw HTTP error bubble up for proper classification
      throw error
    }
  }

  /**
   * Gets a single work item by ID
   */
  async getWorkItem(id: number, expand?: WorkItemExpand): Promise<WorkItem> {
    await this.ensureValidated()
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
    await this.ensureValidated()
    const startTime = Date.now()
    
    if (!ids || ids.length === 0) {
      this.logger?.debug('Batch request with empty IDs', {
        operation: 'batch_get_work_items',
        requestedCount: 0,
        validCount: 0
      })
      return []
    }

    // Validate and clean IDs
    const validIds = this.validateAndCleanIds(ids)
    
    this.logger?.debug('Starting batch work item fetch', {
      operation: 'batch_get_work_items',
      requestedCount: ids.length,
      validCount: validIds.length,
      batchSize: validIds.length,
      expand: options?.expand,
      fields: options?.fields?.length || 'all'
    })

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
      const result = await this.executeWithResilience('batch', async () => {
        const response = await this.httpClient.get<WorkItemBatchResponse>(url)
        
        this.logger?.debug('Batch API response received', {
          operation: 'batch_get_work_items',
          statusCode: response.status,
          itemsReceived: response.data.value?.length || 0,
          responseSize: JSON.stringify(response.data).length,
          durationMs: Date.now() - startTime
        })
        
        return response.data.value
      })
      
      this.logger?.info('Batch work item fetch completed successfully', {
        operation: 'batch_get_work_items',
        requestedCount: validIds.length,
        fetchedCount: result.length,
        durationMs: Date.now() - startTime,
        success: true
      })
      
      return result
    } catch (error) {
      this.logger?.error('Batch work item fetch failed', {
        operation: 'batch_get_work_items',
        requestedCount: validIds.length,
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
        url: url,
        retryable: true
      })
      
      if (options?.errorPolicy === 'omit') {
        this.logger?.warn('Returning empty array due to error policy', {
          operation: 'batch_get_work_items',
          errorPolicy: 'omit',
          fallbackCount: 0
        })
        return []
      }
      
      ErrorHandler.handleAxiosError(error as AxiosError)
    }
  }

  /**
   * Executes a WIQL query to get work item references
   */
  async queryWorkItems(wiql: string): Promise<WorkItemQueryResult> {
    await this.ensureValidated()
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
    await this.ensureValidated()
    this.validateWorkItemId(workItemId)

    const url = this.auth.buildUrl(
      `/_apis/wit/workItems/${workItemId}/comments`,
      { 'api-version': '7.0-preview.4' }
    )
    try {
      // Use direct HTTP call for comments API (bypassing resilience system due to compatibility issues)
      const response = await this.httpClient.get<WorkItemCommentsResponse>(url)
      return response.data.comments || []
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
      await this.executeWithResilience('single', async () => {
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
        maxAttempts: 2, // Reduced from 3 to 2
        initialDelay: 1500, // Increased initial delay
        maxDelay: 12000, // Increased max delay
        backoffStrategy: 'exponential' as const,
        jitterStrategy: 'full-jitter' as const,
        retryOn: (error: any) => {
          // Never retry authentication errors (401, 403)
          const status = error.response?.status || error.statusCode || error.status
          if (status === 401 || status === 403) {
            return false
          }
          // Retry server errors and network errors
          return status >= 500 || !status
        }
      },
      timeout: 45000, // Increased timeout
    }

    switch (operationType) {
      case 'batch':
        return {
          ...basePolicy,
          retry: { ...basePolicy.retry, maxAttempts: 2, maxDelay: 20000 }, // Reduced attempts but increased delay
          timeout: 90000, // Increased timeout for batch operations
          circuitBreaker: {
            key: 'azure-devops-batch',
            failureThreshold: 12, // Increased tolerance for batch operations
            recoveryTime: 120000, // 2 minutes recovery time
            sampleSize: 20, // Larger sample size
            halfOpenPolicy: 'single-probe',
          },
        }
      case 'query':
        return {
          ...basePolicy,
          circuitBreaker: {
            key: 'azure-devops-query',
            failureThreshold: 8, // Increased tolerance
            recoveryTime: 45000, // Longer recovery
            sampleSize: 15,
            halfOpenPolicy: 'single-probe',
          },
        }
      case 'comment':
        return {
          ...basePolicy,
          retry: { ...basePolicy.retry, maxAttempts: 2 }, // Keep at 2 for comments
          circuitBreaker: {
            key: 'azure-devops-comment',
            failureThreshold: 5, // Increased tolerance
            recoveryTime: 30000, // Longer recovery
            sampleSize: 8,
            halfOpenPolicy: 'single-probe',
          },
        }
      default: // 'single'
        return {
          ...basePolicy,
          circuitBreaker: {
            key: 'azure-devops-single',
            failureThreshold: 6, // Increased tolerance
            recoveryTime: 45000, // Longer recovery
            sampleSize: 10, // Larger sample
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
    // Check again for silent mode
    const isSilent = process.env.LOG_SILENT === 'true'
    
    // Don't set up logging interceptors in silent mode
    if (isSilent) {
      // Just set up rate limit tracking without logging
      this.httpClient.interceptors.response.use(
        (response) => {
          this.rateLimiter.updateFromHeaders(
            response.headers as Record<string, string>,
          )
          return response
        },
        (error) => {
          if (error.response?.headers) {
            this.rateLimiter.updateFromHeaders(
              error.response.headers as Record<string, string>,
            )
          }
          return Promise.reject(ErrorHandler.handleAxiosError(error))
        }
      )
      return
    }
    
    // Request interceptor for structured logging (non-silent mode)
    this.httpClient.interceptors.request.use((config) => {
      const startTime = Date.now()
      config.metadata = { startTime } // Store start time for duration calculation
      
      this.logger?.debug('Azure DevOps API request initiated', {
        method: config.method?.toUpperCase(),
        url: config.url,
        baseURL: config.baseURL,
        timeout: config.timeout,
        operation: 'http_request',
        requestId: Math.random().toString(36).substr(2, 9)
      })
      
      // Also log to console for immediate visibility (only in debug mode)
      // Skip console debug in silent mode
      if (process.env.LOG_LEVEL === 'debug' && process.env.LOG_SILENT !== 'true') {
        console.debug(`Azure DevOps API Request: ${config.method?.toUpperCase()} ${config.url}`)
      }
      
      return config
    })

    // Response interceptor for rate limit tracking and logging
    this.httpClient.interceptors.response.use(
      (response) => {
        const duration = response.config.metadata?.startTime 
          ? Date.now() - response.config.metadata.startTime 
          : undefined
          
        this.rateLimiter.updateFromHeaders(
          response.headers as Record<string, string>,
        )
        
        this.logger?.debug('Azure DevOps API response received', {
          method: response.config.method?.toUpperCase(),
          url: response.config.url,
          status: response.status,
          statusText: response.statusText,
          contentLength: response.headers['content-length'],
          rateLimitRemaining: response.headers['x-ratelimit-remaining'],
          durationMs: duration,
          operation: 'http_response',
          success: true
        })
        
        // Also log to console for immediate visibility (only in debug mode)
        // Skip console debug in silent mode
        if (process.env.LOG_LEVEL === 'debug' && process.env.LOG_SILENT !== 'true') {
          console.debug(`Azure DevOps API Response: ${response.status} ${response.statusText}`)
        }
        
        return response
      },
      (error) => {
        const duration = error.config?.metadata?.startTime 
          ? Date.now() - error.config.metadata.startTime 
          : undefined
          
        if (error.response) {
          this.rateLimiter.updateFromHeaders(
            error.response.headers as Record<string, string>,
          )
          
          this.logger?.warn('Azure DevOps API request failed', {
            method: error.config?.method?.toUpperCase(),
            url: error.config?.url,
            status: error.response.status,
            statusText: error.response.statusText,
            rateLimitRemaining: error.response.headers['x-ratelimit-remaining'],
            durationMs: duration,
            operation: 'http_error',
            retryable: error.response.status >= 500 || error.response.status === 429,
            error: error.message
          })
          
          // Skip console debug in silent mode
          if (process.env.LOG_LEVEL === 'debug' && process.env.LOG_SILENT !== 'true') {
            console.debug(`Azure DevOps API Error: ${error.response.status} ${error.response.statusText}`)
          }
        } else {
          this.logger?.error('Azure DevOps API request network error', {
            method: error.config?.method?.toUpperCase(),
            url: error.config?.url,
            durationMs: duration,
            operation: 'http_network_error',
            error: error.message,
            code: error.code
          })
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
