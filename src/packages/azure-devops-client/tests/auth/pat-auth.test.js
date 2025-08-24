import { describe, it, expect, beforeEach } from 'vitest'
import { PATAuth } from '../../src/auth/pat-auth.js'
describe('PATAuth', () => {
  let config
  let patAuth
  beforeEach(() => {
    config = {
      organization: 'test-org',
      project: 'test-project',
      pat: 'test-personal-access-token',
    }
    patAuth = new PATAuth(config)
  })
  describe('constructor', () => {
    it('should initialize with provided config', () => {
      expect(patAuth.organization).toBe('test-org')
      expect(patAuth.project).toBe('test-project')
    })
    it('should throw error if PAT is empty', () => {
      const invalidConfig = { ...config, pat: '' }
      expect(() => new PATAuth(invalidConfig)).toThrow(
        'Personal Access Token is required',
      )
    })
    it('should throw error if organization is empty', () => {
      const invalidConfig = { ...config, organization: '' }
      expect(() => new PATAuth(invalidConfig)).toThrow(
        'Organization is required',
      )
    })
    it('should throw error if project is empty', () => {
      const invalidConfig = { ...config, project: '' }
      expect(() => new PATAuth(invalidConfig)).toThrow('Project is required')
    })
    it('should use default API version if not provided', () => {
      expect(patAuth.apiVersion).toBe('7.1-preview.3')
    })
    it('should use custom API version if provided', () => {
      const configWithVersion = { ...config, apiVersion: '6.0' }
      const authWithVersion = new PATAuth(configWithVersion)
      expect(authWithVersion.apiVersion).toBe('6.0')
    })
    it('should use default base URL if not provided', () => {
      expect(patAuth.baseUrl).toBe('https://dev.azure.com/test-org')
    })
    it('should use custom base URL if provided', () => {
      const configWithBaseUrl = {
        ...config,
        baseUrl: 'https://custom.azure.com/test-org',
      }
      const authWithBaseUrl = new PATAuth(configWithBaseUrl)
      expect(authWithBaseUrl.baseUrl).toBe('https://custom.azure.com/test-org')
    })
  })
  describe('getAuthHeaders', () => {
    it('should return correct authorization header with base64 encoded PAT', () => {
      const headers = patAuth.getAuthHeaders()
      expect(headers).toHaveProperty('Authorization')
      expect(headers.Authorization).toBe(
        'Basic ' +
          Buffer.from(':test-personal-access-token').toString('base64'),
      )
    })
    it('should include content-type header', () => {
      const headers = patAuth.getAuthHeaders()
      expect(headers).toHaveProperty('Content-Type')
      expect(headers['Content-Type']).toBe('application/json')
    })
    it('should include accept header', () => {
      const headers = patAuth.getAuthHeaders()
      expect(headers).toHaveProperty('Accept')
      expect(headers.Accept).toBe('application/json')
    })
    it('should include user-agent header', () => {
      const headers = patAuth.getAuthHeaders()
      expect(headers).toHaveProperty('User-Agent')
      expect(headers['User-Agent']).toBe('azure-devops-client/1.0.0')
    })
  })
  describe('buildUrl', () => {
    it('should build correct API URL for work items', () => {
      const url = patAuth.buildUrl('/_apis/wit/workitems')
      expect(url).toBe(
        'https://dev.azure.com/test-org/test-project/_apis/wit/workitems?api-version=7.1-preview.3',
      )
    })
    it('should build correct API URL with query parameters', () => {
      const url = patAuth.buildUrl('/_apis/wit/workitems', {
        $expand: 'all',
        ids: '1,2,3',
      })
      expect(url).toBe(
        'https://dev.azure.com/test-org/test-project/_apis/wit/workitems?$expand=all&ids=1%2C2%2C3&api-version=7.1-preview.3',
      )
    })
    it('should handle empty query parameters', () => {
      const url = patAuth.buildUrl('/_apis/wit/workitems', {})
      expect(url).toBe(
        'https://dev.azure.com/test-org/test-project/_apis/wit/workitems?api-version=7.1-preview.3',
      )
    })
    it('should handle undefined query parameters', () => {
      const url = patAuth.buildUrl('/_apis/wit/workitems')
      expect(url).toBe(
        'https://dev.azure.com/test-org/test-project/_apis/wit/workitems?api-version=7.1-preview.3',
      )
    })
    it('should encode special characters in query values', () => {
      const url = patAuth.buildUrl('/_apis/wit/workitems', {
        query:
          'SELECT * FROM WorkItems WHERE [System.Title] CONTAINS "test & example"',
      })
      expect(url).toContain('test%20%26%20example')
    })
  })
  describe('validateConfig', () => {
    it('should not throw for valid config', () => {
      expect(() => PATAuth.validateConfig(config)).not.toThrow()
    })
    it('should throw for missing PAT', () => {
      const invalidConfig = { ...config, pat: '' }
      expect(() => PATAuth.validateConfig(invalidConfig)).toThrow(
        'Personal Access Token is required',
      )
    })
    it('should throw for missing organization', () => {
      const invalidConfig = { ...config, organization: '' }
      expect(() => PATAuth.validateConfig(invalidConfig)).toThrow(
        'Organization is required',
      )
    })
    it('should throw for missing project', () => {
      const invalidConfig = { ...config, project: '' }
      expect(() => PATAuth.validateConfig(invalidConfig)).toThrow(
        'Project is required',
      )
    })
    it('should throw for whitespace-only PAT', () => {
      const invalidConfig = { ...config, pat: '   ' }
      expect(() => PATAuth.validateConfig(invalidConfig)).toThrow(
        'Personal Access Token is required',
      )
    })
    it('should throw for whitespace-only organization', () => {
      const invalidConfig = { ...config, organization: '   ' }
      expect(() => PATAuth.validateConfig(invalidConfig)).toThrow(
        'Organization is required',
      )
    })
    it('should throw for whitespace-only project', () => {
      const invalidConfig = { ...config, project: '   ' }
      expect(() => PATAuth.validateConfig(invalidConfig)).toThrow(
        'Project is required',
      )
    })
  })
  describe('isValidPATFormat', () => {
    it('should return true for valid PAT formats', () => {
      const validPats = [
        'abcd1234567890abcd1234567890abcd1234567890abcd12', // 52 chars
        'xyz789012345678901234567890123456789012345678901234567890', // 60 chars
      ]
      validPats.forEach((pat) => {
        const testConfig = { ...config, pat }
        expect(() => PATAuth.validateConfig(testConfig)).not.toThrow()
      })
    })
    it('should return false for invalid PAT formats', () => {
      const invalidPats = [
        'short', // too short
        'has spaces in it which is invalid format', // contains spaces
        'has-dashes-which-might-be-invalid', // contains dashes
        '12345', // too short and only numbers
        '', // empty
      ]
      invalidPats.forEach((pat) => {
        const testConfig = { ...config, pat }
        const patAuth = new PATAuth(testConfig)
        expect(patAuth.isValidPATFormat()).toBe(false)
      })
    })
  })
})
//# sourceMappingURL=pat-auth.test.js.map
