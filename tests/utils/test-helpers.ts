import type { WorkItem as PrismaWorkItem } from '@prisma/client'

import { vi } from 'vitest'

import type { WorkItemData } from '../../src/services/azure-devops'

// Types for test data
export interface TestWorkItem {
  id: number
  azureId: number
  title: string
  state: string
  type: string
  assignedTo: string
  createdDate: Date
  changedDate: Date
  areaPath: string
  iterationPath: string
  priority: number
  severity?: string | null
  description: string
  lastSyncDate: Date
}

export interface AzureWorkItem {
  id: number
  rev: number
  fields: {
    'System.Id': number
    'System.Title': string
    'System.State': string
    'System.WorkItemType': string
    'System.AssignedTo'?: {
      displayName: string
      uniqueName: string
    }
    'System.CreatedDate': string
    'System.ChangedDate': string
    'System.AreaPath': string
    'System.IterationPath': string
    'Microsoft.VSTS.Common.Priority': number
    'Microsoft.VSTS.Common.Severity'?: string
    'System.Description': string
    [key: string]: any
  }
}

// Factory function to create test work items
export function createTestWorkItem(
  overrides: Partial<TestWorkItem> = {},
): TestWorkItem {
  const baseId = Math.floor(Math.random() * 10000) + 1000

  return {
    id: baseId,
    azureId: baseId,
    title: 'Test Work Item',
    state: 'Active',
    type: 'User Story',
    assignedTo: 'Nathan Vale',
    createdDate: new Date('2025-01-01T10:00:00Z'),
    changedDate: new Date('2025-01-08T10:00:00Z'),
    areaPath: 'Customer Services Platform',
    iterationPath: 'Customer Services Platform\\Sprint 1',
    priority: 2,
    severity: null,
    description: 'A test work item for unit testing',
    lastSyncDate: new Date(),
    ...overrides,
  }
}

// Factory function to create Prisma WorkItem objects (for database mocking)
export function createPrismaWorkItem(
  overrides: Partial<PrismaWorkItem> = {},
): PrismaWorkItem {
  const baseId = Math.floor(Math.random() * 10000) + 1000

  return {
    id: baseId,
    title: 'Test Work Item',
    state: 'Active',
    type: 'User Story',
    assignedTo: 'nathan.vale@example.com',
    azureUrl: `https://dev.azure.com/fwcdev/_workitems/edit/${baseId}`,
    description: 'Test description for unit testing',
    iterationPath: 'Customer Services Platform\\Sprint 1',
    areaPath: 'Customer Services Platform',
    boardColumn: '2. Build',
    boardColumnDone: false,
    priority: 2,
    severity: null,
    tags: null,
    createdDate: new Date('2025-01-01T10:00:00Z'),
    changedDate: new Date('2025-01-08T10:00:00Z'),
    closedDate: null,
    resolvedDate: null,
    activatedDate: null,
    stateChangeDate: null,
    createdBy: 'nathan.vale@example.com',
    changedBy: 'nathan.vale@example.com',
    closedBy: null,
    resolvedBy: null,
    storyPoints: null,
    effort: null,
    remainingWork: null,
    completedWork: null,
    originalEstimate: null,
    acceptanceCriteria: null,
    reproSteps: null,
    systemInfo: null,
    parentId: null,
    rev: 1,
    lastUpdatedAt: new Date(),
    lastSyncedAt: new Date(),
    rawJson: JSON.stringify({
      id: baseId,
      fields: {
        'System.Title': 'Test Work Item',
        'System.State': 'Active',
        'System.WorkItemType': 'User Story',
      },
    }),
    ...overrides,
  } as PrismaWorkItem
}

// Factory function to create WorkItemData for database/sync service tests
export function createWorkItemData(
  overrides: Partial<WorkItemData> = {},
): WorkItemData {
  const baseId = Math.floor(Math.random() * 10000) + 1000

  return {
    id: baseId,
    title: 'Test Work Item',
    state: 'Active',
    type: 'User Story',
    assignedTo: 'nathan.vale@example.com',
    lastUpdatedAt: new Date(),
    description: 'Test description for unit testing',
    iterationPath: 'Customer Services Platform\\Sprint 1',
    areaPath: 'Customer Services Platform',
    priority: 2,
    rawJson: JSON.stringify({
      id: baseId,
      fields: {
        'System.Title': 'Test Work Item',
        'System.State': 'Active',
        'System.WorkItemType': 'User Story',
      },
    }),
    ...overrides,
  }
}

