import type { OutputManager } from '../cli/output-manager.js'
import type { ProgressManager } from '../cli/progress-manager.js'
import type { WorkItemData } from './azure-devops.js'

import { VerbosityLevel } from '../cli/cli-config.js'
import { ErrorAggregator } from '../utils/error-aggregator.js'
import { getLogger } from '../utils/logger.js'
import { SyncService } from './sync-service.js'

/**
 * CLI-enhanced sync service that extends the base SyncService with professional CLI output.
 * Replaces console.log statements with OutputManager and adds progress indication with ProgressManager.
 */
export class CLISyncService extends SyncService {
  private pendingCountdown: Date | null = null
  private pendingMessage: string | null = null

  constructor(
    private outputManager: OutputManager,
    private progressManager: ProgressManager,
  ) {
    super()
  }

  /**
   * Enhanced performSync with OutputManager instead of console output
   */
  override async performSync(): Promise<void> {
    try {
      const workItems = await this.client.fetchWorkItems()
      await this.db.syncWorkItems(workItems)
      this.outputManager.success(`Synced ${workItems.length} work items`)
    } catch (error) {
      this.outputManager.error('Sync failed', error as any)
      throw error
    }
  }

  /**
   * Enhanced performSyncDetailed with OutputManager and progress indication
   */
  override async performSyncDetailed(
    concurrencyLimit: number = 5,
  ): Promise<void> {
    const errorAggregator = new ErrorAggregator(this.logger)

    this.logger.info('Starting detailed sync operation', {
      component: 'cli-sync-service',
      concurrencyLimit,
      operation: 'detailed_sync',
    })

    try {
      // Step 1: Discover work item IDs using fast WIQL query
      const workItemIds = await this.client.fetchWorkItems()
      const idList = workItemIds.map((item: WorkItemData) => item.id)

      this.logger.info('Work items discovered for detailed sync', {
        component: 'cli-sync-service',
        discoveredCount: idList.length,
        operation: 'work_item_discovery',
      })

      // Step 2: Fetch detailed data with error tracking
      const detailedWorkItems = await (this as any).fetchWorkItemsWithTracking(
        idList.map(Number),
        concurrencyLimit,
        errorAggregator,
      )

      // Step 3: Store all detailed work items
      await this.db.syncWorkItems(detailedWorkItems)
      errorAggregator.recordSuccess()

      // Step 4: Sync comments for work items that need it (enhanced version)
      await this.syncCommentsForWorkItemsEnhanced(detailedWorkItems)

      // Generate and store metrics
      const summary = errorAggregator.generateSummary()
      await (this as any).syncMetrics.storeSyncMetrics(summary, 'detailed')

      // Verify all tables have data - use OutputManager instead of console.log
      const tableVerification = await (this as any).verifyAllTables()

      this.logger.info('Detailed sync completed successfully', {
        component: 'cli-sync-service',
        summary: {
          totalAttempted: summary.syncMetrics.totalAttempted,
          totalSucceeded: summary.syncMetrics.totalSucceeded,
          successRate: summary.syncMetrics.successRate,
          durationMs: summary.syncMetrics.durationMs,
          errorCount: summary.totalErrors,
        },
        tableData: tableVerification,
      })

      // Use OutputManager for table verification output instead of console.log
      // Only show in verbose mode or higher
      this.outputManager.info(
        'Database Table Verification',
        {
          workItems: tableVerification.workItems,
          comments: tableVerification.comments,
          relations: tableVerification.relations,
          links: tableVerification.links,
          syncMetrics: tableVerification.syncMetrics,
        },
        VerbosityLevel.VERBOSE,
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      errorAggregator.recordError(errorMessage)

      // Store failed sync metrics
      const summary = errorAggregator.generateSummary()
      await (this as any).syncMetrics.storeSyncMetrics(summary, 'detailed')

      this.logger.error('Detailed sync failed', {
        component: 'cli-sync-service',
        error: errorMessage,
        operation: 'detailed_sync',
      })

      this.outputManager.error('Detailed sync failed', error as any)
      throw error
    }
  }

  /**
   * Enhanced comment sync with ProgressManager instead of console progress reporting
   */
  private async syncCommentsForWorkItemsEnhanced(
    workItems: WorkItemData[],
  ): Promise<void> {
    const lastSyncTime = await this.db.getLastSyncTime()
    let checkedCount = 0
    let syncedCount = 0
    let totalCommentsProcessed = 0
    const CONCURRENCY = 5

    this.progressManager.startIndeterminate(
      'Checking work items for comment sync',
    )

    // Filter work items that need comment sync first
    const workItemsNeedingSync: WorkItemData[] = []
    for (const workItem of workItems) {
      checkedCount++

      try {
        const needsSync = await this.db.needsCommentSync(
          Number(workItem.id),
          workItem.commentCount || 0,
          workItem.changedDate ? new Date(workItem.changedDate) : null,
          lastSyncTime,
        )

        if (needsSync) {
          workItemsNeedingSync.push(workItem)
        }
      } catch (error) {
        this.outputManager.warn(
          `Failed to check sync status for work item ${workItem.id}`,
          error as any,
        )
      }
    }

    if (workItemsNeedingSync.length === 0) {
      this.progressManager.stopIndeterminate()
      this.outputManager.info(
        `Comment sync complete: ${checkedCount} work items checked, 0 needed comment sync`,
      )
      return
    }

    // Stop the checking spinner with a completion message
    this.progressManager.stopIndeterminate(
      `Found ${workItemsNeedingSync.length} work items needing comment sync`,
    )

    // Process comment sync with controlled concurrency
    const queue = [...workItemsNeedingSync]
    const inProgress = new Set<Promise<void>>()

    // Start the syncing spinner on next line
    this.progressManager.startIndeterminate('Syncing comments for work items')

    while (queue.length > 0 || inProgress.size > 0) {
      // Start new tasks up to concurrency limit
      while (inProgress.size < CONCURRENCY && queue.length > 0) {
        const workItem = queue.shift()!
        const promise = (this as any).syncSingleWorkItemComments(workItem)
          .then((commentCount: number) => {
            syncedCount++
            totalCommentsProcessed += commentCount
          })
          .catch((error: any) => {
            this.outputManager.warn(
              `Failed to sync comments for work item ${workItem.id}`,
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

    this.progressManager.stopIndeterminate('Comment sync completed')
    this.outputManager.info(
      `Comment sync complete: ${checkedCount} work items checked, ${syncedCount} had comments synced (${totalCommentsProcessed} total comments)`,
    )
  }

  /**
   * Enhanced startBackgroundSync with OutputManager and countdown spinner
   */
  override async startBackgroundSync(
    useDetailedSync: boolean = true,
    silent: boolean = false,
  ): Promise<void> {
    const SYNC_INTERVAL = this.getSyncIntervalEnhanced()
    const intervalMinutes = SYNC_INTERVAL / (60 * 1000)

    // Helper function to calculate next sync time
    const getNextSyncTime = () => new Date(Date.now() + SYNC_INTERVAL)

    // Store the next sync time but DON'T start countdown yet
    let nextSyncTime = getNextSyncTime()

    // We'll start the countdown after the first operation completes
    // Store it so we can start it later
    this.pendingCountdown = nextSyncTime

    this.syncInterval = setInterval(async () => {
      // Stop countdown when sync starts
      this.progressManager.stopSyncCountdown()

      try {
        if (useDetailedSync) {
          await this.performSyncDetailed()
        } else {
          await this.performSync()
        }
      } catch (error) {
        this.outputManager.error('Background sync failed', error as any)
      } finally {
        // Start countdown for next sync after current sync completes
        nextSyncTime = getNextSyncTime()
        this.progressManager.startSyncCountdown(nextSyncTime)
      }
    }, SYNC_INTERVAL)

    // Store the message details for later display if in silent mode
    const syncType = useDetailedSync ? 'detailed sync' : 'sync'
    const intervalDisplay =
      intervalMinutes < 1
        ? `${SYNC_INTERVAL / 1000} seconds`
        : `${intervalMinutes} minutes`

    this.pendingMessage = `Background ${syncType} started (every ${intervalDisplay})`

    // Only show the message immediately if not in silent mode
    if (!silent) {
      this.outputManager.info(this.pendingMessage)
    }
  }

  /**
   * Show the background sync started message - call this after showing query results
   */
  showBackgroundSyncStartedMessage(): void {
    if (this.pendingMessage) {
      this.outputManager.info(this.pendingMessage)
      this.pendingMessage = null
    }
  }

  /**
   * Start the pending countdown - call this after showing query results
   */
  startPendingCountdown(): void {
    if (this.pendingCountdown) {
      this.progressManager.startSyncCountdown(this.pendingCountdown)
      this.pendingCountdown = null
    }
  }

  /**
   * Enhanced stopBackgroundSync with OutputManager
   */
  override stopBackgroundSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
      this.progressManager.stopSyncCountdown() // Stop any active countdown
      this.outputManager.info('Background sync stopped')
    }
  }

  /**
   * Enhanced sync interval getter with OutputManager for warnings
   */
  private getSyncIntervalEnhanced(): number {
    const envInterval = process.env.AZURE_DEVOPS_SYNC_INTERVAL_MINUTES
    const defaultInterval = 5 / 60 // 5 seconds for testing (5/60 minutes)

    if (envInterval) {
      const parsed = parseInt(envInterval, 10)
      if (isNaN(parsed) || parsed <= 0) {
        this.outputManager.warn(
          `Invalid AZURE_DEVOPS_SYNC_INTERVAL_MINUTES value: ${envInterval}. Using default ${defaultInterval} minutes.`,
        )
        return defaultInterval * 60 * 1000
      }
      return parsed * 60 * 1000
    }

    return defaultInterval * 60 * 1000
  }

  /**
   * Enhanced close method with cleanup
   */
  override async close(): Promise<void> {
    this.stopBackgroundSync()
    await this.db.close()
  }
}
