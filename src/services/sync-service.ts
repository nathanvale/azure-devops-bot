import { ErrorAggregator } from '../utils/error-aggregator.js'
import { getLogger } from '../utils/logger.js'
import { SyncMetrics } from '../utils/sync-metrics.js'
import { AzureDevOpsClient, type WorkItemData } from './azure-devops.js'
import { DatabaseService } from './database.js'

export class SyncService {
  private client: AzureDevOpsClient
  private db: DatabaseService
  private syncInterval: NodeJS.Timeout | null = null
  private syncMetrics: SyncMetrics
  private logger = getLogger()

  constructor() {
    this.client = new AzureDevOpsClient()
    this.db = new DatabaseService()
    this.syncMetrics = new SyncMetrics(this.db.client)
  }

  async performSync(): Promise<void> {
    try {
      const workItems = await this.client.fetchWorkItems()
      await this.db.syncWorkItems(workItems)
      console.log(`✅ Synced ${workItems.length} work items`)
    } catch (error) {
      console.error('❌ Sync failed:', error)
      throw error
    }
  }

  async performSyncDetailed(concurrencyLimit: number = 5): Promise<void> {
    const errorAggregator = new ErrorAggregator(this.logger)

    this.logger.info('Starting detailed sync operation', {
      component: 'sync-service',
      concurrencyLimit,
      operation: 'detailed_sync',
    })

    try {
      // Step 1: Discover work item IDs using fast WIQL query
      const workItemIds = await this.client.fetchWorkItems()
      const idList = workItemIds.map((item: WorkItemData) => item.id)

      this.logger.info('Work items discovered for detailed sync', {
        component: 'sync-service',
        discoveredCount: idList.length,
        operation: 'work_item_discovery',
      })

      // Step 2: Fetch detailed data with error tracking
      const detailedWorkItems = await this.fetchWorkItemsWithTracking(
        idList,
        concurrencyLimit,
        errorAggregator,
      )

      // Step 3: Store all detailed work items
      await this.db.syncWorkItems(detailedWorkItems)
      errorAggregator.recordSuccess()

      // Step 4: Sync comments for work items that need it
      await this.syncCommentsWithTracking(detailedWorkItems, errorAggregator)

      // Generate and store metrics
      const summary = errorAggregator.generateSummary()
      await this.syncMetrics.storeSyncMetrics(summary, 'detailed')

      // Verify all tables have data
      const tableVerification = await this.verifyAllTables()

      this.logger.info('Detailed sync completed successfully', {
        component: 'sync-service',
        summary: {
          totalAttempted: summary.syncMetrics.totalAttempted,
          totalSucceeded: summary.syncMetrics.totalSucceeded,
          successRate: summary.syncMetrics.successRate,
          durationMs: summary.syncMetrics.durationMs,
          errorCount: summary.totalErrors,
        },
        tableData: tableVerification,
      })
      
      // Log table verification results
      console.log('\n📊 Database Table Verification:')
      console.log(`  ✅ Work Items: ${tableVerification.workItems} records`)
      console.log(`  ${tableVerification.comments > 0 ? '✅' : '⚠️ '} Comments: ${tableVerification.comments} records`)
      console.log(`  ${tableVerification.relations > 0 ? '✅' : '⚠️ '} Relations: ${tableVerification.relations} records`)
      console.log(`  ${tableVerification.links > 0 ? '✅' : '⚠️ '} Links: ${tableVerification.links} records`)
      console.log(`  ${tableVerification.syncMetrics > 0 ? '✅' : '⚠️ '} Sync Metrics: ${tableVerification.syncMetrics} records\n`)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      errorAggregator.recordError(errorMessage)

      // Store failed sync metrics
      const summary = errorAggregator.generateSummary()
      await this.syncMetrics.storeSyncMetrics(summary, 'detailed')

      this.logger.error('Detailed sync failed', {
        component: 'sync-service',
        error: errorMessage,
        operation: 'detailed_sync',
      })

      throw error
    }
  }

