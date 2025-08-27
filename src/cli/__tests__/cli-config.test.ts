import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupCLI, determineVerbosityLevel, VerbosityLevel, OutputFormat, type CLIOptions } from '../cli-config.js';

describe('CLI Configuration', () => {
  let originalArgv: string[];
  let originalExit: typeof process.exit;
  let mockExit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    originalArgv = process.argv;
    originalExit = process.exit;
    mockExit = vi.fn();
    process.exit = mockExit as any;
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.exit = originalExit;
    vi.clearAllMocks();
  });

  describe('setupCLI', () => {
    it('should parse basic query argument', () => {
      process.argv = ['node', 'script', 'my work items'];
      const { query } = setupCLI();
      expect(query).toBe('my work items');
    });

    it('should use default query when none provided', () => {
      process.argv = ['node', 'script'];
      const { query } = setupCLI();
      expect(query).toBe('summary');
    });

    it('should handle verbose flag', () => {
      process.argv = ['node', 'script', '--verbose', 'status'];
      const { options, query } = setupCLI();
      expect(options.verbose).toBe(true);
      expect(query).toBe('status');
    });

    it('should handle quiet flag', () => {
      process.argv = ['node', 'script', '--quiet', 'my items'];
      const { options, query } = setupCLI();
      expect(options.quiet).toBe(true);
      expect(query).toBe('my items');
    });

    it('should handle debug flag', () => {
      process.argv = ['node', 'script', '--debug', 'sync status'];
      const { options, query } = setupCLI();
      expect(options.debug).toBe(true);
      expect(query).toBe('sync status');
    });

    it('should handle format flag with text option', () => {
      process.argv = ['node', 'script', '--format', 'text', 'status'];
      const { options } = setupCLI();
      expect(options.format).toBe('text');
    });

    it('should handle format flag with json option', () => {
      process.argv = ['node', 'script', '--format', 'json', 'status'];
      const { options } = setupCLI();
      expect(options.format).toBe('json');
    });

    it('should handle format flag with markdown option', () => {
      process.argv = ['node', 'script', '--format', 'markdown', 'status'];
      const { options } = setupCLI();
      expect(options.format).toBe('markdown');
    });

    it('should use text as default format', () => {
      process.argv = ['node', 'script', 'status'];
      const { options } = setupCLI();
      expect(options.format).toBe('text');
    });

    it('should handle combined flags', () => {
      process.argv = ['node', 'script', '--verbose', '--format', 'json', 'team progress'];
      const { options, query } = setupCLI();
      expect(options.verbose).toBe(true);
      expect(options.format).toBe('json');
      expect(query).toBe('team progress');
    });

    it('should handle short flag aliases', () => {
      process.argv = ['node', 'script', '-v', '-f', 'markdown', 'report'];
      const { options, query } = setupCLI();
      expect(options.verbose).toBe(true);
      expect(options.format).toBe('markdown');
      expect(query).toBe('report');
    });

    it('should exit with error for conflicting quiet and verbose flags', () => {
      process.argv = ['node', 'script', '--quiet', '--verbose'];
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      setupCLI();
      expect(mockExit).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error: Cannot use --quiet and --verbose together');
      consoleErrorSpy.mockRestore();
    });

    it('should exit with error for conflicting quiet and debug flags', () => {
      process.argv = ['node', 'script', '--quiet', '--debug'];
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      setupCLI();
      expect(mockExit).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error: Cannot use --quiet and --debug together');
      consoleErrorSpy.mockRestore();
    });

    it('should exit with error for invalid format option', () => {
      process.argv = ['node', 'script', '--format', 'invalid'];
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      setupCLI();
      expect(mockExit).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error: Invalid format 'invalid'. Must be one of: text, json, markdown"
      );
      consoleErrorSpy.mockRestore();
    });

    it('should handle help flag', () => {
      process.argv = ['node', 'script', '--help'];
      
      setupCLI();
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it('should handle version flag', () => {
      process.argv = ['node', 'script', '--version'];
      
      setupCLI();
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it('should preserve query with multiple words', () => {
      process.argv = ['node', 'script', 'show all active items assigned to me'];
      const { query } = setupCLI();
      expect(query).toBe('show all active items assigned to me');
    });

    it('should handle flags mixed with query', () => {
      process.argv = ['node', 'script', '--format', 'json', 'work', 'items', '--verbose'];
      const { options, query } = setupCLI();
      expect(options.format).toBe('json');
      expect(options.verbose).toBe(true);
      expect(query).toBe('work items');
    });
  });

  describe('determineVerbosityLevel', () => {
    it('should return QUIET for quiet flag', () => {
      const options: CLIOptions = { quiet: true, verbose: false, debug: false, format: 'text' };
      const level = determineVerbosityLevel(options);
      expect(level).toBe(VerbosityLevel.QUIET);
    });

    it('should return DEBUG for debug flag', () => {
      const options: CLIOptions = { quiet: false, verbose: false, debug: true, format: 'text' };
      const level = determineVerbosityLevel(options);
      expect(level).toBe(VerbosityLevel.DEBUG);
    });

    it('should return VERBOSE for verbose flag', () => {
      const options: CLIOptions = { quiet: false, verbose: true, debug: false, format: 'text' };
      const level = determineVerbosityLevel(options);
      expect(level).toBe(VerbosityLevel.VERBOSE);
    });

    it('should return NORMAL for no flags', () => {
      const options: CLIOptions = { quiet: false, verbose: false, debug: false, format: 'text' };
      const level = determineVerbosityLevel(options);
      expect(level).toBe(VerbosityLevel.NORMAL);
    });

    it('should prioritize DEBUG over VERBOSE when both are true (edge case)', () => {
      const options: CLIOptions = { quiet: false, verbose: true, debug: true, format: 'text' };
      const level = determineVerbosityLevel(options);
      expect(level).toBe(VerbosityLevel.DEBUG);
    });
  });

  describe('CLI Configuration validation', () => {
    it('should have correct VerbosityLevel enum values', () => {
      expect(VerbosityLevel.QUIET).toBe(0);
      expect(VerbosityLevel.NORMAL).toBe(1);
      expect(VerbosityLevel.VERBOSE).toBe(2);
      expect(VerbosityLevel.DEBUG).toBe(3);
    });

    it('should have correct OutputFormat enum values', () => {
      expect(OutputFormat.TEXT).toBe('text');
      expect(OutputFormat.JSON).toBe('json');
      expect(OutputFormat.MARKDOWN).toBe('markdown');
    });

    it('should provide expected CLI options interface', () => {
      const options: CLIOptions = {
        verbose: false,
        quiet: false,
        debug: false,
        format: 'text'
      };
      
      expect(typeof options.verbose).toBe('boolean');
      expect(typeof options.quiet).toBe('boolean');
      expect(typeof options.debug).toBe('boolean');
      expect(['text', 'json', 'markdown'].includes(options.format)).toBe(true);
    });
  });
});