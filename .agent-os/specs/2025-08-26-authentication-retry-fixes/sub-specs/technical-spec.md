# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-08-26-authentication-retry-fixes/spec.md

> Created: 2025-08-26
> Version: 1.0.0

## Technical Requirements

### Blocking Authentication Validation

- PAT token validation must be synchronous and block sync operations on failure
- Authentication errors should not allow any work item processing to continue
- Validation should occur before any Azure DevOps API calls are attempted
- Failed authentication should return structured error with specific failure reason

### Circuit Breaker Reconfiguration

- Authentication errors: Trip after 3 consecutive failures (currently 12/20)
- Network/timeout errors: Trip after 12 consecutive failures (maintain current)
- Rate limiting errors: Trip after 5 consecutive failures (new threshold)
- Circuit breaker state should be error-type specific

### Error Classification System

- **AuthenticationError**: Invalid PAT token, expired token, insufficient permissions
- **RateLimitError**: HTTP 429 responses, X-RateLimit-Remaining: 0
- **NetworkError**: Connection timeouts, DNS failures, network unreachable
- **ServerError**: HTTP 5xx responses from Azure DevOps
- **ValidationError**: Invalid input parameters, malformed requests

### Retry Strategy Implementation

- **AuthenticationError**: No retries (fail immediately)
- **RateLimitError**: Exponential backoff based on X-RateLimit-Reset header
- **NetworkError**: 3 retries with exponential backoff (1s, 2s, 4s)
- **ServerError**: 2 retries with linear backoff (2s, 4s)
- **ValidationError**: No retries (fail immediately)

## Approach Options

**Option A: Modify Existing Error Handling**

- Pros: Minimal code changes, maintains current architecture
- Cons: Doesn't address fundamental issue of non-blocking authentication

**Option B: Implement Pre-flight Authentication Check** (Selected)

- Pros: Prevents cascade failures, clear separation of concerns, fail-fast principle
- Cons: Additional API call overhead for authentication validation

**Option C: Reactive Error Handling Only**

- Pros: No additional API calls, lightweight implementation
- Cons: Still allows cascade failures to begin before detection

**Rationale:** Option B provides the most reliable solution by preventing cascade failures entirely. The slight overhead of pre-flight authentication validation is negligible compared to processing hundreds of doomed requests.

## External Dependencies

Implementation uses existing @orchestr8 packages:

- **@orchestr8/resilience** - ProductionResilienceAdapter with ResiliencePolicy configuration
- **@orchestr8/logger** - Structured logging with createLogger API
- **azure-devops-client** package for API calls

## Implementation Details

### 1. Authentication Validation Service with @orchestr8/logger Integration

