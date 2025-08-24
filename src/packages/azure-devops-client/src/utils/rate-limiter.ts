import pLimit from 'p-limit'

import type { RateLimitConfig, RateLimitHeaders } from '../types/config.js'

export class RateLimiter {
  private readonly maxConcurrent: number
  private readonly requestsPerSecond: number
  private readonly respectHeaders: boolean
  private readonly limiter: ReturnType<typeof pLimit>
  private lastRequestTime = 0
  private requestCount = 0
  private windowStart = Date.now()
  private currentLimits: RateLimitInfo | null = null

  constructor(
    config: RateLimitConfig = {
      maxConcurrent: 10,
      requestsPerSecond: 5,
      respectHeaders: true,
    },
  ) {
    this.maxConcurrent = config.maxConcurrent
    this.requestsPerSecond = config.requestsPerSecond
    this.respectHeaders = config.respectHeaders
    this.limiter = pLimit(this.maxConcurrent)
  }

  /**
   * Wraps a request function with rate limiting
   */
  async execute<T>(requestFn: () => Promise<T>): Promise<T> {
    return this.limiter(async () => {
      await this.enforceRateLimit()
      return requestFn()
    })
  }

  /**
   * Updates rate limit information from response headers
   */
  updateFromHeaders(headers: Record<string, string>): void {
    if (!this.respectHeaders) return

    const rateLimitHeaders = this.parseRateLimitHeaders(headers)
    if (rateLimitHeaders) {
      this.currentLimits = {
        limit: parseInt(rateLimitHeaders['x-ratelimit-limit']),
        remaining: parseInt(rateLimitHeaders['x-ratelimit-remaining']),
        reset: parseInt(rateLimitHeaders['x-ratelimit-reset']),
        resource: rateLimitHeaders['x-ratelimit-resource'],
      }
    }
  }

  /**
   * Gets current rate limit status
   */
  getRateLimitStatus(): RateLimitStatus {
    return {
      maxConcurrent: this.maxConcurrent,
      requestsPerSecond: this.requestsPerSecond,
      currentLimits: this.currentLimits,
      isThrottling: this.isCurrentlyThrottling(),
      estimatedWaitTime: this.getEstimatedWaitTime(),
    }
  }

  /**
   * Enforces rate limiting based on local and server limits
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now()

    // Reset counter if window has passed
    if (now - this.windowStart >= 1000) {
      this.requestCount = 0
      this.windowStart = now
    }

    // Check local rate limit
    if (this.requestCount >= this.requestsPerSecond) {
      const waitTime = 1000 - (now - this.windowStart)
      if (waitTime > 0) {
        await this.delay(waitTime)
        this.requestCount = 0
        this.windowStart = Date.now()
      }
    }

    // Check server rate limit headers if available
    if (this.respectHeaders && this.currentLimits) {
      if (this.currentLimits.remaining <= 1) {
        const resetTime = this.currentLimits.reset * 1000
        const waitTime = resetTime - now
        if (waitTime > 0) {
          await this.delay(Math.min(waitTime, 60000)) // Max 60 second wait
        }
      }
    }

    // Ensure minimum time between requests
    const timeSinceLastRequest = now - this.lastRequestTime
    const minInterval = 1000 / this.requestsPerSecond
    if (timeSinceLastRequest < minInterval) {
      await this.delay(minInterval - timeSinceLastRequest)
    }

    this.requestCount++
    this.lastRequestTime = Date.now()
  }

  /**
   * Parses rate limit headers from response
   */
  private parseRateLimitHeaders(
    headers: Record<string, string>,
  ): RateLimitHeaders | null {
    const rateLimitHeaders: Partial<RateLimitHeaders> = {}

    const headerKeys = [
      'x-ratelimit-resource',
      'x-ratelimit-delay',
      'x-ratelimit-limit',
      'x-ratelimit-remaining',
      'x-ratelimit-reset',
    ] as const

    for (const key of headerKeys) {
      // Check for exact match and case variations
      let value = headers[key]

      if (!value) {
        // Check all header keys case-insensitively
        for (const headerKey in headers) {
          if (headerKey.toLowerCase() === key.toLowerCase()) {
            value = headers[headerKey]
            break
          }
        }
      }

      if (value) {
        rateLimitHeaders[key] = value
      }
    }

    // Only return if we have the essential headers
    if (
      rateLimitHeaders['x-ratelimit-limit'] &&
      rateLimitHeaders['x-ratelimit-remaining']
    ) {
      return rateLimitHeaders as RateLimitHeaders
    }

    return null
  }

  /**
   * Checks if currently throttling requests
   */
  private isCurrentlyThrottling(): boolean {
    const now = Date.now()

    // Check local throttling
    if (this.requestCount >= this.requestsPerSecond) {
      const timeInWindow = now - this.windowStart
      if (timeInWindow < 1000) {
        return true
      }
    }

    // Check server throttling
    if (this.respectHeaders && this.currentLimits) {
      return this.currentLimits.remaining <= 1
    }

    return false
  }

  /**
   * Gets estimated wait time before next request can be made
   */
  private getEstimatedWaitTime(): number {
    const now = Date.now()
    let waitTime = 0

    // Local rate limit wait time
    if (this.requestCount >= this.requestsPerSecond) {
      const timeInWindow = now - this.windowStart
      if (timeInWindow < 1000) {
        waitTime = Math.max(waitTime, 1000 - timeInWindow)
      }
    }

    // Server rate limit wait time
    if (
      this.respectHeaders &&
      this.currentLimits &&
      this.currentLimits.remaining <= 1
    ) {
      const resetTime = this.currentLimits.reset * 1000
      const serverWaitTime = resetTime - now
      if (serverWaitTime > 0) {
        waitTime = Math.max(waitTime, Math.min(serverWaitTime, 60000))
      }
    }

    // Minimum interval wait time
    const timeSinceLastRequest = now - this.lastRequestTime
    const minInterval = 1000 / this.requestsPerSecond
    if (timeSinceLastRequest < minInterval) {
      waitTime = Math.max(waitTime, minInterval - timeSinceLastRequest)
    }

    return waitTime
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

interface RateLimitInfo {
  limit: number
  remaining: number
  reset: number
  resource: string
}

export interface RateLimitStatus {
  maxConcurrent: number
  requestsPerSecond: number
  currentLimits: RateLimitInfo | null
  isThrottling: boolean
  estimatedWaitTime: number
}
