import { beforeAll, afterEach, afterAll, vi } from 'vitest'

import { server } from '@/mocks/server'

// Start MSW server before all tests
beforeAll(() => {
  server.listen({
    onUnhandledRequest: 'error',
  })
})

// Clean up after each test
afterEach(() => {
  // Reset MSW handlers to default
  server.resetHandlers()

  // Reset all other mocks
  vi.resetAllMocks()
})

// Clean up after all tests
afterAll(() => {
  server.close()
})

// Mock environment variables for testing
vi.stubEnv('NODE_ENV', 'test')
vi.stubEnv('AZURE_DEVOPS_ORG', 'fwcdev')
vi.stubEnv('AZURE_DEVOPS_PROJECT', 'Customer Services Platform')
vi.stubEnv('AZURE_DEVOPS_PAT', 'test-pat-token-for-integration-testing')

// Global test utilities
global.consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
global.consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
global.consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
