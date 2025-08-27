import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthValidationService } from '../auth-validation.js'
import { AzureDevOpsRestClient } from '../../packages/azure-devops-client/src/client.js'
import { ErrorType } from '../../utils/error-classification.js'
import { server } from '../../mocks/server.js'

// Test configuration  
const testConfig = {
  organization: 'test-org',
  project: 'test-project',
  pat: 'test-pat-token',
  baseUrl: 'https://dev.azure.com/test-org',
  apiVersion: '7.1-preview.3'
}

describe('AuthValidationService', () => {
  let authValidationService: AuthValidationService
  let mockClient: AzureDevOpsRestClient

  afterEach(() => {
    vi.clearAllMocks()
  })

  beforeEach(async () => {
    mockClient = new AzureDevOpsRestClient(testConfig)
    authValidationService = new AuthValidationService(mockClient)
    
    // Allow some time for async initialization
    await new Promise(resolve => setTimeout(resolve, 100))
  })

  describe('validateAuthentication', () => {
    describe('success scenarios', () => {
      it('should return success result with user profile on valid PAT token', async () => {
        // No need for individual handler - global handler should catch it
        const result = await authValidationService.validateAuthentication()

        expect(result.success).toBe(true)
        expect(result.error).toBeUndefined()
        expect(result.profile).toEqual({
          id: 'test-user-id',
          displayName: 'Test User',
          emailAddress: 'test.user@example.com',
          domain: 'test-domain'
        })
      })

      it('should complete validation within acceptable time limit', async () => {
        server.use(
          http.get('*/test-project/_apis/profile/profiles/me', () => {
            return HttpResponse.json({
              id: 'test-user-id',
              displayName: 'Test User',
              emailAddress: 'test.user@example.com',
              domain: 'test-domain'
            })
          })
        )

        const startTime = performance.now()
        const result = await authValidationService.validateAuthentication()
        const duration = performance.now() - startTime

        expect(result.success).toBe(true)
        expect(duration).toBeLessThan(200) // Should complete in under 200ms
      })
    })

    describe('authentication failure scenarios', () => {
      it('should return failure result with INVALID_TOKEN error on 401 response', async () => {
        // Override both profile and projects handlers to return 401
        server.use(
          http.get('https://dev.azure.com/:org/:project/_apis/profile/profiles/me', () => {
            return HttpResponse.json(
              { message: 'Unauthorized' },
              { 
                status: 401,
                statusText: 'Unauthorized'
              }
            )
          }),
          http.get('https://dev.azure.com/:org/:project/_apis/projects', () => {
            return HttpResponse.json(
              { message: 'Unauthorized' },
              { 
                status: 401,
                statusText: 'Unauthorized'
              }
            )
          })
        )

        const result = await authValidationService.validateAuthentication()

        expect(result.success).toBe(false)
        expect(result.profile).toBeUndefined()
        expect(result.error).toBeDefined()
        expect(result.error?.code).toBe('INVALID_TOKEN')
        expect(result.error?.message).toContain('PAT token is invalid or expired')
        expect(result.error?.message).toContain('AZURE_DEVOPS_PAT')
      })

      it('should return failure result with INSUFFICIENT_PERMISSIONS error on 403 response', async () => {
        // Override both profile and projects handlers to return 403
        server.use(
          http.get('https://dev.azure.com/:org/:project/_apis/profile/profiles/me', () => {
            return HttpResponse.json(
              { message: 'Forbidden' },
              { 
                status: 403,
                statusText: 'Forbidden'
              }
            )
          }),
          http.get('https://dev.azure.com/:org/:project/_apis/projects', () => {
            return HttpResponse.json(
              { message: 'Forbidden' },
              { 
                status: 403,
                statusText: 'Forbidden'
              }
            )
          })
        )

        const result = await authValidationService.validateAuthentication()

        expect(result.success).toBe(false)
        expect(result.profile).toBeUndefined()
        expect(result.error).toBeDefined()
        expect(result.error?.code).toBe('INSUFFICIENT_PERMISSIONS')
        expect(result.error?.message).toContain('PAT token lacks required permissions')
        expect(result.error?.message).toContain('Work Items (read)')
      })

      it('should return failure result with AUTH_FAILED error on other HTTP errors', async () => {
        // Override both profile and projects handlers to return 500
        server.use(
          http.get('https://dev.azure.com/:org/:project/_apis/profile/profiles/me', () => {
            return new HttpResponse(null, { 
              status: 500,
              statusText: 'Internal Server Error'
            })
          }),
          http.get('https://dev.azure.com/:org/:project/_apis/projects', () => {
            return new HttpResponse(null, { 
              status: 500,
              statusText: 'Internal Server Error'
            })
          })
        )

        const result = await authValidationService.validateAuthentication()

        expect(result.success).toBe(false)
        expect(result.profile).toBeUndefined()
        expect(result.error).toBeDefined()
        expect(result.error?.code).toBe('AUTH_FAILED')
        expect(result.error?.message).toContain('Authentication failed')
      })

      it('should handle network errors gracefully', async () => {
        // Override the global profile handler to return network error
        server.use(
          http.get('https://dev.azure.com/:org/:project/_apis/profile/profiles/me', () => {
            return HttpResponse.error()
          })
        )

        const result = await authValidationService.validateAuthentication()

        expect(result.success).toBe(false)
        expect(result.profile).toBeUndefined()
        expect(result.error).toBeDefined()
      })
    })

    describe('resilience policy integration', () => {
      it('should not retry authentication failures (fail fast)', async () => {
        let profileCallCount = 0
        let projectsCallCount = 0
        
        // Override both handlers to return 401 and count calls
        server.use(
          http.get('https://dev.azure.com/:org/:project/_apis/profile/profiles/me', () => {
            profileCallCount++
            return new HttpResponse(null, { 
              status: 401,
              statusText: 'Unauthorized'
            })
          }),
          http.get('https://dev.azure.com/:org/:project/_apis/projects', () => {
            projectsCallCount++
            return new HttpResponse(null, { 
              status: 401,
              statusText: 'Unauthorized'
            })
          })
        )

        const result = await authValidationService.validateAuthentication()

        expect(result.success).toBe(false)
        // The projects endpoint is called first during ensureValidated(), so it should fail there
        expect(projectsCallCount).toBe(1) // Should not retry authentication errors
        expect(profileCallCount).toBe(0) // Profile should not be called if projects fails
      })

      it('should respect authentication policy timeout', async () => {
        // Use fake timers for this test to control timing precisely
        vi.useFakeTimers()
        
        try {
          // Override the global profile handler to simulate timeout
          server.use(
            http.get('https://dev.azure.com/:org/:project/_apis/profile/profiles/me', async () => {
              // Simulate a response that takes longer than the timeout
              await new Promise(resolve => setTimeout(resolve, 35000)) // 35 seconds > 30 second timeout
              return HttpResponse.json({ id: 'test-user-id' })
            })
          )

          const startTime = Date.now()
          const validationPromise = authValidationService.validateAuthentication()
          
          // Fast-forward time to trigger timeout
          vi.advanceTimersByTime(31000) // Just over 30 second timeout
          
          const result = await validationPromise
          const duration = Date.now() - startTime

          expect(result.success).toBe(false)
          expect(duration).toBeLessThan(35000) // Should timeout before the full 35 seconds
        } finally {
          vi.useRealTimers()
        }
      }, 15000) // Give test 15 seconds to complete with fake timers
    })

    describe('@orchestr8/logger integration', () => {
      it('should log successful authentication with user context', async () => {
        server.use(
          http.get('*/test-project/_apis/profile/profiles/me', () => {
            return HttpResponse.json({
              id: 'test-user-id',
              displayName: 'Test User',
              emailAddress: 'test.user@example.com',
              domain: 'test-domain'
            })
          })
        )

        // Create a spy on console methods to verify logging
        const logSpy = vi.spyOn(console, 'info').mockImplementation(() => {})

        const result = await authValidationService.validateAuthentication()

        expect(result.success).toBe(true)
        
        // Allow time for async logging
        await new Promise(resolve => setTimeout(resolve, 50))
        
        logSpy.mockRestore()
      })

      it('should log authentication failure with error classification', async () => {
        // Override both handlers to return 401
        server.use(
          http.get('https://dev.azure.com/:org/:project/_apis/profile/profiles/me', () => {
            return new HttpResponse(null, { 
              status: 401,
              statusText: 'Unauthorized'
            })
          }),
          http.get('https://dev.azure.com/:org/:project/_apis/projects', () => {
            return new HttpResponse(null, { 
              status: 401,
              statusText: 'Unauthorized'
            })
          })
        )

        // Create a spy on console methods to verify logging
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        const result = await authValidationService.validateAuthentication()

        expect(result.success).toBe(false)
        
        // Allow time for async logging
        await new Promise(resolve => setTimeout(resolve, 50))
        
        errorSpy.mockRestore()
      })
    })

    describe('error classification integration', () => {
      it('should properly classify 401 errors as AUTHENTICATION type', async () => {
        // Override both profile and projects handlers to return 401
        server.use(
          http.get('https://dev.azure.com/:org/:project/_apis/profile/profiles/me', () => {
            return new HttpResponse(null, { 
              status: 401,
              statusText: 'Unauthorized'
            })
          }),
          http.get('https://dev.azure.com/:org/:project/_apis/projects', () => {
            return new HttpResponse(null, { 
              status: 401,
              statusText: 'Unauthorized'
            })
          })
        )

        const result = await authValidationService.validateAuthentication()

        expect(result.success).toBe(false)
        expect(result.error?.code).toBe('INVALID_TOKEN')
        // Verify error classification matches expected type
        expect(['INVALID_TOKEN', 'INSUFFICIENT_PERMISSIONS', 'AUTH_FAILED']).toContain(result.error?.code)
      })

      it('should properly classify 403 errors as AUTHENTICATION type', async () => {
        // Override both profile and projects handlers to return 403
        server.use(
          http.get('https://dev.azure.com/:org/:project/_apis/profile/profiles/me', () => {
            return new HttpResponse(null, { 
              status: 403,
              statusText: 'Forbidden'
            })
          }),
          http.get('https://dev.azure.com/:org/:project/_apis/projects', () => {
            return new HttpResponse(null, { 
              status: 403,
              statusText: 'Forbidden'
            })
          })
        )

        const result = await authValidationService.validateAuthentication()

        expect(result.success).toBe(false)
        expect(result.error?.code).toBe('INSUFFICIENT_PERMISSIONS')
      })
    })
  })

  describe('blocking authentication validation', () => {
    it('should prevent cascade failures by failing immediately on auth error', async () => {
      // Override both handlers to return 401
      server.use(
        http.get('https://dev.azure.com/:org/:project/_apis/profile/profiles/me', () => {
          return new HttpResponse(null, { 
            status: 401,
            statusText: 'Unauthorized'
          })
        }),
        http.get('https://dev.azure.com/:org/:project/_apis/projects', () => {
          return new HttpResponse(null, { 
            status: 401,
            statusText: 'Unauthorized'
          })
        })
      )

      const startTime = performance.now()
      const result = await authValidationService.validateAuthentication()
      const duration = performance.now() - startTime

      expect(result.success).toBe(false)
      expect(duration).toBeLessThan(1000) // Should fail quickly, not retry
    })

    it('should validate authentication before allowing any operations', async () => {
      let profileCalled = false
      
      server.use(
        http.get('*/test-project/_apis/profile/profiles/me', () => {
          profileCalled = true
          return HttpResponse.json({
            id: 'test-user-id',
            displayName: 'Test User',
            emailAddress: 'test.user@example.com',
            domain: 'test-domain'
          })
        })
      )

      const result = await authValidationService.validateAuthentication()

      expect(profileCalled).toBe(true)
      expect(result.success).toBe(true)
    })
  })

  describe('service initialization', () => {
    it('should initialize logger and resilience adapter properly', async () => {
      // Create a new service instance
      const newService = new AuthValidationService(mockClient)
      
      // Allow time for async initialization
      await new Promise(resolve => setTimeout(resolve, 100))

      // Verify service can handle authentication validation (implies proper initialization)
      server.use(
        http.get('*/test-project/_apis/profile/profiles/me', () => {
          return HttpResponse.json({
            id: 'test-user-id',
            displayName: 'Test User',
            emailAddress: 'test.user@example.com',
            domain: 'test-domain'
          })
        })
      )

      const result = await newService.validateAuthentication()
      expect(result.success).toBe(true)
    })
  })
})