```typescript
// src/services/auth-validation.ts
import { createLogger, type Logger } from '@orchestr8/logger'
import type { ResiliencePolicy } from '@orchestr8/schema'
import { ProductionResilienceAdapter } from '@orchestr8/resilience'

export interface AuthValidationResult {
  success: boolean
  error?: AuthenticationError
  profile?: UserProfile
}

export interface UserProfile {
  id: string
  displayName: string
  emailAddress: string
  domain: string
}

// Resilience policy specifically for authentication validation
const authValidationPolicy: ResiliencePolicy = {
  retry: {
    maxAttempts: 1, // No retries for auth validation
    initialDelay: 0,
    maxDelay: 0,
    backoffStrategy: 'fixed',
    retryOn: () => false, // Never retry authentication
  },
  circuitBreaker: {
    key: 'azure-devops-auth', // Explicit key for auth circuit
    failureThreshold: 3, // Trip after 3 failures
    recoveryTime: 300000, // 5 minutes
    sampleSize: 10, // Minimum required
    halfOpenPolicy: 'single-probe',
  },
  timeout: {
    duration: 30000, // 30 second timeout
    operationName: 'authentication-validation',
  },
}

export class AuthValidationService {
  private logger: Logger
  private resilienceAdapter: ProductionResilienceAdapter

  constructor(private client: AzureDevOpsClient) {
    this.initializeServices()
  }

  private async initializeServices() {
    this.logger = await createLogger({
      name: 'azure-devops-auth',
      defaultFields: {
        service: 'azure-devops-bot',
        component: 'authentication',
      },
    })

    this.resilienceAdapter = new ProductionResilienceAdapter({
      telemetry: this.createResilienceTelemetry(),
    })
  }

  /**
   * Validates PAT token using @orchestr8/resilience for proper error handling
   * This is a lightweight operation that confirms authentication works
   */
  async validateAuthentication(): Promise<AuthValidationResult> {
    const start = performance.now()
    this.logger.info('Starting authentication validation')

    try {
      const profile = await this.resilienceAdapter.applyNormalizedPolicy(
        () => this.client.getCurrentUserProfile(),
        authValidationPolicy,
        'retry-cb-timeout',
      )

      this.logger.info('Authentication successful', {
        userId: profile.id,
        userEmail: profile.emailAddress,
        duration: performance.now() - start,
      })

      return {
        success: true,
        profile,
      }
    } catch (error) {
      const classified = ErrorClassifier.classify(error)

      this.logger.error('Authentication failed', {
        errorType: classified.type,
        errorCode: classified.code,
        retryable: classified.retryable,
        httpStatus: error.status,
        duration: performance.now() - start,
      })

      return {
        success: false,
        error: this.classifyAuthError(error),
      }
    }
  }

  private classifyAuthError(error: any): AuthenticationError {
    if (error.status === 401) {
      return new AuthenticationError(
        'INVALID_TOKEN',
        'PAT token is invalid or expired. Please verify your AZURE_DEVOPS_PAT environment variable.',
      )
    }
    if (error.status === 403) {
      return new AuthenticationError(
        'INSUFFICIENT_PERMISSIONS',
        'PAT token lacks required permissions. Please ensure the token has "Work Items (read)" permission.',
      )
    }
    return new AuthenticationError(
      'AUTH_FAILED',
      `Authentication failed: ${error.message}. Check network connectivity and PAT token validity.`,
    )
  }

  private createResilienceTelemetry() {
    return {
      onRetry: (attempt: number, error: Error) => {
        this.logger.warn('Auth validation retry', {
          attempt,
          error: error.message,
        })
      },
      onCircuitOpen: (key: string) => {
        this.logger.error('Auth circuit breaker opened', { key })
      },
      onCircuitClose: (key: string) => {
        this.logger.info('Auth circuit breaker closed', { key })
      },
    }
  }
}
```

### 2. Error Classification System for @orchestr8/resilience Integration