// Factory function to create Azure DevOps work item format
export function createAzureWorkItem(
  overrides: Partial<AzureWorkItem> = {},
): AzureWorkItem {
  const baseId = Math.floor(Math.random() * 10000) + 1000

  return {
    id: baseId,
    rev: 1,
    fields: {
      'System.Id': baseId,
      'System.Title': 'Test Work Item',
      'System.State': 'Active',
      'System.WorkItemType': 'User Story',
      'System.AssignedTo': {
        displayName: 'Nathan Vale',
        uniqueName: 'nathan.vale@example.com',
      },
      'System.CreatedDate': '2025-01-01T10:00:00Z',
      'System.ChangedDate': '2025-01-08T10:00:00Z',
      'System.AreaPath': 'Customer Services Platform',
      'System.IterationPath': 'Customer Services Platform\\Sprint 1',
      'Microsoft.VSTS.Common.Priority': 2,
      'System.Description': 'A test work item for unit testing',
    },
    ...overrides,
  }
}

// Factory function to create Azure DevOps API response
export function createWorkItemsResponse(workItems: AzureWorkItem[]) {
  return {
    count: workItems.length,
    value: workItems,
  }
}

// Factory function to create WIQL query response
export function createWiqlResponse(workItems: AzureWorkItem[]) {
  return {
    queryType: 'flat',
    workItems: workItems.map((item) => ({
      id: item.id,
      url: `https://dev.azure.com/fwcdev/Customer%20Services%20Platform/_apis/wit/workItems/${item.id}`,
    })),
  }
}

// Helper to create mock MCP tool response
export function createMCPResponse(text: string, isError = false) {
  return {
    content: [
      {
        type: 'text' as const,
        text: isError ? `Error: ${text}` : text,
      },
    ],
  }
}

// Helper to wait for a condition to be true
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeoutMs = 5000,
  intervalMs = 100,
): Promise<void> {
  const startTime = Date.now()

  while (Date.now() - startTime < timeoutMs) {
    if (await condition()) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }

  throw new Error(`Condition not met within ${timeoutMs}ms`)
}

// Helper to create a delay promise
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Mock timer helpers
export function setupMockTimers() {
  vi.useFakeTimers()
  return {
    advance: (ms: number) => vi.advanceTimersByTime(ms),
    reset: () => vi.useRealTimers(),
  }
}

// Helper to capture console output
export function captureLogs() {
  const logs: string[] = []
  const errors: string[] = []
  const warns: string[] = []

  const logSpy = vi.spyOn(console, 'log').mockImplementation((message) => {
    logs.push(String(message))
  })

  const errorSpy = vi.spyOn(console, 'error').mockImplementation((message) => {
    errors.push(String(message))
  })

  const warnSpy = vi.spyOn(console, 'warn').mockImplementation((message) => {
    warns.push(String(message))
  })

  return {
    logs,
    errors,
    warns,
    restore: () => {
      logSpy.mockRestore()
      errorSpy.mockRestore()
      warnSpy.mockRestore()
    },
  }
}

// Helper to generate random test data
export function generateRandomString(length = 10): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// Helper to create test environment variables
export function setupTestEnv(vars: Record<string, string>) {
  const originalEnv = { ...process.env }

  Object.entries(vars).forEach(([key, value]) => {
    vi.stubEnv(key, value)
  })

  return () => {
    // Restore original environment
    Object.keys(vars).forEach((key) => {
      if (originalEnv[key] !== undefined) {
        process.env[key] = originalEnv[key]
      } else {
        delete process.env[key]
      }
    })
  }
}

// Helper to assert JSON structure
export function expectJsonStructure(actual: any, expected: any): void {
  if (typeof expected === 'object' && expected !== null) {
    if (actual === null || typeof actual !== 'object') {
      throw new Error('Expected object but got ' + typeof actual)
    }

    for (const [key, value] of Object.entries(expected)) {
      if (!(key in actual)) {
        throw new Error(`Expected property ${key} to exist`)
      }
      if (value !== null && typeof value === 'object') {
        expectJsonStructure(actual[key], value)
      } else {
        if (typeof actual[key] !== typeof value) {
          throw new Error(
            `Expected ${key} to be ${typeof value} but got ${typeof actual[key]}`,
          )
        }
      }
    }
  } else {
    if (typeof actual !== typeof expected) {
      throw new Error(`Expected ${typeof expected} but got ${typeof actual}`)
    }
  }
}
