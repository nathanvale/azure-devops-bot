import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OutputManager } from '../output-manager.js';
import { VerbosityLevel, OutputFormat } from '../cli-config.js';

describe('OutputManager', () => {
  let outputManager: OutputManager;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    vi.clearAllMocks();
  });

  describe('verbosity filtering', () => {
    it('should suppress info messages in QUIET mode', () => {
      outputManager = new OutputManager(VerbosityLevel.QUIET, OutputFormat.TEXT);
      outputManager.info('test message');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should show info messages in NORMAL mode', () => {
      outputManager = new OutputManager(VerbosityLevel.NORMAL, OutputFormat.TEXT);
      outputManager.info('test message');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('ℹ️'), 'test message');
    });

    it('should show info messages in VERBOSE mode', () => {
      outputManager = new OutputManager(VerbosityLevel.VERBOSE, OutputFormat.TEXT);
      outputManager.info('test message');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('ℹ️'), 'test message');
    });

    it('should show info messages in DEBUG mode', () => {
      outputManager = new OutputManager(VerbosityLevel.DEBUG, OutputFormat.TEXT);
      outputManager.info('test message');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('ℹ️'), 'test message');
    });

    it('should show info messages with details in VERBOSE mode', () => {
      outputManager = new OutputManager(VerbosityLevel.VERBOSE, OutputFormat.TEXT);
      const details = { key: 'value' };
      outputManager.info('test message', details);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('ℹ️'), 'test message');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Details:'), details);
    });

    it('should suppress details in NORMAL mode', () => {
      outputManager = new OutputManager(VerbosityLevel.NORMAL, OutputFormat.TEXT);
      const details = { key: 'value' };
      outputManager.info('test message', details);
      expect(consoleLogSpy).toHaveBeenCalledTimes(1); // Only the main message
    });

    it('should always show error messages regardless of verbosity', () => {
      outputManager = new OutputManager(VerbosityLevel.QUIET, OutputFormat.TEXT);
      outputManager.error('error message');
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('❌ Error:'), 'error message');
    });

    it('should show debug messages only in DEBUG mode', () => {
      outputManager = new OutputManager(VerbosityLevel.VERBOSE, OutputFormat.TEXT);
      outputManager.debug('debug message');
      expect(consoleLogSpy).not.toHaveBeenCalled();

      outputManager = new OutputManager(VerbosityLevel.DEBUG, OutputFormat.TEXT);
      outputManager.debug('debug message');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('🔍 [DEBUG]'), 'debug message');
    });

    it('should show success messages at appropriate verbosity levels', () => {
      outputManager = new OutputManager(VerbosityLevel.QUIET, OutputFormat.TEXT);
      outputManager.success('success message');
      expect(consoleLogSpy).not.toHaveBeenCalled();

      outputManager = new OutputManager(VerbosityLevel.NORMAL, OutputFormat.TEXT);
      outputManager.success('success message');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('✅'), 'success message');
    });
  });

  describe('format switching', () => {
    it('should output valid JSON in JSON mode', () => {
      outputManager = new OutputManager(VerbosityLevel.NORMAL, OutputFormat.JSON);
      outputManager.info('test message');
      const output = consoleLogSpy.mock.calls[0][0];
      expect(() => JSON.parse(output)).not.toThrow();
      
      const parsed = JSON.parse(output);
      expect(parsed.level).toBe('info');
      expect(parsed.message).toBe('test message');
      expect(parsed.timestamp).toBeDefined();
    });

    it('should format markdown properly', () => {
      outputManager = new OutputManager(VerbosityLevel.NORMAL, OutputFormat.MARKDOWN);
      outputManager.success('test success');
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toContain('✅ **Success:** test success');
    });

    it('should include details in JSON format', () => {
      outputManager = new OutputManager(VerbosityLevel.NORMAL, OutputFormat.JSON);
      const details = { key: 'value', number: 42 };
      outputManager.info('test message', details);
      const output = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.details).toEqual(details);
    });

    it('should format errors consistently across formats', () => {
      const testCases = [
        { format: OutputFormat.TEXT, expectedContains: '❌ Error:' },
        { format: OutputFormat.JSON, expectedProperty: 'level', expectedValue: 'error' },
        { format: OutputFormat.MARKDOWN, expectedContains: '❌ **Error:**' }
      ];

      testCases.forEach(({ format, expectedContains, expectedProperty, expectedValue }) => {
        consoleLogSpy.mockClear();
        consoleErrorSpy.mockClear();
        
        outputManager = new OutputManager(VerbosityLevel.NORMAL, format);
        outputManager.error('test error', { code: 'TEST_ERROR' });

        if (format === OutputFormat.TEXT) {
          expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining(expectedContains!), 'test error');
        } else if (format === OutputFormat.JSON) {
          const output = consoleLogSpy.mock.calls[0][0];
          const parsed = JSON.parse(output);
          expect(parsed[expectedProperty!]).toBe(expectedValue);
        } else if (format === OutputFormat.MARKDOWN) {
          expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(expectedContains!));
        }
      });
    });
  });

  describe('spinner management', () => {
    it('should not create spinner in QUIET mode', () => {
      outputManager = new OutputManager(VerbosityLevel.QUIET, OutputFormat.TEXT);
      outputManager.startSpinner('test');
      expect(outputManager['activeSpinner']).toBeNull();
    });

    it('should not create spinner in non-TEXT formats', () => {
      outputManager = new OutputManager(VerbosityLevel.NORMAL, OutputFormat.JSON);
      outputManager.startSpinner('test');
      expect(outputManager['activeSpinner']).toBeNull();
    });

    it('should create and manage spinner in NORMAL mode with TEXT format', () => {
      outputManager = new OutputManager(VerbosityLevel.NORMAL, OutputFormat.TEXT);
      outputManager.startSpinner('test');
      expect(outputManager['activeSpinner']).toBeTruthy();
      
      outputManager.stopSpinner();
      expect(outputManager['activeSpinner']).toBeNull();
    });

    it('should update spinner text', () => {
      outputManager = new OutputManager(VerbosityLevel.NORMAL, OutputFormat.TEXT);
      outputManager.startSpinner('initial text');
      const spinner = outputManager['activeSpinner'];
      expect(spinner).toBeTruthy();
      
      outputManager.updateSpinner('updated text');
      expect(spinner!.text).toBe('updated text');
      
      outputManager.stopSpinner();
    });

    it('should stop spinner with success message', () => {
      outputManager = new OutputManager(VerbosityLevel.NORMAL, OutputFormat.TEXT);
      outputManager.startSpinner('processing');
      const spinner = outputManager['activeSpinner'];
      expect(spinner).toBeTruthy();
      
      const succeedSpy = vi.spyOn(spinner!, 'succeed');
      outputManager.stopSpinner('completed successfully');
      
      expect(succeedSpy).toHaveBeenCalledWith('completed successfully');
      expect(outputManager['activeSpinner']).toBeNull();
    });

    it('should handle success message with active spinner', () => {
      outputManager = new OutputManager(VerbosityLevel.NORMAL, OutputFormat.TEXT);
      outputManager.startSpinner('processing');
      const spinner = outputManager['activeSpinner'];
      expect(spinner).toBeTruthy();
      
      const succeedSpy = vi.spyOn(spinner!, 'succeed');
      outputManager.success('operation completed');
      
      expect(succeedSpy).toHaveBeenCalledWith('operation completed');
      expect(outputManager['activeSpinner']).toBeNull();
    });

    it('should stop and restart spinner when logging info', () => {
      outputManager = new OutputManager(VerbosityLevel.NORMAL, OutputFormat.TEXT);
      outputManager.startSpinner('processing');
      const originalSpinner = outputManager['activeSpinner'];
      expect(originalSpinner).toBeTruthy();
      
      const stopSpy = vi.spyOn(originalSpinner!, 'stop');
      const startSpy = vi.spyOn(originalSpinner!, 'start');
      
      outputManager.info('intermediate message');
      
      expect(stopSpy).toHaveBeenCalled();
      expect(startSpy).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('ℹ️'), 'intermediate message');
      
      outputManager.stopSpinner();
    });
  });

  describe('message formatting', () => {
    it('should format work item data properly', () => {
      outputManager = new OutputManager(VerbosityLevel.NORMAL, OutputFormat.TEXT);
      const workItems = [
        { id: 1, title: 'Test Item 1', state: 'Active', assignedTo: 'user1' },
        { id: 2, title: 'Test Item 2', state: 'Closed', assignedTo: null }
      ];
      
      outputManager.formatResult(workItems);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('📋 Results (2 items):'));
    });

    it('should format single result in a box', () => {
      outputManager = new OutputManager(VerbosityLevel.NORMAL, OutputFormat.TEXT);
      const singleResult = { status: 'success', count: 5 };
      
      outputManager.formatResult(singleResult);
      // Should call console.log with boxen output
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should create box messages', () => {
      outputManager = new OutputManager(VerbosityLevel.NORMAL, OutputFormat.TEXT);
      outputManager.box('Important message', 'Notice');
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should suppress box messages in QUIET mode', () => {
      outputManager = new OutputManager(VerbosityLevel.QUIET, OutputFormat.TEXT);
      outputManager.box('Important message', 'Notice');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should format box as markdown in MARKDOWN format', () => {
      outputManager = new OutputManager(VerbosityLevel.NORMAL, OutputFormat.MARKDOWN);
      outputManager.box('Important message', 'Notice');
      expect(consoleLogSpy).toHaveBeenCalledWith('### Notice\nImportant message\n');
    });

    it('should format box as JSON in JSON format', () => {
      outputManager = new OutputManager(VerbosityLevel.NORMAL, OutputFormat.JSON);
      outputManager.box('Important message', 'Notice');
      const output = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.type).toBe('box');
      expect(parsed.title).toBe('Notice');
      expect(parsed.message).toBe('Important message');
    });
  });

  describe('error handling', () => {
    it('should handle errors with details', () => {
      outputManager = new OutputManager(VerbosityLevel.NORMAL, OutputFormat.TEXT);
      const errorDetails = { code: 'ECONNRESET', message: 'Connection reset' };
      outputManager.error('Connection failed', errorDetails);
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('❌ Error:'), 'Connection failed');
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Details:'), errorDetails);
    });

    it('should handle errors without details', () => {
      outputManager = new OutputManager(VerbosityLevel.NORMAL, OutputFormat.TEXT);
      outputManager.error('Simple error');
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('❌ Error:'), 'Simple error');
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('should fail spinner on error', () => {
      outputManager = new OutputManager(VerbosityLevel.NORMAL, OutputFormat.TEXT);
      outputManager.startSpinner('processing');
      const spinner = outputManager['activeSpinner'];
      expect(spinner).toBeTruthy();
      
      const failSpy = vi.spyOn(spinner!, 'fail');
      outputManager.error('process failed');
      
      expect(failSpy).toHaveBeenCalledWith('process failed');
      expect(outputManager['activeSpinner']).toBeNull();
    });
  });

  describe('verbosity level handling with explicit levels', () => {
    it('should respect explicit verbosity level in info messages', () => {
      outputManager = new OutputManager(VerbosityLevel.NORMAL, OutputFormat.TEXT);
      
      // Message with VERBOSE level should not show in NORMAL mode
      outputManager.info('verbose message', null, VerbosityLevel.VERBOSE);
      expect(consoleLogSpy).not.toHaveBeenCalled();
      
      // Message with NORMAL level should show
      consoleLogSpy.mockClear();
      outputManager.info('normal message', null, VerbosityLevel.NORMAL);
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should respect explicit verbosity level in success messages', () => {
      outputManager = new OutputManager(VerbosityLevel.NORMAL, OutputFormat.TEXT);
      
      // Message with VERBOSE level should not show in NORMAL mode
      outputManager.success('verbose success', null, VerbosityLevel.VERBOSE);
      expect(consoleLogSpy).not.toHaveBeenCalled();
      
      // Message with NORMAL level should show
      consoleLogSpy.mockClear();
      outputManager.success('normal success', null, VerbosityLevel.NORMAL);
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('constructor and basic setup', () => {
    it('should initialize with correct verbosity and format', () => {
      outputManager = new OutputManager(VerbosityLevel.DEBUG, OutputFormat.MARKDOWN);
      expect(outputManager['verbosity']).toBe(VerbosityLevel.DEBUG);
      expect(outputManager['format']).toBe(OutputFormat.MARKDOWN);
      expect(outputManager['activeSpinner']).toBeNull();
    });

    it('should handle all verbosity levels correctly', () => {
      const levels = [VerbosityLevel.QUIET, VerbosityLevel.NORMAL, VerbosityLevel.VERBOSE, VerbosityLevel.DEBUG];
      
      levels.forEach(level => {
        outputManager = new OutputManager(level, OutputFormat.TEXT);
        expect(outputManager['verbosity']).toBe(level);
      });
    });

    it('should handle all output formats correctly', () => {
      const formats = [OutputFormat.TEXT, OutputFormat.JSON, OutputFormat.MARKDOWN];
      
      formats.forEach(format => {
        outputManager = new OutputManager(VerbosityLevel.NORMAL, format);
        expect(outputManager['format']).toBe(format);
      });
    });
  });
});