```typescript
// src/utils/error-classification.ts
export enum ErrorType {
  AUTHENTICATION = 'AUTHENTICATION',
  RATE_LIMIT = 'RATE_LIMIT',
  NETWORK = 'NETWORK',
  SERVER = 'SERVER',
  VALIDATION = 'VALIDATION',
}

export interface ClassifiedError {
  type: ErrorType
  code: string
  message: string
  retryable: boolean
  retryDelayMs?: number
  originalError: Error
}

/**
 * Error classifier that works with @orchestr8/resilience retry predicates
 * Used in RetryOn functions for intelligent error-type-aware retry decisions
 */
export class ErrorClassifier {
  static classify(error: any): ClassifiedError {
    // Authentication errors (401, 403)
    if (error.status === 401 || error.status === 403) {
      return {
        type: ErrorType.AUTHENTICATION,
        code:
          error.status === 401 ? 'INVALID_TOKEN' : 'INSUFFICIENT_PERMISSIONS',
        message: this.getAuthErrorMessage(error.status),
        retryable: false,
        originalError: error,
      }
    }

    // Rate limiting errors (429)
    if (error.status === 429) {
      const resetTime = error.headers?.['x-ratelimit-reset']
      const retryAfter = error.headers?.['retry-after']
      const delayMs = this.calculateRateLimitDelay(resetTime, retryAfter)

      return {
        type: ErrorType.RATE_LIMIT,
        code: 'RATE_LIMITED',
        message: `Rate limit exceeded. Server requests retry after ${delayMs}ms`,
        retryable: true,
        retryDelayMs: delayMs,
        originalError: error,
      }
    }

    // Network errors (connection issues, timeouts)
    if (this.isNetworkError(error)) {
      return {
        type: ErrorType.NETWORK,
        code: 'NETWORK_ERROR',
        message: `Network connectivity issue: ${error.code || error.message}`,
        retryable: true,
        retryDelayMs: 1000, // Base delay for exponential backoff
        originalError: error,
      }
    }

    // Server errors (5xx)
    if (error.status >= 500 && error.status < 600) {
      return {
        type: ErrorType.SERVER,
        code: 'SERVER_ERROR',
        message: `Azure DevOps server error: ${error.status} ${error.statusText}`,
        retryable: true,
        retryDelayMs: 2000, // Base delay for server errors
        originalError: error,
      }
    }

    // Client validation errors (4xx except 401, 403, 429)
    if (error.status >= 400 && error.status < 500) {
      return {
        type: ErrorType.VALIDATION,
        code: 'CLIENT_ERROR',
        message: `Request validation failed: ${error.status} ${error.statusText}`,
        retryable: false,
        originalError: error,
      }
    }

    // Unknown errors - treat as non-retryable for safety
    return {
      type: ErrorType.VALIDATION,
      code: 'UNKNOWN_ERROR',
      message: `Unclassified error: ${error.message || 'Unknown error occurred'}`,
      retryable: false,
      originalError: error,
    }
  }

  /**
   * Creates a retry predicate function for @orchestr8/resilience
   * Used in ResiliencePolicy.retry.retryOn configuration
   */
  static createRetryPredicate() {
    return (error: unknown): boolean => {
      const classified = ErrorClassifier.classify(error)

      // Log the classification for observability
      console.debug(
        `Error classified as ${classified.type}, retryable: ${classified.retryable}`,
      )

      return classified.retryable
    }
  }

  /**
   * Checks if error represents a network connectivity issue
   */
  private static isNetworkError(error: any): boolean {
    return (
      error.code === 'ECONNRESET' ||
      error.code === 'ECONNREFUSED' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'ENOTFOUND' ||
      error.code === 'ECONNABORTED' ||
      !error.status // No HTTP status usually indicates network issue
    )
  }

  /**
   * Calculates delay for rate limit retries using Azure DevOps headers
   */
  private static calculateRateLimitDelay(
    resetTime?: string,
    retryAfter?: string,
  ): number {
    if (retryAfter) {
      // Retry-After header in seconds
      return Math.min(parseInt(retryAfter) * 1000, 300000) // Max 5 minutes
    }

    if (resetTime) {
      // X-RateLimit-Reset as Unix timestamp
      const resetTimestamp = parseInt(resetTime) * 1000
      const now = Date.now()
      return Math.max(1000, Math.min(resetTimestamp - now, 300000)) // Min 1s, max 5min
    }

    return 60000 // Default 1 minute delay if no headers
  }

  /**
   * Creates user-friendly authentication error messages
   */
  private static getAuthErrorMessage(status: number): string {
    if (status === 401) {
      return 'PAT token is invalid or expired. Please verify AZURE_DEVOPS_PAT environment variable contains a valid Personal Access Token.'
    }
    if (status === 403) {
      return 'PAT token lacks required permissions. Please ensure the token has "Work Items (read)" scope enabled in Azure DevOps.'
    }
    return 'Authentication failed with unexpected error. Please check PAT token and network connectivity.'
  }
}
```

### 3. Resilience Policies Using @orchestr8/resilience

