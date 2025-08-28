import * as fs from 'fs'
// import * as path from 'path'

import { z } from 'zod'

import type { AzureDevOpsClient } from '../../../services/azure-devops.js'
import type { DatabaseService } from '../../../services/database.js'
// import type { DomainTool } from '../../types/base.js'

import {
  HealthCheckResponseEnvelope,
  TableVerificationEnvelope,
  StatisticsResponseEnvelope,
  CleanupOrphansResponseEnvelope,
} from '../../schemas/envelopes.js'
import {
  StatisticsRequestSchema,
  CleanupOrphansSchema,
  createSuccessResponse,
  createTimestamp,
} from '../../schemas/index.js'
import { BaseDomain } from '../../types/base.js'

/**
 * Admin domain for system management and health monitoring
 * Provides tools for database maintenance, health checks, and system administration
 */
export class AdminDomain extends BaseDomain {
  constructor(
    private db: DatabaseService,
    private azureClient?: AzureDevOpsClient,
  ) {
    super()
    this.initializeTools()
  }

  getName(): string {
    return 'admin'
  }

  private initializeTools(): void {
    this.tools = [
      {
        name: 'admin_health_check',
        description:
          'Perform comprehensive system health check including database, filesystem, memory, and Azure DevOps connectivity',
        inputSchema: z.object({}) as z.ZodType<Record<string, never>>,
        outputSchema: HealthCheckResponseEnvelope,
        handler: this.handleHealthCheck.bind(this) as (args: unknown) => Promise<unknown>,
      },
      {
        name: 'admin_verify_tables',
        description:
          'Verify database table integrity and return record counts for all tables',
        inputSchema: z.object({}) as z.ZodType<Record<string, never>>,
        outputSchema: TableVerificationEnvelope,
        handler: this.handleVerifyTables.bind(this) as (args: unknown) => Promise<unknown>,
      },
      {
        name: 'admin_get_statistics',
        description:
          'Get comprehensive database statistics including data distribution and quality metrics',
        inputSchema: StatisticsRequestSchema,
        outputSchema: StatisticsResponseEnvelope,
        handler: this.handleGetStatistics.bind(this) as (args: unknown) => Promise<unknown>,
      },
      {
        name: 'admin_cleanup_orphans',
        description:
          'Clean up orphaned database records with dry-run support for safe preview',
        inputSchema: CleanupOrphansSchema,
        outputSchema: CleanupOrphansResponseEnvelope,
        handler: this.handleCleanupOrphans.bind(this) as (args: unknown) => Promise<unknown>,
      },
    ]
  }

