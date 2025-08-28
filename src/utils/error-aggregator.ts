import type { Logger } from '@orchestr8/logger'

import { getLogger } from './logger.js'

export interface ErrorSummary {
  totalErrors: number
  errorsByType: Record<string, number>
  errorDetails: Array<{
    type: string
    message: string
    workItemId?: number
    timestamp: Date
    retryCount?: number
  }>
  syncMetrics: {
    totalAttempted: number
    totalSucceeded: number
    totalFailed: number
    successRate: number
    startTime: Date
    endTime?: Date
    durationMs?: number
  }
}

export class ErrorAggregator {
  private errors: Array<{
    type: string
    message: string
    workItemId?: number
    timestamp: Date
    retryCount?: number
  }> = []

  private syncMetrics = {
    totalAttempted: 0,
    totalSucceeded: 0,
    totalFailed: 0,
    startTime: new Date(),
    endTime: undefined as Date | undefined,
  }

  private logger: Logger

  constructor(logger?: Logger) {
    // Use provided logger or try to get global logger, fallback to console
    if (logger) {
      this.logger = logger
    } else {
      try {
        this.logger = getLogger()
      } catch {
        // Fallback to console if global logger not initialized
        // Use originalConsole if available (for quiet mode), otherwise regular console
        const originalConsole = (global as { originalConsole?: typeof console })
          .originalConsole
        const safeConsole = originalConsole || console

        this.logger = {
          debug: safeConsole.debug?.bind?.(safeConsole) || (() => {}),
          info: safeConsole.info?.bind?.(safeConsole) || (() => {}),
          warn: safeConsole.warn?.bind?.(safeConsole) || (() => {}),
          error: safeConsole.error?.bind?.(safeConsole) || (() => {}),
          trace: safeConsole.trace?.bind?.(safeConsole) || (() => {}),
          child: () => this.logger,
        } as Logger
      }
    }
  }

  /**
   * Record a successful operation
   */
  recordSuccess(workItemId?: number): void {
    this.syncMetrics.totalSucceeded++
    this.syncMetrics.totalAttempted++

    this.logger.debug('Operation succeeded', {
      component: 'error-aggregator',
      workItemId,
      totalSucceeded: this.syncMetrics.totalSucceeded,
    })
  }

  /**
   * Record an error with categorization
   */
  recordError(
    error: Error | string,
    workItemId?: number,
    retryCount?: number,
  ): void {
    const errorMessage = error instanceof Error ? error.message : error
    const errorType = this.categorizeError(errorMessage)

    const errorRecord = {
      type: errorType,
      message: errorMessage,
      workItemId,
      timestamp: new Date(),
      retryCount,
    }

    this.errors.push(errorRecord)
    this.syncMetrics.totalFailed++
    this.syncMetrics.totalAttempted++

    this.logger.error('Operation failed', {
      component: 'error-aggregator',
      errorType,
      workItemId,
      retryCount,
      error: errorMessage,
      totalFailed: this.syncMetrics.totalFailed,
    })
  }

  /**
   * Categorize errors by type for better analysis
   */
  private categorizeError(errorMessage: string): string {
    const message = errorMessage.toLowerCase()

    if (
      message.includes('401') ||
      message.includes('unauthorized') ||
      message.includes('authentication')
    ) {
      return 'AUTHENTICATION'
    }
    if (message.includes('429') || message.includes('rate limit')) {
      return 'RATE_LIMIT'
    }
    if (message.includes('timeout') || message.includes('econnreset')) {
      return 'TIMEOUT'
    }
    if (message.includes('enotfound') || message.includes('network')) {
      return 'NETWORK'
    }
    if (message.includes('not found') || message.includes('404')) {
      return 'NOT_FOUND'
    }
    if (message.includes('retry exhausted')) {
      return 'RETRY_EXHAUSTED'
    }
    if (message.includes('circuit breaker')) {
      return 'CIRCUIT_BREAKER'
    }
    if (message.includes('validation') || message.includes('invalid')) {
      return 'VALIDATION'
    }

    return 'UNKNOWN'
  }

  /**
   * Mark the sync operation as completed and generate summary
   */
  generateSummary(): ErrorSummary {
    this.syncMetrics.endTime = new Date()
    const durationMs = this.syncMetrics.endTime.getTime() - this.syncMetrics.startTime.getTime()
    
    // Create final metrics with duration
    const finalMetrics = { ...this.syncMetrics, durationMs }

    // Count errors by type
    const errorsByType: Record<string, number> = {}
    for (const error of this.errors) {
      errorsByType[error.type] = (errorsByType[error.type] || 0) + 1
    }

    const successRate =
      this.syncMetrics.totalAttempted > 0
        ? (this.syncMetrics.totalSucceeded / this.syncMetrics.totalAttempted) *
          100
        : 0

    const summary: ErrorSummary = {
      totalErrors: this.errors.length,
      errorsByType,
      errorDetails: [...this.errors],
      syncMetrics: {
        ...finalMetrics,
        successRate: Math.round(successRate * 100) / 100, // Round to 2 decimals
      },
    }

    // Log comprehensive summary
    this.logger.info('Sync operation completed', {
      component: 'error-aggregator',
      summary: {
        totalAttempted: summary.syncMetrics.totalAttempted,
        totalSucceeded: summary.syncMetrics.totalSucceeded,
        totalFailed: summary.syncMetrics.totalFailed,
        successRate: summary.syncMetrics.successRate,
        durationMs: summary.syncMetrics.durationMs,
        errorsByType,
        totalErrors: summary.totalErrors,
      },
    })

    // Log detailed error breakdown if there are errors
    if (this.errors.length > 0) {
      this.logger.warn('Sync completed with errors', {
        component: 'error-aggregator',
        errorBreakdown: errorsByType,
        sampleErrors: this.errors.slice(0, 5).map((e) => ({
          type: e.type,
          message: e.message.substring(0, 100),
          workItemId: e.workItemId,
        })),
      })
    }

    return summary
  }

  /**
   * Get current metrics without completing the sync
   */
  getCurrentMetrics() {
    const successRate =
      this.syncMetrics.totalAttempted > 0
        ? (this.syncMetrics.totalSucceeded / this.syncMetrics.totalAttempted) *
          100
        : 0

    return {
      ...this.syncMetrics,
      successRate: Math.round(successRate * 100) / 100,
      totalErrors: this.errors.length,
    }
  }

  /**
   * Reset the aggregator for a new sync operation
   */
  reset(): void {
    this.errors = []
    this.syncMetrics = {
      totalAttempted: 0,
      totalSucceeded: 0,
      totalFailed: 0,
      startTime: new Date(),
      endTime: undefined,
    }

    this.logger.info('Error aggregator reset for new sync operation', {
      component: 'error-aggregator',
    })
  }
}
