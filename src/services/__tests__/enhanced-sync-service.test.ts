import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Mock } from 'vitest'
import { ProductionResilienceAdapter } from '@orchestr8/resilience'
import { createPinoLogger } from '@orchestr8/logger'

import { EnhancedSyncService } from '../enhanced-sync-service.js'
import { AuthValidationService } from '../auth-validation.js'
import type { IAzureDevOpsClient } from '../../packages/azure-devops-client/src/interfaces/client.js'
import type { WorkItemData } from '../azure-devops.js'
import type { DatabaseService } from '../database.js'
import { ResiliencePolicySelector } from '../../utils/resilience-policies.js'

// Mock dependencies
vi.mock('@orchestr8/resilience')
vi.mock('@orchestr8/logger')
vi.mock('../auth-validation.js')
vi.mock('../database.js')
vi.mock('../../utils/resilience-policies.js')

describe('EnhancedSyncService', () => {
  let enhancedSyncService: EnhancedSyncService
  let mockClient: IAzureDevOpsClient
  let mockDatabase: DatabaseService
  let mockResilienceAdapter: ProductionResilienceAdapter
  let mockAuthValidationService: AuthValidationService
  let mockLogger: any

  const mockWorkItem: WorkItemData = {
    id: 1234,
    title: 'Test Work Item',
    workItemType: 'User Story',
    state: 'Active',
    assignedTo: {
      uniqueName: 'test@example.com',
      displayName: 'Test User'
    },
    createdDate: new Date('2025-01-01'),
    changedDate: new Date('2025-01-02'),
    commentCount: 2
  }

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()

    // Mock Azure DevOps client
    mockClient = {
      fetchWorkItems: vi.fn(),
      fetchSingleWorkItem: vi.fn(),
      fetchWorkItemsDetailed: vi.fn(),
      fetchWorkItemComments: vi.fn(),
      getCurrentUserProfile: vi.fn(),
    } as any

    // Mock database service
    mockDatabase = {
      syncWorkItems: vi.fn(),
      storeWorkItemComments: vi.fn(),
      getLastSyncTime: vi.fn(),
      needsCommentSync: vi.fn(),
      close: vi.fn(),
      client: {} as any
    } as any

    // Mock resilience adapter
    mockResilienceAdapter = {
      applyPolicy: vi.fn(),
      applyNormalizedPolicy: vi.fn(),
    } as any

    // Mock logger
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      child: vi.fn().mockReturnThis(),
    }

    // Mock logger creation
    ;(createPinoLogger as Mock).mockResolvedValue(mockLogger)

    // Mock ProductionResilienceAdapter constructor
    ;(ProductionResilienceAdapter as any).mockImplementation(() => mockResilienceAdapter)

    // Mock AuthValidationService
    mockAuthValidationService = {
      validateAuthentication: vi.fn(),
    } as any
    ;(AuthValidationService as any).mockImplementation(() => mockAuthValidationService)

    // Mock ResiliencePolicySelector
    ;(ResiliencePolicySelector.getPolicy as Mock).mockReturnValue({
      retry: { maxAttempts: 3 },
      circuitBreaker: { key: 'test' },
      timeout: { duration: 30000 }
    })

    enhancedSyncService = new EnhancedSyncService(mockClient, mockDatabase)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('constructor', () => {
    it('should initialize with client and database', () => {
      expect(enhancedSyncService).toBeDefined()
      expect(ProductionResilienceAdapter).toHaveBeenCalledWith(expect.objectContaining({
        telemetry: expect.any(Object)
      }))
      expect(AuthValidationService).toHaveBeenCalledWith(mockClient)
    })

    it('should create resilience adapter with telemetry configuration', () => {
      expect(ProductionResilienceAdapter).toHaveBeenCalledWith({
        telemetry: expect.objectContaining({
          logEvent: expect.any(Function),
          createCircuitBreakerObserver: expect.any(Function),
          startTimer: expect.any(Function),
          getLogger: expect.any(Function)
        })
      })
    })
  })

  describe('performEnhancedSync', () => {
    beforeEach(() => {
      ;(mockAuthValidationService.validateAuthentication as Mock).mockResolvedValue({
        success: true,
        profile: { id: 'user-123', emailAddress: 'test@example.com' }
      })
      ;(mockClient.fetchWorkItems as Mock).mockResolvedValue([{ id: 1234 }])
      ;(mockResilienceAdapter.applyNormalizedPolicy as Mock).mockImplementation(
        async (operation: Function) => await operation()
      )
      ;(mockDatabase.syncWorkItems as Mock).mockResolvedValue(undefined)
      ;(mockDatabase.getLastSyncTime as Mock).mockResolvedValue(new Date())
    })

    it('should validate authentication before starting sync', async () => {
      await enhancedSyncService.performEnhancedSync()

      expect(mockAuthValidationService.validateAuthentication).toHaveBeenCalledTimes(1)
    })

    it('should block sync operations if authentication fails', async () => {
      ;(mockAuthValidationService.validateAuthentication as Mock).mockResolvedValue({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Invalid PAT token' }
      })

      await expect(enhancedSyncService.performEnhancedSync()).rejects.toThrow(
        'Authentication validation failed before sync: Invalid PAT token'
      )

      expect(mockClient.fetchWorkItems).not.toHaveBeenCalled()
    })

    it('should use sync operations policy for work item discovery', async () => {
      await enhancedSyncService.performEnhancedSync()

      expect(ResiliencePolicySelector.getPolicy).toHaveBeenCalledWith('sync')
      expect(mockResilienceAdapter.applyNormalizedPolicy).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          retry: { maxAttempts: 3 },
          circuitBreaker: { key: 'test' },
          timeout: { duration: 30000 }
        })
      )
    })

    it('should discover work item IDs successfully', async () => {
      const mockWorkItems = [{ id: 1234 }, { id: 5678 }]
      ;(mockClient.fetchWorkItems as Mock).mockResolvedValue(mockWorkItems)

      await enhancedSyncService.performEnhancedSync()

      expect(mockClient.fetchWorkItems).toHaveBeenCalledTimes(1)
      expect(mockLogger.info).toHaveBeenCalledWith('Work items discovered for enhanced sync', expect.objectContaining({
        component: 'enhanced-sync-service',
        discoveredCount: 2,
        operation: 'work_item_discovery'
      }))
    })

    it('should handle work item discovery errors gracefully', async () => {
      const discoveryError = new Error('Network error during discovery')
      ;(mockResilienceAdapter.applyNormalizedPolicy as Mock).mockRejectedValue(discoveryError)

      await expect(enhancedSyncService.performEnhancedSync()).rejects.toThrow('Network error during discovery')
      
      expect(mockLogger.error).toHaveBeenCalledWith('Enhanced sync failed', expect.objectContaining({
        component: 'enhanced-sync-service',
        error: 'Network error during discovery',
        operation: 'enhanced_sync'
      }))
    })
  })

  describe('batch processing with resilience policies', () => {
    beforeEach(() => {
      ;(mockAuthValidationService.validateAuthentication as Mock).mockResolvedValue({
        success: true,
        profile: { id: 'user-123' }
      })
      ;(mockClient.fetchWorkItems as Mock).mockResolvedValue([{ id: 1234 }, { id: 5678 }])
      ;(mockClient.fetchSingleWorkItem as Mock).mockResolvedValue(mockWorkItem)
      ;(mockResilienceAdapter.applyNormalizedPolicy as Mock).mockImplementation(
        async (operation: Function) => await operation()
      )
      ;(mockDatabase.syncWorkItems as Mock).mockResolvedValue(undefined)
      ;(mockDatabase.getLastSyncTime as Mock).mockResolvedValue(new Date())
      ;(mockDatabase.needsCommentSync as Mock).mockResolvedValue(false)
    })

    it('should use batch operations policy for detailed work item fetching', async () => {
      await enhancedSyncService.performEnhancedSync()

      // Should call getPolicy for both 'sync' (discovery) and 'batch' (detailed fetch)
      expect(ResiliencePolicySelector.getPolicy).toHaveBeenCalledWith('sync')
      expect(ResiliencePolicySelector.getPolicy).toHaveBeenCalledWith('batch')
    })

    it('should process work items in batches with controlled concurrency', async () => {
      const concurrencyLimit = 3
      await enhancedSyncService.performEnhancedSync(concurrencyLimit)

      expect(mockClient.fetchSingleWorkItem).toHaveBeenCalledWith(1234)
      expect(mockClient.fetchSingleWorkItem).toHaveBeenCalledWith(5678)
    })

    it('should handle individual work item fetch failures without stopping sync', async () => {
      const fetchError = new Error('Failed to fetch work item 1234')
      ;(mockClient.fetchSingleWorkItem as Mock)
        .mockResolvedValueOnce(mockWorkItem) // First call succeeds
        .mockRejectedValueOnce(fetchError)   // Second call fails

      await enhancedSyncService.performEnhancedSync()

      expect(mockLogger.warn).toHaveBeenCalledWith('Failed to fetch work item', expect.objectContaining({
        component: 'enhanced-sync-service',
        workItemId: 5678,
        error: 'Failed to fetch work item 1234',
        operation: 'work_item_fetch'
      }))

      // Should still sync the successful work item
      expect(mockDatabase.syncWorkItems).toHaveBeenCalledWith([mockWorkItem])
    })
  })

  describe('comment sync with resilience policies', () => {
    beforeEach(() => {
      ;(mockAuthValidationService.validateAuthentication as Mock).mockResolvedValue({
        success: true,
        profile: { id: 'user-123' }
      })
      ;(mockClient.fetchWorkItems as Mock).mockResolvedValue([{ id: 1234 }])
      ;(mockClient.fetchSingleWorkItem as Mock).mockResolvedValue(mockWorkItem)
      ;(mockClient.fetchWorkItemComments as Mock).mockResolvedValue([
        { id: 1, text: 'Comment 1', createdDate: new Date(), createdBy: { displayName: 'User' } }
      ])
      ;(mockResilienceAdapter.applyNormalizedPolicy as Mock).mockImplementation(
        async (operation: Function) => await operation()
      )
      ;(mockDatabase.syncWorkItems as Mock).mockResolvedValue(undefined)
      ;(mockDatabase.getLastSyncTime as Mock).mockResolvedValue(new Date('2025-01-01'))
      ;(mockDatabase.needsCommentSync as Mock).mockResolvedValue(true)
      ;(mockDatabase.storeWorkItemComments as Mock).mockResolvedValue(undefined)
    })

    it('should sync comments with sync operations resilience policy', async () => {
      await enhancedSyncService.performEnhancedSync()

      expect(mockClient.fetchWorkItemComments).toHaveBeenCalledWith(1234)
      expect(mockDatabase.storeWorkItemComments).toHaveBeenCalledWith([
        expect.objectContaining({ id: 1, text: 'Comment 1' })
      ])
    })

    it('should skip comment sync when not needed', async () => {
      ;(mockDatabase.needsCommentSync as Mock).mockResolvedValue(false)

      await enhancedSyncService.performEnhancedSync()

      expect(mockClient.fetchWorkItemComments).not.toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith('No work items need comment sync', expect.objectContaining({
        component: 'enhanced-sync-service',
        checkedCount: 1,
        operation: 'comment_sync'
      }))
    })

    it('should handle comment sync failures gracefully', async () => {
      const commentError = new Error('Failed to fetch comments')
      let callCount = 0
      
      ;(mockResilienceAdapter.applyNormalizedPolicy as Mock).mockImplementation(
        async (operation: Function) => {
          callCount++
          // First 2 calls are for discovery and work item fetching (should succeed)
          if (callCount <= 2) {
            return await operation()
          }
          // Third call and beyond are for comment fetching (should fail)
          throw commentError
        }
      )

      await enhancedSyncService.performEnhancedSync()

      expect(mockLogger.warn).toHaveBeenCalledWith('Failed to sync comments for work item', expect.objectContaining({
        component: 'enhanced-sync-service',
        workItemId: 1234,
        error: 'Failed to fetch comments',
        operation: 'single_comment_sync'
      }))
    })
  })

  describe('resilience telemetry integration', () => {
    it('should configure telemetry callbacks for circuit breaker events', () => {
      const telemetryConfig = (ProductionResilienceAdapter as any).mock.calls[0][0].telemetry

      expect(telemetryConfig).toHaveProperty('logEvent')
      expect(telemetryConfig).toHaveProperty('createCircuitBreakerObserver')
      expect(telemetryConfig).toHaveProperty('startTimer')
      expect(telemetryConfig).toHaveProperty('getLogger')
    })

    it('should log circuit breaker state changes', () => {
      const telemetryConfig = (ProductionResilienceAdapter as any).mock.calls[0][0].telemetry
      const observer = telemetryConfig.createCircuitBreakerObserver()

      observer.onStateChange('azure-devops-sync', 'open')

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Sync circuit breaker opened - sync failures detected',
        expect.objectContaining({
          circuitKey: 'azure-devops-sync',
          action: 'blocking_further_attempts'
        })
      )
    })

    it('should track operation timing', () => {
      const telemetryConfig = (ProductionResilienceAdapter as any).mock.calls[0][0].telemetry
      const stopTimer = telemetryConfig.startTimer('test-operation')

      stopTimer()

      expect(mockLogger.debug).toHaveBeenCalledWith('Enhanced sync timing', expect.objectContaining({
        operation: 'test-operation',
        durationMs: expect.any(Number)
      }))
    })
  })

  describe('error handling and logging', () => {
    beforeEach(() => {
      ;(mockAuthValidationService.validateAuthentication as Mock).mockResolvedValue({
        success: true,
        profile: { id: 'user-123' }
      })
    })

    it('should log sync start and completion', async () => {
      ;(mockClient.fetchWorkItems as Mock).mockResolvedValue([])
      ;(mockResilienceAdapter.applyNormalizedPolicy as Mock).mockImplementation(
        async (operation: Function) => await operation()
      )
      ;(mockDatabase.syncWorkItems as Mock).mockResolvedValue(undefined)
      ;(mockDatabase.getLastSyncTime as Mock).mockResolvedValue(new Date())

      await enhancedSyncService.performEnhancedSync()

      expect(mockLogger.info).toHaveBeenCalledWith('Starting enhanced sync operation', expect.objectContaining({
        component: 'enhanced-sync-service',
        concurrencyLimit: 5,
        operation: 'enhanced_sync'
      }))

      expect(mockLogger.info).toHaveBeenCalledWith('Enhanced sync completed successfully', expect.anything())
    })

    it('should log detailed error information on failure', async () => {
      const syncError = new Error('Database connection failed')
      ;(mockResilienceAdapter.applyNormalizedPolicy as Mock).mockRejectedValue(syncError)

      await expect(enhancedSyncService.performEnhancedSync()).rejects.toThrow('Database connection failed')

      expect(mockLogger.error).toHaveBeenCalledWith('Enhanced sync failed', expect.objectContaining({
        component: 'enhanced-sync-service',
        error: 'Database connection failed',
        operation: 'enhanced_sync'
      }))
    })
  })

  describe('close method', () => {
    it('should close database connection properly', async () => {
      await enhancedSyncService.close()

      expect(mockDatabase.close).toHaveBeenCalledTimes(1)
    })
  })
})