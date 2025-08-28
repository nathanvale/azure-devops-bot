import { z } from 'zod'

/**
 * Admin health check response schema
 */
export const HealthCheckResponseSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'critical']),
  timestamp: z.string().datetime(),
  checks: z.object({
    database: z.object({
      status: z.enum(['up', 'down', 'degraded']),
      responseTime: z.number().min(0).describe('Database response time in ms'),
      connectionPool: z.object({
        active: z.number().int().min(0),
        idle: z.number().int().min(0),
        total: z.number().int().min(0),
      }),
    }),
    filesystem: z.object({
      status: z.enum(['up', 'down', 'degraded']),
      diskUsage: z.object({
        used: z.number().min(0).describe('Used disk space in MB'),
        available: z.number().min(0).describe('Available disk space in MB'),
        total: z.number().min(0).describe('Total disk space in MB'),
        percentUsed: z.number().min(0).max(100),
      }),
    }),
    memory: z.object({
      status: z.enum(['up', 'down', 'degraded']),
      usage: z.object({
        used: z.number().min(0).describe('Used memory in MB'),
        available: z.number().min(0).describe('Available memory in MB'),
        total: z.number().min(0).describe('Total memory in MB'),
        percentUsed: z.number().min(0).max(100),
      }),
    }),
    azureDevOps: z.object({
      status: z.enum(['up', 'down', 'degraded']),
      lastSuccessfulConnection: z.string().datetime().nullable(),
      responseTime: z
        .number()
        .min(0)
        .nullable()
        .describe('API response time in ms'),
    }),
  }),
  warnings: z.array(z.string()).optional(),
  errors: z.array(z.string()).optional(),
})

/**
 * Table verification response schema
 */
export const TableVerificationSchema = z.object({
  timestamp: z.string().datetime(),
  tables: z.object({
    workItems: z.object({
      count: z.number().int().min(0),
      lastUpdated: z.string().datetime().nullable(),
      sizeBytes: z.number().int().min(0),
    }),
    comments: z.object({
      count: z.number().int().min(0),
      lastUpdated: z.string().datetime().nullable(),
      sizeBytes: z.number().int().min(0),
    }),
    relations: z.object({
      count: z.number().int().min(0),
      lastUpdated: z.string().datetime().nullable(),
      sizeBytes: z.number().int().min(0),
    }),
    links: z.object({
      count: z.number().int().min(0),
      lastUpdated: z.string().datetime().nullable(),
      sizeBytes: z.number().int().min(0),
    }),
    persons: z.object({
      count: z.number().int().min(0),
      lastUpdated: z.string().datetime().nullable(),
      sizeBytes: z.number().int().min(0),
    }),
    syncMetrics: z.object({
      count: z.number().int().min(0),
      lastUpdated: z.string().datetime().nullable(),
      sizeBytes: z.number().int().min(0),
    }),
  }),
  totalRecords: z.number().int().min(0),
  totalSizeBytes: z.number().int().min(0),
  integrity: z.object({
    status: z.enum(['healthy', 'issues', 'critical']),
    orphanedRecords: z.number().int().min(0),
    missingReferences: z.number().int().min(0),
    duplicateRecords: z.number().int().min(0),
  }),
})

/**
 * Database statistics request schema
 */
export const StatisticsRequestSchema = z.object({
  includePersons: z
    .boolean()
    .default(true)
    .describe('Include person statistics'),
  includeRelations: z
    .boolean()
    .default(true)
    .describe('Include relationship statistics'),
  includeDistribution: z
    .boolean()
    .default(false)
    .describe('Include data distribution analysis'),
})

/**
 * Database statistics response schema
 */
export const StatisticsResponseSchema = z.object({
  timestamp: z.string().datetime(),
  overview: z.object({
    totalWorkItems: z.number().int().min(0),
    totalPersons: z.number().int().min(0),
    totalComments: z.number().int().min(0),
    totalRelations: z.number().int().min(0),
    totalLinks: z.number().int().min(0),
    databaseSizeBytes: z.number().int().min(0),
  }),
  workItems: z.object({
    byState: z.record(z.string(), z.number().int().min(0)),
    byType: z.record(z.string(), z.number().int().min(0)),
    byIteration: z.record(z.string(), z.number().int().min(0)),
    byAreaPath: z.record(z.string(), z.number().int().min(0)),
    assignmentDistribution: z.record(z.string(), z.number().int().min(0)),
    ageDistribution: z.object({
      lessThan1Day: z.number().int().min(0),
      lessThan1Week: z.number().int().min(0),
      lessThan1Month: z.number().int().min(0),
      lessThan3Months: z.number().int().min(0),
      moreThan3Months: z.number().int().min(0),
    }),
  }),
  persons: z
    .object({
      totalUnique: z.number().int().min(0),
      mostActiveAssignees: z
        .array(
          z.object({
            name: z.string(),
            email: z.string(),
            workItemCount: z.number().int().min(0),
          }),
        )
        .optional(),
      byDomain: z.record(z.string(), z.number().int().min(0)).optional(),
    })
    .optional(),
  relations: z
    .object({
      byType: z.record(z.string(), z.number().int().min(0)),
      orphanedRelations: z.number().int().min(0),
    })
    .optional(),
  dataQuality: z.object({
    workItemsWithoutAssignee: z.number().int().min(0),
    workItemsWithoutIteration: z.number().int().min(0),
    commentsWithoutAuthor: z.number().int().min(0),
    missingPersonReferences: z.number().int().min(0),
  }),
})

/**
 * Cleanup orphans request schema
 */
export const CleanupOrphansSchema = z.object({
  dryRun: z
    .boolean()
    .default(true)
    .describe('Preview changes without executing'),
  cleanupTypes: z
    .array(z.enum(['comments', 'relations', 'links', 'persons']))
    .default(['comments', 'relations', 'links'])
    .describe('Types of orphaned data to clean'),
  maxRecords: z
    .number()
    .int()
    .min(1)
    .max(10000)
    .default(1000)
    .describe('Maximum records to process in one operation'),
})

/**
 * Cleanup orphans response schema
 */
export const CleanupOrphansResponseSchema = z.object({
  timestamp: z.string().datetime(),
  dryRun: z.boolean(),
  summary: z.object({
    totalScanned: z.number().int().min(0),
    orphansFound: z.number().int().min(0),
    orphansRemoved: z.number().int().min(0),
    errorsEncountered: z.number().int().min(0),
    durationMs: z.number().int().min(0),
  }),
  details: z.object({
    comments: z.object({
      scanned: z.number().int().min(0),
      orphansFound: z.number().int().min(0),
      removed: z.number().int().min(0),
    }),
    relations: z.object({
      scanned: z.number().int().min(0),
      orphansFound: z.number().int().min(0),
      removed: z.number().int().min(0),
    }),
    links: z.object({
      scanned: z.number().int().min(0),
      orphansFound: z.number().int().min(0),
      removed: z.number().int().min(0),
    }),
    persons: z.object({
      scanned: z.number().int().min(0),
      orphansFound: z.number().int().min(0),
      removed: z.number().int().min(0),
    }),
  }),
  warnings: z.array(z.string()),
  errors: z.array(z.string()),
})