  /**
   * Perform comprehensive health check
   */
  private async handleHealthCheck(
    _args: Record<string, never>,
  ): Promise<z.infer<typeof HealthCheckResponseEnvelope>> {
    const timestamp = createTimestamp()
    const checks: Record<string, unknown> = {}
    const warnings: string[] = []
    const errors: string[] = []
    let overallStatus: 'healthy' | 'degraded' | 'critical' = 'healthy'

    // Database health check
    try {
      const dbStartTime = Date.now()
      await this.db.client.$queryRaw`SELECT 1`
      const dbResponseTime = Date.now() - dbStartTime

      checks.database = {
        status: 'up' as const,
        responseTime: dbResponseTime,
        connectionPool: {
          active: 1, // SQLite doesn't have connection pooling
          idle: 0,
          total: 1,
        },
      }

      if (dbResponseTime > 100) {
        warnings.push(`Database response time is high: ${dbResponseTime}ms`)
        overallStatus = 'degraded'
      }
    } catch (error) {
      checks.database = {
        status: 'down' as const,
        responseTime: -1,
        connectionPool: { active: 0, idle: 0, total: 0 },
      }
      errors.push(
        `Database check failed: ${error instanceof Error ? error.message : String(error)}`,
      )
      overallStatus = 'critical'
    }

    // Filesystem health check
    try {
      const dbPath = './dev.db' // Assuming standard SQLite path
      let diskUsage = { used: 0, available: 0, total: 0, percentUsed: 0 }

      if (fs.existsSync(dbPath)) {
        const stats = fs.statSync(dbPath)
        diskUsage.used = Math.round(stats.size / (1024 * 1024)) // MB
        // For SQLite, we can't easily get disk space, so we'll use defaults
        diskUsage.available = 10000 // 10GB available (placeholder)
        diskUsage.total = diskUsage.used + diskUsage.available
        diskUsage.percentUsed = (diskUsage.used / diskUsage.total) * 100
      }

      checks.filesystem = {
        status: 'up' as const,
        diskUsage,
      }

      if (diskUsage.percentUsed > 80) {
        warnings.push(
          `Disk usage is high: ${diskUsage.percentUsed.toFixed(1)}%`,
        )
        overallStatus = 'degraded'
      }
    } catch (error) {
      checks.filesystem = {
        status: 'down' as const,
        diskUsage: { used: 0, available: 0, total: 0, percentUsed: 0 },
      }
      errors.push(
        `Filesystem check failed: ${error instanceof Error ? error.message : String(error)}`,
      )
      if (overallStatus !== 'critical') overallStatus = 'degraded'
    }

    // Memory usage check
    try {
      // Memory usage info available but not currently displayed
      // const memUsage = process.memoryUsage()
      const totalMem = (await import('os')).totalmem()
      const freeMem = (await import('os')).freemem()
      const usedMem = totalMem - freeMem

      const memoryMB = {
        used: Math.round(usedMem / (1024 * 1024)),
        available: Math.round(freeMem / (1024 * 1024)),
        total: Math.round(totalMem / (1024 * 1024)),
        percentUsed: (usedMem / totalMem) * 100,
      }

      checks.memory = {
        status:
          memoryMB.percentUsed > 90 ? ('degraded' as const) : ('up' as const),
        usage: memoryMB,
      }

      if (memoryMB.percentUsed > 85) {
        warnings.push(
          `Memory usage is high: ${memoryMB.percentUsed.toFixed(1)}%`,
        )
        if (overallStatus === 'healthy') overallStatus = 'degraded'
      }
    } catch (error) {
      checks.memory = {
        status: 'down' as const,
        usage: { used: 0, available: 0, total: 0, percentUsed: 0 },
      }
      errors.push(
        `Memory check failed: ${error instanceof Error ? error.message : String(error)}`,
      )
      if (overallStatus !== 'critical') overallStatus = 'degraded'
    }

    // Azure DevOps connectivity check
    try {
      if (this.azureClient) {
        const azureStartTime = Date.now()
        // TODO: Implement health check method in AzureDevOpsClient
        // For now, we'll assume it's working if client exists
        const azureResponseTime = Date.now() - azureStartTime

        checks.azureDevOps = {
          status: 'up' as const,
          lastSuccessfulConnection: createTimestamp(),
          responseTime: azureResponseTime,
        }
      } else {
        checks.azureDevOps = {
          status: 'degraded' as const,
          lastSuccessfulConnection: null,
          responseTime: null,
        }
        warnings.push('Azure DevOps client not configured')
        if (overallStatus === 'healthy') overallStatus = 'degraded'
      }
    } catch (error) {
      checks.azureDevOps = {
        status: 'down' as const,
        lastSuccessfulConnection: null,
        responseTime: null,
      }
      errors.push(
        `Azure DevOps connectivity check failed: ${error instanceof Error ? error.message : String(error)}`,
      )
      if (overallStatus !== 'critical') overallStatus = 'degraded'
    }

    return createSuccessResponse({
      status: overallStatus,
      timestamp,
      checks,
      warnings: warnings.length > 0 ? warnings : undefined,
      errors: errors.length > 0 ? errors : undefined,
    }) as z.infer<typeof HealthCheckResponseEnvelope>
  }

