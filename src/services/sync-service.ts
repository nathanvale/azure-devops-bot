import { AzureAuth } from './auth.js'
import { AzureDevOpsClient } from './azure-devops.js'
import { DatabaseService } from './database.js'

export class SyncService {
  private auth: AzureAuth
  private client: AzureDevOpsClient
  private db: DatabaseService
  private syncInterval: NodeJS.Timeout | null = null

  constructor() {
    this.auth = new AzureAuth()
    this.client = new AzureDevOpsClient()
    this.db = new DatabaseService()
  }

  async performSync(): Promise<void> {
    try {
      await this.auth.ensureAuth()
      const workItems = await this.client.fetchWorkItems()
      await this.db.syncWorkItems(workItems)
      console.log(`✅ Synced ${workItems.length} work items`)
    } catch (error) {
      console.error('❌ Sync failed:', error)
      throw error
    }
  }

  async performSyncDetailed(concurrencyLimit: number = 5): Promise<void> {
    const startTime = Date.now()

    try {
      await this.auth.ensureAuth()

      // Step 1: Discover work item IDs using fast WIQL query
      const workItemIds = await this.client.fetchWorkItems()
      const idList = workItemIds.map((item: any) => item.id)

      console.log(`🔍 Discovered ${idList.length} work items for detailed sync`)

      // Step 2: Fetch detailed data in parallel with controlled concurrency
      const detailedWorkItems = await this.client.fetchWorkItemsDetailed(
        idList,
        concurrencyLimit,
      )

      // Step 3: Store all detailed work items
      await this.db.syncWorkItems(detailedWorkItems)

      // Step 4: Sync comments for work items that need it
      await this.syncCommentsForWorkItems(detailedWorkItems)

      const endTime = Date.now()
      const duration = endTime - startTime

      console.log(
        `✅ Synced ${detailedWorkItems.length} work items with detailed data`,
      )
      console.log(`⏱️  Detailed sync completed in ${duration}ms`)
      console.log(
        `📊 Work items: ${idList.length} discovered, ${detailedWorkItems.length} detailed fetched with concurrency ${concurrencyLimit}`,
      )
    } catch (error) {
      console.error('❌ Detailed sync failed:', error)
      throw error
    }
  }

  private async syncCommentsForWorkItems(workItems: any[]): Promise<void> {
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
    const workItemsNeedingSync: any[] = []
    for (const workItem of workItems) {
      checkedCount++

      try {
        const needsSync = await this.db.needsCommentSync(
          workItem.id,
          workItem.commentCount || 0,
          workItem.changedDate,
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

  private async syncSingleWorkItemComments(workItem: any): Promise<number> {
    const comments = await this.client.fetchWorkItemComments(workItem.id)
    await this.db.storeWorkItemComments(comments)
    return comments.length
  }

  private getSyncInterval(): number {
    const envInterval = process.env.AZURE_DEVOPS_SYNC_INTERVAL_MINUTES
    const defaultInterval = 5 // 5 minutes default

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
    console.log(
      `🔄 Background ${syncType} started (every ${intervalMinutes} minutes)`,
    )
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
}
