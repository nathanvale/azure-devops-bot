import { z } from 'zod'

/**
 * Sync force operation schema
 */
export const SyncForceSchema = z.object({
  concurrency: z
    .number()
    .int()
    .min(1)
    .max(20)
    .default(5)
    .describe('Parallel processing limit'),
})

/**
 * Sync comments force schema
 */
export const SyncCommentsSchema = z.object({
  workItemIds: z
    .array(z.number().int().positive())
    .optional()
    .describe('Specific work items to sync comments for'),
  concurrency: z
    .number()
    .int()
    .min(1)
    .max(10)
    .default(3)
    .describe('Parallel processing limit'),
})

/**
 * Sync status request schema
 */
export const SyncStatusSchema = z.object({
  includeHistory: z.boolean().default(false).describe('Include sync history'),
  includeErrors: z.boolean().default(false).describe('Include error details'),
  historyLimit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe('Max history entries'),
})

/**
 * Sync metrics request schema
 */
export const SyncMetricsSchema = z.object({
  timeframe: z
    .enum(['1h', '24h', '7d'])
    .default('24h')
    .describe('Metrics timeframe'),
  includeErrorBreakdown: z
    .boolean()
    .default(true)
    .describe('Include error type breakdown'),
})

/**
 * Sync execution status
 */
export const SyncExecutionSchema = z.object({
  id: z.string().uuid(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime().nullable(),
  status: z.enum(['running', 'completed', 'failed', 'cancelled']),
  type: z.enum(['full', 'delta', 'comments', 'manual']),
  durationMs: z.number().int().min(0),
  totalAttempted: z.number().int().min(0),
  totalSucceeded: z.number().int().min(0),
  totalFailed: z.number().int().min(0),
  successRate: z.number().min(0).max(100),
  totalErrors: z.number().int().min(0),
  errorsByType: z.record(z.string(), z.number().int().min(0)),
})

/**
 * Sync summary response schema
 */
export const SyncSummarySchema = z.object({
  totalSyncs: z.number().int().min(0),
  successfulSyncs: z.number().int().min(0),
  failedSyncs: z.number().int().min(0),
  avgSuccessRate: z.number().min(0).max(100),
  avgDuration: z.number().min(0),
  lastSyncTime: z.string().datetime().nullable(),
  recentFailures: z.number().int().min(0),
  errorTrends: z.record(z.string(), z.number().int().min(0)),
  healthStatus: z.enum(['healthy', 'degraded', 'critical']),
})

/**
 * Sync metrics response schema
 */
export const SyncMetricsResponseSchema = z.object({
  timeframe: z.string(),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  metrics: z.object({
    totalSyncs: z.number().int().min(0),
    successRate: z.number().min(0).max(100),
    avgDuration: z.number().min(0),
    minDuration: z.number().min(0),
    maxDuration: z.number().min(0),
    totalWorkItems: z.number().int().min(0),
    totalComments: z.number().int().min(0),
    totalErrors: z.number().int().min(0),
  }),
  errorBreakdown: z.record(z.string(), z.number().int().min(0)).optional(),
  trends: z.object({
    successRateTrend: z.enum(['improving', 'stable', 'degrading']),
    durationTrend: z.enum(['improving', 'stable', 'degrading']),
    errorTrend: z.enum(['improving', 'stable', 'degrading']),
  }),
})

/**
 * Sync status response schema
 */
export const SyncStatusResponseSchema = z.object({
  currentStatus: z.enum(['idle', 'syncing', 'error']),
  lastSync: SyncExecutionSchema.nullable(),
  nextScheduledSync: z.string().datetime().nullable(),
  summary: SyncSummarySchema,
  recentHistory: z.array(SyncExecutionSchema).optional(),
  activeSync: SyncExecutionSchema.nullable(),
  configuration: z.object({
    intervalMs: z.number().int().min(0),
    concurrency: z.number().int().min(1),
    retryAttempts: z.number().int().min(0),
    timeoutMs: z.number().int().min(0),
  }),
})

/**
 * Sync force response schema
 */
export const SyncForceResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  execution: SyncExecutionSchema,
  summary: z.object({
    workItemsProcessed: z.number().int().min(0),
    commentsProcessed: z.number().int().min(0),
    errorsEncountered: z.number().int().min(0),
    durationMs: z.number().int().min(0),
  }),
})
