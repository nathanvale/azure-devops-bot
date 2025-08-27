import { PrismaClient } from '@prisma/client'
import type { ErrorSummary } from './error-aggregator.js'
import { getLogger } from './logger.js'

export interface SyncMetricsData {
  id: number
  syncType: string
  startTime: Date
  endTime: Date
  durationMs: number
  totalAttempted: number
  totalSucceeded: number
  totalFailed: number
  successRate: number
  totalErrors: number
  errorsByType: Record<string, number>
  avgResponseTime?: number
  rateLimitHits: number
  status: string
  createdAt: Date
}

export class SyncMetrics {
  private prisma: PrismaClient
  private logger = getLogger()

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /**
   * Store sync metrics from an error summary
   */
  async storeSyncMetrics(
    errorSummary: ErrorSummary,
    syncType: string = 'detailed',
    avgResponseTime?: number,
    rateLimitHits: number = 0
  ): Promise<SyncMetricsData> {
    const { syncMetrics, errorsByType, totalErrors } = errorSummary

    if (!syncMetrics.endTime || !syncMetrics.durationMs) {
      throw new Error('Sync metrics must be completed before storing')
    }

    const status = this.determineStatus(syncMetrics.successRate, totalErrors)

    try {
      const storedMetrics = await this.prisma.syncMetric.create({
        data: {
          syncType,
          startTime: syncMetrics.startTime,
          endTime: syncMetrics.endTime,
          durationMs: syncMetrics.durationMs,
          totalAttempted: syncMetrics.totalAttempted,
          totalSucceeded: syncMetrics.totalSucceeded,
          totalFailed: syncMetrics.totalFailed,
          successRate: syncMetrics.successRate,
          totalErrors,
          errorsByType: JSON.stringify(errorsByType),
          avgResponseTime,
          rateLimitHits,
          status,
        },
      })

      this.logger.info('Sync metrics stored successfully', {
        component: 'sync-metrics',
        id: storedMetrics.id,
        syncType,
        status,
        successRate: syncMetrics.successRate,
        durationMs: syncMetrics.durationMs,
      })

      return {
        ...storedMetrics,
        errorsByType: JSON.parse(storedMetrics.errorsByType),
      }
    } catch (error) {
      this.logger.error('Failed to store sync metrics', {
        component: 'sync-metrics',
        error: error instanceof Error ? error.message : String(error),
        syncType,
      })
      throw error
    }
  }

  /**
   * Get the latest sync metrics
   */
  async getLatestSync(syncType?: string): Promise<SyncMetricsData | null> {
    try {
      const whereClause = syncType ? { syncType } : {}
      
      const latestSync = await this.prisma.syncMetric.findFirst({
        where: whereClause,
        orderBy: { startTime: 'desc' },
      })

      if (!latestSync) {
        return null
      }

      return {
        ...latestSync,
        errorsByType: JSON.parse(latestSync.errorsByType),
        avgResponseTime: latestSync.avgResponseTime || undefined,
      }
    } catch (error) {
      this.logger.error('Failed to get latest sync metrics', {
        component: 'sync-metrics',
        error: error instanceof Error ? error.message : String(error),
        syncType,
      })
      throw error
    }
  }

  /**
   * Get sync metrics for the last N syncs
   */
  async getRecentSyncs(limit: number = 10, syncType?: string): Promise<SyncMetricsData[]> {
    try {
      const whereClause = syncType ? { syncType } : {}
      
      const recentSyncs = await this.prisma.syncMetric.findMany({
        where: whereClause,
        orderBy: { startTime: 'desc' },
        take: limit,
      })

      return recentSyncs.map(sync => ({
        ...sync,
        errorsByType: JSON.parse(sync.errorsByType),
        avgResponseTime: sync.avgResponseTime || undefined,
      }))
    } catch (error) {
      this.logger.error('Failed to get recent sync metrics', {
        component: 'sync-metrics',
        error: error instanceof Error ? error.message : String(error),
        limit,
        syncType,
      })
      throw error
    }
  }

  /**
   * Get sync metrics summary for dashboard
   */
  async getSyncSummary(): Promise<{
    totalSyncs: number
    avgSuccessRate: number
    avgDuration: number
    lastSyncTime: Date | null
    recentFailures: number
    errorTrends: Record<string, number>
  }> {
    try {
      // Get basic counts
      const totalSyncs = await this.prisma.syncMetric.count()
      
      // Get recent metrics (last 24 hours)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const recentSyncs = await this.prisma.syncMetric.findMany({
        where: {
          startTime: {
            gte: oneDayAgo,
          },
        },
        orderBy: { startTime: 'desc' },
      })

      // Calculate averages
      const avgSuccessRate = recentSyncs.length > 0
        ? recentSyncs.reduce((sum, sync) => sum + sync.successRate, 0) / recentSyncs.length
        : 0

      const avgDuration = recentSyncs.length > 0
        ? recentSyncs.reduce((sum, sync) => sum + sync.durationMs, 0) / recentSyncs.length
        : 0

      // Get last sync time
      const latestSync = await this.prisma.syncMetric.findFirst({
        orderBy: { startTime: 'desc' },
      })

      // Count recent failures (success rate < 90%)
      const recentFailures = recentSyncs.filter(sync => sync.successRate < 90).length

      // Aggregate error trends
      const errorTrends: Record<string, number> = {}
      for (const sync of recentSyncs) {
        const errors = JSON.parse(sync.errorsByType) as Record<string, number>
        for (const [errorType, count] of Object.entries(errors)) {
          errorTrends[errorType] = (errorTrends[errorType] || 0) + count
        }
      }

      return {
        totalSyncs,
        avgSuccessRate: Math.round(avgSuccessRate * 100) / 100,
        avgDuration: Math.round(avgDuration),
        lastSyncTime: latestSync?.startTime || null,
        recentFailures,
        errorTrends,
      }
    } catch (error) {
      this.logger.error('Failed to get sync summary', {
        component: 'sync-metrics',
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Clean up old sync metrics (keep last 100 records per sync type)
   */
  async cleanupOldMetrics(): Promise<number> {
    try {
      // Get unique sync types
      const syncTypes = await this.prisma.syncMetric.findMany({
        select: { syncType: true },
        distinct: ['syncType'],
      })

      let totalDeleted = 0

      for (const { syncType } of syncTypes) {
        // Get IDs of records to keep (latest 100)
        const recentIds = await this.prisma.syncMetric.findMany({
          where: { syncType },
          select: { id: true },
          orderBy: { startTime: 'desc' },
          take: 100,
        })

        if (recentIds.length >= 100) {
          // Delete older records
          const deleteResult = await this.prisma.syncMetric.deleteMany({
            where: {
              syncType,
              id: {
                notIn: recentIds.map(r => r.id),
              },
            },
          })

          totalDeleted += deleteResult.count
        }
      }

      if (totalDeleted > 0) {
        this.logger.info('Cleaned up old sync metrics', {
          component: 'sync-metrics',
          deletedCount: totalDeleted,
        })
      }

      return totalDeleted
    } catch (error) {
      this.logger.error('Failed to cleanup old sync metrics', {
        component: 'sync-metrics',
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Determine sync status based on success rate and errors
   */
  private determineStatus(successRate: number, totalErrors: number): string {
    if (totalErrors === 0 && successRate === 100) {
      return 'completed'
    } else if (successRate >= 90) {
      return 'partial'
    } else {
      return 'failed'
    }
  }
}