```typescript
// src/utils/resilience-policies.ts
import type { ResiliencePolicy } from '@orchestr8/schema'
import { ErrorClassifier } from './error-classification.js'

/**
 * Pre-configured resilience policies that align with actual @orchestr8/resilience API
 * Each policy uses proper schema with retry predicates for error-type-aware behavior
 */

// Policy for authentication operations - fail fast, no retries
export const authenticationPolicy: ResiliencePolicy = {
  retry: {
    maxAttempts: 1, // No retries for authentication
    initialDelay: 0,
    maxDelay: 0,
    backoffStrategy: 'fixed',
    jitterStrategy: 'none',
    retryOn: (error: unknown) => {
      const classified = ErrorClassifier.classify(error)
      return false // Never retry authentication operations
    },
  },
  circuitBreaker: {
    key: 'azure-devops-auth',
    failureThreshold: 3, // Trip after 3 failures
    recoveryTime: 300000, // 5 minutes
    sampleSize: 10,
    halfOpenPolicy: 'single-probe',
  },
  timeout: {
    duration: 30000,
    operationName: 'authentication',
  },
}

// Policy for data sync operations - smart retry with error type awareness
export const syncOperationsPolicy: ResiliencePolicy = {
  retry: {
    maxAttempts: 5, // Maximum retries across all error types
    initialDelay: 1000, // 1 second base delay
    maxDelay: 30000, // 30 second maximum
    backoffStrategy: 'exponential',
    jitterStrategy: 'full', // Prevent thundering herd
    retryOn: (error: unknown) => {
      const classified = ErrorClassifier.classify(error)

      switch (classified.type) {
        case 'AUTHENTICATION':
        case 'VALIDATION':
          return false // Never retry auth/validation errors
        case 'RATE_LIMIT':
        case 'NETWORK':
        case 'SERVER':
          return true // Retry network/server issues
        default:
          return false // Conservative default
      }
    },
  },
  circuitBreaker: {
    key: 'azure-devops-sync',
    failureThreshold: 0.5, // 50% failure rate (better than count)
    recoveryTime: 60000, // 1 minute recovery
    sampleSize: 10, // Statistical significance
    halfOpenPolicy: 'single-probe',
  },
  timeout: {
    duration: 120000, // 2 minutes for sync operations
    operationName: 'work-item-sync',
  },
}

// Policy for batch work item operations - optimized for bulk processing
export const batchOperationsPolicy: ResiliencePolicy = {
  retry: {
    maxAttempts: 3, // Fewer retries for batch ops
    initialDelay: 2000, // 2 second base delay
    maxDelay: 15000, // 15 second maximum
    backoffStrategy: 'exponential',
    jitterStrategy: 'decorrelated', // Better for batch operations
    retryOn: ErrorClassifier.createRetryPredicate(),
  },
  circuitBreaker: {
    key: 'azure-devops-batch',
    failureThreshold: 0.3, // 30% failure rate for batch
    recoveryTime: 30000, // 30 seconds recovery
    sampleSize: 15, // Larger sample for batch operations
    halfOpenPolicy: 'single-probe',
  },
  timeout: {
    duration: 180000, // 3 minutes for batch operations
    operationName: 'batch-processing',
  },
}

// Policy for rate-limited operations - respects server timing
export const rateLimitAwarePolicy: ResiliencePolicy = {
  retry: {
    maxAttempts: 5,
    initialDelay: 1000, // Will be overridden by rate limit headers
    maxDelay: 300000, // 5 minutes maximum (Azure DevOps max)
    backoffStrategy: 'fixed', // Use exact delays from headers
    jitterStrategy: 'none', // No jitter for rate limit delays
    retryOn: (error: unknown) => {
      const classified = ErrorClassifier.classify(error)

      // Only retry rate limit and network errors
      return (
        classified.type === 'RATE_LIMIT' ||
        classified.type === 'NETWORK' ||
        classified.type === 'SERVER'
      )
    },
  },
  circuitBreaker: {
    key: 'azure-devops-rate-limit',
    failureThreshold: 0.8, // High threshold for rate limits (80%)
    recoveryTime: 600000, // 10 minutes for rate limit recovery
    sampleSize: 20, // Larger sample for rate limit detection
    halfOpenPolicy: 'single-probe',
  },
  timeout: {
    duration: 300000, // 5 minutes for rate-limited operations
    operationName: 'rate-limited-operation',
  },
}

/**
 * Policy selector based on operation type
 */
export class ResiliencePolicySelector {
  static getPolicy(
    operationType: 'auth' | 'sync' | 'batch' | 'rateLimit',
  ): ResiliencePolicy {
    switch (operationType) {
      case 'auth':
        return authenticationPolicy
      case 'sync':
        return syncOperationsPolicy
      case 'batch':
        return batchOperationsPolicy
      case 'rateLimit':
        return rateLimitAwarePolicy
      default:
        return syncOperationsPolicy // Safe default
    }
  }
}
```

### 4. Enhanced Sync Service with @orchestr8/resilience Integration

