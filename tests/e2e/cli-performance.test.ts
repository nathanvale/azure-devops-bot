import { exec } from 'child_process'
import path from 'path'
import { performance } from 'perf_hooks'
import { fileURLToPath } from 'url'
import { promisify } from 'util'

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import {
  setupCLI,
  determineVerbosityLevel,
  OutputFormat,
  VerbosityLevel,
} from '../../src/cli/cli-config.js'
import { JSONFormatter } from '../../src/cli/formatters/json-formatter.js'
import { MarkdownFormatter } from '../../src/cli/formatters/markdown-formatter.js'
import { TextFormatter } from '../../src/cli/formatters/text-formatter.js'
import { OutputManager } from '../../src/cli/output-manager.js'
import { ProgressManager } from '../../src/cli/progress-manager.js'

const execAsync = promisify(exec)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const cliPath = path.join(__dirname, '../../src/index.ts')

describe('CLI Performance Tests', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      AZURE_DEVOPS_PAT: 'test-pat-token',
      AZURE_DEVOPS_USER_EMAILS: 'test@example.com',
      AZURE_DEVOPS_ORGANIZATION: 'test-org',
      AZURE_DEVOPS_PROJECT: 'test-project',
    }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('CLI Parsing Performance', () => {
    it('should parse CLI arguments in less than 5ms', () => {
      const start = performance.now()

      // Mock process.argv for testing
      const originalArgv = process.argv
      process.argv = [
        'node',
        'index.js',
        '-v',
        '--format',
        'json',
        'test query',
      ]

      const { options, query } = setupCLI()

      process.argv = originalArgv

      const end = performance.now()
      const duration = end - start

      expect(duration).toBeLessThan(5)
      expect(options).toBeDefined()
      expect(query).toBe('test query')
    })

    it('should determine verbosity level quickly', () => {
      const options = {
        verbose: true,
        quiet: false,
        debug: false,
        format: 'text' as const,
      }

      const start = performance.now()
      const verbosity = determineVerbosityLevel(options)
      const end = performance.now()

      expect(end - start).toBeLessThan(1)
      expect(verbosity).toBe(VerbosityLevel.VERBOSE)
    })
  })

  describe('Output Formatting Performance', () => {
    const generateWorkItems = (count: number) => {
      return Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        title: `Work Item ${i + 1}`,
        state: ['New', 'Active', 'Resolved', 'Closed'][i % 4],
        assignedTo: `user${i}@example.com`,
        description: `This is a description for work item ${i + 1}`,
        workItemType: ['Bug', 'Task', 'Story'][i % 3],
        createdDate: new Date().toISOString(),
        changedDate: new Date().toISOString(),
        tags: [`tag${i}`, `priority${i % 3}`],
      }))
    }

    it('should format 100 items in text format in less than 10ms', () => {
      const items = generateWorkItems(100)

      const start = performance.now()
      const result = TextFormatter.formatWorkItems(items)
      const end = performance.now()

      expect(end - start).toBeLessThan(10)
      expect(result).toContain('Work Items')
      expect(result).toContain('100')
    })

    it('should format 1000 items in text format in less than 100ms', () => {
      const items = generateWorkItems(1000)

      const start = performance.now()
      const result = TextFormatter.formatWorkItems(items)
      const end = performance.now()

      expect(end - start).toBeLessThan(100)
      expect(result).toContain('1000')
    })

    it('should format 100 items in JSON format in less than 5ms', () => {
      const items = generateWorkItems(100)

      const start = performance.now()
      const result = JSONFormatter.formatWorkItems(items)
      const end = performance.now()

      expect(end - start).toBeLessThan(5)
      const parsed = JSON.parse(result)
      expect(parsed.count).toBe(100)
    })

    it('should format 1000 items in JSON format in less than 50ms', () => {
      const items = generateWorkItems(1000)

      const start = performance.now()
      const result = JSONFormatter.formatWorkItems(items)
      const end = performance.now()

      expect(end - start).toBeLessThan(50)
      const parsed = JSON.parse(result)
      expect(parsed.count).toBe(1000)
    })

    it('should format 100 items in markdown format in less than 10ms', () => {
      const items = generateWorkItems(100)

      const start = performance.now()
      const result = MarkdownFormatter.formatWorkItems(items)
      const end = performance.now()

      expect(end - start).toBeLessThan(10)
      expect(result).toContain('# Azure DevOps Work Items Report')
      expect(result).toContain('100')
    })
  })

  describe('OutputManager Performance', () => {
    it('should handle rapid consecutive outputs efficiently', () => {
      const outputManager = new OutputManager(
        VerbosityLevel.VERBOSE,
        OutputFormat.TEXT,
      )
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const start = performance.now()

      for (let i = 0; i < 100; i++) {
        outputManager.info(`Message ${i}`, { index: i })
      }

      const end = performance.now()

      expect(end - start).toBeLessThan(50)
      expect(consoleSpy).toHaveBeenCalledTimes(200) // Each info call logs message + details

      consoleSpy.mockRestore()
    })

    it('should skip output efficiently when verbosity is lower', () => {
      const outputManager = new OutputManager(
        VerbosityLevel.QUIET,
        OutputFormat.TEXT,
      )
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const start = performance.now()

      for (let i = 0; i < 1000; i++) {
        outputManager.info(`Message ${i}`, { index: i }, VerbosityLevel.VERBOSE)
      }

      const end = performance.now()

      expect(end - start).toBeLessThan(5) // Should be very fast since messages are skipped
      expect(consoleSpy).not.toHaveBeenCalled()

      consoleSpy.mockRestore()
    })
  })

  describe('ProgressManager Performance', () => {
    it('should update progress bar efficiently', () => {
      const progressManager = new ProgressManager(
        VerbosityLevel.NORMAL,
        OutputFormat.TEXT,
      )

      const start = performance.now()

      progressManager.startProgress('Processing items', 1000)

      for (let i = 0; i <= 1000; i += 10) {
        progressManager.updateProgress(i)
      }

      progressManager.completeProgress('Processing complete')

      const end = performance.now()

      expect(end - start).toBeLessThan(100)
    })

    it('should handle indeterminate progress efficiently', () => {
      const progressManager = new ProgressManager(
        VerbosityLevel.NORMAL,
        OutputFormat.TEXT,
      )

      const start = performance.now()

      progressManager.startIndeterminate('Loading...')

      // Simulate some work
      setTimeout(() => {
        progressManager.stopIndeterminate('Loading complete')
      }, 10)

      const end = performance.now()

      expect(end - start).toBeLessThan(5) // Starting should be instant
    })
  })

  describe('CLI Startup Performance', () => {
    it('should start CLI and show help in less than 500ms', async () => {
      const start = performance.now()

      const { stdout } = await execAsync(`npx tsx ${cliPath} --help`, {
        timeout: 5000,
      })

      const end = performance.now()

      expect(end - start).toBeLessThan(500)
      expect(stdout).toContain('azure-devops-bot')
    })

    it('should handle multiple rapid CLI invocations', async () => {
      const promises = []

      const start = performance.now()

      // Launch 5 CLI instances in parallel
      for (let i = 0; i < 5; i++) {
        promises.push(execAsync(`npx tsx ${cliPath} --version`))
      }

      const results = await Promise.all(promises)

      const end = performance.now()

      expect(end - start).toBeLessThan(2000) // All should complete within 2 seconds
      results.forEach((result) => {
        expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/)
      })
    })
  })

  describe('Memory Usage', () => {
    it('should format large datasets without excessive memory usage', () => {
      const items = generateWorkItems(10000)
      const initialMemory = process.memoryUsage().heapUsed

      // Format in all three formats
      TextFormatter.formatWorkItems(items)
      JSONFormatter.formatWorkItems(items)
      MarkdownFormatter.formatWorkItems(items)

      const finalMemory = process.memoryUsage().heapUsed
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024 // Convert to MB

      // Memory increase should be reasonable (less than 50MB for 10k items)
      expect(memoryIncrease).toBeLessThan(50)
    })

    it('should clean up resources properly', () => {
      const outputManager = new OutputManager(
        VerbosityLevel.NORMAL,
        OutputFormat.TEXT,
      )
      const progressManager = new ProgressManager(
        VerbosityLevel.NORMAL,
        OutputFormat.TEXT,
      )

      // Start and stop multiple spinners
      for (let i = 0; i < 10; i++) {
        outputManager.startSpinner(`Spinner ${i}`)
        outputManager.stopSpinner()
      }

      // Start and stop multiple progress bars
      for (let i = 0; i < 10; i++) {
        progressManager.startProgress(`Progress ${i}`, 100)
        progressManager.completeProgress()
      }

      // Check that no resources are leaked
      const activeHandles = (process as any)._getActiveHandles?.().length || 0
      expect(activeHandles).toBeLessThan(20) // Reasonable number of handles
    })
  })

  function generateWorkItems(count: number) {
    return Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      title: `Work Item ${i + 1}`,
      state: ['New', 'Active', 'Resolved', 'Closed'][i % 4],
      assignedTo: `user${i}@example.com`,
      description: `This is a description for work item ${i + 1}`,
      workItemType: ['Bug', 'Task', 'Story'][i % 3],
      createdDate: new Date().toISOString(),
      changedDate: new Date().toISOString(),
      tags: [`tag${i}`, `priority${i % 3}`],
    }))
  }
})
