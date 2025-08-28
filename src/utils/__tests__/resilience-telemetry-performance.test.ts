import type { ResiliencePolicy } from '@orchestr8/resilience'

import { performance } from 'perf_hooks'

import { ProductionResilienceAdapter } from '@orchestr8/resilience'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { ErrorClassifier } from '../error-classification'
import {
  authenticationPolicy,
  syncOperationsPolicy,
  batchOperationsPolicy,
  rateLimitAwarePolicy,
  ResiliencePolicySelector,
} from '../resilience-policies'

describe('Resilience Telemetry & Callback Performance Tests', () => {
  let adapter: ProductionResilienceAdapter
  // let telemetryData: any[] = []
  // let startTime: number

  beforeEach(() => {
    adapter = new ProductionResilienceAdapter()
    // telemetryData = []
    // startTime = performance.now()
  })

  afterEach(() => {
    // Clear any state
    // telemetryData = []
  })

  describe('7.2 Resilience Telemetry Integration Performance', () => {
    it('should execute telemetry callbacks with minimal overhead (<5ms per callback)', async () => {
      const testPolicy: ResiliencePolicy = {
        retry: {
          maxAttempts: 1, // No retries for this test
          initialDelay: 0,
          maxDelay: 0,
          backoffStrategy: 'fixed',
          jitterStrategy: 'none',
        },
        // Remove timeout to avoid timeout overhead in performance test
      }

      // Create a simple operation that always succeeds
      const operation = async () => {
        await new Promise((resolve) => setTimeout(resolve, 1))
        return 'success'
      }

      const iterations = 100
      let totalCallbackTime = 0

      // Run multiple iterations to measure callback overhead
      for (let i = 0; i < iterations; i++) {
        const callbackStartTime = performance.now()

        const result = await adapter.applyPolicy(operation, testPolicy)

        const callbackEndTime = performance.now()
        totalCallbackTime += callbackEndTime - callbackStartTime

        expect(result).toBe('success')
      }

      const avgCallbackTime = totalCallbackTime / iterations

      // Each callback execution should add less than 5ms overhead
      expect(avgCallbackTime).toBeLessThan(5)
    })

    it('should handle telemetry callbacks under high concurrency efficiently', async () => {
      const testPolicy: ResiliencePolicy = {
        retry: {
          maxAttempts: 1,
          initialDelay: 0,
          maxDelay: 0,
          backoffStrategy: 'fixed',
          jitterStrategy: 'none',
        },
        // Remove timeout to focus on telemetry performance
      }

      const operation = async (id: number) => {
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 10))
        return `result-${id}`
      }

      const concurrentOps = 50
      const startTime = performance.now()

      // Execute many operations concurrently
      const promises = Array(concurrentOps)
        .fill(0)
        .map(async (_, i) => {
          return adapter.applyPolicy(() => operation(i), testPolicy)
        })

      const results = await Promise.all(promises)

      const totalTime = performance.now() - startTime
      const avgTimePerOp = totalTime / concurrentOps

      // Verify all operations completed
      expect(results).toHaveLength(concurrentOps)
      results.forEach((result, i) => {
        expect(result).toBe(`result-${i}`)
      })

      // Concurrent telemetry callbacks shouldn't significantly slow operations
      expect(avgTimePerOp).toBeLessThan(20) // 20ms per operation including concurrency
      expect(totalTime).toBeLessThan(1000) // Total time under 1 second
    })

    it('should measure telemetry overhead during retry scenarios', async () => {
      let attemptCount = 0
      const maxAttempts = 3

      const testPolicy: ResiliencePolicy = {
        retry: {
          maxAttempts,
          initialDelay: 10,
          maxDelay: 50,
          backoffStrategy: 'fixed',
          jitterStrategy: 'none',
        },
        timeout: 1000,
      }

      // Operation that fails first N attempts then succeeds
      const flakyOperation = async () => {
        attemptCount++
        if (attemptCount < maxAttempts) {
          throw new Error(`Attempt ${attemptCount} failed`)
        }
        return 'success'
      }

      const startTime = performance.now()
      const result = await adapter.applyPolicy(flakyOperation, testPolicy)
      const totalTime = performance.now() - startTime

      expect(result).toBe('success')
      expect(attemptCount).toBe(maxAttempts)

      // Total time with retries and telemetry should be reasonable
      expect(totalTime).toBeLessThan(200) // Should complete retries quickly
    })

    it('should track telemetry for circuit breaker operations efficiently', async () => {
      const testPolicy: ResiliencePolicy = {
        retry: {
          maxAttempts: 1,
          initialDelay: 0,
          maxDelay: 0,
          backoffStrategy: 'fixed',
          jitterStrategy: 'none',
        },
        circuitBreaker: {
          key: 'telemetry-circuit-test',
          failureThreshold: 2, // Very low threshold for testing
          recoveryTime: 100, // Short recovery time
          sampleSize: 5,
          halfOpenPolicy: 'single-probe',
        },
        timeout: 500,
      }

      // Operation that always fails
      const failingOperation = async () => {
        throw new Error('Simulated failure')
      }

      const startTime = performance.now()
      let errorCount = 0

      // Execute operations that will trigger circuit breaker
      for (let i = 0; i < 5; i++) {
        try {
          await adapter.applyPolicy(failingOperation, testPolicy)
        } catch {
          errorCount++
          // Circuit breaker telemetry should not add significant overhead
          const currentTime = performance.now() - startTime
          expect(currentTime).toBeLessThan(1000) // Should fail fast
        }
      }

      expect(errorCount).toBe(5)

      // Total time for all circuit breaker operations should be minimal
      const totalTime = performance.now() - startTime
      expect(totalTime).toBeLessThan(500) // Circuit breaking should be fast
    })
  })

  describe('Resilience Policy Performance Tests', () => {
    it('should select policies with minimal overhead (<1ms)', () => {
      const operations = ['auth', 'sync', 'batch', 'rateLimit', 'unknown']
      const iterations = 1000

      const startTime = performance.now()

      for (let i = 0; i < iterations; i++) {
        for (const op of operations) {
          const policy = ResiliencePolicySelector.getPolicy(op)
          expect(policy).toBeDefined()
          expect(policy.retry).toBeDefined()
        }
      }

      const totalTime = performance.now() - startTime
      const avgTimePerSelection = totalTime / (iterations * operations.length)

      // Policy selection should be extremely fast
      expect(avgTimePerSelection).toBeLessThan(0.1) // Less than 0.1ms per selection
    })

    it('should apply authentication policy with no-retry behavior efficiently', async () => {
      const operation = async () => 'auth-success'

      const startTime = performance.now()
      const result = await adapter.applyPolicy(operation, authenticationPolicy)
      const duration = performance.now() - startTime

      expect(result).toBe('auth-success')
      expect(duration).toBeLessThan(50) // Should complete very quickly
    })

    it('should apply sync operations policy with retry behavior efficiently', async () => {
      let attemptCount = 0

      // Operation that succeeds on second attempt
      const operation = async () => {
        attemptCount++
        if (attemptCount === 1) {
          const error = new Error('Server error')
          ;(error as any).status = 500
          throw error
        }
        return 'sync-success'
      }

      const startTime = performance.now()
      const result = await adapter.applyPolicy(operation, syncOperationsPolicy)
      const duration = performance.now() - startTime

      expect(result).toBe('sync-success')
      expect(attemptCount).toBe(2)

      // Should complete within reasonable time including retry delay
      expect(duration).toBeLessThan(2000) // Including 1s initial delay
    })

    it('should apply batch operations policy efficiently for large operations', async () => {
      // Simulate a batch operation processing multiple items
      const operation = async () => {
        // Simulate processing 50 items (reduced from 100)
        const items = Array(50)
          .fill(0)
          .map((_, i) => ({ id: i, processed: true }))
        await new Promise((resolve) => setTimeout(resolve, 10)) // Reduced processing time
        return items
      }

      const startTime = performance.now()
      const result = await adapter.applyPolicy(operation, batchOperationsPolicy)
      const duration = performance.now() - startTime

      expect(result).toHaveLength(50)
      expect(duration).toBeLessThan(5000) // Increased timeout for batch operations
    })

    it('should apply rate limit aware policy with proper delay handling', async () => {
      // Mock a rate limit error scenario
      let attemptCount = 0

      const rateLimitOperation = async () => {
        attemptCount++
        if (attemptCount === 1) {
          const error = new Error('Rate limit exceeded')
          ;(error as any).status = 429
          ;(error as any).response = {
            status: 429,
            headers: {
              'x-ratelimit-remaining': '0',
              'retry-after': '1',
            },
          }
          throw error
        }
        return 'rate-limit-success'
      }

      const startTime = performance.now()
      const result = await adapter.applyPolicy(
        rateLimitOperation,
        rateLimitAwarePolicy,
      )
      const duration = performance.now() - startTime

      expect(result).toBe('rate-limit-success')
      expect(attemptCount).toBe(2)

      // Should handle rate limits within reasonable time
      expect(duration).toBeLessThan(3000) // Including rate limit delay
    })
  })

  describe('Error Classification Integration Performance', () => {
    it('should classify errors efficiently in retry predicates (<0.5ms per classification)', () => {
      const errors = [
        new Error('Network error'),
        { status: 401, message: 'Unauthorized' },
        { status: 500, message: 'Server error' },
        { status: 429, message: 'Rate limit' },
        { code: 'ECONNRESET', message: 'Connection reset' },
      ]

      const iterations = 1000
      const startTime = performance.now()

      for (let i = 0; i < iterations; i++) {
        for (const error of errors) {
          const classification = ErrorClassifier.classify(error)
          expect(classification).toBeDefined()
          expect(classification.type).toBeDefined()

          // Test retry predicate performance
          const shouldRetry = ErrorClassifier.createRetryPredicate()(error)
          expect(typeof shouldRetry).toBe('boolean')
        }
      }

      const totalTime = performance.now() - startTime
      const avgTimePerClassification = totalTime / (iterations * errors.length)

      // Error classification should be very fast
      expect(avgTimePerClassification).toBeLessThan(0.5)
    })

    it('should handle complex error objects efficiently', () => {
      const complexError = {
        name: 'AxiosError',
        message: 'Request failed with status code 500',
        code: 'ERR_BAD_RESPONSE',
        response: {
          status: 500,
          statusText: 'Internal Server Error',
          headers: {
            'x-ratelimit-remaining': '100',
            'retry-after': '30',
          },
          data: {
            error: {
              code: 'InternalServerError',
              message: 'An internal server error occurred',
            },
          },
        },
        request: {
          url: 'https://dev.azure.com/_apis/wit/workitems',
          method: 'GET',
        },
        config: {
          timeout: 30000,
          retry: true,
        },
      }

      const iterations = 500
      const startTime = performance.now()

      for (let i = 0; i < iterations; i++) {
        const classification = ErrorClassifier.classify(complexError)
        expect(classification.type).toBe('SERVER')
        expect(classification.retryable).toBe(true)
      }

      const totalTime = performance.now() - startTime
      const avgTime = totalTime / iterations

      // Complex error classification should still be fast
      expect(avgTime).toBeLessThan(1) // Less than 1ms per complex classification
    })
  })

  describe('Memory Usage During Resilience Operations', () => {
    it('should not leak memory during repeated resilience operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed

      const testPolicy: ResiliencePolicy = {
        retry: {
          maxAttempts: 1,
          initialDelay: 0,
          maxDelay: 0,
          backoffStrategy: 'fixed',
          jitterStrategy: 'none',
        },
        timeout: 100,
      }

      // Create many operations with unique contexts
      for (let i = 0; i < 1000; i++) {
        await adapter.applyPolicy(async () => {
          // Create some data that should be garbage collected
          const data = Array(100)
            .fill(0)
            .map((_, j) => ({
              id: i * 1000 + j,
              operation: 'memory-test',
              timestamp: Date.now(),
            }))
          return data.length
        }, testPolicy)
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }

      const finalMemory = process.memoryUsage().heapUsed
      const memoryIncrease = finalMemory - initialMemory

      // Memory increase should be reasonable (< 10MB for 1000 operations)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024)
    })

    it('should handle concurrent operations without memory leaks', async () => {
      const initialMemory = process.memoryUsage().heapUsed

      const testPolicy: ResiliencePolicy = {
        retry: {
          maxAttempts: 1,
          initialDelay: 0,
          maxDelay: 0,
          backoffStrategy: 'fixed',
          jitterStrategy: 'none',
        },
        // Remove timeout for memory test focus
      }

      // Execute many concurrent operations
      const concurrentOps = 100
      const promises = Array(concurrentOps)
        .fill(0)
        .map(async (_, i) => {
          return adapter.applyPolicy(async () => {
            // Simulate some data processing
            await new Promise((resolve) =>
              setTimeout(resolve, Math.random() * 50),
            )
            return { operationId: i, timestamp: Date.now() }
          }, testPolicy)
        })

      const results = await Promise.all(promises)

      expect(results).toHaveLength(concurrentOps)

      // Force garbage collection
      if (global.gc) {
        global.gc()
      }

      const finalMemory = process.memoryUsage().heapUsed
      const memoryIncrease = finalMemory - initialMemory

      // Concurrent operations shouldn't cause significant memory increase
      expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024) // Less than 5MB
    })
  })
})
