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
  static classify(error: unknown): ClassifiedError {
    const err = error as any
    
    // Handle timeout errors from resilience adapter
    if (err?.name === 'TimeoutError') {
      return {
        type: ErrorType.NETWORK,
        code: 'TIMEOUT_ERROR',
        message: `Request timeout: ${err?.message || 'Unknown timeout error'}`,
        retryable: true,
        retryDelayMs: 5000,
        originalError: err as Error,
      }
    }

    // Note: Retry exhausted errors should not occur for auth errors anymore due to retryOn predicate
    // But handle them as a fallback
    if (err?.message && err.message.includes('Retry exhausted')) {
      return {
        type: ErrorType.AUTHENTICATION,
        code: 'AUTH_FAILED',
        message:
          'Authentication failed after retry attempts. This should not normally occur.',
        retryable: false,
        originalError: err as Error,
      }
    }

    // Try multiple ways to get status code - prioritize statusCode for AzureDevOpsError
    const status =
      err?.statusCode ||
      err?.status ||
      err?.response?.status ||
      err?.cause?.status

    // Authentication errors (401, 403)
    if (status === 401 || status === 403) {
      return {
        type: ErrorType.AUTHENTICATION,
        code: status === 401 ? 'INVALID_TOKEN' : 'INSUFFICIENT_PERMISSIONS',
        message: this.getAuthErrorMessage(status),
        retryable: false,
        originalError: err as Error,
      }
    }

    // Rate limiting errors (429)
    if (status === 429) {
      const resetTime = err?.headers?.['x-ratelimit-reset']
      const retryAfter = err?.headers?.['retry-after']
      const delayMs = this.calculateRateLimitDelay(resetTime, retryAfter)

      return {
        type: ErrorType.RATE_LIMIT,
        code: 'RATE_LIMITED',
        message: `Rate limit exceeded. Server requests retry after ${delayMs}ms`,
        retryable: true,
        retryDelayMs: delayMs,
        originalError: err as Error,
      }
    }

    // Network errors (connection issues, timeouts)
    if (this.isNetworkError(err)) {
      return {
        type: ErrorType.NETWORK,
        code: 'NETWORK_ERROR',
        message: `Network connectivity issue: ${err?.code || err?.message || 'Unknown network error'}`,
        retryable: true,
        retryDelayMs: 1000, // Base delay for exponential backoff
        originalError: err as Error,
      }
    }

    // Server errors (5xx)
    if (status >= 500 && status < 600) {
      return {
        type: ErrorType.SERVER,
        code: 'SERVER_ERROR',
        message: `Azure DevOps server error: ${status} ${err?.statusText || 'Server Error'}`,
        retryable: true,
        retryDelayMs: 2000, // Base delay for server errors
        originalError: err as Error,
      }
    }

    // Client validation errors (4xx except 401, 403, 429)
    if (status >= 400 && status < 500) {
      return {
        type: ErrorType.VALIDATION,
        code: 'CLIENT_ERROR',
        message: `Request validation failed: ${status} ${err?.statusText || 'Client Error'}`,
        retryable: false,
        originalError: err as Error,
      }
    }

    // Unknown errors - treat as non-retryable for safety
    return {
      type: ErrorType.VALIDATION,
      code: 'UNKNOWN_ERROR',
      message: `Unclassified error: ${err?.message || 'Unknown error occurred'}`,
      retryable: false,
      originalError: err instanceof Error ? err : new Error(String(err)),
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
  private static isNetworkError(error: unknown): boolean {
    const err = error as any
    // Only treat as network error if it has specific network error codes
    return (
      err?.code === 'ECONNRESET' ||
      err?.code === 'ECONNREFUSED' ||
      err?.code === 'ETIMEDOUT' ||
      err?.code === 'ENOTFOUND' ||
      err?.code === 'ECONNABORTED'
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
