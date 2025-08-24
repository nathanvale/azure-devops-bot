import type { AxiosError } from 'axios'

import type { AzureDevOpsApiErrorResponse } from '../types/api-responses.js'

export class AzureDevOpsError extends Error {
  public readonly code: string
  public readonly statusCode?: number
  public readonly response?: any
  public readonly isRetryable: boolean

  constructor(
    message: string,
    code: string,
    statusCode?: number,
    response?: any,
    isRetryable = false,
  ) {
    super(message)
    this.name = 'AzureDevOpsError'
    this.code = code
    this.statusCode = statusCode
    this.response = response
    this.isRetryable = isRetryable

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AzureDevOpsError)
    }
  }
}

export class AuthenticationError extends AzureDevOpsError {
  constructor(
    message = 'Authentication failed. Please check your Personal Access Token.',
  ) {
    super(message, 'AUTH_ERROR', 401, null, false)
    this.name = 'AuthenticationError'
  }
}

export class RateLimitError extends AzureDevOpsError {
  public readonly retryAfter?: number

  constructor(message = 'Rate limit exceeded', retryAfter?: number) {
    super(message, 'RATE_LIMIT_ERROR', 429, null, true)
    this.name = 'RateLimitError'
    this.retryAfter = retryAfter
  }
}

export class ValidationError extends AzureDevOpsError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400, null, false)
    this.name = 'ValidationError'
  }
}

export class NetworkError extends AzureDevOpsError {
  constructor(message = 'Network error occurred') {
    super(message, 'NETWORK_ERROR', undefined, null, true)
    this.name = 'NetworkError'
  }
}

export class TimeoutError extends AzureDevOpsError {
  constructor(message = 'Request timeout') {
    super(message, 'TIMEOUT_ERROR', undefined, null, true)
    this.name = 'TimeoutError'
  }
}

export class WorkItemNotFoundError extends AzureDevOpsError {
  public readonly workItemId: number

  constructor(workItemId: number) {
    super(
      `Work item ${workItemId} not found`,
      'WORK_ITEM_NOT_FOUND',
      404,
      null,
      false,
    )
    this.name = 'WorkItemNotFoundError'
    this.workItemId = workItemId
  }
}

export class InvalidQueryError extends AzureDevOpsError {
  public readonly query: string

  constructor(query: string, message = 'Invalid WIQL query syntax') {
    super(message, 'INVALID_QUERY', 400, null, false)
    this.name = 'InvalidQueryError'
    this.query = query
  }
}

export class ServerError extends AzureDevOpsError {
  constructor(message = 'Azure DevOps server error', statusCode = 500) {
    super(message, 'SERVER_ERROR', statusCode, null, true)
    this.name = 'ServerError'
  }
}

/**
 * Error handler utility class for processing Azure DevOps API errors
 */
export class ErrorHandler {
  /**
   * Converts axios errors to Azure DevOps specific errors
   */
  static handleAxiosError(error: AxiosError): never {
    // Network errors (no response)
    if (!error.response) {
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        throw new TimeoutError()
      }

      if (
        error.code === 'NETWORK_ERROR' ||
        error.message.includes('Network Error')
      ) {
        throw new NetworkError()
      }

      throw new AzureDevOpsError(
        error.message,
        'UNKNOWN_ERROR',
        undefined,
        null,
        true,
      )
    }

    const { status, data } = error.response
    const errorMessage = this.extractErrorMessage(data)

    // Handle specific status codes
    switch (status) {
      case 400:
        if (this.isInvalidQueryError(data)) {
          throw new InvalidQueryError('', errorMessage)
        }
        throw new ValidationError(errorMessage)

      case 401:
        throw new AuthenticationError()

      case 404:
        const workItemId = this.extractWorkItemId(error.config?.url)
        if (workItemId) {
          throw new WorkItemNotFoundError(workItemId)
        }
        throw new AzureDevOpsError(errorMessage, 'NOT_FOUND', 404)

      case 429:
        const retryAfter = this.extractRetryAfter(
          error.response.headers as Record<string, string>,
        )
        throw new RateLimitError(errorMessage, retryAfter)

      case 500:
      case 502:
      case 503:
      case 504:
        throw new ServerError(errorMessage, status)

      default:
        const isRetryable = status >= 500 || status === 408 || status === 429
        throw new AzureDevOpsError(
          errorMessage,
          `HTTP_${status}`,
          status,
          data,
          isRetryable,
        )
    }
  }

  /**
   * Extracts error message from Azure DevOps API response
   */
  private static extractErrorMessage(data: any): string {
    if (typeof data === 'string') {
      return data
    }

    if (data && typeof data === 'object') {
      // Azure DevOps error format
      if (data.message) {
        return data.message
      }

      // Alternative error formats
      if (data.error && data.error.message) {
        return data.error.message
      }

      if (data.value && data.value.message) {
        return data.value.message
      }

      // Fallback to JSON string
      try {
        return JSON.stringify(data)
      } catch {
        return 'Unknown error occurred'
      }
    }

    return 'Unknown error occurred'
  }

  /**
   * Checks if error indicates invalid WIQL query
   */
  private static isInvalidQueryError(data: any): boolean {
    if (data && typeof data === 'object') {
      const message = data.message?.toLowerCase() || ''
      const typeKey = data.typeKey?.toLowerCase() || ''

      return (
        message.includes('query') ||
        message.includes('wiql') ||
        typeKey.includes('query') ||
        typeKey.includes('invalidquery')
      )
    }

    return false
  }

  /**
   * Extracts work item ID from URL for specific error messages
   */
  private static extractWorkItemId(url?: string): number | null {
    if (!url) return null

    const match = url.match(/\/workitems?\/(\d+)/i)
    return match && match[1] ? parseInt(match[1], 10) : null
  }

  /**
   * Extracts retry-after value from response headers
   */
  private static extractRetryAfter(
    headers: Record<string, string>,
  ): number | undefined {
    const retryAfter = headers['retry-after'] || headers['x-ratelimit-reset']

    if (retryAfter) {
      const value = parseInt(retryAfter, 10)
      return isNaN(value) ? undefined : value
    }

    return undefined
  }

  /**
   * Determines if an error should be retried
   */
  static isRetryableError(error: Error): boolean {
    if (error instanceof AzureDevOpsError) {
      return error.isRetryable
    }

    // Network errors and timeouts are generally retryable
    return (
      error.message.includes('timeout') ||
      error.message.includes('ECONNRESET') ||
      error.message.includes('ECONNABORTED')
    )
  }

  /**
   * Gets retry delay for rate limit errors
   */
  static getRetryDelay(error: Error, attempt: number): number {
    if (error instanceof RateLimitError && error.retryAfter) {
      return error.retryAfter * 1000 // Convert to milliseconds
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
    const baseDelay = 1000
    const backoffFactor = 2
    const maxDelay = 30000

    const delay = baseDelay * Math.pow(backoffFactor, attempt - 1)
    return Math.min(delay, maxDelay)
  }

  /**
   * Creates error summary for logging
   */
  static createErrorSummary(error: Error): ErrorSummary {
    if (error instanceof AzureDevOpsError) {
      return {
        type: error.name,
        code: error.code,
        message: error.message,
        statusCode: error.statusCode,
        isRetryable: error.isRetryable,
      }
    }

    return {
      type: error.name || 'Error',
      code: 'UNKNOWN',
      message: error.message,
      statusCode: undefined,
      isRetryable: this.isRetryableError(error),
    }
  }
}

export interface ErrorSummary {
  type: string
  code: string
  message: string
  statusCode?: number
  isRetryable: boolean
}
