import { describe, it, expect } from 'vitest'
import type { ResiliencePolicy } from '@orchestr8/resilience'
import { 
  authenticationPolicy,
  syncOperationsPolicy,
  batchOperationsPolicy,
  rateLimitAwarePolicy,
  ResiliencePolicySelector
} from '../resilience-policies.js'
import { ErrorClassifier } from '../error-classification.js'

describe('Resilience Policies', () => {
  describe('authenticationPolicy', () => {
    it('has correct retry configuration - no retries', () => {
      expect(authenticationPolicy.retry).toEqual({
        maxAttempts: 1,
        initialDelay: 0,
        maxDelay: 0,
        backoffStrategy: 'fixed',
        jitterStrategy: 'none',
        retryOn: expect.any(Function)
      })
    })

    it('retry predicate never allows retries', () => {
      const retryOn = authenticationPolicy.retry?.retryOn
      expect(retryOn).toBeDefined()
      
      // Test various error types - all should return false
      const authError = { status: 401, message: 'Unauthorized' }
      const networkError = { code: 'ECONNRESET', message: 'Connection reset' }
      const serverError = { status: 500, message: 'Server error' }
      const rateLimitError = { status: 429, message: 'Rate limited' }
      
      expect(retryOn!(authError)).toBe(false)
      expect(retryOn!(networkError)).toBe(false)
      expect(retryOn!(serverError)).toBe(false)
      expect(retryOn!(rateLimitError)).toBe(false)
    })

    it('has correct circuit breaker configuration - 3 failure threshold', () => {
      expect(authenticationPolicy.circuitBreaker).toEqual({
        key: 'azure-devops-auth',
        failureThreshold: 3,
        recoveryTime: 300000, // 5 minutes
        sampleSize: 10,
        halfOpenPolicy: 'single-probe'
      })
    })

    it('has correct timeout configuration', () => {
      expect(authenticationPolicy.timeout).toEqual({
        duration: 30000, // 30 seconds
        operationName: 'authentication'
      })
    })
  })

  describe('syncOperationsPolicy', () => {
    it('has correct retry configuration - intelligent retries', () => {
      expect(syncOperationsPolicy.retry).toEqual({
        maxAttempts: 5,
        initialDelay: 1000, // 1 second
        maxDelay: 30000, // 30 seconds
        backoffStrategy: 'exponential',
        jitterStrategy: 'full',
        retryOn: expect.any(Function)
      })
    })

    it('retry predicate respects error type classification', () => {
      const retryOn = syncOperationsPolicy.retry?.retryOn
      expect(retryOn).toBeDefined()
      
      // Should NOT retry authentication and validation errors
      const authError = { status: 401, message: 'Unauthorized' }
      const validationError = { status: 400, message: 'Bad request' }
      expect(retryOn!(authError)).toBe(false)
      expect(retryOn!(validationError)).toBe(false)
      
      // SHOULD retry rate limit, network, and server errors
      const rateLimitError = { status: 429, message: 'Rate limited' }
      const networkError = { code: 'ECONNRESET', message: 'Connection reset' }
      const serverError = { status: 500, message: 'Server error' }
      expect(retryOn!(rateLimitError)).toBe(true)
      expect(retryOn!(networkError)).toBe(true)
      expect(retryOn!(serverError)).toBe(true)
      
      // Should NOT retry unknown errors (conservative default)
      const unknownError = { message: 'Unknown error' }
      expect(retryOn!(unknownError)).toBe(false)
    })

    it('has correct circuit breaker configuration - 50% failure rate threshold', () => {
      expect(syncOperationsPolicy.circuitBreaker).toEqual({
        key: 'azure-devops-sync',
        failureThreshold: 0.5, // 50% failure rate
        recoveryTime: 60000, // 1 minute
        sampleSize: 10,
        halfOpenPolicy: 'single-probe'
      })
    })

    it('has correct timeout configuration for sync operations', () => {
      expect(syncOperationsPolicy.timeout).toEqual({
        duration: 120000, // 2 minutes
        operationName: 'work-item-sync'
      })
    })
  })

  describe('batchOperationsPolicy', () => {
    it('has correct retry configuration - optimized for bulk processing', () => {
      expect(batchOperationsPolicy.retry).toEqual({
        maxAttempts: 3, // Fewer retries for batch ops
        initialDelay: 2000, // 2 second base
        maxDelay: 15000, // 15 seconds max
        backoffStrategy: 'exponential',
        jitterStrategy: 'decorrelated', // Better for batch operations
        retryOn: expect.any(Function)
      })
    })

    it('retry predicate uses ErrorClassifier.createRetryPredicate', () => {
      const retryOn = batchOperationsPolicy.retry?.retryOn
      expect(retryOn).toBeDefined()
      
      // Should match ErrorClassifier behavior
      const retryableError = { status: 429, message: 'Rate limited' }
      const nonRetryableError = { status: 401, message: 'Auth failed' }
      
      expect(retryOn!(retryableError)).toBe(true)
      expect(retryOn!(nonRetryableError)).toBe(false)
    })

    it('has correct circuit breaker configuration - 30% failure threshold', () => {
      expect(batchOperationsPolicy.circuitBreaker).toEqual({
        key: 'azure-devops-batch',
        failureThreshold: 0.3, // 30% failure rate for batch
        recoveryTime: 30000, // 30 seconds
        sampleSize: 15, // Larger sample for batch operations
        halfOpenPolicy: 'single-probe'
      })
    })

    it('has correct timeout configuration for batch processing', () => {
      expect(batchOperationsPolicy.timeout).toEqual({
        duration: 180000, // 3 minutes
        operationName: 'batch-processing'
      })
    })
  })

  describe('rateLimitAwarePolicy', () => {
    it('has correct retry configuration - respects server timing', () => {
      expect(rateLimitAwarePolicy.retry).toEqual({
        maxAttempts: 5,
        initialDelay: 1000, // Will be overridden by rate limit headers
        maxDelay: 300000, // 5 minutes maximum (Azure DevOps max)
        backoffStrategy: 'fixed', // Use exact delays from headers
        jitterStrategy: 'none', // No jitter for rate limit delays
        retryOn: expect.any(Function)
      })
    })

    it('retry predicate only allows rate limit, network, and server errors', () => {
      const retryOn = rateLimitAwarePolicy.retry?.retryOn
      expect(retryOn).toBeDefined()
      
      // SHOULD retry rate limit, network, and server errors
      const rateLimitError = { status: 429, message: 'Rate limited' }
      const networkError = { code: 'ECONNRESET', message: 'Connection reset' }
      const serverError = { status: 500, message: 'Server error' }
      expect(retryOn!(rateLimitError)).toBe(true)
      expect(retryOn!(networkError)).toBe(true)
      expect(retryOn!(serverError)).toBe(true)
      
      // Should NOT retry auth and validation errors
      const authError = { status: 401, message: 'Unauthorized' }
      const validationError = { status: 400, message: 'Bad request' }
      expect(retryOn!(authError)).toBe(false)
      expect(retryOn!(validationError)).toBe(false)
    })

    it('has correct circuit breaker configuration - high threshold for rate limits', () => {
      expect(rateLimitAwarePolicy.circuitBreaker).toEqual({
        key: 'azure-devops-rate-limit',
        failureThreshold: 0.8, // 80% threshold for rate limits
        recoveryTime: 600000, // 10 minutes for rate limit recovery
        sampleSize: 20, // Larger sample for rate limit detection
        halfOpenPolicy: 'single-probe'
      })
    })

    it('has correct timeout configuration for rate-limited operations', () => {
      expect(rateLimitAwarePolicy.timeout).toEqual({
        duration: 300000, // 5 minutes
        operationName: 'rate-limited-operation'
      })
    })
  })

  describe('ResiliencePolicySelector', () => {
    it('returns authenticationPolicy for auth operation type', () => {
      const policy = ResiliencePolicySelector.getPolicy('auth')
      expect(policy).toBe(authenticationPolicy)
    })

    it('returns syncOperationsPolicy for sync operation type', () => {
      const policy = ResiliencePolicySelector.getPolicy('sync')
      expect(policy).toBe(syncOperationsPolicy)
    })

    it('returns batchOperationsPolicy for batch operation type', () => {
      const policy = ResiliencePolicySelector.getPolicy('batch')
      expect(policy).toBe(batchOperationsPolicy)
    })

    it('returns rateLimitAwarePolicy for rateLimit operation type', () => {
      const policy = ResiliencePolicySelector.getPolicy('rateLimit')
      expect(policy).toBe(rateLimitAwarePolicy)
    })

    it('returns syncOperationsPolicy as safe default for unknown operation type', () => {
      // @ts-expect-error Testing unknown operation type
      const policy = ResiliencePolicySelector.getPolicy('unknown')
      expect(policy).toBe(syncOperationsPolicy)
    })
  })

  describe('Policy Schema Validation', () => {
    const validatePolicyStructure = (policy: ResiliencePolicy, policyName: string) => {
      // All policies must have retry configuration
      expect(policy.retry, `${policyName} should have retry config`).toBeDefined()
      expect(policy.retry?.maxAttempts, `${policyName} should have maxAttempts`).toBeGreaterThan(0)
      expect(policy.retry?.initialDelay, `${policyName} should have initialDelay`).toBeGreaterThanOrEqual(0)
      expect(policy.retry?.maxDelay, `${policyName} should have maxDelay`).toBeGreaterThanOrEqual(policy.retry?.initialDelay || 0)
      expect(policy.retry?.backoffStrategy, `${policyName} should have backoffStrategy`).toMatch(/^(fixed|linear|exponential)$/)
      expect(policy.retry?.jitterStrategy, `${policyName} should have jitterStrategy`).toMatch(/^(none|full|decorrelated)$/)
      expect(policy.retry?.retryOn, `${policyName} should have retryOn function`).toBeTypeOf('function')

      // All policies must have circuit breaker configuration
      expect(policy.circuitBreaker, `${policyName} should have circuit breaker config`).toBeDefined()
      expect(policy.circuitBreaker?.key, `${policyName} should have circuit key`).toBeTruthy()
      expect(policy.circuitBreaker?.failureThreshold, `${policyName} should have failure threshold`).toBeGreaterThan(0)
      expect(policy.circuitBreaker?.recoveryTime, `${policyName} should have recovery time`).toBeGreaterThan(0)
      expect(policy.circuitBreaker?.sampleSize, `${policyName} should have sample size`).toBeGreaterThanOrEqual(10)
      expect(policy.circuitBreaker?.halfOpenPolicy, `${policyName} should have half-open policy`).toBe('single-probe')

      // All policies must have timeout configuration
      expect(policy.timeout, `${policyName} should have timeout config`).toBeDefined()
      expect(policy.timeout?.duration, `${policyName} should have timeout duration`).toBeGreaterThan(0)
      expect(policy.timeout?.operationName, `${policyName} should have operation name`).toBeTruthy()
    }

    it('authenticationPolicy has valid schema structure', () => {
      validatePolicyStructure(authenticationPolicy, 'authenticationPolicy')
      
      // Additional auth-specific validations
      expect(authenticationPolicy.retry?.maxAttempts).toBe(1) // No retries for auth
      expect(authenticationPolicy.circuitBreaker?.failureThreshold).toBe(3) // Specific threshold per spec
    })

    it('syncOperationsPolicy has valid schema structure', () => {
      validatePolicyStructure(syncOperationsPolicy, 'syncOperationsPolicy')
      
      // Additional sync-specific validations
      expect(syncOperationsPolicy.retry?.maxAttempts).toBeGreaterThan(1) // Should allow retries
      expect(syncOperationsPolicy.circuitBreaker?.failureThreshold).toBe(0.5) // 50% failure rate
    })

    it('batchOperationsPolicy has valid schema structure', () => {
      validatePolicyStructure(batchOperationsPolicy, 'batchOperationsPolicy')
      
      // Additional batch-specific validations
      expect(batchOperationsPolicy.circuitBreaker?.failureThreshold).toBe(0.3) // 30% failure rate
      expect(batchOperationsPolicy.circuitBreaker?.sampleSize).toBe(15) // Larger sample size
    })

    it('rateLimitAwarePolicy has valid schema structure', () => {
      validatePolicyStructure(rateLimitAwarePolicy, 'rateLimitAwarePolicy')
      
      // Additional rate limit-specific validations
      expect(rateLimitAwarePolicy.retry?.backoffStrategy).toBe('fixed') // Fixed delays from headers
      expect(rateLimitAwarePolicy.retry?.jitterStrategy).toBe('none') // No jitter for rate limits
      expect(rateLimitAwarePolicy.circuitBreaker?.failureThreshold).toBe(0.8) // 80% threshold
    })
  })

  describe('Error Type Integration Tests', () => {
    it('syncOperationsPolicy integrates correctly with ErrorClassifier', () => {
      const retryOn = syncOperationsPolicy.retry?.retryOn
      expect(retryOn).toBeDefined()
      
      // Create different error types and verify proper classification
      const errorScenarios = [
        { error: { status: 401 }, expectedRetry: false, type: 'AUTH' },
        { error: { status: 403 }, expectedRetry: false, type: 'AUTH' },
        { error: { status: 400 }, expectedRetry: false, type: 'VALIDATION' },
        { error: { status: 404 }, expectedRetry: false, type: 'VALIDATION' },
        { error: { status: 429 }, expectedRetry: true, type: 'RATE_LIMIT' },
        { error: { status: 500 }, expectedRetry: true, type: 'SERVER' },
        { error: { status: 502 }, expectedRetry: true, type: 'SERVER' },
        { error: { status: 503 }, expectedRetry: true, type: 'SERVER' },
        { error: { code: 'ECONNRESET' }, expectedRetry: true, type: 'NETWORK' },
        { error: { code: 'ETIMEDOUT' }, expectedRetry: true, type: 'NETWORK' },
        { error: { message: 'Unknown error' }, expectedRetry: false, type: 'UNKNOWN' }
      ]

      errorScenarios.forEach(({ error, expectedRetry, type }) => {
        const shouldRetry = retryOn!(error)
        expect(shouldRetry, `${type} error should ${expectedRetry ? 'be' : 'not be'} retryable`).toBe(expectedRetry)
      })
    })

    it('rateLimitAwarePolicy correctly filters error types', () => {
      const retryOn = rateLimitAwarePolicy.retry?.retryOn
      expect(retryOn).toBeDefined()
      
      // Should only retry specific error types
      const retryableErrors = [
        { status: 429, message: 'Rate limited' }, // RATE_LIMIT
        { code: 'ECONNRESET', message: 'Connection reset' }, // NETWORK  
        { status: 500, message: 'Server error' } // SERVER
      ]
      
      const nonRetryableErrors = [
        { status: 401, message: 'Unauthorized' }, // AUTHENTICATION
        { status: 400, message: 'Bad request' }, // VALIDATION
        { message: 'Unknown error' } // UNKNOWN
      ]
      
      retryableErrors.forEach(error => {
        expect(retryOn!(error), `Error ${JSON.stringify(error)} should be retryable`).toBe(true)
      })
      
      nonRetryableErrors.forEach(error => {
        expect(retryOn!(error), `Error ${JSON.stringify(error)} should not be retryable`).toBe(false)
      })
    })
  })

  describe('Performance and Resource Considerations', () => {
    it('timeout durations are reasonable for operation types', () => {
      // Auth validation should be quick
      expect(authenticationPolicy.timeout?.duration).toBeLessThanOrEqual(30000) // ≤ 30 seconds
      
      // Sync operations need more time but not excessive
      expect(syncOperationsPolicy.timeout?.duration).toBeLessThanOrEqual(120000) // ≤ 2 minutes
      
      // Batch operations need the most time
      expect(batchOperationsPolicy.timeout?.duration).toBeLessThanOrEqual(180000) // ≤ 3 minutes
      
      // Rate limited operations need to accommodate delays
      expect(rateLimitAwarePolicy.timeout?.duration).toBeLessThanOrEqual(300000) // ≤ 5 minutes
    })

    it('circuit breaker recovery times are reasonable', () => {
      // Auth should have longer recovery (auth issues tend to be persistent)
      expect(authenticationPolicy.circuitBreaker?.recoveryTime).toBeGreaterThanOrEqual(300000) // ≥ 5 minutes
      
      // Sync should recover quickly for temporary issues
      expect(syncOperationsPolicy.circuitBreaker?.recoveryTime).toBeLessThanOrEqual(60000) // ≤ 1 minute
      
      // Batch should recover quickly
      expect(batchOperationsPolicy.circuitBreaker?.recoveryTime).toBeLessThanOrEqual(30000) // ≤ 30 seconds
      
      // Rate limits need longer recovery
      expect(rateLimitAwarePolicy.circuitBreaker?.recoveryTime).toBeGreaterThanOrEqual(600000) // ≥ 10 minutes
    })

    it('sample sizes are statistically meaningful', () => {
      // All policies should have sample sizes ≥ 10 for statistical significance
      expect(authenticationPolicy.circuitBreaker?.sampleSize).toBeGreaterThanOrEqual(10)
      expect(syncOperationsPolicy.circuitBreaker?.sampleSize).toBeGreaterThanOrEqual(10)
      expect(batchOperationsPolicy.circuitBreaker?.sampleSize).toBeGreaterThanOrEqual(10)
      expect(rateLimitAwarePolicy.circuitBreaker?.sampleSize).toBeGreaterThanOrEqual(10)
      
      // Batch and rate limit should have larger samples for better accuracy
      expect(batchOperationsPolicy.circuitBreaker?.sampleSize).toBeGreaterThanOrEqual(15)
      expect(rateLimitAwarePolicy.circuitBreaker?.sampleSize).toBeGreaterThanOrEqual(20)
    })
  })
})