```typescript
// src/services/enhanced-sync-service.ts
import { createLogger, type Logger } from '@orchestr8/logger'
import { ProductionResilienceAdapter } from '@orchestr8/resilience'
import { ResiliencePolicySelector } from '../utils/resilience-policies.js'
import {
  ErrorClassifier,
  type ClassifiedError,
} from '../utils/error-classification.js'
import { AuthValidationService } from './auth-validation.js'

/**
 * Enhanced sync service that uses @orchestr8/resilience for proper error handling
 * Implements blocking authentication and intelligent retry strategies
 */
export class EnhancedSyncService {
  private logger: Logger
  private resilienceAdapter: ProductionResilienceAdapter
  private authValidationService: AuthValidationService

  constructor(
    private client: AzureDevOpsClient,
    private databaseService: DatabaseService,
  ) {
    this.initializeServices()
  }

  private async initializeServices() {
    // Initialize structured logger with proper fields
    this.logger = await createLogger({
      name: 'azure-devops-sync',
      level: 'info',
      defaultFields: {
        service: 'azure-devops-bot',
        component: 'sync-service',
      },
    })

    // Create resilience adapter with telemetry integration
    this.resilienceAdapter = new ProductionResilienceAdapter({
      telemetry: this.createResilienceTelemetry(),
    })

    this.authValidationService = new AuthValidationService(this.client)
  }

  /**
   * Main sync operation with blocking authentication validation
   * Prevents cascade failures by validating auth before any processing
   */
  async syncAllWorkItems(): Promise<void> {
    const start = performance.now()

    this.logger.info('Starting work item sync with authentication validation')

    try {
      // BLOCKING authentication validation - prevents cascade failures
      await this.validateAuthenticationBlocking()

      // Execute sync operations with resilience policies
      await this.resilienceAdapter.applyNormalizedPolicy(
        () => this.performSyncOperations(),
        ResiliencePolicySelector.getPolicy('sync'),
        'retry-cb-timeout',
      )

      this.logger.info('Sync completed successfully', {
        duration: performance.now() - start,
      })
    } catch (error) {
      const classified = ErrorClassifier.classify(error)

      this.logger.error('Sync failed', {
        errorType: classified.type,
        errorCode: classified.code,
        retryable: classified.retryable,
        duration: performance.now() - start,
      })

      throw new Error(`Sync operation failed: ${classified.message}`)
    }
  }

  /**
   * Blocking authentication validation that prevents any processing on auth failure
   * Uses dedicated authentication resilience policy
   */
  private async validateAuthenticationBlocking(): Promise<void> {
    this.logger.info('Performing blocking authentication validation')

    const authResult = await this.resilienceAdapter.applyNormalizedPolicy(
      () => this.authValidationService.validateAuthentication(),
      ResiliencePolicySelector.getPolicy('auth'),
      'retry-cb-timeout',
    )

    if (!authResult.success) {
      const errorMsg =
        `Authentication validation failed: ${authResult.error?.message}. ` +
        'All sync operations cancelled to prevent cascade failures.'

      this.logger.error('Authentication validation failed', {
        errorCode: authResult.error?.code,
        preventedCascadeFailure: true,
      })

      throw new Error(errorMsg)
    }

    this.logger.info('Authentication validated successfully', {
      user: authResult.profile?.displayName,
      email: authResult.profile?.emailAddress,
    })
  }

  /**
   * Performs actual sync operations with error-aware processing
   */
  private async performSyncOperations(): Promise<void> {
    const start = performance.now()

    // Fetch work item IDs first
    const workItemIds = await this.resilienceAdapter.applyNormalizedPolicy(
      () => this.client.fetchWorkItemIds(),
      ResiliencePolicySelector.getPolicy('sync'),
      'retry-cb-timeout',
    )

    this.logger.info('Fetched work item IDs', { count: workItemIds.length })

    // Process work items in batches with batch-specific resilience policy
    const batches = this.createBatches(workItemIds, 200)
    let processedCount = 0

    for (const [index, batchIds] of batches.entries()) {
      try {
        await this.resilienceAdapter.applyNormalizedPolicy(
          () => this.processBatch(batchIds),
          ResiliencePolicySelector.getPolicy('batch'),
          'retry-cb-timeout',
        )

        processedCount += batchIds.length

        this.logger.info('Batch processed successfully', {
          batchIndex: index + 1,
          totalBatches: batches.length,
          batchSize: batchIds.length,
          totalProcessed: processedCount,
        })
      } catch (error) {
        const classified = ErrorClassifier.classify(error)

        this.logger.error('Batch processing failed', {
          batchIndex: index + 1,
          errorType: classified.type,
          errorCode: classified.code,
          retryable: classified.retryable,
        })

        // For batch failures, continue with next batch unless it's auth error
        if (classified.type === 'AUTHENTICATION') {
          throw error // Auth errors should stop entire sync
        }

        // Log but continue with other batches for other error types
        continue
      }
    }

    this.logger.info('Sync operations completed', {
      totalItems: workItemIds.length,
      processedItems: processedCount,
      duration: performance.now() - start,
    })
  }

  /**
   * Process a single batch of work items
   */
  private async processBatch(workItemIds: number[]): Promise<void> {
    const workItems = await this.client.fetchWorkItemsBatch(workItemIds)
    await this.databaseService.storeWorkItems(workItems)
  }

  /**
   * Creates batches from work item IDs
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = []
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize))
    }
    return batches
  }

  /**
   * Creates telemetry integration for resilience adapter
   */
  private createResilienceTelemetry() {
    return {
      onRetry: (attempt: number, error: Error, operationName?: string) => {
        const classified = ErrorClassifier.classify(error)
        this.logger.warn('Operation retry', {
          operation: operationName,
          attempt,
          errorType: classified.type,
          errorCode: classified.code,
        })
      },

      onCircuitOpen: (key: string, failures: number) => {
        this.logger.error('Circuit breaker opened', {
          circuitKey: key,
          failureCount: failures,
        })
      },

      onCircuitClose: (key: string) => {
        this.logger.info('Circuit breaker closed', {
          circuitKey: key,
        })
      },

      onTimeout: (duration: number, operationName?: string) => {
        this.logger.warn('Operation timeout', {
          operation: operationName,
          timeoutMs: duration,
        })
      },
    }
  }
}
```

