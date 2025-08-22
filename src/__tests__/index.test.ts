import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

// Use vi.hoisted to ensure mocks are available during module loading
const mockSyncService = vi.hoisted(() => ({
  startBackgroundSync: vi.fn(),
  shouldSync: vi.fn(),
  performSync: vi.fn(),
  performSyncDetailed: vi.fn(),
  close: vi.fn(),
}))

const mockDatabaseService = vi.hoisted(() => ({
  close: vi.fn(),
}))

const mockQueryEngine = vi.hoisted(() => ({
  processQuery: vi.fn(),
}))

const mockAzureDevOpsClient = vi.hoisted(() => ({
  validateUserEmails: vi.fn(),
}))

const mockSetUserEmails = vi.hoisted(() => vi.fn())

vi.mock('../services/sync-service.js', () => ({
  SyncService: vi.fn(() => mockSyncService),
}))

vi.mock('../services/database.js', () => ({
  DatabaseService: vi.fn(() => mockDatabaseService),
}))

vi.mock('../services/query-engine.js', () => ({
  QueryEngine: vi.fn(() => mockQueryEngine),
}))

vi.mock('../services/azure-devops.js', () => {
  const mockClass = vi.fn(() => mockAzureDevOpsClient)
  ;(mockClass as any).setUserEmails = mockSetUserEmails
  return {
    AzureDevOpsClient: mockClass,
  }
})

import { AzureDevOpsBot } from '../index.js'

