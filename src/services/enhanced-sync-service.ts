import type { Logger } from '@orchestr8/logger'
import { LoggerFactory } from '../utils/logger.js'
import { ProductionResilienceAdapter } from '@orchestr8/resilience'
import type { ResiliencePolicy } from '@orchestr8/resilience'

import type { IAzureDevOpsClient } from '../packages/azure-devops-client/src/interfaces/client.js'
import type { WorkItemData } from './azure-devops.js'
import type { DatabaseService } from './database.js'
import { AuthValidationService } from './auth-validation.js'
import { ResiliencePolicySelector } from '../utils/resilience-policies.js'
import { ErrorAggregator } from '../utils/error-aggregator.js'

/**
 * Enhanced Sync Service with @orchestr8/resilience integration
 * 
 * Replaces the original SyncService with comprehensive resilience patterns:
 * - Blocking authentication validation prevents cascade failures
 * - Operation-specific resilience policies (auth, sync, batch, rate-limit)
 * - @orchestr8/logger structured logging with telemetry
 * - ProductionResilienceAdapter for advanced retry and circuit breaking
 */
export class EnhancedSyncService {
  private logger?: Logger
  private resilienceAdapter: ProductionResilienceAdapter
  private authValidationService: AuthValidationService
  private syncInterval: NodeJS.Timeout | null = null

  constructor(
    private client: IAzureDevOpsClient,
    private database: DatabaseService
  ) {
    this.initializeServices()
    this.authValidationService = new AuthValidationService(client)
    this.resilienceAdapter = new ProductionResilienceAdapter({
      telemetry: this.createResilienceTelemetry()
    })
  }

  /**
   * Initialize logger and resilience services
   */
  private initializeServices(): void {
    // Use centralized logger factory that respects quiet mode
    this.logger = LoggerFactory.createForComponent('enhanced-sync-service')
  }

  /**
   * Enhanced sync operation with comprehensive resilience and authentication validation
   * 
   * Flow:
   * 1. Blocking authentication validation (prevents cascade failures)
   * 2. Discover work item IDs using sync operations policy
   * 3. Fetch detailed work items using batch operations policy
   * 4. Store work items with error aggregation
   * 5. Sync comments for work items needing updates
   * 6. Generate telemetry and metrics
   */
  async performEnhancedSync(concurrencyLimit: number = 5): Promise<void> {
    const start = performance.now()
    
    // Ensure services are initialized
    if (!this.logger || !this.resilienceAdapter) {
      await this.initializeServices()
    }

    this.logger?.info('Starting enhanced sync operation', {
      component: 'enhanced-sync-service',
      concurrencyLimit,
      operation: 'enhanced_sync'
    })

    const errorAggregator = new ErrorAggregator(this.logger)

    try {
      // Step 1: Blocking authentication validation prevents cascade failures
      await this.validateAuthenticationBlocking()

      // Step 2: Discover work item IDs using sync operations resilience policy
      const workItemIds = await this.discoverWorkItemIds()

      this.logger?.info('Work items discovered for enhanced sync', {
        component: 'enhanced-sync-service',
        discoveredCount: workItemIds.length,
        operation: 'work_item_discovery'
      })

      // Step 3: Fetch detailed work items using batch operations policy
      const detailedWorkItems = await this.fetchWorkItemsWithBatchResilience(
        workItemIds,
        concurrencyLimit,
        errorAggregator
      )

      // Step 4: Store work items
      await this.database.syncWorkItems(detailedWorkItems)
      errorAggregator.recordSuccess()

      // Step 5: Sync comments for work items that need it
      await this.syncCommentsWithResilience(detailedWorkItems, errorAggregator)

      const duration = performance.now() - start
      this.logger?.info('Enhanced sync completed successfully', {
        component: 'enhanced-sync-service',
        durationMs: duration,
        totalWorkItems: detailedWorkItems.length,
        operation: 'enhanced_sync'
      })

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const duration = performance.now() - start

      errorAggregator.recordError(errorMessage)

      this.logger?.error('Enhanced sync failed', {
        component: 'enhanced-sync-service',
        error: errorMessage,
        durationMs: duration,
        operation: 'enhanced_sync'
      })

      throw error
    }
  }

