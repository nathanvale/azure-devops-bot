import { describe, it, expect, beforeEach, vi } from 'vitest'

import { AzureDevOpsClient } from '../azure-devops.js'

describe('Azure DevOps PAT Integration', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = process.env
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('PAT Environment Variable Support', () => {
    it('should use AZURE_DEVOPS_PAT from environment variables', () => {
      const testPAT = 'test-personal-access-token-12345'
      process.env = {
        ...originalEnv,
        AZURE_DEVOPS_PAT: testPAT,
      }

      const client = new AzureDevOpsClient()

      // We can't directly access the private restProvider, but we can verify the client was created
      expect(client).toBeInstanceOf(AzureDevOpsClient)
    })

    it('should require AZURE_DEVOPS_PAT to be provided', () => {
      process.env = {
        ...originalEnv,
        AZURE_DEVOPS_PAT: undefined,
      }

      // Should throw during construction when PAT is missing
      expect(() => new AzureDevOpsClient()).toThrow(
        'AZURE_DEVOPS_PAT environment variable is required',
      )
    })

    it('should require AZURE_DEVOPS_PAT to be non-empty', () => {
      process.env = {
        ...originalEnv,
        AZURE_DEVOPS_PAT: '',
      }

      // Should throw during construction when PAT is empty
      expect(() => new AzureDevOpsClient()).toThrow(
        'AZURE_DEVOPS_PAT environment variable is required',
      )
    })
  })

  describe('PAT Configuration', () => {
    it('should accept valid PAT format', () => {
      const testPAT = 'abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklm' // 52 char PAT
      process.env = {
        ...originalEnv,
        AZURE_DEVOPS_PAT: testPAT,
      }

      // Should create client successfully with valid PAT
      expect(() => new AzureDevOpsClient()).not.toThrow()
    })
  })
})
