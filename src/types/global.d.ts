// Global type declarations for the Azure DevOps Bot
import type { MockInstance } from 'vitest'

declare global {
  namespace NodeJS {
    interface Global {
      [key: string]: unknown
    }
  }

  // Global URL constructor
  const URL: typeof globalThis.URL

  // Vitest global setup
  var mockServer: unknown
  var testWorkItems: unknown
  var prismaClient: unknown

  // Console spy globals for testing
  var consoleLogSpy: MockInstance
  var consoleErrorSpy: MockInstance
  var consoleWarnSpy: MockInstance
}

export {}