### 5. Updated Azure DevOps Client Integration

```typescript
// src/packages/azure-devops-client/src/client.ts modifications
import { ProductionResilienceAdapter } from '@orchestr8/resilience'
import { createLogger, type Logger } from '@orchestr8/logger'
import { ResiliencePolicySelector } from '../../utils/resilience-policies.js'
import { ErrorClassifier } from '../../utils/error-classification.js'

/**
 * Updates to the existing AzureDevOpsRestClient to use proper @orchestr8 patterns
 * Replaces the custom retry/circuit breaker logic with standard resilience policies
 */
export class AzureDevOpsRestClient implements IAzureDevOpsClient {
  private readonly auth: PATAuth
  private readonly httpClient: AxiosInstance
  private readonly rateLimiter: RateLimiter
  private readonly resilienceAdapter: ProductionResilienceAdapter
  private readonly batchProcessor: BatchProcessor<number, WorkItem>
  private logger: Logger

  // Remove the old resilience field and replace with proper adapter
  constructor(config: AzureDevOpsClientConfig) {
    this.auth = new PATAuth(config)
    this.rateLimiter = new RateLimiter(config.rateLimit)
    this.httpClient = this.createHttpClient(config)
    this.batchProcessor = createBatchProcessor<number, WorkItem>(
      {
        batchSize: 200,
        maxConcurrency: 3,
      },
      this.rateLimiter,
    )

    this.initializeServices()
    this.setupInterceptors()
  }

  private async initializeServices() {
    // Initialize logger first
    this.logger = await createLogger({
      name: 'azure-devops-client',
      level: 'debug',
      defaultFields: {
        service: 'azure-devops-bot',
        component: 'rest-client',
      },
    })

    // Initialize resilience adapter with telemetry
    this.resilienceAdapter = new ProductionResilienceAdapter({
      telemetry: {
        onRetry: (attempt: number, error: Error, operationName?: string) => {
          const classified = ErrorClassifier.classify(error)
          this.logger.warn('Client operation retry', {
            operation: operationName,
            attempt,
            errorType: classified.type,
          })
        },
        onCircuitOpen: (key: string) => {
          this.logger.error('Client circuit breaker opened', { key })
        },
        onCircuitClose: (key: string) => {
          this.logger.info('Client circuit breaker closed', { key })
        },
      },
    })
  }

  /**
   * Updated method using resilience policies instead of custom retry logic
   */
  async getCurrentUserProfile(): Promise<UserProfile> {
    return this.resilienceAdapter.applyNormalizedPolicy(
      async () => {
        const response = await this.httpClient.get(
          this.auth.buildUrl('/_apis/profile/profiles/me'),
          { headers: this.auth.getAuthHeaders() },
        )
        return this.transformUserProfile(response.data)
      },
      ResiliencePolicySelector.getPolicy('auth'),
      'retry-cb-timeout',
    )
  }

  /**
   * Updated work item fetching with proper resilience policies
   */
  async getWorkItem(id: number, expand?: WorkItemExpand[]): Promise<WorkItem> {
    return this.resilienceAdapter.applyNormalizedPolicy(
      async () => {
        const expandParam = expand?.join(',') || 'All'
        const url = this.auth.buildUrl(`/_apis/wit/workitems/${id}`, {
          $expand: expandParam,
        })

        const response = await this.httpClient.get(url, {
          headers: this.auth.getAuthHeaders(),
        })

        return this.transformWorkItem(response.data)
      },
      ResiliencePolicySelector.getPolicy('sync'),
      'retry-cb-timeout',
    )
  }

  /**
   * Batch work item fetching with batch-specific resilience policy
   */
  async getWorkItemsBatch(
    ids: number[],
    expand?: WorkItemExpand[],
  ): Promise<WorkItem[]> {
    return this.resilienceAdapter.applyNormalizedPolicy(
      async () => {
        const expandParam = expand?.join(',') || 'All'
        const url = this.auth.buildUrl('/_apis/wit/workitems', {
          ids: ids.join(','),
          $expand: expandParam,
        })

        const response = await this.httpClient.get(url, {
          headers: this.auth.getAuthHeaders(),
        })

        const batchResponse = response.data as WorkItemBatchResponse
        return batchResponse.value.map((item) => this.transformWorkItem(item))
      },
      ResiliencePolicySelector.getPolicy('batch'),
      'retry-cb-timeout',
    )
  }

  /**
   * Rate-limited operations use specialized policy
   */
  async queryWorkItems(wiql: string): Promise<WorkItemQueryResult> {
    return this.resilienceAdapter.applyNormalizedPolicy(
      async () => {
        const url = this.auth.buildUrl('/_apis/wit/wiql')
        const response = await this.httpClient.post(
          url,
          { query: wiql },
          { headers: this.auth.getAuthHeaders() },
        )
        return this.transformQueryResult(response.data)
      },
      ResiliencePolicySelector.getPolicy('rateLimit'),
      'retry-cb-timeout',
    )
  }

  // ... rest of the existing methods updated to use resilienceAdapter
}
```

