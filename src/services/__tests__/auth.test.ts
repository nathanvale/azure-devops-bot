import { describe, it, expect, beforeEach, vi } from 'vitest'

import { AzureAuth } from '../auth'

describe('AzureAuth', () => {
  let auth: AzureAuth
  let mockExecAsync: any

  beforeEach(() => {
    vi.resetAllMocks()

    // Create a mock execAsync function
    mockExecAsync = vi.fn()

    // Pass the mock function to the constructor
    auth = new AzureAuth(mockExecAsync)

    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  describe('checkAuth', () => {
    it('should return true when authenticated', async () => {
      const mockAccountInfo = {
        environmentName: 'AzureCloud',
        id: 'subscription-id',
        isDefault: true,
        name: 'Test Subscription',
      }

      mockExecAsync.mockResolvedValue({
        stdout: JSON.stringify(mockAccountInfo),
      })

      const result = await auth.checkAuth()

      expect(result).toBe(true)
      expect(mockExecAsync).toHaveBeenCalledWith('az account show')
    })

    it('should return true when account info has content', async () => {
      mockExecAsync.mockResolvedValue({ stdout: '{"id": "test"}' })

      const result = await auth.checkAuth()

      expect(result).toBe(true)
    })

    it('should return false when not authenticated', async () => {
      mockExecAsync.mockRejectedValue(new Error('Please run az login'))

      const result = await auth.checkAuth()

      expect(result).toBe(false)
    })

    it('should return false when stdout is empty', async () => {
      mockExecAsync.mockResolvedValue({ stdout: '' })

      const result = await auth.checkAuth()

      expect(result).toBe(false)
    })

    it('should return false when stdout is whitespace only', async () => {
      mockExecAsync.mockResolvedValue({ stdout: '   \n\t  ' })

      const result = await auth.checkAuth()

      expect(result).toBe(false)
    })

    it('should return false when command execution fails', async () => {
      mockExecAsync.mockRejectedValue(new Error('Command not found'))

      const result = await auth.checkAuth()

      expect(result).toBe(false)
    })

    it('should handle Azure CLI not installed', async () => {
      mockExecAsync.mockRejectedValue(new Error('az: command not found'))

      const result = await auth.checkAuth()

      expect(result).toBe(false)
    })

    it('should handle network errors', async () => {
      mockExecAsync.mockRejectedValue(new Error('Network error'))

      const result = await auth.checkAuth()

      expect(result).toBe(false)
    })
  })

  describe('login', () => {
    it('should provide authentication instructions and throw error', async () => {
      await expect(auth.login()).rejects.toThrow(
        'Azure CLI authentication required',
      )

      expect(console.log).toHaveBeenCalledWith(
        '❌ Not authenticated with Azure CLI',
      )
      expect(console.log).toHaveBeenCalledWith(
        '🔗 Please sign in at: https://dev.azure.com/fwcdev',
      )
      expect(console.log).toHaveBeenCalledWith('💡 Then run: az login')
    })

    it('should use correct SSO URL', async () => {
      await expect(auth.login()).rejects.toThrow()

      expect(console.log).toHaveBeenCalledWith(
        '🔗 Please sign in at: https://dev.azure.com/fwcdev',
      )
    })

    it('should always throw authentication required error', async () => {
      await expect(auth.login()).rejects.toThrow(
        'Azure CLI authentication required',
      )
    })
  })

  describe('ensureAuth', () => {
    it('should not call login when already authenticated', async () => {
      mockExecAsync.mockResolvedValue({ stdout: '{"id": "test"}' })

      const loginSpy = vi.spyOn(auth, 'login')

      await auth.ensureAuth()

      expect(loginSpy).not.toHaveBeenCalled()
    })

    it('should call login when not authenticated', async () => {
      mockExecAsync.mockRejectedValue(new Error('Not authenticated'))

      const loginSpy = vi
        .spyOn(auth, 'login')
        .mockRejectedValue(new Error('Azure CLI authentication required'))

      await expect(auth.ensureAuth()).rejects.toThrow(
        'Azure CLI authentication required',
      )

      expect(loginSpy).toHaveBeenCalledTimes(1)
    })

    it('should propagate login errors', async () => {
      mockExecAsync.mockRejectedValue(new Error('Not authenticated'))

      await expect(auth.ensureAuth()).rejects.toThrow(
        'Azure CLI authentication required',
      )
    })

    it('should handle checkAuth errors', async () => {
      vi.spyOn(auth, 'checkAuth').mockRejectedValue(
        new Error('Check auth failed'),
      )

      await expect(auth.ensureAuth()).rejects.toThrow('Check auth failed')
    })
  })

  describe('static constants', () => {
    it('should have correct SSO URL', () => {
      expect(AzureAuth['SSO_URL']).toBe('https://dev.azure.com/fwcdev')
    })

    it('should use the same organization as other services', () => {
      // This ensures consistency across the application
      expect(AzureAuth['SSO_URL']).toContain('fwcdev')
    })
  })

  describe('authentication flow integration', () => {
    it('should handle complete authentication flow', async () => {
      // First check fails (not authenticated)
      mockExecAsync.mockRejectedValueOnce(new Error('Not authenticated'))

      // Ensure auth should fail when not authenticated (this will call the real login method)
      await expect(auth.ensureAuth()).rejects.toThrow(
        'Azure CLI authentication required',
      )

      expect(console.log).toHaveBeenCalledWith(
        '❌ Not authenticated with Azure CLI',
      )
    })

    it('should handle successful authentication check', async () => {
      // Mock successful authentication
      mockExecAsync.mockResolvedValue({
        stdout: '{"id": "subscription-id", "name": "Test Subscription"}',
      })

      const checkResult = await auth.checkAuth()
      expect(checkResult).toBe(true)

      // ensureAuth should not throw when already authenticated
      await expect(auth.ensureAuth()).resolves.toBeUndefined()
    })

    it('should handle edge case where az account show returns empty object', async () => {
      mockExecAsync.mockResolvedValue({ stdout: '{}' })

      const result = await auth.checkAuth()

      expect(result).toBe(true) // Empty object still has content
    })

    it('should handle malformed JSON from az account show', async () => {
      mockExecAsync.mockResolvedValue({ stdout: 'malformed json' })

      const result = await auth.checkAuth()

      expect(result).toBe(true) // Any non-empty string counts as authenticated
    })
  })

  describe('error scenarios', () => {
    it('should handle Azure CLI returning error codes', async () => {
      const error: any = new Error('Command failed')
      error.code = 1
      mockExecAsync.mockRejectedValue(error)

      const result = await auth.checkAuth()

      expect(result).toBe(false)
    })

    it('should handle timeout errors', async () => {
      const error: any = new Error('Command timed out')
      error.code = 'TIMEOUT'
      mockExecAsync.mockRejectedValue(error)

      const result = await auth.checkAuth()

      expect(result).toBe(false)
    })

    it('should handle permission errors', async () => {
      const error: any = new Error('Permission denied')
      error.code = 'EACCES'
      mockExecAsync.mockRejectedValue(error)

      const result = await auth.checkAuth()

      expect(result).toBe(false)
    })
  })
})
