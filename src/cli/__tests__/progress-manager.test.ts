import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProgressManager } from '../progress-manager.js';
import { VerbosityLevel, OutputFormat } from '../cli-config.js';

describe('ProgressManager', () => {
  let progressManager: ProgressManager;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let processStdoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    processStdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.useFakeTimers();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    processStdoutSpy.mockRestore();
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('progress bar management', () => {
    it('should not create progress bar in QUIET mode', () => {
      progressManager = new ProgressManager(VerbosityLevel.QUIET, OutputFormat.TEXT);
      progressManager.startProgress('test', 100);
      expect(progressManager['progressBar']).toBeNull();
    });

    it('should not create progress bar in non-TEXT formats', () => {
      progressManager = new ProgressManager(VerbosityLevel.NORMAL, OutputFormat.JSON);
      progressManager.startProgress('test', 100);
      expect(progressManager['progressBar']).toBeNull();
    });

    it('should create progress bar in NORMAL mode with TEXT format', () => {
      progressManager = new ProgressManager(VerbosityLevel.NORMAL, OutputFormat.TEXT);
      progressManager.startProgress('test', 100);
      expect(progressManager['progressBar']).toBeTruthy();
      progressManager.completeProgress();
      expect(progressManager['progressBar']).toBeNull();
    });

    it('should update progress correctly', () => {
      progressManager = new ProgressManager(VerbosityLevel.NORMAL, OutputFormat.TEXT);
      progressManager.startProgress('test', 100);
      const mockProgressBar = progressManager['progressBar'];
      expect(mockProgressBar).toBeTruthy();
      
      const updateSpy = vi.spyOn(mockProgressBar!, 'update').mockImplementation(() => {});
      
      progressManager.updateProgress(50);
      expect(updateSpy).toHaveBeenCalledWith(50);
      
      progressManager.completeProgress();
    });

    it('should update progress with status text in VERBOSE mode', () => {
      progressManager = new ProgressManager(VerbosityLevel.VERBOSE, OutputFormat.TEXT);
      progressManager.startProgress('test', 100);
      const mockProgressBar = progressManager['progressBar'];
      expect(mockProgressBar).toBeTruthy();
      
      const updateSpy = vi.spyOn(mockProgressBar!, 'update').mockImplementation(() => {});
      
      progressManager.updateProgress(75, 'processing item 75');
      expect(updateSpy).toHaveBeenCalledWith(75, { status: 'processing item 75' });
      
      progressManager.completeProgress();
    });

    it('should not include status text in NORMAL mode', () => {
      progressManager = new ProgressManager(VerbosityLevel.NORMAL, OutputFormat.TEXT);
      progressManager.startProgress('test', 100);
      const mockProgressBar = progressManager['progressBar'];
      expect(mockProgressBar).toBeTruthy();
      
      const updateSpy = vi.spyOn(mockProgressBar!, 'update').mockImplementation(() => {});
      
      progressManager.updateProgress(75, 'processing item 75');
      expect(updateSpy).toHaveBeenCalledWith(75);
      
      progressManager.completeProgress();
    });

    it('should complete progress with success message', () => {
      progressManager = new ProgressManager(VerbosityLevel.NORMAL, OutputFormat.TEXT);
      progressManager.startProgress('test', 100);
      const mockProgressBar = progressManager['progressBar'];
      expect(mockProgressBar).toBeTruthy();
      
      const stopSpy = vi.spyOn(mockProgressBar!, 'stop').mockImplementation(() => {});
      
      progressManager.completeProgress('Operation completed successfully');
      
      expect(stopSpy).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('✅'), 'Operation completed successfully');
      expect(progressManager['progressBar']).toBeNull();
    });

    it('should complete progress without message', () => {
      progressManager = new ProgressManager(VerbosityLevel.NORMAL, OutputFormat.TEXT);
      progressManager.startProgress('test', 100);
      const mockProgressBar = progressManager['progressBar'];
      expect(mockProgressBar).toBeTruthy();
      
      const stopSpy = vi.spyOn(mockProgressBar!, 'stop').mockImplementation(() => {});
      
      progressManager.completeProgress();
      
      expect(stopSpy).toHaveBeenCalled();
      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(progressManager['progressBar']).toBeNull();
    });

    it('should suppress completion message in QUIET mode', () => {
      progressManager = new ProgressManager(VerbosityLevel.QUIET, OutputFormat.TEXT);
      progressManager.startProgress('test', 100); // Won't create bar in QUIET mode
      
      progressManager.completeProgress('Should not show');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('indeterminate progress', () => {
    it('should not start indeterminate progress in QUIET mode', () => {
      progressManager = new ProgressManager(VerbosityLevel.QUIET, OutputFormat.TEXT);
      progressManager.startIndeterminate('testing');
      
      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(progressManager['progressInterval']).toBeNull();
    });

    it('should not start indeterminate progress in non-TEXT formats', () => {
      progressManager = new ProgressManager(VerbosityLevel.NORMAL, OutputFormat.JSON);
      progressManager.startIndeterminate('testing');
      
      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(progressManager['progressInterval']).toBeNull();
    });

    it('should start indeterminate progress with initial message', () => {
      progressManager = new ProgressManager(VerbosityLevel.NORMAL, OutputFormat.TEXT);
      progressManager.startIndeterminate('testing operation');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('🔄'), 'testing operation...');
      expect(progressManager['progressInterval']).toBeTruthy();
      
      progressManager.stopIndeterminate();
    });

    it('should animate indeterminate progress dots', () => {
      progressManager = new ProgressManager(VerbosityLevel.NORMAL, OutputFormat.TEXT);
      progressManager.startIndeterminate('testing');
      
      // Advance timers to see animation
      vi.advanceTimersByTime(500);
      expect(processStdoutSpy).toHaveBeenCalledWith(expect.stringContaining('testing.'));
      
      vi.advanceTimersByTime(500);
      expect(processStdoutSpy).toHaveBeenCalledWith(expect.stringContaining('testing..'));
      
      vi.advanceTimersByTime(500);
      expect(processStdoutSpy).toHaveBeenCalledWith(expect.stringContaining('testing...'));
      
      vi.advanceTimersByTime(500);
      expect(processStdoutSpy).toHaveBeenCalledWith(expect.stringContaining('testing   '));
      
      progressManager.stopIndeterminate();
    });

    it('should stop indeterminate progress with completion message', () => {
      progressManager = new ProgressManager(VerbosityLevel.NORMAL, OutputFormat.TEXT);
      progressManager.startIndeterminate('testing');
      
      vi.advanceTimersByTime(500);
      
      progressManager.stopIndeterminate('Testing completed');
      
      expect(progressManager['progressInterval']).toBeNull();
      // Should clear the line
      expect(processStdoutSpy).toHaveBeenCalledWith('\r\x1b[K');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('✅'), 'Testing completed');
    });

    it('should stop indeterminate progress without message', () => {
      progressManager = new ProgressManager(VerbosityLevel.NORMAL, OutputFormat.TEXT);
      progressManager.startIndeterminate('testing');
      
      vi.advanceTimersByTime(500);
      
      progressManager.stopIndeterminate();
      
      expect(progressManager['progressInterval']).toBeNull();
      expect(processStdoutSpy).toHaveBeenCalledWith('\r\x1b[K');
      // Should not show completion message
      expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('✅'), expect.anything());
    });

    it('should handle multiple start/stop cycles', () => {
      progressManager = new ProgressManager(VerbosityLevel.NORMAL, OutputFormat.TEXT);
      
      // First cycle
      progressManager.startIndeterminate('first operation');
      expect(progressManager['progressInterval']).toBeTruthy();
      
      progressManager.stopIndeterminate('First completed');
      expect(progressManager['progressInterval']).toBeNull();
      
      // Second cycle
      progressManager.startIndeterminate('second operation');
      expect(progressManager['progressInterval']).toBeTruthy();
      
      progressManager.stopIndeterminate('Second completed');
      expect(progressManager['progressInterval']).toBeNull();
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('✅'), 'First completed');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('✅'), 'Second completed');
    });
  });

  describe('progress reporting', () => {
    it('should not report progress in modes below VERBOSE', () => {
      progressManager = new ProgressManager(VerbosityLevel.NORMAL, OutputFormat.TEXT);
      progressManager.reportProgress(50, 100, 'Processing items');
      
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should report progress in VERBOSE mode with TEXT format', () => {
      progressManager = new ProgressManager(VerbosityLevel.VERBOSE, OutputFormat.TEXT);
      progressManager.reportProgress(75, 100, 'Processing items');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('📊'),
        'Processing items: 75/100 (75%)'
      );
    });

    it('should report progress in JSON format', () => {
      progressManager = new ProgressManager(VerbosityLevel.VERBOSE, OutputFormat.JSON);
      progressManager.reportProgress(30, 100, 'Syncing work items');
      
      const output = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      
      expect(parsed.type).toBe('progress');
      expect(parsed.operation).toBe('Syncing work items');
      expect(parsed.current).toBe(30);
      expect(parsed.total).toBe(100);
      expect(parsed.percentage).toBe(30);
      expect(parsed.timestamp).toBeDefined();
    });

    it('should report progress in MARKDOWN format', () => {
      progressManager = new ProgressManager(VerbosityLevel.VERBOSE, OutputFormat.MARKDOWN);
      progressManager.reportProgress(25, 50, 'Loading data');
      
      expect(consoleLogSpy).toHaveBeenCalledWith('**Progress:** Loading data: 25/50 (50%)');
    });

    it('should calculate percentage correctly', () => {
      progressManager = new ProgressManager(VerbosityLevel.VERBOSE, OutputFormat.TEXT);
      
      progressManager.reportProgress(1, 3, 'test');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('📊'),
        'test: 1/3 (33%)'
      );
      
      consoleLogSpy.mockClear();
      
      progressManager.reportProgress(2, 3, 'test');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('📊'),
        'test: 2/3 (67%)'
      );
    });

    it('should handle edge cases in percentage calculation', () => {
      progressManager = new ProgressManager(VerbosityLevel.VERBOSE, OutputFormat.TEXT);
      
      // Zero total
      progressManager.reportProgress(0, 0, 'empty operation');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('📊'),
        expect.stringContaining('(NaN%)') // or however you want to handle this edge case
      );
      
      consoleLogSpy.mockClear();
      
      // Completion
      progressManager.reportProgress(100, 100, 'complete operation');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('📊'),
        'complete operation: 100/100 (100%)'
      );
    });
  });

  describe('cleanup and lifecycle', () => {
    it('should clean up progress bar on completion', () => {
      progressManager = new ProgressManager(VerbosityLevel.NORMAL, OutputFormat.TEXT);
      progressManager.startProgress('test', 100);
      expect(progressManager['progressBar']).toBeTruthy();
      
      progressManager.completeProgress();
      expect(progressManager['progressBar']).toBeNull();
    });

    it('should clean up indeterminate progress on stop', () => {
      progressManager = new ProgressManager(VerbosityLevel.NORMAL, OutputFormat.TEXT);
      progressManager.startIndeterminate('test');
      expect(progressManager['progressInterval']).toBeTruthy();
      
      progressManager.stopIndeterminate();
      expect(progressManager['progressInterval']).toBeNull();
    });

    it('should handle multiple cleanup calls safely', () => {
      progressManager = new ProgressManager(VerbosityLevel.NORMAL, OutputFormat.TEXT);
      
      // Complete already completed progress
      progressManager.completeProgress();
      progressManager.completeProgress();
      expect(progressManager['progressBar']).toBeNull();
      
      // Stop already stopped indeterminate
      progressManager.stopIndeterminate();
      progressManager.stopIndeterminate();
      expect(progressManager['progressInterval']).toBeNull();
    });

    it('should stop indeterminate progress before starting determinate', () => {
      progressManager = new ProgressManager(VerbosityLevel.NORMAL, OutputFormat.TEXT);
      
      progressManager.startIndeterminate('preparing');
      expect(progressManager['progressInterval']).toBeTruthy();
      
      progressManager.startProgress('processing', 100);
      expect(progressManager['progressInterval']).toBeNull();
      expect(progressManager['progressBar']).toBeTruthy();
      
      progressManager.completeProgress();
    });

    it('should stop determinate progress before starting indeterminate', () => {
      progressManager = new ProgressManager(VerbosityLevel.NORMAL, OutputFormat.TEXT);
      
      progressManager.startProgress('processing', 100);
      expect(progressManager['progressBar']).toBeTruthy();
      
      progressManager.startIndeterminate('finalizing');
      expect(progressManager['progressBar']).toBeNull();
      expect(progressManager['progressInterval']).toBeTruthy();
      
      progressManager.stopIndeterminate();
    });
  });

  describe('verbosity level filtering', () => {
    const verbosityLevels = [
      { level: VerbosityLevel.QUIET, shouldShow: false },
      { level: VerbosityLevel.NORMAL, shouldShow: false },
      { level: VerbosityLevel.VERBOSE, shouldShow: true },
      { level: VerbosityLevel.DEBUG, shouldShow: true }
    ];

    verbosityLevels.forEach(({ level, shouldShow }) => {
      it(`should ${shouldShow ? 'show' : 'hide'} progress reporting in ${VerbosityLevel[level]} mode`, () => {
        progressManager = new ProgressManager(level, OutputFormat.TEXT);
        progressManager.reportProgress(50, 100, 'test operation');
        
        if (shouldShow) {
          expect(consoleLogSpy).toHaveBeenCalled();
        } else {
          expect(consoleLogSpy).not.toHaveBeenCalled();
        }
      });
    });

    it('should show completion messages at NORMAL level and above', () => {
      const testCases = [
        { level: VerbosityLevel.QUIET, shouldShow: false },
        { level: VerbosityLevel.NORMAL, shouldShow: true },
        { level: VerbosityLevel.VERBOSE, shouldShow: true },
        { level: VerbosityLevel.DEBUG, shouldShow: true }
      ];

      testCases.forEach(({ level, shouldShow }) => {
        consoleLogSpy.mockClear();
        progressManager = new ProgressManager(level, OutputFormat.TEXT);
        
        // Test with determinate progress (won't create bar in QUIET mode)
        progressManager.startProgress('test', 100);
        progressManager.completeProgress('Task completed');
        
        if (shouldShow && level > VerbosityLevel.QUIET) {
          expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('✅'), 'Task completed');
        } else {
          expect(consoleLogSpy).not.toHaveBeenCalled();
        }
      });
    });
  });

  describe('constructor and initialization', () => {
    it('should initialize with correct verbosity and format', () => {
      progressManager = new ProgressManager(VerbosityLevel.DEBUG, OutputFormat.MARKDOWN);
      expect(progressManager['verbosity']).toBe(VerbosityLevel.DEBUG);
      expect(progressManager['format']).toBe(OutputFormat.MARKDOWN);
      expect(progressManager['progressBar']).toBeNull();
      expect(progressManager['progressInterval']).toBeNull();
    });

    it('should handle all combinations of verbosity and format', () => {
      const verbosityLevels = [VerbosityLevel.QUIET, VerbosityLevel.NORMAL, VerbosityLevel.VERBOSE, VerbosityLevel.DEBUG];
      const formats = [OutputFormat.TEXT, OutputFormat.JSON, OutputFormat.MARKDOWN];
      
      verbosityLevels.forEach(verbosity => {
        formats.forEach(format => {
          progressManager = new ProgressManager(verbosity, format);
          expect(progressManager['verbosity']).toBe(verbosity);
          expect(progressManager['format']).toBe(format);
        });
      });
    });
  });
});