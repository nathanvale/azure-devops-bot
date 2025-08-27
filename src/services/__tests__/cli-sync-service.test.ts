import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CLISyncService } from '../cli-sync-service.js';
import { OutputManager } from '../../cli/output-manager.js';
import { ProgressManager } from '../../cli/progress-manager.js';
import { VerbosityLevel, OutputFormat } from '../../cli/cli-config.js';
import { initializeLogger } from '../../utils/logger.js';

describe('CLISyncService', () => {
  let outputManager: OutputManager;
  let progressManager: ProgressManager;
  let cliSyncService: CLISyncService;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    // Initialize logger before creating service
    await initializeLogger('cli-sync-service-test');
    
    outputManager = new OutputManager(VerbosityLevel.NORMAL, OutputFormat.TEXT);
    progressManager = new ProgressManager(VerbosityLevel.NORMAL, OutputFormat.TEXT);
    cliSyncService = new CLISyncService(outputManager, progressManager);
    
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with OutputManager and ProgressManager', () => {
      expect(cliSyncService).toBeInstanceOf(CLISyncService);
      expect(cliSyncService['outputManager']).toBe(outputManager);
      expect(cliSyncService['progressManager']).toBe(progressManager);
    });

    it('should extend base SyncService functionality', () => {
      // Should have all the same methods as base SyncService
      expect(typeof cliSyncService.performSync).toBe('function');
      expect(typeof cliSyncService.performSyncDetailed).toBe('function');
      expect(typeof cliSyncService.startBackgroundSync).toBe('function');
      expect(typeof cliSyncService.stopBackgroundSync).toBe('function');
      expect(typeof cliSyncService.shouldSync).toBe('function');
      expect(typeof cliSyncService.close).toBe('function');
    });
  });

  describe('performSync with enhanced output', () => {
    it('should use OutputManager for success messages instead of console.log', async () => {
      const successSpy = vi.spyOn(outputManager, 'success');
      
      // Mock the underlying methods to avoid actual Azure DevOps calls
      const mockFetchWorkItems = vi.fn().mockResolvedValue([
        { id: 1, title: 'Test Work Item 1' },
        { id: 2, title: 'Test Work Item 2' }
      ]);
      const mockSyncWorkItems = vi.fn().mockResolvedValue(undefined);
      
      cliSyncService['client'] = {
        fetchWorkItems: mockFetchWorkItems
      } as any;
      
      cliSyncService['db'] = {
        syncWorkItems: mockSyncWorkItems
      } as any;

      await cliSyncService.performSync();

      expect(successSpy).toHaveBeenCalledWith('Synced 2 work items');
      // OutputManager success method calls console.log internally, so we expect that
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('✅'), 'Synced 2 work items');
    });

    it('should use OutputManager for error messages instead of console.error', async () => {
      const errorSpy = vi.spyOn(outputManager, 'error');
      const testError = new Error('Sync failed for testing');
      
      // Mock the underlying methods to throw an error
      const mockFetchWorkItems = vi.fn().mockRejectedValue(testError);
      
      cliSyncService['client'] = {
        fetchWorkItems: mockFetchWorkItems
      } as any;

      await expect(cliSyncService.performSync()).rejects.toThrow('Sync failed for testing');

      expect(errorSpy).toHaveBeenCalledWith('Sync failed', testError);
      // OutputManager error method calls console.error internally, so we expect that
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('❌ Error:'), 'Sync failed');
    });
  });

  describe('performSyncDetailed with enhanced output', () => {
    it('should use OutputManager for table verification output', async () => {
      const infoSpy = vi.spyOn(outputManager, 'info');
      const mockTableVerification = {
        workItems: 150,
        comments: 45,
        relations: 12,
        links: 8,
        syncMetrics: 3
      };
      
      // Mock all the dependencies to avoid actual calls
      const mockFetchWorkItems = vi.fn().mockResolvedValue([{ id: 1 }]);
      const mockFetchWorkItemsBatch = vi.fn().mockResolvedValue([{ id: 1, title: 'Test' }]);
      const mockSyncWorkItems = vi.fn().mockResolvedValue(undefined);
      const mockVerifyAllTables = vi.fn().mockResolvedValue(mockTableVerification);
      const mockGetLastSyncTime = vi.fn().mockResolvedValue(new Date('2023-01-01'));
      const mockNeedsCommentSync = vi.fn().mockResolvedValue(false);
      const mockStoreSyncMetrics = vi.fn().mockResolvedValue(undefined);
      
      cliSyncService['client'] = {
        fetchWorkItems: mockFetchWorkItems,
        fetchWorkItemsBatch: mockFetchWorkItemsBatch
      } as any;
      
      cliSyncService['db'] = {
        syncWorkItems: mockSyncWorkItems,
        getLastSyncTime: mockGetLastSyncTime,
        needsCommentSync: mockNeedsCommentSync
      } as any;
      
      cliSyncService['verifyAllTables'] = mockVerifyAllTables;
      cliSyncService['syncMetrics'] = {
        storeSyncMetrics: mockStoreSyncMetrics
      } as any;
      cliSyncService['fetchWorkItemsWithTracking'] = vi.fn().mockResolvedValue([{ id: 1, title: 'Test' }]);

      await cliSyncService.performSyncDetailed();

      // Should use OutputManager for table verification, not console.log
      expect(infoSpy).toHaveBeenCalledWith('Database Table Verification', {
        workItems: 150,
        comments: 45,
        relations: 12,
        links: 8,
        syncMetrics: 3
      });
      
      // Should not use raw console.log for table verification (though OutputManager uses console internally)
      expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('📊 Database Table Verification:'));
    });

    it('should use OutputManager for error handling instead of console.error', async () => {
      const errorSpy = vi.spyOn(outputManager, 'error');
      const testError = new Error('Detailed sync failed');
      
      // Mock to throw an error
      const mockFetchWorkItems = vi.fn().mockRejectedValue(testError);
      const mockStoreSyncMetrics = vi.fn().mockResolvedValue(undefined);
      
      cliSyncService['client'] = {
        fetchWorkItems: mockFetchWorkItems
      } as any;
      
      cliSyncService['syncMetrics'] = {
        storeSyncMetrics: mockStoreSyncMetrics
      } as any;

      await expect(cliSyncService.performSyncDetailed()).rejects.toThrow('Detailed sync failed');

      expect(errorSpy).toHaveBeenCalledWith('Detailed sync failed', testError);
      // OutputManager error method calls console.error internally, so we expect that
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('❌ Error:'), 'Detailed sync failed');
    });
  });

  describe('background sync with enhanced output', () => {
    it('should use OutputManager for background sync start message', async () => {
      const infoSpy = vi.spyOn(outputManager, 'info');
      
      // Mock environment variable for sync interval
      const originalEnv = process.env.AZURE_DEVOPS_SYNC_INTERVAL_MINUTES;
      process.env.AZURE_DEVOPS_SYNC_INTERVAL_MINUTES = '5';

      await cliSyncService.startBackgroundSync(true);

      expect(infoSpy).toHaveBeenCalledWith('Background detailed sync started (every 5 minutes)');
      expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('🔄 Background'));
      
      // Clean up
      cliSyncService.stopBackgroundSync();
      if (originalEnv) {
        process.env.AZURE_DEVOPS_SYNC_INTERVAL_MINUTES = originalEnv;
      } else {
        delete process.env.AZURE_DEVOPS_SYNC_INTERVAL_MINUTES;
      }
    });

    it('should use OutputManager for background sync stop message', () => {
      const infoSpy = vi.spyOn(outputManager, 'info');
      
      // Start first so we have something to stop
      cliSyncService['syncInterval'] = setInterval(() => {}, 1000);

      cliSyncService.stopBackgroundSync();

      expect(infoSpy).toHaveBeenCalledWith('Background sync stopped');
      expect(consoleLogSpy).not.toHaveBeenCalledWith('⏹️  Background sync stopped');
    });

    it('should use OutputManager for invalid sync interval warnings', async () => {
      const warnSpy = vi.spyOn(outputManager, 'warn');
      
      // Set invalid environment variable
      const originalEnv = process.env.AZURE_DEVOPS_SYNC_INTERVAL_MINUTES;
      process.env.AZURE_DEVOPS_SYNC_INTERVAL_MINUTES = 'invalid';

      await cliSyncService.startBackgroundSync();

      expect(warnSpy).toHaveBeenCalledWith(
        'Invalid AZURE_DEVOPS_SYNC_INTERVAL_MINUTES value: invalid. Using default 0.08333333333333333 minutes.'
      );
      // OutputManager warn method calls console.log internally, so we expect that
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️'),
        'Invalid AZURE_DEVOPS_SYNC_INTERVAL_MINUTES value: invalid. Using default 0.08333333333333333 minutes.'
      );
      
      // Clean up
      cliSyncService.stopBackgroundSync();
      if (originalEnv) {
        process.env.AZURE_DEVOPS_SYNC_INTERVAL_MINUTES = originalEnv;
      } else {
        delete process.env.AZURE_DEVOPS_SYNC_INTERVAL_MINUTES;
      }
    });

    it('should use OutputManager for background sync failure errors', async () => {
      const errorSpy = vi.spyOn(outputManager, 'error');
      
      // Test the error handling logic directly by calling the internal method
      // Mock all dependencies to simulate a sync failure
      const mockFetchWorkItems = vi.fn().mockRejectedValue(new Error('Background sync test error'));
      const mockStoreSyncMetrics = vi.fn().mockResolvedValue(undefined);
      
      cliSyncService['client'] = {
        fetchWorkItems: mockFetchWorkItems
      } as any;
      
      cliSyncService['syncMetrics'] = {
        storeSyncMetrics: mockStoreSyncMetrics
      } as any;

      // Test the error handling directly by calling performSyncDetailed which should fail
      try {
        await cliSyncService.performSyncDetailed();
      } catch (error) {
        // Expected to fail
      }

      expect(errorSpy).toHaveBeenCalledWith('Detailed sync failed', expect.any(Error));
      // OutputManager error method calls console.error internally, so we expect that
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('❌ Error:'), 'Detailed sync failed');
    });
  });

  describe('comment sync with progress indication', () => {
    it('should use ProgressManager for comment sync operations', async () => {
      const startIndeterminateSpy = vi.spyOn(progressManager, 'startIndeterminate');
      const stopIndeterminateSpy = vi.spyOn(progressManager, 'stopIndeterminate');
      const infoSpy = vi.spyOn(outputManager, 'info');
      
      const mockWorkItems = [
        { id: 1, title: 'Test Item 1', commentCount: 5 },
        { id: 2, title: 'Test Item 2', commentCount: 3 }
      ];
      
      // Mock dependencies
      const mockGetLastSyncTime = vi.fn().mockResolvedValue(new Date('2023-01-01'));
      const mockNeedsCommentSync = vi.fn().mockResolvedValue(true);
      const mockFetchWorkItemComments = vi.fn().mockResolvedValue([
        { id: 1, text: 'Comment 1' },
        { id: 2, text: 'Comment 2' }
      ]);
      const mockStoreWorkItemComments = vi.fn().mockResolvedValue(undefined);
      
      cliSyncService['db'] = {
        getLastSyncTime: mockGetLastSyncTime,
        needsCommentSync: mockNeedsCommentSync,
        storeWorkItemComments: mockStoreWorkItemComments
      } as any;
      
      cliSyncService['client'] = {
        fetchWorkItemComments: mockFetchWorkItemComments
      } as any;

      await cliSyncService['syncCommentsForWorkItemsEnhanced'](mockWorkItems);

      expect(startIndeterminateSpy).toHaveBeenCalledWith('Checking work items for comment sync');
      expect(infoSpy).toHaveBeenCalledWith('Found 2 work items needing comment sync');
      expect(stopIndeterminateSpy).toHaveBeenCalledWith('Comment sync completed');
      
      // Should not use console.log for progress messages
      expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('📝 Checking'));
    });

    it('should handle no comments needed scenario gracefully', async () => {
      const startIndeterminateSpy = vi.spyOn(progressManager, 'startIndeterminate');
      const stopIndeterminateSpy = vi.spyOn(progressManager, 'stopIndeterminate');
      const infoSpy = vi.spyOn(outputManager, 'info');
      
      const mockWorkItems = [
        { id: 1, title: 'Test Item 1', commentCount: 0 }
      ];
      
      // Mock dependencies - no sync needed
      const mockGetLastSyncTime = vi.fn().mockResolvedValue(new Date('2023-01-01'));
      const mockNeedsCommentSync = vi.fn().mockResolvedValue(false);
      
      cliSyncService['db'] = {
        getLastSyncTime: mockGetLastSyncTime,
        needsCommentSync: mockNeedsCommentSync
      } as any;

      await cliSyncService['syncCommentsForWorkItemsEnhanced'](mockWorkItems);

      expect(startIndeterminateSpy).toHaveBeenCalledWith('Checking work items for comment sync');
      expect(infoSpy).toHaveBeenCalledWith('Comment sync complete: 1 work items checked, 0 needed comment sync');
      expect(stopIndeterminateSpy).toHaveBeenCalledWith('Comment sync completed');
    });

    it('should show progress updates during long comment sync operations', async () => {
      const infoSpy = vi.spyOn(outputManager, 'info');
      
      // Create many work items to trigger progress reporting
      const mockWorkItems = Array.from({ length: 15 }, (_, i) => ({
        id: i + 1,
        title: `Test Item ${i + 1}`,
        commentCount: 2
      }));
      
      // Mock dependencies
      const mockGetLastSyncTime = vi.fn().mockResolvedValue(new Date('2023-01-01'));
      const mockNeedsCommentSync = vi.fn().mockResolvedValue(true);
      const mockFetchWorkItemComments = vi.fn().mockImplementation((id) => 
        Promise.resolve([{ id: id * 100, text: `Comment for ${id}` }])
      );
      const mockStoreWorkItemComments = vi.fn().mockResolvedValue(undefined);
      
      cliSyncService['db'] = {
        getLastSyncTime: mockGetLastSyncTime,
        needsCommentSync: mockNeedsCommentSync,
        storeWorkItemComments: mockStoreWorkItemComments
      } as any;
      
      cliSyncService['client'] = {
        fetchWorkItemComments: mockFetchWorkItemComments
      } as any;

      await cliSyncService['syncCommentsForWorkItemsEnhanced'](mockWorkItems);

      expect(infoSpy).toHaveBeenCalledWith('Found 15 work items needing comment sync');
      
      // Should not use console.log for progress reporting
      expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('📝 Comment sync progress:'));
    });
  });

  describe('verbosity level integration', () => {
    it('should respect QUIET verbosity level', async () => {
      await initializeLogger('cli-sync-service-quiet-test');
      const quietOutput = new OutputManager(VerbosityLevel.QUIET, OutputFormat.TEXT);
      const quietSyncService = new CLISyncService(quietOutput, progressManager);
      
      expect(quietSyncService['outputManager']['verbosity']).toBe(VerbosityLevel.QUIET);
    });

    it('should respect DEBUG verbosity level', async () => {
      await initializeLogger('cli-sync-service-debug-test');
      const debugOutput = new OutputManager(VerbosityLevel.DEBUG, OutputFormat.TEXT);
      const debugSyncService = new CLISyncService(debugOutput, progressManager);
      
      expect(debugSyncService['outputManager']['verbosity']).toBe(VerbosityLevel.DEBUG);
    });

    it('should maintain consistent verbosity between output and progress managers', async () => {
      await initializeLogger('cli-sync-service-verbose-test');
      const verboseOutput = new OutputManager(VerbosityLevel.VERBOSE, OutputFormat.JSON);
      const verboseProgress = new ProgressManager(VerbosityLevel.VERBOSE, OutputFormat.JSON);
      const verboseSyncService = new CLISyncService(verboseOutput, verboseProgress);
      
      expect(verboseSyncService['outputManager']['verbosity']).toBe(VerbosityLevel.VERBOSE);
      expect(verboseSyncService['progressManager']['verbosity']).toBe(VerbosityLevel.VERBOSE);
    });
  });

  describe('output format integration', () => {
    it('should support JSON output format', async () => {
      await initializeLogger('cli-sync-service-json-test');
      const jsonOutput = new OutputManager(VerbosityLevel.NORMAL, OutputFormat.JSON);
      const jsonProgress = new ProgressManager(VerbosityLevel.NORMAL, OutputFormat.JSON);
      const jsonSyncService = new CLISyncService(jsonOutput, jsonProgress);
      
      expect(jsonSyncService['outputManager']['format']).toBe(OutputFormat.JSON);
      expect(jsonSyncService['progressManager']['format']).toBe(OutputFormat.JSON);
    });

    it('should support MARKDOWN output format', async () => {
      await initializeLogger('cli-sync-service-markdown-test');
      const markdownOutput = new OutputManager(VerbosityLevel.NORMAL, OutputFormat.MARKDOWN);
      const markdownProgress = new ProgressManager(VerbosityLevel.NORMAL, OutputFormat.MARKDOWN);
      const markdownSyncService = new CLISyncService(markdownOutput, markdownProgress);
      
      expect(markdownSyncService['outputManager']['format']).toBe(OutputFormat.MARKDOWN);
      expect(markdownSyncService['progressManager']['format']).toBe(OutputFormat.MARKDOWN);
    });
  });

  describe('method delegation to base class', () => {
    it('should delegate shouldSync to base SyncService', async () => {
      const mockShouldSync = vi.fn().mockResolvedValue(true);
      
      // Mock the base class method
      Object.setPrototypeOf(cliSyncService, {
        ...Object.getPrototypeOf(cliSyncService),
        shouldSync: mockShouldSync
      });

      const result = await cliSyncService.shouldSync();
      
      expect(result).toBe(true);
      expect(mockShouldSync).toHaveBeenCalled();
    });

    it('should delegate close to base SyncService with enhanced cleanup', async () => {
      const mockClose = vi.fn().mockResolvedValue(undefined);
      const mockDb = { close: vi.fn().mockResolvedValue(undefined) };
      cliSyncService['syncInterval'] = setInterval(() => {}, 1000);
      cliSyncService['db'] = mockDb as any;

      await cliSyncService.close();
      
      expect(mockDb.close).toHaveBeenCalled();
      expect(cliSyncService['syncInterval']).toBeNull();
    });
  });
});