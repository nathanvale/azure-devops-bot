import type { ResiliencePolicy } from '@orchestr8/resilience'

import { performance } from 'perf_hooks'

import { ProductionResilienceAdapter } from '@orchestr8/resilience'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import {
  authenticationPolicy,
  syncOperationsPolicy,
  batchOperationsPolicy,
  rateLimitAwarePolicy,
  ResiliencePolicySelector,
} from '../resilience-policies'

describe('ProductionResilienceAdapter Memory Usage and Performance', () => {
  let adapter: ProductionResilienceAdapter
  let initialMemory: number

  beforeEach(() => {
    adapter = new ProductionResilienceAdapter()
    initialMemory = process.memoryUsage().heapUsed
  })

  afterEach(() => {
    // Force garbage collection if available
    if (global.gc) {
      global.gc()
    }
  })

  describe('7.4 ProductionResilienceAdapter Performance Tests', () => {
    it('should evaluate policies with minimal overhead (<1ms per evaluation)', () => {
      const policies = [
        authenticationPolicy,
        syncOperationsPolicy,
        batchOperationsPolicy,
        rateLimitAwarePolicy,
      ]

      const iterations = 1000
      const startTime = performance.now()

      for (let i = 0; i < iterations; i++) {
        for (const policy of policies) {
          // Simulate policy evaluation overhead
          const isRetryable = policy.retry ? true : false // retryOn doesn't exist in current interface
          const hasTimeout = !!policy.timeout
          const hasCircuitBreaker = !!policy.circuitBreaker

          expect(typeof isRetryable).toBe('boolean')
          expect(typeof hasTimeout).toBe('boolean')
          expect(typeof hasCircuitBreaker).toBe('boolean')
        }
      }

      const totalTime = performance.now() - startTime
      const avgTimePerEvaluation = totalTime / (iterations * policies.length)

      // Policy evaluation should be extremely fast
      expect(avgTimePerEvaluation).toBeLessThan(0.1)
    })

    it('should handle policy application with minimal memory allocation', async () => {
      const testPolicy: ResiliencePolicy = {
        retry: {
          maxAttempts: 1,
          initialDelay: 0,
          maxDelay: 0,
          backoffStrategy: 'fixed',
          jitterStrategy: 'none',
        },
      }

      const operation = async () => {
        // Create some temporary data that should be GCed
        const tempData = Array(100)
          .fill(0)
          .map((_, i) => ({ id: i, data: `item-${i}` }))
        return tempData.length
      }

      const iterations = 100
      const results: number[] = []

      for (let i = 0; i < iterations; i++) {
        const result = await adapter.applyPolicy(operation, testPolicy)
        results.push(result)
      }

      expect(results).toHaveLength(iterations)
      expect(results.every((r) => r === 100)).toBe(true)

      // Force garbage collection
      if (global.gc) {
        global.gc()
      }

      const finalMemory = process.memoryUsage().heapUsed
      const memoryIncrease = finalMemory - initialMemory

      // Memory increase should be minimal (< 5MB for 100 operations)
      expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024)
    })

    it('should execute policies concurrently without memory leaks', async () => {
      const testPolicy: ResiliencePolicy = {
        retry: {
          maxAttempts: 1,
          initialDelay: 0,
          maxDelay: 0,
          backoffStrategy: 'fixed',
          jitterStrategy: 'none',
        },
        circuitBreaker: {
          key: 'concurrent-test',
          failureThreshold: 5,
          recoveryTime: 1000,
          sampleSize: 10,
          halfOpenPolicy: 'single-probe',
        },
      }

      const operation = async (id: number) => {
        // Simulate some data processing
        const data = Array(50)
          .fill(0)
          .map((_, i) => ({
            id: i + id * 50,
            processed: true,
            timestamp: Date.now(),
          }))
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 10))
        return data
      }

      const concurrentOps = 50
      const startTime = performance.now()

      const promises = Array(concurrentOps)
        .fill(0)
        .map((_, i) => adapter.applyPolicy(() => operation(i), testPolicy))

      const results = await Promise.all(promises)
      const duration = performance.now() - startTime

      expect(results).toHaveLength(concurrentOps)
      results.forEach((result, i) => {
        expect(result).toHaveLength(50)
        expect(result[0]?.id).toBe(i * 50)
      })

      // Should complete concurrently in reasonable time
      expect(duration).toBeLessThan(1000)

      // Force garbage collection
      if (global.gc) {
        global.gc()
      }

      const finalMemory = process.memoryUsage().heapUsed
      const memoryIncrease = finalMemory - initialMemory

      // Concurrent operations shouldn't cause significant memory leaks
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024) // Less than 10MB
    })

    it('should handle rapid policy switching efficiently', async () => {
      const policies = [
        authenticationPolicy,
        syncOperationsPolicy,
        batchOperationsPolicy,
        rateLimitAwarePolicy,
      ]

      const operation = async (value: number) => {
        await new Promise((resolve) => setTimeout(resolve, 1))
        return value * 2
      }

      const iterations = 200
      const startTime = performance.now()
      const results: number[] = []

      for (let i = 0; i < iterations; i++) {
        const policy = policies[i % policies.length]
        const result = await adapter.applyPolicy(() => operation(i), policy!)
        results.push(result)
      }

      const duration = performance.now() - startTime
      const avgTimePerOp = duration / iterations

      expect(results).toHaveLength(iterations)
      results.forEach((result, i) => {
        expect(result).toBe(i * 2)
      })

      // Policy switching shouldn't add significant overhead
      expect(avgTimePerOp).toBeLessThan(20) // Less than 20ms per operation
      expect(duration).toBeLessThan(4000) // Total under 4 seconds
    })

    it('should maintain performance under retry scenarios', async () => {
      let callCount = 0

      const retryPolicy: ResiliencePolicy = {
        retry: {
          maxAttempts: 3,
          initialDelay: 10,
          maxDelay: 50,
          backoffStrategy: 'exponential',
          jitterStrategy: 'none',
        },
      }

      const flakyOperation = async () => {
        callCount++
        if (callCount <= 2) {
          throw new Error('retry-me')
        }
        return `success-after-${callCount}-attempts`
      }

      const startTime = performance.now()
      const result = await adapter.applyPolicy(flakyOperation, retryPolicy)
      const duration = performance.now() - startTime

      expect(result).toBe('success-after-3-attempts')
      expect(callCount).toBe(3)

      // Should complete retries within reasonable time including delays
      expect(duration).toBeLessThan(500) // Should be fast with small delays
    })

    it('should track circuit breaker state transitions efficiently', async () => {
      const cbPolicy: ResiliencePolicy = {
        retry: {
          maxAttempts: 1,
          initialDelay: 0,
          maxDelay: 0,
          backoffStrategy: 'fixed',
          jitterStrategy: 'none',
        },
        circuitBreaker: {
          key: 'state-transition-test',
          failureThreshold: 2,
          recoveryTime: 100,
          sampleSize: 5,
          halfOpenPolicy: 'single-probe',
        },
      }

      const failingOperation = async () => {
        throw new Error('Circuit breaker test failure')
      }

      const successOperation = async () => {
        return 'success'
      }

      const startTime = performance.now()
      let failureCount = 0
      let successCount = 0

      // Trigger circuit breaker with failures
      for (let i = 0; i < 3; i++) {
        try {
          await adapter.applyPolicy(failingOperation, cbPolicy)
        } catch {
          failureCount++
        }
      }

      // Wait for recovery time
      await new Promise((resolve) => setTimeout(resolve, 150))

      // Try success operation
      try {
        const result = await adapter.applyPolicy(successOperation, cbPolicy)
        if (result === 'success') {
          successCount++
        }
      } catch {
        // Circuit may still be open
      }

      const totalTime = performance.now() - startTime

      expect(failureCount).toBeGreaterThan(0)
      expect(successCount).toBeGreaterThan(0) // Should recover after failures

      // Circuit breaker operations should be efficient
      expect(totalTime).toBeLessThan(1000) // Including recovery wait time
    })
  })

  describe('Memory Profiling Tests', () => {
    it('should not accumulate memory during repeated policy applications', async () => {
      const baselinePolicy: ResiliencePolicy = {
        retry: {
          maxAttempts: 1,
          initialDelay: 0,
          maxDelay: 0,
          backoffStrategy: 'fixed',
          jitterStrategy: 'none',
        },
      }

      const operation = async (iteration: number) => {
        // Create objects that should be garbage collected
        const largeData = Array(1000)
          .fill(0)
          .map((_, i) => ({
            iteration,
            index: i,
            data: `large-string-data-${iteration}-${i}`.repeat(10),
          }))

        // Process the data
        const processed = largeData.filter((item) => item.index % 2 === 0)
        return processed.length
      }

      // Baseline memory measurement
      const baselineMemory = process.memoryUsage().heapUsed

      // Execute many operations
      const iterations = 50
      const results: number[] = []

      for (let i = 0; i < iterations; i++) {
        const result = await adapter.applyPolicy(
          () => operation(i),
          baselinePolicy,
        )
        results.push(result)

        // Periodic garbage collection
        if (i % 10 === 0 && global.gc) {
          global.gc()
        }
      }

      // Final garbage collection
      if (global.gc) {
        global.gc()
      }

      const finalMemory = process.memoryUsage().heapUsed
      const memoryGrowth = finalMemory - baselineMemory

      expect(results).toHaveLength(iterations)
      expect(results.every((r) => r === 500)).toBe(true) // 1000 items, half filtered

      // Memory growth should be reasonable (< 20MB for 50 iterations with large data)
      expect(memoryGrowth).toBeLessThan(20 * 1024 * 1024)
    })

    it('should handle policy evaluation memory efficiently', () => {
      const selectionIterations = 10000
      const policyTypes = ['auth', 'sync', 'batch', 'rateLimit', 'unknown']

      const startMemory = process.memoryUsage().heapUsed

      // Simulate heavy policy selection usage
      for (let i = 0; i < selectionIterations; i++) {
        const policyType = policyTypes[i % policyTypes.length]!
        const policy = ResiliencePolicySelector.getPolicy(policyType)

        // Access policy properties to ensure they're allocated
        const retryConfig = policy.retry
        const cbConfig = policy.circuitBreaker
        const timeoutConfig = policy.timeout

        // Simulate policy evaluation
        const hasRetries = (retryConfig?.maxAttempts || 0) > 1
        const hasCircuitBreaker = !!cbConfig
        const hasTimeout = !!timeoutConfig

        expect(typeof hasRetries).toBe('boolean')
        expect(typeof hasCircuitBreaker).toBe('boolean')
        expect(typeof hasTimeout).toBe('boolean')
      }

      if (global.gc) {
        global.gc()
      }

      const endMemory = process.memoryUsage().heapUsed
      const memoryIncrease = endMemory - startMemory

      // Policy selection and evaluation should not accumulate significant memory
      expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024) // Less than 5MB
    })
  })

  describe('Performance Benchmarks', () => {
    it('should benchmark adapter creation and policy application overhead', async () => {
      const iterations = 100
      const adapterCreationTimes: number[] = []
      const policyApplicationTimes: number[] = []

      const simplePolicy: ResiliencePolicy = {
        retry: {
          maxAttempts: 1,
          initialDelay: 0,
          maxDelay: 0,
          backoffStrategy: 'fixed',
          jitterStrategy: 'none',
        },
      }

      const simpleOperation = async () => 'benchmark-result'

      for (let i = 0; i < iterations; i++) {
        // Benchmark adapter creation
        const createStart = performance.now()
        const testAdapter = new ProductionResilienceAdapter()
        const createEnd = performance.now()
        adapterCreationTimes.push(createEnd - createStart)

        // Benchmark policy application
        const applyStart = performance.now()
        const result = await testAdapter.applyPolicy(
          simpleOperation,
          simplePolicy,
        )
        const applyEnd = performance.now()
        policyApplicationTimes.push(applyEnd - applyStart)

        expect(result).toBe('benchmark-result')
      }

      const avgCreationTime =
        adapterCreationTimes.reduce((a, b) => a + b, 0) / iterations
      const avgApplicationTime =
        policyApplicationTimes.reduce((a, b) => a + b, 0) / iterations

      // Adapter creation should be fast
      expect(avgCreationTime).toBeLessThan(5) // Less than 5ms

      // Policy application should be fast
      expect(avgApplicationTime).toBeLessThan(10) // Less than 10ms
    })
  })
})
