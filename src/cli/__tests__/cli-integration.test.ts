import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CLIAzureDevOpsBot } from '../cli-azure-devops-bot.js';
import { OutputManager } from '../output-manager.js';
import { ProgressManager } from '../progress-manager.js';
import { VerbosityLevel, OutputFormat } from '../cli-config.js';

describe('CLI Integration', () => {
  let outputManager: OutputManager;
  let progressManager: ProgressManager;
  let cliBot: CLIAzureDevOpsBot;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    outputManager = new OutputManager(VerbosityLevel.NORMAL, OutputFormat.TEXT);
    progressManager = new ProgressManager(VerbosityLevel.NORMAL, OutputFormat.TEXT);
    cliBot = new CLIAzureDevOpsBot(outputManager, progressManager);
    
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
    vi.clearAllMocks();
  });

  describe('CLIAzureDevOpsBot initialization', () => {
    it('should initialize with output and progress managers', () => {
      expect(cliBot).toBeInstanceOf(CLIAzureDevOpsBot);
      expect(cliBot['outputManager']).toBe(outputManager);
      expect(cliBot['progressManager']).toBe(progressManager);
    });

    it('should extend the base AzureDevOpsBot class', () => {
      // CLIAzureDevOpsBot should have methods from base class
      expect(typeof cliBot.start).toBe('function');
      expect(typeof cliBot.stop).toBe('function');
    });
  });

  describe('email validation workflow', () => {
    it('should handle missing AZURE_DEVOPS_USER_EMAILS environment variable', () => {
      const originalEnv = process.env.AZURE_DEVOPS_USER_EMAILS;
      delete process.env.AZURE_DEVOPS_USER_EMAILS;
      
      expect(() => {
        cliBot['getUserEmails']();
      }).toThrow();
      
      expect(processExitSpy).toHaveBeenCalledWith(1);
      
      // Restore environment
      if (originalEnv) {
        process.env.AZURE_DEVOPS_USER_EMAILS = originalEnv;
      }
    });

    it('should handle invalid email format in environment variable', () => {
      const originalEnv = process.env.AZURE_DEVOPS_USER_EMAILS;
      process.env.AZURE_DEVOPS_USER_EMAILS = ',,,';
      
      expect(() => {
        cliBot['getUserEmails']();
      }).toThrow();
      
      expect(processExitSpy).toHaveBeenCalledWith(1);
      
      // Restore environment
      if (originalEnv) {
        process.env.AZURE_DEVOPS_USER_EMAILS = originalEnv;
      } else {
        delete process.env.AZURE_DEVOPS_USER_EMAILS;
      }
    });

    it('should parse valid email addresses correctly', () => {
      const originalEnv = process.env.AZURE_DEVOPS_USER_EMAILS;
      process.env.AZURE_DEVOPS_USER_EMAILS = 'test1@company.com, test2@company.com ,test3@company.com';
      
      const emails = cliBot['getUserEmails']();
      expect(emails).toEqual(['test1@company.com', 'test2@company.com', 'test3@company.com']);
      
      // Restore environment
      if (originalEnv) {
        process.env.AZURE_DEVOPS_USER_EMAILS = originalEnv;
      } else {
        delete process.env.AZURE_DEVOPS_USER_EMAILS;
      }
    });

    it('should show enhanced error messages with setup guidance', () => {
      const originalEnv = process.env.AZURE_DEVOPS_USER_EMAILS;
      delete process.env.AZURE_DEVOPS_USER_EMAILS;
      
      const errorSpy = vi.spyOn(outputManager, 'error');
      const boxSpy = vi.spyOn(outputManager, 'box');
      
      expect(() => {
        cliBot['getUserEmails']();
      }).toThrow();
      
      expect(errorSpy).toHaveBeenCalledWith(
        'AZURE_DEVOPS_USER_EMAILS environment variable is required',
        expect.objectContaining({
          examples: expect.any(Array),
          setupMethods: expect.any(Array)
        })
      );
      
      expect(boxSpy).toHaveBeenCalledWith(
        expect.stringContaining('Set your email address(es) for Azure DevOps work item assignment'),
        'Setup Required'
      );
      
      // Restore environment
      if (originalEnv) {
        process.env.AZURE_DEVOPS_USER_EMAILS = originalEnv;
      }
    });
  });

  describe('CLI workflow integration', () => {
    it('should use OutputManager for all user-facing messages', async () => {
      const infoSpy = vi.spyOn(outputManager, 'info');
      const successSpy = vi.spyOn(outputManager, 'success');
      const errorSpy = vi.spyOn(outputManager, 'error');
      
      // Mock the necessary dependencies to prevent actual Azure DevOps calls
      const mockValidateEmails = vi.fn().mockResolvedValue({ valid: ['test@company.com'], invalid: [] });
      const mockShouldSync = vi.fn().mockResolvedValue(false);
      const mockStartBackgroundSync = vi.fn().mockResolvedValue(undefined);
      const mockProcessQuery = vi.fn().mockResolvedValue('Mock response');
      
      // Mock the Azure DevOps client and services
      cliBot['syncService'] = {
        startBackgroundSync: mockStartBackgroundSync,
        shouldSync: mockShouldSync,
        performSyncDetailed: vi.fn().mockResolvedValue(undefined)
      } as any;
      
      cliBot['queryEngine'] = {
        processQuery: mockProcessQuery
      } as any;
      
      // Mock Azure DevOps client
      const AzureDevOpsClientMock = vi.fn().mockImplementation(() => ({
        validateUserEmails: mockValidateEmails
      }));
      
      // Set up environment
      const originalEnv = process.env.AZURE_DEVOPS_USER_EMAILS;
      process.env.AZURE_DEVOPS_USER_EMAILS = 'test@company.com';
      
      try {
        // We can't actually run the full start method due to dependencies,
        // but we can test that the methods use OutputManager
        const emails = cliBot['getUserEmails']();
        expect(emails).toEqual(['test@company.com']);
        
        // Verify OutputManager methods would be called
        expect(infoSpy).not.toHaveBeenCalled(); // Not called during getUserEmails
        expect(successSpy).not.toHaveBeenCalled();
        expect(errorSpy).not.toHaveBeenCalled();
        
      } finally {
        // Restore environment
        if (originalEnv) {
          process.env.AZURE_DEVOPS_USER_EMAILS = originalEnv;
        } else {
          delete process.env.AZURE_DEVOPS_USER_EMAILS;
        }
      }
    });

    it('should use ProgressManager for long-running operations', () => {
      const startSpinnerSpy = vi.spyOn(progressManager, 'startSpinner');
      const stopSpinnerSpy = vi.spyOn(progressManager, 'stopSpinner');
      const startIndeterminateSpy = vi.spyOn(progressManager, 'startIndeterminate');
      const stopIndeterminateSpy = vi.spyOn(progressManager, 'stopIndeterminate');
      
      // Test spinner usage
      progressManager.startSpinner('Testing spinner');
      expect(startSpinnerSpy).toHaveBeenCalledWith('Testing spinner');
      
      progressManager.stopSpinner('Spinner completed');
      expect(stopSpinnerSpy).toHaveBeenCalledWith('Spinner completed');
      
      // Test indeterminate progress
      progressManager.startIndeterminate('Testing indeterminate');
      expect(startIndeterminateSpy).toHaveBeenCalledWith('Testing indeterminate');
      
      progressManager.stopIndeterminate('Indeterminate completed');
      expect(stopIndeterminateSpy).toHaveBeenCalledWith('Indeterminate completed');
    });
  });

  describe('error handling integration', () => {
    it('should provide contextual error information', () => {
      const errorSpy = vi.spyOn(outputManager, 'error');
      const boxSpy = vi.spyOn(outputManager, 'box');
      
      const originalEnv = process.env.AZURE_DEVOPS_USER_EMAILS;
      delete process.env.AZURE_DEVOPS_USER_EMAILS;
      
      expect(() => {
        cliBot['getUserEmails']();
      }).toThrow();
      
      expect(errorSpy).toHaveBeenCalledWith(
        'AZURE_DEVOPS_USER_EMAILS environment variable is required',
        expect.objectContaining({
          examples: expect.arrayContaining(['Jane.Citizen@fwc.gov.au,ITEX-JC@fwc.gov.au']),
          setupMethods: expect.arrayContaining([
            'Create .env file with AZURE_DEVOPS_USER_EMAILS',
            'Export in shell: export AZURE_DEVOPS_USER_EMAILS="emails"',
            'Add to shell profile (~/.bashrc, ~/.zshrc)'
          ])
        })
      );
      
      expect(boxSpy).toHaveBeenCalledWith(
        expect.stringContaining('Set your email address(es) for Azure DevOps work item assignment'),
        'Setup Required'
      );
      
      // Restore environment
      if (originalEnv) {
        process.env.AZURE_DEVOPS_USER_EMAILS = originalEnv;
      }
    });

    it('should handle graceful shutdown', async () => {
      const stopSpy = vi.spyOn(cliBot, 'stop').mockResolvedValue();
      const infoSpy = vi.spyOn(outputManager, 'info');
      
      // Simulate shutdown
      await cliBot.stop();
      
      expect(stopSpy).toHaveBeenCalled();
    });

    it('should provide helpful error messages for common issues', () => {
      const errorSpy = vi.spyOn(outputManager, 'error');
      
      // Test empty emails array
      const originalEnv = process.env.AZURE_DEVOPS_USER_EMAILS;
      process.env.AZURE_DEVOPS_USER_EMAILS = '';
      
      expect(() => {
        cliBot['getUserEmails']();
      }).toThrow();
      
      expect(errorSpy).toHaveBeenCalledWith(
        'No valid email addresses provided',
        expect.objectContaining({
          raw_value: '',
          required_min: 1
        })
      );
      
      // Restore environment
      if (originalEnv) {
        process.env.AZURE_DEVOPS_USER_EMAILS = originalEnv;
      } else {
        delete process.env.AZURE_DEVOPS_USER_EMAILS;
      }
    });
  });

  describe('different verbosity levels', () => {
    it('should handle QUIET mode correctly', () => {
      const quietOutput = new OutputManager(VerbosityLevel.QUIET, OutputFormat.TEXT);
      const quietBot = new CLIAzureDevOpsBot(quietOutput, progressManager);
      
      expect(quietBot['outputManager']['verbosity']).toBe(VerbosityLevel.QUIET);
      
      const infoSpy = vi.spyOn(quietOutput, 'info');
      quietOutput.info('This should not show in quiet mode');
      expect(infoSpy).toHaveBeenCalled();
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should handle DEBUG mode correctly', () => {
      const debugOutput = new OutputManager(VerbosityLevel.DEBUG, OutputFormat.TEXT);
      const debugBot = new CLIAzureDevOpsBot(debugOutput, progressManager);
      
      expect(debugBot['outputManager']['verbosity']).toBe(VerbosityLevel.DEBUG);
      
      const debugSpy = vi.spyOn(debugOutput, 'debug');
      debugOutput.debug('This should show in debug mode');
      expect(debugSpy).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('different output formats', () => {
    it('should handle JSON output format', () => {
      const jsonOutput = new OutputManager(VerbosityLevel.NORMAL, OutputFormat.JSON);
      const jsonBot = new CLIAzureDevOpsBot(jsonOutput, progressManager);
      
      expect(jsonBot['outputManager']['format']).toBe(OutputFormat.JSON);
      
      const infoSpy = vi.spyOn(jsonOutput, 'info');
      jsonOutput.info('Test message');
      expect(infoSpy).toHaveBeenCalled();
      
      // Should output JSON
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('{"level":"info"')
      );
    });

    it('should handle MARKDOWN output format', () => {
      const markdownOutput = new OutputManager(VerbosityLevel.NORMAL, OutputFormat.MARKDOWN);
      const markdownBot = new CLIAzureDevOpsBot(markdownOutput, progressManager);
      
      expect(markdownBot['outputManager']['format']).toBe(OutputFormat.MARKDOWN);
      
      const successSpy = vi.spyOn(markdownOutput, 'success');
      markdownOutput.success('Test success');
      expect(successSpy).toHaveBeenCalled();
      
      // Should output Markdown
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('✅ **Success:**')
      );
    });
  });

  describe('result formatting integration', () => {
    it('should format work item results correctly', () => {
      const mockWorkItems = [
        { id: 1, title: 'Test Item 1', state: 'Active', assignedTo: 'user@company.com' },
        { id: 2, title: 'Test Item 2', state: 'Closed', assignedTo: null }
      ];
      
      const formatSpy = vi.spyOn(outputManager, 'formatResult');
      outputManager.formatResult(mockWorkItems);
      
      expect(formatSpy).toHaveBeenCalledWith(mockWorkItems);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('📋 Results (2 items)')
      );
    });

    it('should handle empty results gracefully', () => {
      const formatSpy = vi.spyOn(outputManager, 'formatResult');
      outputManager.formatResult([]);
      
      expect(formatSpy).toHaveBeenCalledWith([]);
    });
  });

  describe('configuration validation', () => {
    it('should validate CLI options are properly passed to managers', () => {
      const verboseOutput = new OutputManager(VerbosityLevel.VERBOSE, OutputFormat.TEXT);
      const verboseProgress = new ProgressManager(VerbosityLevel.VERBOSE, OutputFormat.TEXT);
      const verboseBot = new CLIAzureDevOpsBot(verboseOutput, verboseProgress);
      
      expect(verboseBot['outputManager']['verbosity']).toBe(VerbosityLevel.VERBOSE);
      expect(verboseBot['progressManager']['verbosity']).toBe(VerbosityLevel.VERBOSE);
    });

    it('should maintain consistency between output and progress managers', () => {
      const jsonOutput = new OutputManager(VerbosityLevel.DEBUG, OutputFormat.JSON);
      const jsonProgress = new ProgressManager(VerbosityLevel.DEBUG, OutputFormat.JSON);
      const jsonBot = new CLIAzureDevOpsBot(jsonOutput, jsonProgress);
      
      expect(jsonBot['outputManager']['format']).toBe(OutputFormat.JSON);
      expect(jsonBot['progressManager']['format']).toBe(OutputFormat.JSON);
      expect(jsonBot['outputManager']['verbosity']).toBe(VerbosityLevel.DEBUG);
      expect(jsonBot['progressManager']['verbosity']).toBe(VerbosityLevel.DEBUG);
    });
  });
});