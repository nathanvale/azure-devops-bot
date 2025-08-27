import type { ResiliencePolicy } from '@orchestr8/resilience'
import { ErrorClassifier } from './error-classification.js'

/**
 * Authentication policy - No retries, fail immediately
 * Used for PAT token validation and authentication checks
 */
export const authenticationPolicy: ResiliencePolicy = {
  retry: {
    maxAttempts: 1, // No retries for authentication
    initialDelay: 0,
    maxDelay: 0,
    backoffStrategy: 'fixed',
    jitterStrategy: 'none',
    retryOn: () => false // Never retry authentication failures
  },
  circuitBreaker: {
    key: 'azure-devops-auth',
    failureThreshold: 3, // 3 failures before opening circuit
    recoveryTime: 300000, // 5 minutes recovery time
    sampleSize: 10,
    halfOpenPolicy: 'single-probe'
  },
  timeout: {
    duration: 30000, // 30 second timeout for auth operations
    operationName: 'authentication'
  }
}

/**
 * Sync operations policy - Intelligent retries using ErrorClassifier
 * Used for work item sync and regular API operations
 */
export const syncOperationsPolicy: ResiliencePolicy = {
  retry: {
    maxAttempts: 5, // Allow up to 5 attempts
    initialDelay: 1000, // Start with 1 second delay
    maxDelay: 30000, // Maximum 30 second delay
    backoffStrategy: 'exponential',
    jitterStrategy: 'full',
    retryOn: ErrorClassifier.createRetryPredicate()
  },
  circuitBreaker: {
    key: 'azure-devops-sync',
    failureThreshold: 0.5, // 50% failure rate threshold
    recoveryTime: 60000, // 1 minute recovery time
    sampleSize: 10,
    halfOpenPolicy: 'single-probe'
  },
  timeout: {
    duration: 120000, // 2 minute timeout for sync operations
    operationName: 'work-item-sync'
  }
}

/**
 * Batch operations policy - Optimized for bulk processing
 * Used for fetching multiple work items efficiently
 */
export const batchOperationsPolicy: ResiliencePolicy = {
  retry: {
    maxAttempts: 3, // Fewer retries for batch operations
    initialDelay: 2000, // 2 second base delay
    maxDelay: 15000, // 15 second maximum delay
    backoffStrategy: 'exponential',
    jitterStrategy: 'decorrelated', // Better for batch operations
    retryOn: ErrorClassifier.createRetryPredicate()
  },
  circuitBreaker: {
    key: 'azure-devops-batch',
    failureThreshold: 0.3, // 30% failure rate for batch operations
    recoveryTime: 30000, // 30 second recovery time
    sampleSize: 15, // Larger sample size for batch operations
    halfOpenPolicy: 'single-probe'
  },
  timeout: {
    duration: 180000, // 3 minute timeout for batch processing
    operationName: 'batch-processing'
  }
}

/**
 * Rate limit aware policy - Respects Azure DevOps X-RateLimit headers
 * Used when rate limiting is detected or anticipated
 */
export const rateLimitAwarePolicy: ResiliencePolicy = {
  retry: {
    maxAttempts: 5,
    initialDelay: 1000, // Will be overridden by rate limit headers
    maxDelay: 300000, // 5 minute maximum (Azure DevOps max)
    backoffStrategy: 'fixed', // Use exact delays from headers
    jitterStrategy: 'none', // No jitter for rate limit delays
    retryOn: (error: unknown): boolean => {
      const classified = ErrorClassifier.classify(error)
      // Only retry rate limit, network, and server errors
      return classified.type === 'RATE_LIMIT' || 
             classified.type === 'NETWORK' || 
             classified.type === 'SERVER'
    }
  },
  circuitBreaker: {
    key: 'azure-devops-rate-limit',
    failureThreshold: 0.8, // 80% threshold for rate limits
    recoveryTime: 600000, // 10 minute recovery time
    sampleSize: 20, // Larger sample for rate limit detection
    halfOpenPolicy: 'single-probe'
  },
  timeout: {
    duration: 300000, // 5 minute timeout for rate-limited operations
    operationName: 'rate-limited-operation'
  }
}

/**
 * Policy selector for choosing appropriate resilience policy by operation type
 */
export class ResiliencePolicySelector {
  /**
   * Get appropriate resilience policy for operation type
   * @param operationType - Type of operation: 'auth', 'sync', 'batch', 'rateLimit'
   * @returns Appropriate ResiliencePolicy for the operation
   */
  static getPolicy(operationType: 'auth' | 'sync' | 'batch' | 'rateLimit' | string): ResiliencePolicy {
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
        // Safe default fallback to sync operations policy
        return syncOperationsPolicy
    }
  }
}