  /**
   * Fetch work items using batch API with error tracking
   */
  private async fetchWorkItemsWithTracking(
    idList: number[],
    concurrencyLimit: number,
    errorAggregator: ErrorAggregator,
  ): Promise<WorkItemData[]> {
    if (!idList || idList.length === 0) {
      return []
    }

    this.logger.info('Starting batch work item fetch', {
      component: 'sync-service',
      totalIds: idList.length,
      estimatedBatches: Math.ceil(idList.length / 200),
      operation: 'batch_work_item_fetch',
    })

    try {
      // Use the new batch method instead of individual API calls
      const workItems = await this.client.fetchWorkItemsBatch(idList)

      // Record success for each work item that was fetched
      workItems.forEach((workItem) => {
        errorAggregator.recordSuccess(workItem.id)
      })

      // Record errors for any work items that couldn't be fetched
      const fetchedIds = new Set(workItems.map((item) => item.id))
      const missingIds = idList.filter((id) => !fetchedIds.has(id))

      missingIds.forEach((id) => {
        errorAggregator.recordError('Work item not found or inaccessible', id)
        this.logger.warn('Work item not returned in batch', {
          component: 'sync-service',
          workItemId: id,
          operation: 'batch_work_item_fetch',
        })
      })

      this.logger.info('Batch work item fetch completed', {
        component: 'sync-service',
        requestedCount: idList.length,
        fetchedCount: workItems.length,
        missingCount: missingIds.length,
        operation: 'batch_work_item_fetch',
      })

      return workItems
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)

      // If batch fetch fails completely, record error for all items
      idList.forEach((id) => {
        errorAggregator.recordError(errorMessage, id)
      })

      this.logger.error('Batch work item fetch failed completely', {
        component: 'sync-service',
        totalIds: idList.length,
        error: errorMessage,
        operation: 'batch_work_item_fetch',
      })

      throw error
    }
  }

  /**
   * Sync comments with error tracking
   */
  private async syncCommentsWithTracking(
    workItems: WorkItemData[],
    errorAggregator: ErrorAggregator,
  ): Promise<void> {
    const lastSyncTime = await this.db.getLastSyncTime()
    let checkedCount = 0
    let syncedCount = 0
    let totalCommentsProcessed = 0
    const CONCURRENCY = 5

    this.logger.info('Starting comment sync', {
      component: 'sync-service',
      workItemCount: workItems.length,
      operation: 'comment_sync',
    })

    // Filter work items that need comment sync first
    const workItemsNeedingSync: WorkItemData[] = []
    for (const workItem of workItems) {
      checkedCount++

      try {
        const needsSync = await this.db.needsCommentSync(
          workItem.id,
          workItem.commentCount || 0,
          workItem.changedDate || null,
          lastSyncTime,
        )

        if (needsSync) {
          workItemsNeedingSync.push(workItem)
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        errorAggregator.recordError(errorMessage, workItem.id)
        this.logger.warn('Failed to check comment sync status', {
          component: 'sync-service',
          workItemId: workItem.id,
          error: errorMessage,
          operation: 'comment_sync_check',
        })
      }
    }

    if (workItemsNeedingSync.length === 0) {
      this.logger.info('No work items need comment sync', {
        component: 'sync-service',
        checkedCount,
        operation: 'comment_sync',
      })
      return
    }

    this.logger.info('Processing comment sync', {
      component: 'sync-service',
      needingSyncCount: workItemsNeedingSync.length,
      operation: 'comment_sync',
    })

    // Process comment sync with controlled concurrency
    const queue = [...workItemsNeedingSync]
    const inProgress = new Set<Promise<void>>()
    const totalToSync = workItemsNeedingSync.length

    while (queue.length > 0 || inProgress.size > 0) {
      // Start new tasks up to concurrency limit
      while (inProgress.size < CONCURRENCY && queue.length > 0) {
        const workItem = queue.shift()!
        const promise = this.syncSingleWorkItemCommentsWithTracking(
          workItem,
          errorAggregator,
        )
          .then((commentCount) => {
            syncedCount++
            totalCommentsProcessed += commentCount
            errorAggregator.recordSuccess(workItem.id)
          })
          .catch((error) => {
            const errorMessage =
              error instanceof Error ? error.message : String(error)
            errorAggregator.recordError(errorMessage, workItem.id)
          })
          .finally(() => {
            inProgress.delete(promise)
          })

        inProgress.add(promise)
      }

      // Wait for at least one task to complete
      if (inProgress.size > 0) {
        await Promise.race(inProgress)
      }
    }

    this.logger.info('Comment sync completed', {
      component: 'sync-service',
      checkedCount,
      syncedCount,
      totalCommentsProcessed,
      operation: 'comment_sync',
    })
  }

  private async syncSingleWorkItemCommentsWithTracking(
    workItem: WorkItemData,
    errorAggregator: ErrorAggregator,
  ): Promise<number> {
    try {
      const comments = await this.client.fetchWorkItemComments(workItem.id)
      await this.db.storeWorkItemComments(comments)
      return comments.length
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      this.logger.warn('Failed to sync comments for work item', {
        component: 'sync-service',
        workItemId: workItem.id,
        error: errorMessage,
        operation: 'single_comment_sync',
      })
      throw error
    }
  }

  private async syncCommentsForWorkItems(
    workItems: WorkItemData[],
  ): Promise<void> {
    const lastSyncTime = await this.db.getLastSyncTime()
    let checkedCount = 0
    let syncedCount = 0
    let totalCommentsProcessed = 0
    const startTime = Date.now()
    const CONCURRENCY = 5

    console.log(
      `📝 Checking ${workItems.length} work items for comment sync...`,
    )

    // Filter work items that need comment sync first
    const workItemsNeedingSync: WorkItemData[] = []
    for (const workItem of workItems) {
      checkedCount++

      try {
        const needsSync = await this.db.needsCommentSync(
          workItem.id,
          workItem.commentCount || 0,
          workItem.changedDate || null,
          lastSyncTime,
        )

        if (needsSync) {
          workItemsNeedingSync.push(workItem)
        }
      } catch (error) {
        console.warn(
          `⚠️  Failed to check sync status for work item ${workItem.id}:`,
          error,
        )
      }
    }

    if (workItemsNeedingSync.length === 0) {
      console.log(
        `📝 Comment sync complete: ${checkedCount} work items checked, 0 needed comment sync`,
      )
      return
    }

    console.log(
      `📝 Found ${workItemsNeedingSync.length} work items needing comment sync`,
    )

    // Process comment sync with controlled concurrency
    const queue = [...workItemsNeedingSync]
    const inProgress = new Set<Promise<void>>()
    const totalToSync = workItemsNeedingSync.length
    let progressReportInterval: NodeJS.Timeout | null = null

    // Report progress every 5 seconds for long operations
    if (totalToSync > 10) {
      progressReportInterval = setInterval(() => {
        const completed = totalToSync - queue.length - inProgress.size
        const percent = Math.round((completed / totalToSync) * 100)
        console.log(
          `📝 Comment sync progress: ${completed}/${totalToSync} work items (${percent}%) - ${syncedCount} items had comments`,
        )
      }, 5000)
    }

    while (queue.length > 0 || inProgress.size > 0) {
      // Start new tasks up to concurrency limit
      while (inProgress.size < CONCURRENCY && queue.length > 0) {
        const workItem = queue.shift()!
        const promise = this.syncSingleWorkItemComments(workItem)
          .then((commentCount) => {
            syncedCount++
            totalCommentsProcessed += commentCount
          })
          .catch((error) => {
            console.warn(
              `⚠️  Failed to sync comments for work item ${workItem.id}:`,
              error,
            )
          })
          .finally(() => {
            inProgress.delete(promise)
          })

        inProgress.add(promise)
      }

      // Wait for at least one task to complete
      if (inProgress.size > 0) {
        await Promise.race(inProgress)
      }
    }

    if (progressReportInterval) {
      clearInterval(progressReportInterval)
    }

    const endTime = Date.now()
    const duration = endTime - startTime

    console.log(
      `📝 Comment sync complete: ${checkedCount} work items checked, ${syncedCount} had comments synced (${totalCommentsProcessed} total comments) in ${duration}ms`,
    )
  }

  private async syncSingleWorkItemComments(
    workItem: WorkItemData,
  ): Promise<number> {
    const comments = await this.client.fetchWorkItemComments(workItem.id)
    await this.db.storeWorkItemComments(comments)
    return comments.length
  }

  private getSyncInterval(): number {
    const envInterval = process.env.AZURE_DEVOPS_SYNC_INTERVAL_MINUTES
    const defaultInterval = 5 / 60 // 5 seconds for testing (5/60 minutes)

    if (envInterval) {
      const parsed = parseInt(envInterval, 10)
      if (isNaN(parsed) || parsed <= 0) {
        console.warn(
          `⚠️  Invalid AZURE_DEVOPS_SYNC_INTERVAL_MINUTES value: ${envInterval}. Using default ${defaultInterval} minutes.`,
        )
        return defaultInterval * 60 * 1000
      }
      return parsed * 60 * 1000
    }

    return defaultInterval * 60 * 1000
  }

  async startBackgroundSync(useDetailedSync: boolean = true): Promise<void> {
    const SYNC_INTERVAL = this.getSyncInterval()
    const intervalMinutes = SYNC_INTERVAL / (60 * 1000)

    this.syncInterval = setInterval(async () => {
      try {
        if (useDetailedSync) {
          await this.performSyncDetailed()
        } else {
          await this.performSync()
        }
      } catch (error) {
        console.error('Background sync failed:', error)
      }
    }, SYNC_INTERVAL)

    const syncType = useDetailedSync ? 'detailed sync' : 'sync'
    const intervalDisplay =
      intervalMinutes < 1
        ? `${SYNC_INTERVAL / 1000} seconds`
        : `${intervalMinutes} minutes`
    console.log(`🔄 Background ${syncType} started (every ${intervalDisplay})`)
  }

  stopBackgroundSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
      console.log('⏹️  Background sync stopped')
    }
  }

  async shouldSync(): Promise<boolean> {
    const lastSync = await this.db.getLastSyncTime()
    if (!lastSync) return true

    const now = new Date()
    const timeSinceSync = now.getTime() - lastSync.getTime()
    const fiveMinutes = 5 * 60 * 1000

    return timeSinceSync > fiveMinutes
  }

  async close(): Promise<void> {
    this.stopBackgroundSync()
    await this.db.close()
  }

  /**
   * Verify all database tables have data
   */
  private async verifyAllTables(): Promise<{
    workItems: number
    comments: number
    relations: number
    links: number
    syncMetrics: number
  }> {
    try {
      const [workItems, comments, relations, links, syncMetrics] = await Promise.all([
        this.db.client.workItem.count(),
        this.db.client.workItemComment.count(),
        this.db.client.workItemRelation.count(),
        this.db.client.workItemLink.count(),
        this.db.client.syncMetric.count(),
      ])

      return {
        workItems,
        comments,
        relations,
        links,
        syncMetrics,
      }
    } catch (error) {
      this.logger.error('Failed to verify database tables', {
        component: 'sync-service',
        error: error instanceof Error ? error.message : String(error),
      })
      
      // Return zeros on error
      return {
        workItems: 0,
        comments: 0,
        relations: 0,
        links: 0,
        syncMetrics: 0,
      }
    }
  }
}