## Performance Considerations

- **Pre-flight Authentication**: Adds ~200ms overhead but prevents minutes of failed processing (178 × 3 retries = 534 prevented failures)
- **@orchestr8/resilience Overhead**: ~5ms per operation for policy evaluation, negligible compared to network latency
- **Circuit Breaker Memory**: ~50 bytes per circuit key, scales with number of operation types
- **Structured Logging**: ~2ms overhead per log entry, provides valuable observability
- **Rate Limit Compliance**: Uses server-specified delays, prevents unnecessary API consumption

## Security Considerations

- **PAT Token Validation**: Uses lightweight profile endpoint (`/_apis/profile/profiles/me`), minimal data exposure
- **Error Message Sanitization**: @orchestr8/logger automatically redacts sensitive fields
- **Circuit Breaker Keys**: Use non-sensitive operation names, no data leakage
- **Structured Logging**: Sensitive tokens automatically redacted by @orchestr8/logger configuration
- **Authentication Errors**: Provide actionable guidance without exposing system internals

## Monitoring and Observability

- **@orchestr8/resilience Telemetry**: Built-in metrics for retry attempts, circuit states, timeouts
- **Structured Logging**: Consistent error classification, timing data, user context
- **Circuit Breaker Health**: Real-time status of authentication, sync, batch, and rate-limit circuits
- **Error Distribution**: Automatic categorization by type (AUTH, RATE_LIMIT, NETWORK, SERVER, VALIDATION)
- **Performance Metrics**: Operation duration, retry success rates, authentication validation timing
- **Cascade Failure Prevention**: Tracks prevented failures through blocking authentication

## Migration from Current Implementation

### Removed Components

- **Custom CircuitBreaker class**: Replaced with @orchestr8/resilience circuit breaker policies
- **Manual retry loops**: Replaced with ResiliencePolicy retry configuration
- **Error-specific timeout handling**: Unified under @orchestr8/resilience timeout policies
- **Custom backoff calculations**: Handled by @orchestr8/resilience backoff strategies

### Preserved Components

- **ErrorClassifier**: Enhanced to work with @orchestr8/resilience retry predicates
- **Rate limiting logic**: Integrated into rate-limit-aware resilience policies
- **Batch processing**: Enhanced with batch-specific resilience policies
- **Authentication patterns**: Improved with blocking validation and proper error handling

### New Capabilities

- **Jitter strategies**: Prevent thundering herd problems in batch operations
- **Statistical circuit breakers**: Use failure rates instead of raw counts
- **Operation-specific policies**: Different resilience behavior per operation type
- **Telemetry integration**: Built-in observability and monitoring