describe('AzureDevOpsBot', () => {
  let originalEnv: typeof process.env
  let originalArgv: string[]
  let consoleSpy: any
  let processExitSpy: any
  let bot: AzureDevOpsBot

  beforeEach(() => {
    // Save original environment and argv
    originalEnv = { ...process.env }
    originalArgv = [...process.argv]

    // Mock console and process.exit
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    }
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit unexpectedly called with "${code}"`)
    })

    // Reset all mocks
    vi.resetAllMocks()
    mockSetUserEmails.mockClear()
    mockAzureDevOpsClient.validateUserEmails.mockClear()
    mockSyncService.startBackgroundSync.mockClear()
    mockSyncService.shouldSync.mockClear()
    mockSyncService.performSync.mockClear()
    mockSyncService.performSyncDetailed.mockClear()
    mockQueryEngine.processQuery.mockClear()

    // Create a new bot instance for each test
    bot = new AzureDevOpsBot()
  })

  afterEach(() => {
    // Restore original environment and argv
    process.env = originalEnv
    process.argv = originalArgv

    // Restore spies
    consoleSpy.log.mockRestore()
    consoleSpy.error.mockRestore()
    processExitSpy.mockRestore()
  })

  describe('Environment Variable Validation', () => {
    it('should exit with error when AZURE_DEVOPS_USER_EMAILS is not set', async () => {
      delete process.env.AZURE_DEVOPS_USER_EMAILS

      await expect(bot.start()).rejects.toThrow(
        'process.exit unexpectedly called with "1"',
      )

      expect(processExitSpy).toHaveBeenCalledWith(1)
      expect(consoleSpy.error).toHaveBeenCalledWith(
        '❌ Error: AZURE_DEVOPS_USER_EMAILS environment variable is required',
      )
    })

    it('should exit with error when AZURE_DEVOPS_USER_EMAILS is empty', async () => {
      process.env.AZURE_DEVOPS_USER_EMAILS = ''

      await expect(bot.start()).rejects.toThrow(
        'process.exit unexpectedly called with "1"',
      )

      expect(processExitSpy).toHaveBeenCalledWith(1)
      expect(consoleSpy.error).toHaveBeenCalledWith(
        '❌ Error: AZURE_DEVOPS_USER_EMAILS environment variable is required',
      )
    })

    it('should exit with error when AZURE_DEVOPS_USER_EMAILS contains only whitespace', async () => {
      process.env.AZURE_DEVOPS_USER_EMAILS = '   '

      await expect(bot.start()).rejects.toThrow(
        'process.exit unexpectedly called with "1"',
      )

      expect(processExitSpy).toHaveBeenCalledWith(1)
      expect(consoleSpy.error).toHaveBeenCalledWith(
        '❌ Error: At least one valid email address must be provided',
      )
    })

    it('should exit with error when AZURE_DEVOPS_USER_EMAILS contains only commas', async () => {
      process.env.AZURE_DEVOPS_USER_EMAILS = ',,,'

      await expect(bot.start()).rejects.toThrow(
        'process.exit unexpectedly called with "1"',
      )

      expect(processExitSpy).toHaveBeenCalledWith(1)
      expect(consoleSpy.error).toHaveBeenCalledWith(
        '❌ Error: At least one valid email address must be provided',
      )
    })

    it('should parse multiple emails correctly', async () => {
      process.env.AZURE_DEVOPS_USER_EMAILS =
        'user1@fwc.gov.au, user2@fwc.gov.au , user3@fwc.gov.au'

      // Mock successful validation
      mockAzureDevOpsClient.validateUserEmails.mockResolvedValue({
        valid: ['user1@fwc.gov.au', 'user2@fwc.gov.au', 'user3@fwc.gov.au'],
        invalid: [],
      })

      mockSyncService.shouldSync.mockResolvedValue(false)
      mockQueryEngine.processQuery.mockResolvedValue('Test response')

      await bot.start()

      expect(mockSetUserEmails).toHaveBeenCalledWith([
        'user1@fwc.gov.au',
        'user2@fwc.gov.au',
        'user3@fwc.gov.au',
      ])
    })

    it('should filter out empty emails from comma-separated list', async () => {
      process.env.AZURE_DEVOPS_USER_EMAILS =
        'user1@fwc.gov.au,,user2@fwc.gov.au, ,user3@fwc.gov.au'

      mockAzureDevOpsClient.validateUserEmails.mockResolvedValue({
        valid: ['user1@fwc.gov.au', 'user2@fwc.gov.au', 'user3@fwc.gov.au'],
        invalid: [],
      })

      mockSyncService.shouldSync.mockResolvedValue(false)
      mockQueryEngine.processQuery.mockResolvedValue('Test response')

      await bot.start()

      expect(mockSetUserEmails).toHaveBeenCalledWith([
        'user1@fwc.gov.au',
        'user2@fwc.gov.au',
        'user3@fwc.gov.au',
      ])
    })
  })

  describe('Email Validation', () => {
    beforeEach(() => {
      process.env.AZURE_DEVOPS_USER_EMAILS =
        'valid@fwc.gov.au,invalid@example.com'
    })

    it('should exit with error when some emails are invalid', async () => {
      mockAzureDevOpsClient.validateUserEmails.mockResolvedValue({
        valid: ['valid@fwc.gov.au'],
        invalid: ['invalid@example.com'],
      })

      await expect(bot.start()).rejects.toThrow(
        'process.exit unexpectedly called with "1"',
      )

      expect(processExitSpy).toHaveBeenCalledWith(1)
      expect(consoleSpy.error).toHaveBeenCalledWith(
        '❌ Error: The following email addresses were not found in Azure DevOps:',
      )
      expect(consoleSpy.error).toHaveBeenCalledWith('  • invalid@example.com')
      expect(consoleSpy.error).toHaveBeenCalledWith(
        'Valid emails found:',
        'valid@fwc.gov.au',
      )
    })

    it('should exit with error when all emails are invalid', async () => {
      process.env.AZURE_DEVOPS_USER_EMAILS =
        'invalid1@example.com,invalid2@example.com'

      mockAzureDevOpsClient.validateUserEmails.mockResolvedValue({
        valid: [],
        invalid: ['invalid1@example.com', 'invalid2@example.com'],
      })

      await expect(bot.start()).rejects.toThrow(
        'process.exit unexpectedly called with "1"',
      )

      expect(processExitSpy).toHaveBeenCalledWith(1)
      expect(consoleSpy.error).toHaveBeenCalledWith(
        '❌ Error: The following email addresses were not found in Azure DevOps:',
      )
      expect(consoleSpy.error).toHaveBeenCalledWith('  • invalid1@example.com')
      expect(consoleSpy.error).toHaveBeenCalledWith('  • invalid2@example.com')
      expect(consoleSpy.error).toHaveBeenCalledWith(
        'Valid emails found:',
        'None',
      )
    })

    it('should continue when all emails are valid', async () => {
      process.env.AZURE_DEVOPS_USER_EMAILS =
        'valid1@fwc.gov.au,valid2@fwc.gov.au'

      mockAzureDevOpsClient.validateUserEmails.mockResolvedValue({
        valid: ['valid1@fwc.gov.au', 'valid2@fwc.gov.au'],
        invalid: [],
      })

      mockSyncService.shouldSync.mockResolvedValue(false)
      mockQueryEngine.processQuery.mockResolvedValue('Test response')

      await bot.start()

      expect(processExitSpy).not.toHaveBeenCalled()
      expect(consoleSpy.log).toHaveBeenCalledWith(
        '✅ All email addresses validated successfully: valid1@fwc.gov.au, valid2@fwc.gov.au',
      )
    })

    it('should show helpful error messages for invalid emails', async () => {
      mockAzureDevOpsClient.validateUserEmails.mockResolvedValue({
        valid: [],
        invalid: ['invalid@example.com'],
      })

      await expect(bot.start()).rejects.toThrow(
        'process.exit unexpectedly called with "1"',
      )

      expect(consoleSpy.error).toHaveBeenCalledWith(
        'Please ensure these email addresses:',
      )
      expect(consoleSpy.error).toHaveBeenCalledWith(
        '  1. Are correctly spelled',
      )
      expect(consoleSpy.error).toHaveBeenCalledWith(
        '  2. Exist in the Azure DevOps organization',
      )
      expect(consoleSpy.error).toHaveBeenCalledWith(
        '  3. Have access to the project',
      )
    })
  })

  describe('Application Flow', () => {
    beforeEach(() => {
      process.env.AZURE_DEVOPS_USER_EMAILS = 'valid@fwc.gov.au'

      mockAzureDevOpsClient.validateUserEmails.mockResolvedValue({
        valid: ['valid@fwc.gov.au'],
        invalid: [],
      })
    })

    it('should perform sync when shouldSync returns true', async () => {
      mockSyncService.shouldSync.mockResolvedValue(true)
      mockQueryEngine.processQuery.mockResolvedValue('Test response')

      await bot.start()

      expect(mockSyncService.performSyncDetailed).toHaveBeenCalled()
      expect(consoleSpy.log).toHaveBeenCalledWith(
        '🔄 Syncing work items with detailed metadata...',
      )
    })

    it('should skip sync when shouldSync returns false', async () => {
      mockSyncService.shouldSync.mockResolvedValue(false)
      mockQueryEngine.processQuery.mockResolvedValue('Test response')

      await bot.start()

      expect(mockSyncService.performSyncDetailed).not.toHaveBeenCalled()
      expect(consoleSpy.log).not.toHaveBeenCalledWith(
        '🔄 Syncing work items with detailed metadata...',
      )
    })

    it("should use 'summary' as default query when no args provided", async () => {
      process.argv = ['node', 'index.js']

      mockSyncService.shouldSync.mockResolvedValue(false)
      mockQueryEngine.processQuery.mockResolvedValue('Summary response')

      await bot.start()

      expect(mockQueryEngine.processQuery).toHaveBeenCalledWith('summary', [
        'valid@fwc.gov.au',
      ])
    })

    it('should use command line arguments as query', async () => {
      process.argv = ['node', 'index.js', 'search', 'for', 'bugs']

      mockSyncService.shouldSync.mockResolvedValue(false)
      mockQueryEngine.processQuery.mockResolvedValue('Search response')

      await bot.start()

      expect(mockQueryEngine.processQuery).toHaveBeenCalledWith(
        'search for bugs',
        ['valid@fwc.gov.au'],
      )
    })

    it('should display query response', async () => {
      mockSyncService.shouldSync.mockResolvedValue(false)
      mockQueryEngine.processQuery.mockResolvedValue('Query response')

      await bot.start()

      expect(consoleSpy.log).toHaveBeenCalledWith('\nQuery response')
    })

    it('should handle errors during execution', async () => {
      mockSyncService.shouldSync.mockRejectedValue(new Error('Sync failed'))

      await expect(bot.start()).rejects.toThrow(
        'process.exit unexpectedly called with "1"',
      )

      expect(processExitSpy).toHaveBeenCalledWith(1)
      expect(consoleSpy.error).toHaveBeenCalledWith(
        '❌ Error:',
        expect.any(Error),
      )
    })
  })

  describe('Logging', () => {
    beforeEach(() => {
      process.env.AZURE_DEVOPS_USER_EMAILS = 'user1@fwc.gov.au,user2@fwc.gov.au'

      mockAzureDevOpsClient.validateUserEmails.mockResolvedValue({
        valid: ['user1@fwc.gov.au', 'user2@fwc.gov.au'],
        invalid: [],
      })

      mockSyncService.shouldSync.mockResolvedValue(false)
      mockQueryEngine.processQuery.mockResolvedValue('Test response')
    })

    it('should log validation start message', async () => {
      await bot.start()

      expect(consoleSpy.log).toHaveBeenCalledWith(
        '🔍 Validating email addresses in Azure DevOps: user1@fwc.gov.au, user2@fwc.gov.au',
      )
    })

    it('should log validation success message', async () => {
      await bot.start()

      expect(consoleSpy.log).toHaveBeenCalledWith(
        '✅ All email addresses validated successfully: user1@fwc.gov.au, user2@fwc.gov.au',
      )
    })

    it('should log background sync start message', async () => {
      await bot.start()

      expect(mockSyncService.startBackgroundSync).toHaveBeenCalled()
    })
  })
})
