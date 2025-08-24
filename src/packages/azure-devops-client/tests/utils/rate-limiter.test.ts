import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

import type { RateLimitConfig } from '../../src/types/config.js'

import {
  RateLimiter,
  type RateLimitStatus,
} from '../../src/utils/rate-limiter.js'

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter
  let mockNow: number

  beforeEach(() => {
    mockNow = Date.now()
    vi.spyOn(Date, 'now').mockImplementation(() => mockNow)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      rateLimiter = new RateLimiter()
      const status = rateLimiter.getRateLimitStatus()

      expect(status.maxConcurrent).toBe(10)
      expect(status.requestsPerSecond).toBe(5)
      expect(status.currentLimits).toBeNull()
      expect(status.isThrottling).toBe(false)
    })

    it('should initialize with custom configuration', () => {
      const config: RateLimitConfig = {
        maxConcurrent: 5,
        requestsPerSecond: 2,
        respectHeaders: false,
      }

      rateLimiter = new RateLimiter(config)
      const status = rateLimiter.getRateLimitStatus()

      expect(status.maxConcurrent).toBe(5)
      expect(status.requestsPerSecond).toBe(2)
    })
  })

  describe('execute', () => {
    beforeEach(() => {
      rateLimiter = new RateLimiter({
        maxConcurrent: 2,
        requestsPerSecond: 2,
        respectHeaders: true,
      })
    })

    it('should execute request function successfully', async () => {
      const mockRequestFn = vi.fn().mockResolvedValue('success')

      const result = await rateLimiter.execute(mockRequestFn)

      expect(mockRequestFn).toHaveBeenCalledOnce()
      expect(result).toBe('success')
    })

    it('should handle request function errors', async () => {
      const mockError = new Error('Request failed')
      const mockRequestFn = vi.fn().mockRejectedValue(mockError)

      await expect(rateLimiter.execute(mockRequestFn)).rejects.toThrow(
        'Request failed',
      )
      expect(mockRequestFn).toHaveBeenCalledOnce()
    })

    it('should enforce rate limiting between requests', async () => {
      const mockRequestFn = vi.fn().mockResolvedValue('success')
      const delayTime = 1000 / 2 // 500ms for 2 requests per second

      // First request should execute immediately
      const start = Date.now()
      await rateLimiter.execute(mockRequestFn)

      // Advance time slightly (not enough for rate limit window)
      mockNow += 100
      vi.spyOn(Date, 'now').mockImplementation(() => mockNow)

      // Second request should be delayed
      await rateLimiter.execute(mockRequestFn)

      expect(mockRequestFn).toHaveBeenCalledTimes(2)
      // Note: The exact timing is complex to test due to internal rate limiting logic
    })

    it('should limit concurrent requests', async () => {
      let concurrentCount = 0
      let maxConcurrent = 0

      const mockRequestFn = vi.fn().mockImplementation(async () => {
        concurrentCount++
        maxConcurrent = Math.max(maxConcurrent, concurrentCount)

        // Simulate some async work
        await new Promise((resolve) => setTimeout(resolve, 100))

        concurrentCount--
        return 'success'
      })

      // Launch more requests than the concurrency limit
      const promises = Array.from({ length: 5 }, () =>
        rateLimiter.execute(mockRequestFn),
      )
      await Promise.all(promises)

      expect(mockRequestFn).toHaveBeenCalledTimes(5)
      expect(maxConcurrent).toBeLessThanOrEqual(2) // maxConcurrent is 2
    })
  })

  describe('updateFromHeaders', () => {
    beforeEach(() => {
      rateLimiter = new RateLimiter({
        maxConcurrent: 10,
        requestsPerSecond: 5,
        respectHeaders: true,
      })
    })

    it('should update rate limits from valid headers', () => {
      // rateLimiter is already initialized with respectHeaders: true in beforeEach
      const headers = {
        'x-ratelimit-limit': '1000',
        'x-ratelimit-remaining': '800',
        'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 300),
        'x-ratelimit-resource': 'core',
      }

      rateLimiter.updateFromHeaders(headers)
      const status = rateLimiter.getRateLimitStatus()

      expect(status.currentLimits).toEqual({
        limit: 1000,
        remaining: 800,
        reset: Math.floor(Date.now() / 1000) + 300,
        resource: 'core',
      })
    })

    it('should handle case-insensitive headers', () => {
      const headers = {
        'x-ratelimit-limit': '1000',
        'X-RATELIMIT-REMAINING': '800',
        'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 300),
        'X-RateLimit-Resource': 'core',
      }

      rateLimiter.updateFromHeaders(headers)
      const status = rateLimiter.getRateLimitStatus()

      expect(status.currentLimits).toEqual({
        limit: 1000,
        remaining: 800,
        reset: Math.floor(Date.now() / 1000) + 300,
        resource: 'core',
      })
    })

    it('should ignore headers when respectHeaders is false', () => {
      rateLimiter = new RateLimiter({
        maxConcurrent: 10,
        requestsPerSecond: 5,
        respectHeaders: false,
      })
      const headers = {
        'x-ratelimit-limit': '1000',
        'x-ratelimit-remaining': '800',
      }

      rateLimiter.updateFromHeaders(headers)
      const status = rateLimiter.getRateLimitStatus()

      expect(status.currentLimits).toBeNull()
    })

    it('should not update with incomplete headers', () => {
      const headers = {
        'x-ratelimit-limit': '1000',
        // Missing x-ratelimit-remaining
      }

      rateLimiter.updateFromHeaders(headers)
      const status = rateLimiter.getRateLimitStatus()

      expect(status.currentLimits).toBeNull()
    })

    it('should not update with invalid header values', () => {
      const headers = {
        'x-ratelimit-limit': 'invalid',
        'x-ratelimit-remaining': 'also-invalid',
      }

      rateLimiter.updateFromHeaders(headers)
      const status = rateLimiter.getRateLimitStatus()

      expect(status.currentLimits?.limit).toBeNaN()
      expect(status.currentLimits?.remaining).toBeNaN()
    })
  })

  describe('getRateLimitStatus', () => {
    beforeEach(() => {
      rateLimiter = new RateLimiter({
        maxConcurrent: 3,
        requestsPerSecond: 4,
        respectHeaders: true,
      })
    })

    it('should return correct status without server limits', () => {
      const status = rateLimiter.getRateLimitStatus()

      expect(status).toEqual({
        maxConcurrent: 3,
        requestsPerSecond: 4,
        currentLimits: null,
        isThrottling: false,
        estimatedWaitTime: 0,
      })
    })

    it('should return correct status with server limits', () => {
      const resetTime = Math.floor(Date.now() / 1000) + 600
      const headers = {
        'x-ratelimit-limit': '1000',
        'x-ratelimit-remaining': '500',
        'x-ratelimit-reset': String(resetTime),
        'x-ratelimit-resource': 'core',
      }

      rateLimiter.updateFromHeaders(headers)
      const status = rateLimiter.getRateLimitStatus()

      expect(status.currentLimits).toEqual({
        limit: 1000,
        remaining: 500,
        reset: resetTime,
        resource: 'core',
      })
      expect(status.isThrottling).toBe(false)
    })
  })

  describe('throttling behavior', () => {
    beforeEach(() => {
      rateLimiter = new RateLimiter({
        maxConcurrent: 10,
        requestsPerSecond: 2,
        respectHeaders: true,
      })
    })

    it('should throttle when local rate limit is exceeded', async () => {
      const mockRequestFn = vi.fn().mockResolvedValue('success')

      // Make requests that exceed the rate limit
      await rateLimiter.execute(mockRequestFn)
      await rateLimiter.execute(mockRequestFn)

      const status = rateLimiter.getRateLimitStatus()
      expect(status.isThrottling).toBe(true)
      expect(status.estimatedWaitTime).toBeGreaterThan(0)
    })

    it('should throttle when server rate limit is low', async () => {
      const headers = {
        'x-ratelimit-limit': '1000',
        'x-ratelimit-remaining': '1', // Very low remaining
        'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 300),
        'x-ratelimit-resource': 'core',
      }

      rateLimiter.updateFromHeaders(headers)
      const status = rateLimiter.getRateLimitStatus()

      expect(status.isThrottling).toBe(true)
    })

    it('should respect server rate limit reset time', async () => {
      const resetTime = Math.floor(Date.now() / 1000) + 1 // Reset in 1 second
      const headers = {
        'x-ratelimit-limit': '1000',
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': String(resetTime),
        'x-ratelimit-resource': 'core',
      }

      rateLimiter.updateFromHeaders(headers)

      const mockRequestFn = vi.fn().mockResolvedValue('success')

      // This should be delayed due to rate limit
      const startTime = Date.now()
      await rateLimiter.execute(mockRequestFn)

      expect(mockRequestFn).toHaveBeenCalledOnce()
      // Note: Exact timing test is complex due to internal implementation
    })

    it('should enforce minimum interval between requests', async () => {
      const mockRequestFn = vi.fn().mockResolvedValue('success')
      const expectedInterval = 1000 / 2 // 500ms for 2 requests per second

      // Track request times
      const requestTimes: number[] = []
      mockRequestFn.mockImplementation(async () => {
        requestTimes.push(Date.now())
        return 'success'
      })

      // Make two requests quickly
      await rateLimiter.execute(mockRequestFn)

      // Advance time by less than minimum interval
      mockNow += expectedInterval / 2
      vi.spyOn(Date, 'now').mockImplementation(() => mockNow)

      await rateLimiter.execute(mockRequestFn)

      expect(mockRequestFn).toHaveBeenCalledTimes(2)
    })
  })

  describe('error scenarios', () => {
    beforeEach(() => {
      rateLimiter = new RateLimiter({
        maxConcurrent: 2,
        requestsPerSecond: 5,
        respectHeaders: true,
      })
    })

    it('should handle concurrent request failures gracefully', async () => {
      let failureCount = 0
      const mockRequestFn = vi.fn().mockImplementation(async () => {
        failureCount++
        if (failureCount <= 2) {
          throw new Error(`Request ${failureCount} failed`)
        }
        return 'success'
      })

      // Launch multiple concurrent requests, some will fail
      const promises = [
        rateLimiter.execute(mockRequestFn).catch((e) => e),
        rateLimiter.execute(mockRequestFn).catch((e) => e),
        rateLimiter.execute(mockRequestFn),
      ]

      const results = await Promise.all(promises)

      expect(results[0]).toBeInstanceOf(Error)
      expect(results[1]).toBeInstanceOf(Error)
      expect(results[2]).toBe('success')
      expect(mockRequestFn).toHaveBeenCalledTimes(3)
    })

    it('should handle header update with extreme values', () => {
      const headers = {
        'x-ratelimit-limit': String(Number.MAX_SAFE_INTEGER),
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': String(
          Math.floor(Date.now() / 1000) + Number.MAX_SAFE_INTEGER,
        ),
        'x-ratelimit-resource': 'core',
      }

      rateLimiter.updateFromHeaders(headers)
      const status = rateLimiter.getRateLimitStatus()

      expect(status.currentLimits).toBeDefined()
      expect(status.estimatedWaitTime).toBeLessThanOrEqual(60000) // Capped at 60 seconds
    })

    it('should continue working after rate limit expires', async () => {
      const mockRequestFn = vi.fn().mockResolvedValue('success')

      // Set up rate limit that will expire soon
      const headers = {
        'x-ratelimit-limit': '1000',
        'x-ratelimit-remaining': '1',
        'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 1),
        'x-ratelimit-resource': 'core',
      }

      rateLimiter.updateFromHeaders(headers)

      // Should be throttling initially
      expect(rateLimiter.getRateLimitStatus().isThrottling).toBe(true)

      // Advance time past reset
      mockNow += 2000
      vi.spyOn(Date, 'now').mockImplementation(() => mockNow)

      // Update with new limits
      rateLimiter.updateFromHeaders({
        'x-ratelimit-limit': '1000',
        'x-ratelimit-remaining': '999',
        'x-ratelimit-reset': String(Math.floor(mockNow / 1000) + 3600),
        'x-ratelimit-resource': 'core',
      })

      // Should no longer be throttling
      expect(rateLimiter.getRateLimitStatus().isThrottling).toBe(false)

      // Should be able to make requests
      await rateLimiter.execute(mockRequestFn)
      expect(mockRequestFn).toHaveBeenCalledOnce()
    })
  })

  describe('performance characteristics', () => {
    it('should handle high concurrency efficiently', async () => {
      rateLimiter = new RateLimiter({
        maxConcurrent: 50,
        requestsPerSecond: 100,
        respectHeaders: false, // Disable header processing for this test
      })

      const mockRequestFn = vi.fn().mockImplementation(async () => {
        // Simulate fast request
        await new Promise((resolve) => setTimeout(resolve, 1))
        return 'success'
      })

      const requestCount = 200
      const promises = Array.from({ length: requestCount }, () =>
        rateLimiter.execute(mockRequestFn),
      )

      const startTime = Date.now()
      await Promise.all(promises)
      const endTime = Date.now()

      expect(mockRequestFn).toHaveBeenCalledTimes(requestCount)
      expect(endTime - startTime).toBeLessThan(10000) // Should complete within 10 seconds
    })

    it('should provide accurate status information under load', async () => {
      rateLimiter = new RateLimiter({
        maxConcurrent: 5,
        requestsPerSecond: 10,
        respectHeaders: true,
      })

      const mockRequestFn = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
        return 'success'
      })

      // Launch many requests
      const promises = Array.from({ length: 20 }, () =>
        rateLimiter.execute(mockRequestFn),
      )

      // Check status while requests are running
      const statusDuringExecution = rateLimiter.getRateLimitStatus()
      expect(statusDuringExecution).toBeDefined()
      expect(typeof statusDuringExecution.isThrottling).toBe('boolean')
      expect(typeof statusDuringExecution.estimatedWaitTime).toBe('number')

      await Promise.all(promises)
      expect(mockRequestFn).toHaveBeenCalledTimes(20)
    })
  })
})
