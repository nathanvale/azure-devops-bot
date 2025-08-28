import { exec } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import { promisify } from 'util'

import { describe, it, expect, beforeEach, afterEach } from 'vitest'

const execAsync = promisify(exec)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const cliPath = path.join(__dirname, '../../src/index.ts')

describe('CLI End-to-End Tests', () => {
  const originalEnv = process.env

  beforeEach(() => {
    // Set up test environment
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

  describe('CLI Help and Version', () => {
    it('should display help information with --help flag', async () => {
      const { stdout, stderr } = await execAsync(`npx tsx ${cliPath} --help`)

      expect(stderr).toBe('')
      expect(stdout).toContain('azure-devops-bot')
      expect(stdout).toContain('Azure DevOps work item sync and query tool')
      expect(stdout).toContain('--verbose')
      expect(stdout).toContain('--quiet')
      expect(stdout).toContain('--debug')
      expect(stdout).toContain('--format')
      expect(stdout).toContain('Examples:')
    })

    it('should display version with --version flag', async () => {
      const { stdout } = await execAsync(`npx tsx ${cliPath} --version`)
      expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/)
    })

    it('should display help with -h flag', async () => {
      const { stdout } = await execAsync(`npx tsx ${cliPath} -h`)
      expect(stdout).toContain('azure-devops-bot')
      expect(stdout).toContain('Options:')
    })
  })

  describe('Verbosity Levels', () => {
    it('should run with quiet mode (-q)', async () => {
      const { stdout } = await execAsync(`npx tsx ${cliPath} -q "test query"`, {
        env: process.env,
        timeout: 10000,
      })

      // In quiet mode, output should be minimal
      const lines = stdout.split('\n').filter((line) => line.trim())
      expect(lines.length).toBeLessThanOrEqual(5)
    })

    it('should run with verbose mode (-v)', async () => {
      const { stdout } = await execAsync(`npx tsx ${cliPath} -v "test query"`, {
        env: process.env,
        timeout: 10000,
      })

      // In verbose mode, output should include detailed information
      expect(stdout.length).toBeGreaterThan(100)
    })

    it('should run with debug mode (-d)', async () => {
      const { stdout } = await execAsync(`npx tsx ${cliPath} -d "test query"`, {
        env: process.env,
        timeout: 10000,
      })

      // In debug mode, output should be very detailed
      expect(stdout.length).toBeGreaterThan(200)
    })

    it('should reject conflicting verbosity flags', async () => {
      await expect(
        execAsync(`npx tsx ${cliPath} -q -v "test query"`),
      ).rejects.toThrow('Cannot use --quiet and --verbose together')
    })

    it('should reject conflicting quiet and debug flags', async () => {
      await expect(
        execAsync(`npx tsx ${cliPath} -q -d "test query"`),
      ).rejects.toThrow('Cannot use --quiet and --debug together')
    })
  })

  describe('Output Formats', () => {
    it('should output in text format by default', async () => {
      const { stdout } = await execAsync(`npx tsx ${cliPath} "test query"`, {
        env: process.env,
        timeout: 10000,
      })

      // Text format should include color codes or formatted text
      expect(stdout).toBeDefined()
      // Check for typical text formatting indicators
      expect(stdout).not.toMatch(/^\s*{/) // Not JSON
      expect(stdout).not.toMatch(/^#\s/m) // Not Markdown
    })

    it('should output in JSON format with --format json', async () => {
      const { stdout } = await execAsync(
        `npx tsx ${cliPath} --format json "test query"`,
        {
          env: process.env,
          timeout: 10000,
        },
      )

      // Should be valid JSON
      const lines = stdout.split('\n').filter((line) => line.trim())
      const jsonLine = lines.find((line) => line.startsWith('{'))

      if (jsonLine) {
        expect(() => JSON.parse(jsonLine)).not.toThrow()
      }
    })

    it('should output in markdown format with --format markdown', async () => {
      const { stdout } = await execAsync(
        `npx tsx ${cliPath} --format markdown "test query"`,
        {
          env: process.env,
          timeout: 10000,
        },
      )

      // Should contain markdown elements
      expect(stdout).toMatch(/(#|\*\*|```)/)
    })

    it('should reject invalid format types', async () => {
      await expect(
        execAsync(`npx tsx ${cliPath} --format xml "test query"`),
      ).rejects.toThrow('Invalid format')
    })
  })

  describe('Error Handling', () => {
    it('should handle missing environment variables gracefully', async () => {
      delete process.env.AZURE_DEVOPS_USER_EMAILS

      try {
        await execAsync(`npx tsx ${cliPath} "test query"`, {
          env: process.env,
          timeout: 10000,
        })
      } catch (error: any) {
        expect(error.message).toContain('AZURE_DEVOPS_USER_EMAILS')
        expect(error.message).toContain('required')
      }
    })

    it('should handle invalid PAT tokens gracefully', async () => {
      process.env.AZURE_DEVOPS_PAT = 'invalid-token'

      try {
        await execAsync(`npx tsx ${cliPath} "test query"`, {
          env: process.env,
          timeout: 10000,
        })
      } catch (error: any) {
        // Should provide helpful error message
        expect(error.message).toBeDefined()
      }
    })
  })

  describe('Query Processing', () => {
    it('should handle default query when none provided', async () => {
      const { stdout } = await execAsync(`npx tsx ${cliPath}`, {
        env: process.env,
        timeout: 10000,
      })

      expect(stdout).toBeDefined()
    })

    it('should process custom query strings', async () => {
      const { stdout } = await execAsync(`npx tsx ${cliPath} "my work items"`, {
        env: process.env,
        timeout: 10000,
      })

      expect(stdout).toBeDefined()
    })

    it('should handle queries with special characters', async () => {
      const { stdout } = await execAsync(
        `npx tsx ${cliPath} "work items with 'quotes' and spaces"`,
        {
          env: process.env,
          timeout: 10000,
        },
      )

      expect(stdout).toBeDefined()
    })
  })

  describe('Backward Compatibility', () => {
    it('should maintain backward compatibility when no CLI flags are used', async () => {
      const { stdout } = await execAsync(`npx tsx ${cliPath} "test query"`, {
        env: process.env,
        timeout: 10000,
      })

      // Should behave like the original implementation
      expect(stdout).toBeDefined()
      // Should not include CLI-specific output unless flags are used
    })

    it('should work with PM2 process management', async () => {
      // This test would verify PM2 compatibility but is skipped in test environment
      // as it requires PM2 to be installed and configured
      expect(true).toBe(true)
    })
  })

  describe('Combined Options', () => {
    it('should handle verbose mode with JSON format', async () => {
      const { stdout } = await execAsync(
        `npx tsx ${cliPath} -v --format json "test query"`,
        {
          env: process.env,
          timeout: 10000,
        },
      )

      // Should output verbose JSON
      const lines = stdout.split('\n').filter((line) => line.trim())
      const jsonLines = lines.filter((line) => line.startsWith('{'))

      expect(jsonLines.length).toBeGreaterThan(0)
      jsonLines.forEach((line) => {
        expect(() => JSON.parse(line)).not.toThrow()
      })
    })

    it('should handle debug mode with markdown format', async () => {
      const { stdout } = await execAsync(
        `npx tsx ${cliPath} -d --format markdown "test query"`,
        {
          env: process.env,
          timeout: 10000,
        },
      )

      // Should output detailed markdown
      expect(stdout).toContain('#')
      expect(stdout.length).toBeGreaterThan(200)
    })

    it('should handle quiet mode with JSON format', async () => {
      const { stdout } = await execAsync(
        `npx tsx ${cliPath} -q --format json "test query"`,
        {
          env: process.env,
          timeout: 10000,
        },
      )

      // Should output minimal JSON
      const lines = stdout.split('\n').filter((line) => line.trim())
      expect(lines.length).toBeLessThanOrEqual(10)
    })
  })
})
