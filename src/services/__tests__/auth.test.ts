import { describe, it, expect, beforeEach, vi } from 'vitest'

import { PATAuth } from '../../packages/azure-devops-client/src/auth/pat-auth.js'
import { AzureAuth } from '../auth'

// Mock the PATAuth class
vi.mock('../../packages/azure-devops-client/src/auth/pat-auth.js', () => ({
  PATAuth: vi.fn().mockImplementation(() => ({
    isValidPATFormat: vi.fn(),
    validateAuthentication: vi.fn(),
  })),
}))

describe('AzureAuth', () => {
  let auth: AzureAuth
  let mockPATAuth: any

  beforeEach(() => {
    vi.resetAllMocks()

    // Clear environment variables
    delete process.env.AZURE_DEVOPS_PAT

    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {})

    // Create mock PATAuth instance
    mockPATAuth = {
      isValidPATFormat: vi.fn(),
      validateAuthentication: vi.fn(),
    }

    // Make the PATAuth constructor return our mock
    ;(PATAuth as any).mockImplementation(() => mockPATAuth)
  })

  describe('checkAuth', () => {
    it('should return false when PAT is not set', async () => {
      auth = new AzureAuth()

      const result = await auth.checkAuth()

      expect(result).toBe(false)
    })

    it('should return false when PAT format is invalid', async () => {
      process.env.AZURE_DEVOPS_PAT = 'invalid-pat'
      mockPATAuth.isValidPATFormat.mockReturnValue(false)

      auth = new AzureAuth()
      const result = await auth.checkAuth()

      expect(result).toBe(false)
      expect(mockPATAuth.isValidPATFormat).toHaveBeenCalled()
    })

    it('should return true when PAT is valid and authentication succeeds', async () => {
      process.env.AZURE_DEVOPS_PAT = 'valid-pat-token'
      mockPATAuth.isValidPATFormat.mockReturnValue(true)
      mockPATAuth.validateAuthentication.mockResolvedValue(true)

      auth = new AzureAuth()
      const result = await auth.checkAuth()

      expect(result).toBe(true)
      expect(mockPATAuth.isValidPATFormat).toHaveBeenCalled()
      expect(mockPATAuth.validateAuthentication).toHaveBeenCalled()
    })

    it('should return false when PAT validation fails', async () => {
      process.env.AZURE_DEVOPS_PAT = 'expired-pat-token'
      mockPATAuth.isValidPATFormat.mockReturnValue(true)
      mockPATAuth.validateAuthentication.mockResolvedValue(false)

      auth = new AzureAuth()
      const result = await auth.checkAuth()

      expect(result).toBe(false)
    })

    it('should handle PAT validation errors gracefully', async () => {
      process.env.AZURE_DEVOPS_PAT = 'problematic-pat'
      mockPATAuth.isValidPATFormat.mockReturnValue(true)
      mockPATAuth.validateAuthentication.mockRejectedValue(
        new Error('Network error'),
      )

      auth = new AzureAuth()
      const result = await auth.checkAuth()

      expect(result).toBe(false)
    })

    it('should handle PAT with whitespace correctly', async () => {
      process.env.AZURE_DEVOPS_PAT = '  valid-pat-token  '
      mockPATAuth.isValidPATFormat.mockReturnValue(true)
      mockPATAuth.validateAuthentication.mockResolvedValue(true)

      auth = new AzureAuth()
      const result = await auth.checkAuth()

      expect(result).toBe(true)
      expect(PATAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          pat: 'valid-pat-token', // Should be trimmed
        }),
      )
    })
  })

  describe('login', () => {
    it('should provide PAT setup instructions when PAT is not set', async () => {
      auth = new AzureAuth()

      await expect(auth.login()).rejects.toThrow(
        'AZURE_DEVOPS_PAT environment variable is required',
      )

      expect(console.log).toHaveBeenCalledWith(
        '❌ AZURE_DEVOPS_PAT environment variable is not set',
      )
      expect(console.log).toHaveBeenCalledWith(
        '🔗 Please create a Personal Access Token at: https://dev.azure.com/fwcdev/_usersSettings/tokens',
      )
      expect(console.log).toHaveBeenCalledWith(
        '💡 Steps to set up PAT authentication:',
      )
    })

    it('should provide PAT troubleshooting when authentication fails', async () => {
      process.env.AZURE_DEVOPS_PAT = 'invalid-or-expired-pat'
      auth = new AzureAuth()

      await expect(auth.login()).rejects.toThrow(
        'Azure DevOps PAT authentication failed',
      )

      expect(console.log).toHaveBeenCalledWith('❌ PAT authentication failed')
      expect(console.log).toHaveBeenCalledWith(
        '🔑 Your Personal Access Token may be invalid or expired',
      )
    })

    it('should handle empty PAT string', async () => {
      process.env.AZURE_DEVOPS_PAT = '   '
      auth = new AzureAuth()

      await expect(auth.login()).rejects.toThrow(
        'AZURE_DEVOPS_PAT environment variable is required',
      )
    })

    it('should always throw when called', async () => {
      process.env.AZURE_DEVOPS_PAT = 'some-pat'
      auth = new AzureAuth()

      await expect(auth.login()).rejects.toThrow()
    })
  })

  describe('ensureAuth', () => {
    it('should not call login when already authenticated', async () => {
      process.env.AZURE_DEVOPS_PAT = 'valid-pat'
      mockPATAuth.isValidPATFormat.mockReturnValue(true)
      mockPATAuth.validateAuthentication.mockResolvedValue(true)

      auth = new AzureAuth()
      const loginSpy = vi.spyOn(auth, 'login')

      await auth.ensureAuth()

      expect(loginSpy).not.toHaveBeenCalled()
    })

    it('should call login when not authenticated', async () => {
      auth = new AzureAuth() // No PAT set

      const loginSpy = vi
        .spyOn(auth, 'login')
        .mockRejectedValue(
          new Error('AZURE_DEVOPS_PAT environment variable is required'),
        )

      await expect(auth.ensureAuth()).rejects.toThrow(
        'AZURE_DEVOPS_PAT environment variable is required',
      )

      expect(loginSpy).toHaveBeenCalledTimes(1)
    })

    it('should propagate login errors', async () => {
      auth = new AzureAuth() // No PAT set

      await expect(auth.ensureAuth()).rejects.toThrow(
        'AZURE_DEVOPS_PAT environment variable is required',
      )
    })

    it('should handle checkAuth errors', async () => {
      process.env.AZURE_DEVOPS_PAT = 'problematic-pat'
      auth = new AzureAuth()

      vi.spyOn(auth, 'checkAuth').mockRejectedValue(
        new Error('Check auth failed'),
      )

      await expect(auth.ensureAuth()).rejects.toThrow('Check auth failed')
    })
  })

  describe('connection info', () => {
    it('should return correct connection information', () => {
      auth = new AzureAuth()

      const connectionInfo = auth.getConnectionInfo()

      expect(connectionInfo).toEqual({
        organization: 'fwcdev',
        project: 'Customer Services Platform',
        azureDevOpsUrl: 'https://dev.azure.com/fwcdev',
      })
    })

    it('should provide consistent organization across methods', () => {
      auth = new AzureAuth()

      const connectionInfo = auth.getConnectionInfo()
      expect(connectionInfo.organization).toBe('fwcdev')
    })
  })

  describe('PAT auth integration', () => {
    it('should return PAT auth instance when available', () => {
      process.env.AZURE_DEVOPS_PAT = 'valid-pat'
      auth = new AzureAuth()

      const patAuth = auth.getPATAuth()

      expect(patAuth).toBe(mockPATAuth)
    })

    it('should return null when PAT is not configured', () => {
      auth = new AzureAuth()

      const patAuth = auth.getPATAuth()

      expect(patAuth).toBeNull()
    })

    it('should handle PAT auth initialization errors gracefully', () => {
      process.env.AZURE_DEVOPS_PAT = 'problematic-pat'
      // Make PATAuth constructor throw
      ;(PATAuth as any).mockImplementation(() => {
        throw new Error('PAT initialization failed')
      })

      // Should not throw during construction
      expect(() => new AzureAuth()).not.toThrow()
    })
  })

  describe('authentication flow integration', () => {
    it('should handle complete authentication failure flow', async () => {
      // No PAT set
      auth = new AzureAuth()

      // Ensure auth should fail when not authenticated
      await expect(auth.ensureAuth()).rejects.toThrow(
        'AZURE_DEVOPS_PAT environment variable is required',
      )

      expect(console.log).toHaveBeenCalledWith(
        '❌ AZURE_DEVOPS_PAT environment variable is not set',
      )
    })

    it('should handle successful authentication flow', async () => {
      process.env.AZURE_DEVOPS_PAT = 'valid-pat'
      mockPATAuth.isValidPATFormat.mockReturnValue(true)
      mockPATAuth.validateAuthentication.mockResolvedValue(true)

      auth = new AzureAuth()

      const checkResult = await auth.checkAuth()
      expect(checkResult).toBe(true)

      // ensureAuth should not throw when already authenticated
      await expect(auth.ensureAuth()).resolves.toBeUndefined()
    })

    it('should handle PAT format validation edge cases', async () => {
      process.env.AZURE_DEVOPS_PAT = 'edge-case-pat'
      mockPATAuth.isValidPATFormat.mockReturnValue(false)

      auth = new AzureAuth()
      const result = await auth.checkAuth()

      expect(result).toBe(false)
    })

    it('should handle network connectivity issues during validation', async () => {
      process.env.AZURE_DEVOPS_PAT = 'network-test-pat'
      mockPATAuth.isValidPATFormat.mockReturnValue(true)
      mockPATAuth.validateAuthentication.mockRejectedValue(
        new Error('Network timeout'),
      )

      auth = new AzureAuth()
      const result = await auth.checkAuth()

      expect(result).toBe(false)
    })
  })
})
