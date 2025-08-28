import { describe, it, expect } from 'vitest'

import { ErrorClassifier, ErrorType } from '../error-classification.js'

describe('ErrorClassifier', () => {
  describe('classify', () => {
    describe('Authentication Errors', () => {
      it('classifies 401 as AUTHENTICATION error with INVALID_TOKEN code', () => {
        const error = {
          status: 401,
          statusText: 'Unauthorized',
          message: 'Invalid token',
        }

        const result = ErrorClassifier.classify(error)

        expect(result).toEqual({
          type: ErrorType.AUTHENTICATION,
          code: 'INVALID_TOKEN',
          message:
            'PAT token is invalid or expired. Please verify AZURE_DEVOPS_PAT environment variable contains a valid Personal Access Token.',
          retryable: false,
          originalError: error,
        })
      })

      it('classifies 403 as AUTHENTICATION error with INSUFFICIENT_PERMISSIONS code', () => {
        const error = {
          status: 403,
          statusText: 'Forbidden',
          message: 'Access denied',
        }

        const result = ErrorClassifier.classify(error)

        expect(result).toEqual({
          type: ErrorType.AUTHENTICATION,
          code: 'INSUFFICIENT_PERMISSIONS',
          message:
            'PAT token lacks required permissions. Please ensure the token has "Work Items (read)" scope enabled in Azure DevOps.',
          retryable: false,
          originalError: error,
        })
      })
    })

    describe('Rate Limit Errors', () => {
      it('classifies 429 as RATE_LIMIT error with delay from retry-after header', () => {
        const error = {
          status: 429,
          statusText: 'Too Many Requests',
          message: 'Rate limit exceeded',
          headers: {
            'retry-after': '60',
          },
        }

        const result = ErrorClassifier.classify(error)

        expect(result).toEqual({
          type: ErrorType.RATE_LIMIT,
          code: 'RATE_LIMITED',
          message: 'Rate limit exceeded. Server requests retry after 60000ms',
          retryable: true,
          retryDelayMs: 60000,
          originalError: error,
        })
      })

      it('calculates delay from x-ratelimit-reset header when available', () => {
        const futureTimestamp = Math.floor((Date.now() + 120000) / 1000) // 2 minutes from now
        const error = {
          status: 429,
          statusText: 'Too Many Requests',
          message: 'Rate limit exceeded',
          headers: {
            'x-ratelimit-reset': futureTimestamp.toString(),
          },
        }

        const result = ErrorClassifier.classify(error)

        expect(result.type).toBe(ErrorType.RATE_LIMIT)
        expect(result.retryDelayMs).toBeGreaterThan(110000) // At least ~2 minutes
        expect(result.retryDelayMs).toBeLessThan(130000) // But not more than ~2 minutes + buffer
      })

      it('uses default delay when no rate limit headers present', () => {
        const error = {
          status: 429,
          statusText: 'Too Many Requests',
          message: 'Rate limit exceeded',
          headers: {},
        }

        const result = ErrorClassifier.classify(error)

        expect(result.retryDelayMs).toBe(60000) // Default 1 minute
      })

      it('caps retry-after delay at 5 minutes maximum', () => {
        const error = {
          status: 429,
          statusText: 'Too Many Requests',
          message: 'Rate limit exceeded',
          headers: {
            'retry-after': '600', // 10 minutes
          },
        }

        const result = ErrorClassifier.classify(error)

        expect(result.retryDelayMs).toBe(300000) // Capped at 5 minutes
      })
    })

    describe('Network Errors', () => {
      it('classifies ECONNRESET as NETWORK error', () => {
        const error = {
          code: 'ECONNRESET',
          message: 'Connection reset by peer',
        }

        const result = ErrorClassifier.classify(error)

        expect(result).toEqual({
          type: ErrorType.NETWORK,
          code: 'NETWORK_ERROR',
          message: 'Network connectivity issue: ECONNRESET',
          retryable: true,
          retryDelayMs: 1000,
          originalError: error,
        })
      })

      it('classifies ECONNREFUSED as NETWORK error', () => {
        const error = {
          code: 'ECONNREFUSED',
          message: 'Connection refused',
        }

        const result = ErrorClassifier.classify(error)

        expect(result.type).toBe(ErrorType.NETWORK)
        expect(result.retryable).toBe(true)
      })

      it('classifies ETIMEDOUT as NETWORK error', () => {
        const error = {
          code: 'ETIMEDOUT',
          message: 'Request timeout',
        }

        const result = ErrorClassifier.classify(error)

        expect(result.type).toBe(ErrorType.NETWORK)
        expect(result.retryable).toBe(true)
      })

      it('classifies ENOTFOUND as NETWORK error', () => {
        const error = {
          code: 'ENOTFOUND',
          message: 'DNS lookup failed',
        }

        const result = ErrorClassifier.classify(error)

        expect(result.type).toBe(ErrorType.NETWORK)
        expect(result.retryable).toBe(true)
      })

      it('classifies ECONNABORTED as NETWORK error', () => {
        const error = {
          code: 'ECONNABORTED',
          message: 'Request aborted',
        }

        const result = ErrorClassifier.classify(error)

        expect(result.type).toBe(ErrorType.NETWORK)
        expect(result.retryable).toBe(true)
      })

      it('classifies errors with network codes but without status as NETWORK error', () => {
        const error = {
          code: 'ECONNRESET',
          message: 'Network error without status',
        }

        const result = ErrorClassifier.classify(error)

        expect(result.type).toBe(ErrorType.NETWORK)
        expect(result.retryable).toBe(true)
      })
    })

    describe('Server Errors', () => {
      it('classifies 500 as SERVER error', () => {
        const error = {
          status: 500,
          statusText: 'Internal Server Error',
          message: 'Server error',
        }

        const result = ErrorClassifier.classify(error)

        expect(result).toEqual({
          type: ErrorType.SERVER,
          code: 'SERVER_ERROR',
          message: 'Azure DevOps server error: 500 Internal Server Error',
          retryable: true,
          retryDelayMs: 2000,
          originalError: error,
        })
      })

      it('classifies 502 as SERVER error', () => {
        const error = {
          status: 502,
          statusText: 'Bad Gateway',
        }

        const result = ErrorClassifier.classify(error)

        expect(result.type).toBe(ErrorType.SERVER)
        expect(result.retryable).toBe(true)
      })

      it('classifies 503 as SERVER error', () => {
        const error = {
          status: 503,
          statusText: 'Service Unavailable',
        }

        const result = ErrorClassifier.classify(error)

        expect(result.type).toBe(ErrorType.SERVER)
        expect(result.retryable).toBe(true)
      })

      it('classifies 504 as SERVER error', () => {
        const error = {
          status: 504,
          statusText: 'Gateway Timeout',
        }

        const result = ErrorClassifier.classify(error)

        expect(result.type).toBe(ErrorType.SERVER)
        expect(result.retryable).toBe(true)
      })
    })

    describe('Validation Errors', () => {
      it('classifies 400 as VALIDATION error', () => {
        const error = {
          status: 400,
          statusText: 'Bad Request',
          message: 'Invalid request',
        }

        const result = ErrorClassifier.classify(error)

        expect(result).toEqual({
          type: ErrorType.VALIDATION,
          code: 'CLIENT_ERROR',
          message: 'Request validation failed: 400 Bad Request',
          retryable: false,
          originalError: error,
        })
      })

      it('classifies 404 as VALIDATION error', () => {
        const error = {
          status: 404,
          statusText: 'Not Found',
        }

        const result = ErrorClassifier.classify(error)

        expect(result.type).toBe(ErrorType.VALIDATION)
        expect(result.retryable).toBe(false)
      })

      it('classifies 422 as VALIDATION error', () => {
        const error = {
          status: 422,
          statusText: 'Unprocessable Entity',
        }

        const result = ErrorClassifier.classify(error)

        expect(result.type).toBe(ErrorType.VALIDATION)
        expect(result.retryable).toBe(false)
      })
    })

    describe('Unknown Errors', () => {
      it('classifies unknown errors as VALIDATION with UNKNOWN_ERROR code', () => {
        const error = {
          message: 'Something unexpected happened',
        }

        const result = ErrorClassifier.classify(error)

        expect(result.type).toBe(ErrorType.VALIDATION)
        expect(result.code).toBe('UNKNOWN_ERROR')
        expect(result.message).toBe('Unclassified error: Something unexpected happened')
        expect(result.retryable).toBe(false)
        expect(result.originalError).toBeInstanceOf(Error)
      })

      it('handles errors without message', () => {
        const error = {}

        const result = ErrorClassifier.classify(error)

        expect(result.type).toBe(ErrorType.VALIDATION)
        expect(result.code).toBe('UNKNOWN_ERROR')
        expect(result.message).toBe(
          'Unclassified error: Unknown error occurred',
        )
        expect(result.retryable).toBe(false)
      })
    })
  })

  describe('createRetryPredicate', () => {
    const retryPredicate = ErrorClassifier.createRetryPredicate()

    it('returns false for AUTHENTICATION errors', () => {
      const authError = {
        status: 401,
        message: 'Unauthorized',
      }

      const shouldRetry = retryPredicate(authError)

      expect(shouldRetry).toBe(false)
    })

    it('returns false for VALIDATION errors', () => {
      const validationError = {
        status: 400,
        message: 'Bad Request',
      }

      const shouldRetry = retryPredicate(validationError)

      expect(shouldRetry).toBe(false)
    })

    it('returns true for RATE_LIMIT errors', () => {
      const rateLimitError = {
        status: 429,
        message: 'Rate limit exceeded',
      }

      const shouldRetry = retryPredicate(rateLimitError)

      expect(shouldRetry).toBe(true)
    })

    it('returns true for NETWORK errors', () => {
      const networkError = {
        code: 'ECONNRESET',
        message: 'Connection reset',
      }

      const shouldRetry = retryPredicate(networkError)

      expect(shouldRetry).toBe(true)
    })

    it('returns true for SERVER errors', () => {
      const serverError = {
        status: 500,
        message: 'Internal server error',
      }

      const shouldRetry = retryPredicate(serverError)

      expect(shouldRetry).toBe(true)
    })

    it('returns false for unknown errors by default', () => {
      const unknownError = {
        message: 'Unknown error',
      }

      const shouldRetry = retryPredicate(unknownError)

      expect(shouldRetry).toBe(false)
    })
  })

  describe('Rate Limit Delay Calculation', () => {
    describe('calculateRateLimitDelay', () => {
      it('uses retry-after header when available', () => {
        const error = {
          status: 429,
          headers: { 'retry-after': '30' },
        }

        const result = ErrorClassifier.classify(error)

        expect(result.retryDelayMs).toBe(30000)
      })

      it('uses x-ratelimit-reset header when retry-after not available', () => {
        const resetTime = Math.floor((Date.now() + 45000) / 1000) // 45 seconds from now
        const error = {
          status: 429,
          headers: { 'x-ratelimit-reset': resetTime.toString() },
        }

        const result = ErrorClassifier.classify(error)

        expect(result.retryDelayMs).toBeGreaterThan(40000)
        expect(result.retryDelayMs).toBeLessThan(50000)
      })

      it('prefers retry-after over x-ratelimit-reset when both present', () => {
        const resetTime = Math.floor((Date.now() + 120000) / 1000) // 2 minutes from now
        const error = {
          status: 429,
          headers: {
            'retry-after': '30',
            'x-ratelimit-reset': resetTime.toString(),
          },
        }

        const result = ErrorClassifier.classify(error)

        expect(result.retryDelayMs).toBe(30000) // Should use retry-after, not reset time
      })

      it('ensures minimum delay of 1 second for reset time calculations', () => {
        const pastTime = Math.floor((Date.now() - 5000) / 1000) // 5 seconds ago
        const error = {
          status: 429,
          headers: { 'x-ratelimit-reset': pastTime.toString() },
        }

        const result = ErrorClassifier.classify(error)

        expect(result.retryDelayMs).toBe(1000) // Minimum delay
      })

      it('caps delay at 5 minutes maximum', () => {
        const farFutureTime = Math.floor((Date.now() + 600000) / 1000) // 10 minutes from now
        const error = {
          status: 429,
          headers: { 'x-ratelimit-reset': farFutureTime.toString() },
        }

        const result = ErrorClassifier.classify(error)

        expect(result.retryDelayMs).toBe(300000) // Capped at 5 minutes
      })

      it('defaults to 1 minute when no headers available', () => {
        const error = {
          status: 429,
          headers: {},
        }

        const result = ErrorClassifier.classify(error)

        expect(result.retryDelayMs).toBe(60000)
      })
    })
  })
})