  /**
   * Blocking authentication validation using AuthValidationService
   * Prevents cascade failures by validating auth before any sync operations
   */
  private async validateAuthenticationBlocking(): Promise<void> {
    const result = await this.authValidationService.validateAuthentication()

    if (!result.success) {
      const errorMessage = result.error ? result.error.message : 'Unknown authentication error'
      throw new Error(`Authentication validation failed before sync: ${errorMessage}`)
    }

    this.logger?.debug('Authentication validation passed', {
      component: 'enhanced-sync-service',
      userId: result.profile?.id,
      operation: 'auth_validation'
    })
  }

  /**
   * Discover work item IDs using sync operations resilience policy
   */
  private async discoverWorkItemIds(): Promise<number[]> {
    const syncPolicy = ResiliencePolicySelector.getPolicy('sync')

    const workItems = await this.resilienceAdapter.applyNormalizedPolicy(
      () => this.client.fetchWorkItems(),
      syncPolicy
    ) as WorkItemData[]

    return workItems.map(item => item.id)
  }

  /**
   * Fetch detailed work items with batch operations resilience policy
   */
  private async fetchWorkItemsWithBatchResilience(
    idList: number[],
    concurrencyLimit: number,
    errorAggregator: ErrorAggregator
  ): Promise<WorkItemData[]> {
    const results: WorkItemData[] = []
    const batchPolicy = ResiliencePolicySelector.getPolicy('batch')
    
    // Process items with controlled concurrency
    const semaphore = new Array(concurrencyLimit).fill(null)
    let currentIndex = 0

    const processBatch = async (): Promise<void> => {
      const promises = semaphore.map(async () => {
        while (currentIndex < idList.length) {
          const index = currentIndex++
          const workItemId = idList[index]

          if (!workItemId) continue

          try {
            const workItem = await this.resilienceAdapter.applyNormalizedPolicy(
              () => this.client.fetchSingleWorkItem(workItemId),
              batchPolicy
            ) as WorkItemData

            results[index] = workItem
            errorAggregator.recordSuccess(workItemId)
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            errorAggregator.recordError(errorMessage, workItemId)
            
            this.logger?.warn('Failed to fetch work item', {
              component: 'enhanced-sync-service',
              workItemId,
              error: errorMessage,
              operation: 'work_item_fetch'
            })
          }
        }
      })

      await Promise.allSettled(promises)
    }

    await processBatch()

    // Filter out undefined values (failed fetches) and preserve order
    return results.filter((item) => item !== undefined)
  }

