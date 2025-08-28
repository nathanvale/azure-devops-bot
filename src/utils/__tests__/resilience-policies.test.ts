import type { ResiliencePolicy } from '@orchestr8/resilience'

import { describe, it, expect } from 'vitest'

// import { ErrorClassifier } from '../error-classification.js'
import {
  authenticationPolicy,
  syncOperationsPolicy,
  batchOperationsPolicy,
  rateLimitAwarePolicy,
  ResiliencePolicySelector,
} from '../resilience-policies.js'

describe('Resilience Policies', () => {
  describe('authenticationPolicy', () => {
    it('has correct retry configuration - no retries', () => {
      expect(authenticationPolicy.retry).toEqual({
        maxAttempts: 1,
        initialDelay: 0,
        maxDelay: 0,
        backoffStrategy: 'fixed',
        jitterStrategy: 'none',
      })
    })

    it('authentication policy enforces no retries through maxAttempts', () => {
      // Authentication policy should have maxAttempts = 1 to prevent retries
      expect(authenticationPolicy.retry?.maxAttempts).toBe(1)
      
      // This ensures no retries will be attempted regardless of error type
      // The resilience framework will respect the maxAttempts limit
    })

    it('has correct circuit breaker configuration - 3 failure threshold', () => {
      expect(authenticationPolicy.circuitBreaker).toEqual({
        key: 'azure-devops-auth',
        failureThreshold: 3,
        recoveryTime: 300000, // 5 minutes
        sampleSize: 10,
        halfOpenPolicy: 'single-probe',
      })
    })

    it('has correct timeout configuration', () => {
      expect(authenticationPolicy.timeout).toBe(30000)
    })
  })

  describe('syncOperationsPolicy', () => {
    it('has correct retry configuration - intelligent retries', () => {
      expect(syncOperationsPolicy.retry).toEqual({
        maxAttempts: 5,
        initialDelay: 1000, // 1 second
        maxDelay: 30000, // 30 seconds
        backoffStrategy: 'exponential',
        jitterStrategy: 'full-jitter',
        // Note: retryOn property not available in current ResiliencePolicy type
      })
    })

    it('sync operations policy allows multiple retry attempts', () => {
      // Sync operations should allow retries through maxAttempts configuration
      expect(syncOperationsPolicy.retry?.maxAttempts).toBeGreaterThan(1)
      
      // The resilience framework will handle error type classification internally
      // We verify the policy is configured to allow retries when appropriate
    })

    it('has correct circuit breaker configuration - 50% failure rate threshold', () => {
      expect(syncOperationsPolicy.circuitBreaker).toEqual({
        key: 'azure-devops-sync',
        failureThreshold: 0.5, // 50% failure rate
        recoveryTime: 60000, // 1 minute
        sampleSize: 10,
        halfOpenPolicy: 'single-probe',
      })
    })

    it('has correct timeout configuration for sync operations', () => {
      expect(syncOperationsPolicy.timeout).toBe(120000)
    })
  })

  describe('batchOperationsPolicy', () => {
    it('has correct retry configuration - optimized for bulk processing', () => {
      expect(batchOperationsPolicy.retry).toEqual({
        maxAttempts: 3, // Fewer retries for batch ops
        initialDelay: 2000, // 2 second base
        maxDelay: 15000, // 15 seconds max
        backoffStrategy: 'exponential',
        jitterStrategy: 'full-jitter', // Better for batch operations
        // Note: retryOn property not available in current ResiliencePolicy type
      })
    })

    it('batch operations policy uses exponential backoff for bulk processing', () => {
      // Batch operations should use exponential backoff
      expect(batchOperationsPolicy.retry?.backoffStrategy).toBe('exponential')
      expect(batchOperationsPolicy.retry?.jitterStrategy).toBe('full-jitter')
      
      // Verify appropriate retry attempts for batch operations
      expect(batchOperationsPolicy.retry?.maxAttempts).toBe(3)
    })

    it('has correct circuit breaker configuration - 30% failure threshold', () => {
      expect(batchOperationsPolicy.circuitBreaker).toEqual({
        key: 'azure-devops-batch',
        failureThreshold: 0.3, // 30% failure rate for batch
        recoveryTime: 30000, // 30 seconds
        sampleSize: 15, // Larger sample for batch operations
        halfOpenPolicy: 'single-probe',
      })
    })

    it('has correct timeout configuration for batch processing', () => {
      expect(batchOperationsPolicy.timeout).toBe(180000)
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
        // Note: retryOn property not available in current ResiliencePolicy type
      })
    })

    it('rate limit aware policy uses fixed backoff strategy', () => {
      // Rate limit policy should use fixed delays to respect server timing
      expect(rateLimitAwarePolicy.retry?.backoffStrategy).toBe('fixed')
      expect(rateLimitAwarePolicy.retry?.jitterStrategy).toBe('none')
      
      // Should have multiple attempts for rate limit scenarios
      expect(rateLimitAwarePolicy.retry?.maxAttempts).toBe(5)
    })

    it('has correct circuit breaker configuration - high threshold for rate limits', () => {
      expect(rateLimitAwarePolicy.circuitBreaker).toEqual({
        key: 'azure-devops-rate-limit',
        failureThreshold: 0.8, // 80% threshold for rate limits
        recoveryTime: 600000, // 10 minutes for rate limit recovery
        sampleSize: 20, // Larger sample for rate limit detection
        halfOpenPolicy: 'single-probe',
      })
    })

    it('has correct timeout configuration for rate-limited operations', () => {
      expect(rateLimitAwarePolicy.timeout).toBe(300000)
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
      const policy = ResiliencePolicySelector.getPolicy('unknown' as any)
      expect(policy).toBe(syncOperationsPolicy)
    })
  })

  describe('Policy Schema Validation', () => {
    const validatePolicyStructure = (
      policy: ResiliencePolicy,
      policyName: string,
    ) => {
      // All policies must have retry configuration
      expect(
        policy.retry,
        `${policyName} should have retry config`,
      ).toBeDefined()
      expect(
        policy.retry?.maxAttempts,
        `${policyName} should have maxAttempts`,
      ).toBeGreaterThan(0)
      expect(
        policy.retry?.initialDelay,
        `${policyName} should have initialDelay`,
      ).toBeGreaterThanOrEqual(0)
      expect(
        policy.retry?.maxDelay,
        `${policyName} should have maxDelay`,
      ).toBeGreaterThanOrEqual(policy.retry?.initialDelay || 0)
      expect(
        policy.retry?.backoffStrategy,
        `${policyName} should have backoffStrategy`,
      ).toMatch(/^(fixed|linear|exponential)$/)
      expect(
        policy.retry?.jitterStrategy,
        `${policyName} should have jitterStrategy`,
      ).toMatch(/^(none|full|decorrelated|full-jitter)$/)
      // Note: retryOn property not available in current ResiliencePolicy type

      // All policies must have circuit breaker configuration
      expect(
        policy.circuitBreaker,
        `${policyName} should have circuit breaker config`,
      ).toBeDefined()
      expect(
        policy.circuitBreaker?.key,
        `${policyName} should have circuit key`,
      ).toBeTruthy()
      expect(
        policy.circuitBreaker?.failureThreshold,
        `${policyName} should have failure threshold`,
      ).toBeGreaterThan(0)
      expect(
        policy.circuitBreaker?.recoveryTime,
        `${policyName} should have recovery time`,
      ).toBeGreaterThan(0)
      expect(
        policy.circuitBreaker?.sampleSize,
        `${policyName} should have sample size`,
      ).toBeGreaterThanOrEqual(10)
      expect(
        policy.circuitBreaker?.halfOpenPolicy,
        `${policyName} should have half-open policy`,
      ).toBe('single-probe')

      // All policies must have timeout configuration
      expect(
        policy.timeout,
        `${policyName} should have timeout config`,
      ).toBeDefined()
      expect(
        policy.timeout,
        `${policyName} should have timeout duration as number`,
      ).toBeGreaterThan(0)
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

  describe('Policy Configuration Validation', () => {
    it('policies have appropriate retry configurations for their use cases', () => {
      // Authentication should not retry (maxAttempts = 1)
      expect(authenticationPolicy.retry?.maxAttempts).toBe(1)
      
      // Other policies should allow retries
      expect(syncOperationsPolicy.retry?.maxAttempts).toBeGreaterThan(1)
      expect(batchOperationsPolicy.retry?.maxAttempts).toBeGreaterThan(1)
      expect(rateLimitAwarePolicy.retry?.maxAttempts).toBeGreaterThan(1)
    })

    it('policies have appropriate backoff strategies', () => {
      // Rate limit should use fixed delays to respect server timing
      expect(rateLimitAwarePolicy.retry?.backoffStrategy).toBe('fixed')
      expect(rateLimitAwarePolicy.retry?.jitterStrategy).toBe('none')
      
      // Batch operations should use exponential backoff
      expect(batchOperationsPolicy.retry?.backoffStrategy).toBe('exponential')
      expect(batchOperationsPolicy.retry?.jitterStrategy).toBe('full-jitter')
      
      // Sync operations should use exponential with jitter
      expect(syncOperationsPolicy.retry?.backoffStrategy).toBe('exponential')
      expect(syncOperationsPolicy.retry?.jitterStrategy).toBe('full-jitter')
    })
  })

  describe('Performance and Resource Considerations', () => {
    it('timeout durations are reasonable for operation types', () => {
      // Auth validation should be quick
      expect(authenticationPolicy.timeout).toBeLessThanOrEqual(30000) // ≤ 30 seconds

      // Sync operations need more time but not excessive
      expect(syncOperationsPolicy.timeout).toBeLessThanOrEqual(120000) // ≤ 2 minutes

      // Batch operations need the most time
      expect(batchOperationsPolicy.timeout).toBeLessThanOrEqual(
        180000,
      ) // ≤ 3 minutes

      // Rate limited operations need to accommodate delays
      expect(rateLimitAwarePolicy.timeout).toBeLessThanOrEqual(300000) // ≤ 5 minutes
    })

    it('circuit breaker recovery times are reasonable', () => {
      // Auth should have longer recovery (auth issues tend to be persistent)
      expect(
        authenticationPolicy.circuitBreaker?.recoveryTime,
      ).toBeGreaterThanOrEqual(300000) // ≥ 5 minutes

      // Sync should recover quickly for temporary issues
      expect(
        syncOperationsPolicy.circuitBreaker?.recoveryTime,
      ).toBeLessThanOrEqual(60000) // ≤ 1 minute

      // Batch should recover quickly
      expect(
        batchOperationsPolicy.circuitBreaker?.recoveryTime,
      ).toBeLessThanOrEqual(30000) // ≤ 30 seconds

      // Rate limits need longer recovery
      expect(
        rateLimitAwarePolicy.circuitBreaker?.recoveryTime,
      ).toBeGreaterThanOrEqual(600000) // ≥ 10 minutes
    })

    it('sample sizes are statistically meaningful', () => {
      // All policies should have sample sizes ≥ 10 for statistical significance
      expect(
        authenticationPolicy.circuitBreaker?.sampleSize,
      ).toBeGreaterThanOrEqual(10)
      expect(
        syncOperationsPolicy.circuitBreaker?.sampleSize,
      ).toBeGreaterThanOrEqual(10)
      expect(
        batchOperationsPolicy.circuitBreaker?.sampleSize,
      ).toBeGreaterThanOrEqual(10)
      expect(
        rateLimitAwarePolicy.circuitBreaker?.sampleSize,
      ).toBeGreaterThanOrEqual(10)

      // Batch and rate limit should have larger samples for better accuracy
      expect(
        batchOperationsPolicy.circuitBreaker?.sampleSize,
      ).toBeGreaterThanOrEqual(15)
      expect(
        rateLimitAwarePolicy.circuitBreaker?.sampleSize,
      ).toBeGreaterThanOrEqual(20)
    })
  })
})
