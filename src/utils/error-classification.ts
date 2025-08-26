export enum ErrorType {
  AUTHENTICATION = 'AUTHENTICATION',
  RATE_LIMIT = 'RATE_LIMIT',
  NETWORK = 'NETWORK',
  SERVER = 'SERVER',
  VALIDATION = 'VALIDATION'
}

export interface ClassifiedError {
  type: ErrorType;
  code: string;
  message: string;
  retryable: boolean;
  retryDelayMs?: number;
  originalError: Error;
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
        code: error.status === 401 ? 'INVALID_TOKEN' : 'INSUFFICIENT_PERMISSIONS',
        message: this.getAuthErrorMessage(error.status),
        retryable: false,
        originalError: error
      };
    }

    // Rate limiting errors (429)
    if (error.status === 429) {
      const resetTime = error.headers?.['x-ratelimit-reset'];
      const retryAfter = error.headers?.['retry-after'];
      const delayMs = this.calculateRateLimitDelay(resetTime, retryAfter);
      
      return {
        type: ErrorType.RATE_LIMIT,
        code: 'RATE_LIMITED',
        message: `Rate limit exceeded. Server requests retry after ${delayMs}ms`,
        retryable: true,
        retryDelayMs: delayMs,
        originalError: error
      };
    }

    // Network errors (connection issues, timeouts)
    if (this.isNetworkError(error)) {
      return {
        type: ErrorType.NETWORK,
        code: 'NETWORK_ERROR',
        message: `Network connectivity issue: ${error.code || error.message}`,
        retryable: true,
        retryDelayMs: 1000, // Base delay for exponential backoff
        originalError: error
      };
    }

    // Server errors (5xx)
    if (error.status >= 500 && error.status < 600) {
      return {
        type: ErrorType.SERVER,
        code: 'SERVER_ERROR',
        message: `Azure DevOps server error: ${error.status} ${error.statusText}`,
        retryable: true,
        retryDelayMs: 2000, // Base delay for server errors
        originalError: error
      };
    }

    // Client validation errors (4xx except 401, 403, 429)
    if (error.status >= 400 && error.status < 500) {
      return {
        type: ErrorType.VALIDATION,
        code: 'CLIENT_ERROR',
        message: `Request validation failed: ${error.status} ${error.statusText}`,
        retryable: false,
        originalError: error
      };
    }

    // Unknown errors - treat as non-retryable for safety
    return {
      type: ErrorType.VALIDATION,
      code: 'UNKNOWN_ERROR',
      message: `Unclassified error: ${error.message || 'Unknown error occurred'}`,
      retryable: false,
      originalError: error
    };
  }

  /**
   * Creates a retry predicate function for @orchestr8/resilience
   * Used in ResiliencePolicy.retry.retryOn configuration
   */
  static createRetryPredicate() {
    return (error: unknown): boolean => {
      const classified = ErrorClassifier.classify(error);
      
      // Log the classification for observability
      console.debug(`Error classified as ${classified.type}, retryable: ${classified.retryable}`);
      
      return classified.retryable;
    };
  }

  /**
   * Checks if error represents a network connectivity issue
   */
  private static isNetworkError(error: any): boolean {
    // Only treat as network error if it has specific network error codes
    return (
      error.code === 'ECONNRESET' ||
      error.code === 'ECONNREFUSED' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'ENOTFOUND' ||
      error.code === 'ECONNABORTED'
    );
  }

  /**
   * Calculates delay for rate limit retries using Azure DevOps headers
   */
  private static calculateRateLimitDelay(resetTime?: string, retryAfter?: string): number {
    if (retryAfter) {
      // Retry-After header in seconds
      return Math.min(parseInt(retryAfter) * 1000, 300000); // Max 5 minutes
    }
    
    if (resetTime) {
      // X-RateLimit-Reset as Unix timestamp
      const resetTimestamp = parseInt(resetTime) * 1000;
      const now = Date.now();
      return Math.max(1000, Math.min(resetTimestamp - now, 300000)); // Min 1s, max 5min
    }
    
    return 60000; // Default 1 minute delay if no headers
  }

  /**
   * Creates user-friendly authentication error messages
   */
  private static getAuthErrorMessage(status: number): string {
    if (status === 401) {
      return 'PAT token is invalid or expired. Please verify AZURE_DEVOPS_PAT environment variable contains a valid Personal Access Token.';
    }
    if (status === 403) {
      return 'PAT token lacks required permissions. Please ensure the token has "Work Items (read)" scope enabled in Azure DevOps.';
    }
    return 'Authentication failed with unexpected error. Please check PAT token and network connectivity.';
  }
}