  /**
   * Sync comments with resilience policies and controlled concurrency
   */
  private async syncCommentsWithResilience(
    workItems: WorkItemData[],
    errorAggregator: ErrorAggregator
  ): Promise<void> {
    const lastSyncTime = await this.database.getLastSyncTime()
    let checkedCount = 0
    let syncedCount = 0
    const CONCURRENCY = 5

    this.logger?.info('Starting comment sync', {
      component: 'enhanced-sync-service',
      workItemCount: workItems.length,
      operation: 'comment_sync'
    })

    // Filter work items that need comment sync
    const workItemsNeedingSync: WorkItemData[] = []
    for (const workItem of workItems) {
      checkedCount++

      try {
        const needsSync = await this.database.needsCommentSync(
          workItem.id,
          workItem.commentCount || 0,
          workItem.changedDate || null,
          lastSyncTime
        )

        if (needsSync) {
          workItemsNeedingSync.push(workItem)
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        errorAggregator.recordError(errorMessage, workItem.id)
        
        this.logger?.warn('Failed to check comment sync status', {
          component: 'enhanced-sync-service',
          workItemId: workItem.id,
          error: errorMessage,
          operation: 'comment_sync_check'
        })
      }
    }

    if (workItemsNeedingSync.length === 0) {
      this.logger?.info('No work items need comment sync', {
        component: 'enhanced-sync-service',
        checkedCount,
        operation: 'comment_sync'
      })
      return
    }

    // Process comment sync with controlled concurrency and resilience
    const queue = [...workItemsNeedingSync]
    const inProgress = new Set<Promise<void>>()
    const syncPolicy = ResiliencePolicySelector.getPolicy('sync')

    while (queue.length > 0 || inProgress.size > 0) {
      // Start new tasks up to concurrency limit
      while (inProgress.size < CONCURRENCY && queue.length > 0) {
        const workItem = queue.shift()!
        const promise = this.syncSingleWorkItemCommentsWithResilience(workItem, syncPolicy)
          .then(() => {
            syncedCount++
            errorAggregator.recordSuccess(workItem.id)
          })
          .catch((error) => {
            const errorMessage = error instanceof Error ? error.message : String(error)
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

    this.logger?.info('Comment sync completed', {
      component: 'enhanced-sync-service',
      checkedCount,
      syncedCount,
      operation: 'comment_sync'
    })
  }

  /**
   * Sync comments for a single work item with resilience policy
   */
  private async syncSingleWorkItemCommentsWithResilience(
    workItem: WorkItemData,
    policy: ResiliencePolicy
  ): Promise<void> {
    try {
      const comments = await this.resilienceAdapter.applyNormalizedPolicy(
        () => this.client.fetchWorkItemComments(workItem.id),
        policy
      )

      await this.database.storeWorkItemComments(comments)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      this.logger?.warn('Failed to sync comments for work item', {
        component: 'enhanced-sync-service',
        workItemId: workItem.id,
        error: errorMessage,
        operation: 'single_comment_sync'
      })
      
      throw error
    }
  }

  /**
   * Start background sync with enhanced resilience
   */
  async startBackgroundSync(useEnhancedSync: boolean = true): Promise<void> {
    const SYNC_INTERVAL = this.getSyncInterval()
    const intervalMinutes = SYNC_INTERVAL / (60 * 1000)

    this.syncInterval = setInterval(async () => {
      try {
        if (useEnhancedSync) {
          await this.performEnhancedSync()
        } else {
          // Fallback to basic sync if needed
          console.warn('Using basic sync - enhanced sync disabled')
        }
      } catch (error) {
        this.logger?.error('Background enhanced sync failed', {
          component: 'enhanced-sync-service',
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }, SYNC_INTERVAL)

    this.logger?.info('Background enhanced sync started', {
      component: 'enhanced-sync-service',
      intervalMinutes,
      operation: 'background_sync_start'
    })
  }

  /**
   * Stop background sync
   */
  stopBackgroundSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
      
      this.logger?.info('Background enhanced sync stopped', {
        component: 'enhanced-sync-service'
      })
    }
  }

  /**
   * Get sync interval from environment or default
   */
  private getSyncInterval(): number {
    const envInterval = process.env.AZURE_DEVOPS_SYNC_INTERVAL_MINUTES
    const defaultInterval = 5 // 5 minutes default

    if (envInterval) {
      const parsed = parseInt(envInterval, 10)
      if (isNaN(parsed) || parsed <= 0) {
        this.logger?.warn('Invalid sync interval, using default', {
          component: 'enhanced-sync-service',
          invalidValue: envInterval,
          defaultInterval
        })
        return defaultInterval * 60 * 1000
      }
      return parsed * 60 * 1000
    }

    return defaultInterval * 60 * 1000
  }

  /**
   * Close service and database connection
   */
  async close(): Promise<void> {
    this.stopBackgroundSync()
    await this.database.close()
    
    this.logger?.info('Enhanced sync service closed', {
      component: 'enhanced-sync-service'
    })
  }

  /**
   * Create telemetry callbacks for resilience adapter integration
   */
  private createResilienceTelemetry() {
    return {
      logEvent: (type: string, context: any, metadata?: Record<string, unknown>) => {
        this.logger?.info(`Resilience event: ${type}`, { context, metadata })
      },
      
      createCircuitBreakerObserver: () => ({
        onStateChange: (key: string, state: 'closed' | 'open' | 'half-open') => {
          if (state === 'open') {
            this.logger?.error('Sync circuit breaker opened - sync failures detected', { 
              circuitKey: key,
              action: 'blocking_further_attempts'
            })
          } else if (state === 'closed') {
            this.logger?.info('Sync circuit breaker closed - sync operations recovered', { 
              circuitKey: key 
            })
          } else if (state === 'half-open') {
            this.logger?.warn('Sync circuit breaker half-open - testing recovery', {
              circuitKey: key
            })
          }
        }
      }),
      
      startTimer: (operation: string) => {
        const start = performance.now()
        return () => {
          const duration = performance.now() - start
          this.logger?.debug('Enhanced sync timing', {
            operation,
            durationMs: duration
          })
          return duration
        }
      },
      
      getLogger: () => this.logger
    }
  }
}