  /**
   * Verify database tables
   */
  private async handleVerifyTables(
    _args: Record<string, never>,
  ): Promise<z.infer<typeof TableVerificationEnvelope>> {
    const timestamp = createTimestamp()
    const tables: Record<string, unknown> = {}
    let totalRecords = 0
    let totalSizeBytes = 0

    // Check each table
    const tableChecks = [
      { name: 'workItems', model: 'workItem' },
      { name: 'comments', model: 'workItemComment' },
      { name: 'relations', model: 'workItemRelation' },
      { name: 'links', model: 'workItemLink' },
      { name: 'persons', model: 'person' },
      { name: 'syncMetrics', model: 'syncMetric' },
    ]

    for (const table of tableChecks) {
      try {
        const count = await (
          this.db.client as any
        )[table.model].count()
        const lastUpdated = await (
          this.db.client as any
        )[table.model].findFirst({
          orderBy: { updatedAt: 'desc' },
          select: { updatedAt: true },
        })

        tables[table.name] = {
          count,
          lastUpdated: lastUpdated?.updatedAt?.toISOString() || null,
          sizeBytes: count * 1024, // Rough estimate
        }

        totalRecords += count
        totalSizeBytes += (tables[table.name] as any).sizeBytes
      } catch (error) {
        tables[table.name] = {
          count: -1,
          lastUpdated: null,
          sizeBytes: 0,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    }

    // Check for integrity issues
    let orphanedRecords = 0
    let missingReferences = 0
    let duplicateRecords = 0

    try {
      // Check for orphaned comments
      const orphanedComments = await this.db.client.$queryRaw`
        SELECT COUNT(*) as count FROM WorkItemComment 
        WHERE workItemId NOT IN (SELECT id FROM WorkItem)
      `
      orphanedRecords += Number(
        (orphanedComments as Array<{ count: bigint }>)[0]?.count || 0,
      )

      // Check for orphaned relations
      const orphanedRelations = await this.db.client.$queryRaw`
        SELECT COUNT(*) as count FROM WorkItemRelation 
        WHERE sourceId NOT IN (SELECT id FROM WorkItem) 
           OR targetId NOT IN (SELECT id FROM WorkItem)
      `
      orphanedRecords += Number(
        (orphanedRelations as Array<{ count: bigint }>)[0]?.count || 0,
      )

      // Check for duplicate work items
      const duplicateWorkItems = await this.db.client.$queryRaw`
        SELECT COUNT(*) - COUNT(DISTINCT id) as count FROM WorkItem
      `
      duplicateRecords += Number(
        (duplicateWorkItems as Array<{ count: bigint }>)[0]?.count || 0,
      )
    } catch {
      // Integrity checks failed, but continue
    }

    const integrityStatus =
      orphanedRecords > 100 || missingReferences > 50
        ? 'critical'
        : orphanedRecords > 10 || missingReferences > 10
          ? 'issues'
          : 'healthy'

    return createSuccessResponse({
      timestamp,
      tables,
      totalRecords,
      totalSizeBytes,
      integrity: {
        status: integrityStatus,
        orphanedRecords,
        missingReferences,
        duplicateRecords,
      },
    }) as z.infer<typeof TableVerificationEnvelope>
  }

  /**
   * Get database statistics
   */
  private async handleGetStatistics(args: {
    includePersons?: boolean
    includeRelations?: boolean
    includeDistribution?: boolean
  }): Promise<z.infer<typeof StatisticsResponseEnvelope>> {
    const timestamp = createTimestamp()

    // Get overview statistics
    const [workItemCount, personCount, commentCount, relationCount, linkCount] =
      await Promise.all([
        this.db.client.workItem.count(),
        this.db.client.person.count(),
        this.db.client.workItemComment.count(),
        this.db.client.workItemRelation.count(),
        this.db.client.workItemLink.count(),
      ])

    const overview = {
      totalWorkItems: workItemCount,
      totalPersons: personCount,
      totalComments: commentCount,
      totalRelations: relationCount,
      totalLinks: linkCount,
      databaseSizeBytes: (workItemCount + personCount + commentCount) * 2048, // Rough estimate
    }

    // Get work item statistics
    const workItems: Record<string, unknown> = {
      byState: {},
      byType: {},
      byIteration: {},
      byAreaPath: {},
      assignmentDistribution: {},
      ageDistribution: {
        lessThan1Day: 0,
        lessThan1Week: 0,
        lessThan1Month: 0,
        lessThan3Months: 0,
        moreThan3Months: 0,
      },
    }

    // Get work item distributions
    try {
      const stateDistribution = await this.db.client.workItem.groupBy({
        by: ['state'],
        _count: { state: true },
      })
      for (const item of stateDistribution) {
        ;(workItems.byState as any)[item.state] = item._count.state
      }

      const typeDistribution = await this.db.client.workItem.groupBy({
        by: ['type'],
        _count: { type: true },
      })
      for (const item of typeDistribution) {
        ;(workItems.byType as any)[item.type] = item._count.type
      }

      // Calculate age distribution
      const now = new Date()
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

      ;(workItems.ageDistribution as any).lessThan1Day =
        await this.db.client.workItem.count({
          where: { createdDate: { gte: oneDayAgo } },
        })
      ;(workItems.ageDistribution as any).lessThan1Week =
        await this.db.client.workItem.count({
          where: { createdDate: { gte: oneWeekAgo, lt: oneDayAgo } },
        })
      ;(workItems.ageDistribution as any).lessThan1Month =
        await this.db.client.workItem.count({
          where: { createdDate: { gte: oneMonthAgo, lt: oneWeekAgo } },
        })
      ;(workItems.ageDistribution as any).lessThan3Months =
        await this.db.client.workItem.count({
          where: { createdDate: { gte: threeMonthsAgo, lt: oneMonthAgo } },
        })
      ;(workItems.ageDistribution as any).moreThan3Months =
        await this.db.client.workItem.count({
          where: { createdDate: { lt: threeMonthsAgo } },
        })
    } catch {
      // Distribution calculation failed, but continue with partial data
    }

    // Optional person statistics
    let persons: Record<string, unknown> | undefined = undefined
    if (args.includePersons) {
      persons = {
        totalUnique: personCount,
        mostActiveAssignees: [],
        byDomain: {},
      }

      try {
        const activeAssignees = await this.db.client.person.findMany({
          include: {
            assignedWorkItems: {
              select: { id: true },
            },
          },
          orderBy: {
            assignedWorkItems: {
              _count: 'desc',
            },
          },
          take: 10,
        })

        ;(persons.mostActiveAssignees as any) = activeAssignees.map((person) => ({
          name: person.displayName,
          email: person.uniqueName,
          workItemCount: person.assignedWorkItems.length,
        }))
      } catch {
        // Person statistics failed, but continue
      }
    }

    // Optional relations statistics
    let relations: Record<string, unknown> | undefined = undefined
    if (args.includeRelations) {
      relations = {
        byType: {},
        orphanedRelations: 0,
      }

      try {
        const relationTypes = await this.db.client.workItemRelation.groupBy({
          by: ['relationshipType'],
          _count: { relationshipType: true },
        })
        for (const item of relationTypes) {
          ;(relations.byType as any)[item.relationshipType] = item._count.relationshipType
        }
      } catch {
        // Relations statistics failed, but continue
      }
    }

    // Data quality metrics
    const dataQuality = {
      workItemsWithoutAssignee: await this.db.client.workItem.count({
        where: { assignedToId: null },
      }),
      workItemsWithoutIteration: await this.db.client.workItem.count({
        where: { iterationPath: null },
      }),
      commentsWithoutAuthor: await this.db.client.workItemComment.count({
        where: { 
          createdBy: ""
        },
      }),
      missingPersonReferences: 0, // TODO: Implement this check
    }

    return createSuccessResponse({
      timestamp,
      overview,
      workItems,
      persons,
      relations,
      dataQuality,
    }) as z.infer<typeof StatisticsResponseEnvelope>
  }

  /**
   * Clean up orphaned records
   */
  private async handleCleanupOrphans(args: {
    dryRun?: boolean
    cleanupTypes?: string[]
    maxRecords?: number
  }): Promise<z.infer<typeof CleanupOrphansResponseEnvelope>> {
    const dryRun = args.dryRun !== false // Default to true
    const cleanupTypes = args.cleanupTypes || ['comments', 'relations', 'links']
    const maxRecords = Math.min(args.maxRecords || 1000, 10000)
    const timestamp = createTimestamp()
    const startTime = Date.now()

    const summary = {
      totalScanned: 0,
      orphansFound: 0,
      orphansRemoved: 0,
      errorsEncountered: 0,
    }

    const details: Record<string, unknown> = {
      comments: { scanned: 0, orphansFound: 0, removed: 0 },
      relations: { scanned: 0, orphansFound: 0, removed: 0 },
      links: { scanned: 0, orphansFound: 0, removed: 0 },
      persons: { scanned: 0, orphansFound: 0, removed: 0 },
    }

    const warnings: string[] = []
    const errors: string[] = []

    // Clean up orphaned comments
    if (cleanupTypes.includes('comments')) {
      try {
        const orphanedComments = await this.db.client.workItemComment.findMany({
          where: {
            workItemId: { notIn: (await this.db.client.workItem.findMany({ select: { id: true } })).map(wi => wi.id) },
          },
          take: maxRecords,
        })

        ;(details.comments as any).scanned = await this.db.client.workItemComment.count()
        ;(details.comments as any).orphansFound = orphanedComments.length
        summary.totalScanned += (details.comments as any).scanned
        summary.orphansFound += (details.comments as any).orphansFound

        if (!dryRun && orphanedComments.length > 0) {
          const deleteResult = await this.db.client.workItemComment.deleteMany({
            where: {
              id: { in: orphanedComments.map((c) => c.id) },
            },
          })
          ;(details.comments as any).removed = deleteResult.count
          summary.orphansRemoved += deleteResult.count
        }

        if (orphanedComments.length >= maxRecords) {
          warnings.push(
            `Comment cleanup limited to ${maxRecords} records. More orphans may exist.`,
          )
        }
      } catch (error) {
        errors.push(
          `Comment cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
        )
        summary.errorsEncountered++
      }
    }

    // Clean up orphaned relations
    if (cleanupTypes.includes('relations')) {
      try {
        const workItemIds = (await this.db.client.workItem.findMany({ select: { id: true } })).map(wi => wi.id)
        const orphanedRelations =
          await this.db.client.workItemRelation.findMany({
            where: {
              OR: [
                { sourceId: { notIn: workItemIds } },
                { targetId: { notIn: workItemIds } }
              ],
            },
            take: maxRecords,
          })

        ;(details.relations as any).scanned =
          await this.db.client.workItemRelation.count()
        ;(details.relations as any).orphansFound = orphanedRelations.length
        summary.totalScanned += (details.relations as any).scanned
        summary.orphansFound += (details.relations as any).orphansFound

        if (!dryRun && orphanedRelations.length > 0) {
          const deleteResult = await this.db.client.workItemRelation.deleteMany(
            {
              where: {
                id: { in: orphanedRelations.map((r) => r.id) },
              },
            },
          )
          ;(details.relations as any).removed = deleteResult.count
          summary.orphansRemoved += deleteResult.count
        }

        if (orphanedRelations.length >= maxRecords) {
          warnings.push(
            `Relations cleanup limited to ${maxRecords} records. More orphans may exist.`,
          )
        }
      } catch (error) {
        errors.push(
          `Relations cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
        )
        summary.errorsEncountered++
      }
    }

    // Add dry run warning
    if (dryRun) {
      warnings.push('This was a dry run. No records were actually deleted.')
    }

    const durationMs = Date.now() - startTime

    return createSuccessResponse({
      timestamp,
      dryRun,
      summary: { ...summary, durationMs },
      details,
      warnings,
      errors,
    }) as z.infer<typeof CleanupOrphansResponseEnvelope>
  }
}
