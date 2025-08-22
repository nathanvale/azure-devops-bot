import type { PrismaClient } from '@prisma/client'

import { vi } from 'vitest'

// Mock work item data
export const mockWorkItemData = [
  {
    id: 1234,
    azureId: 1234,
    title: 'Implement user authentication',
    state: 'Active',
    type: 'User Story',
    assignedTo: 'nathan.vale@example.com',
    createdDate: new Date('2025-01-01T10:00:00Z'),
    changedDate: new Date('2025-01-08T10:00:00Z'),
    areaPath: 'Customer Services Platform',
    iterationPath: 'Customer Services Platform\\Sprint 1',
    priority: 1,
    severity: '2 - High',
    description:
      'As a user, I want to authenticate so that I can access the system',
    lastSyncDate: new Date(),
  },
  {
    id: 5678,
    azureId: 5678,
    title: 'Setup CI/CD pipeline',
    state: 'Done',
    type: 'Task',
    assignedTo: 'nathan.vale@example.com',
    createdDate: new Date('2024-12-15T10:00:00Z'),
    changedDate: new Date('2025-01-05T10:00:00Z'),
    areaPath: 'Customer Services Platform',
    iterationPath: 'Customer Services Platform\\Sprint 1',
    priority: 2,
    severity: null,
    description: 'Setup automated build and deployment pipeline',
    lastSyncDate: new Date(),
  },
]

// Mock Prisma client instance
export const mockPrismaClient = {
  workItem: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
  workItemComment: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
  syncMetadata: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
  },
  $connect: vi.fn(),
  $disconnect: vi.fn(),
  $executeRaw: vi.fn(),
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
} as unknown as PrismaClient

// Helper function to reset all mocks
export const resetPrismaMocks = () => {
  Object.values(mockPrismaClient.workItem).forEach((mock) => {
    if (vi.isMockFunction(mock)) {
      mock.mockReset()
    }
  })
  Object.values(mockPrismaClient.workItemComment).forEach((mock) => {
    if (vi.isMockFunction(mock)) {
      mock.mockReset()
    }
  })
  Object.values(mockPrismaClient.syncMetadata).forEach((mock) => {
    if (vi.isMockFunction(mock)) {
      mock.mockReset()
    }
  })
  if (vi.isMockFunction(mockPrismaClient.$connect)) {
    mockPrismaClient.$connect.mockReset()
  }
  if (vi.isMockFunction(mockPrismaClient.$disconnect)) {
    mockPrismaClient.$disconnect.mockReset()
  }
  if (vi.isMockFunction(mockPrismaClient.$transaction)) {
    mockPrismaClient.$transaction.mockReset()
  }
}

// Setup default mock implementations
export const setupPrismaDefaults = () => {
  // Default implementations for common operations
  mockPrismaClient.workItem.findMany.mockResolvedValue(mockWorkItemData)
  mockPrismaClient.workItem.findUnique.mockImplementation(({ where }) => {
    const item = mockWorkItemData.find(
      (item) => item.id === where.id || item.azureId === where.azureId,
    )
    return Promise.resolve(item || null)
  })
  mockPrismaClient.workItem.create.mockImplementation(({ data }) => {
    const newItem = {
      id: Math.floor(Math.random() * 10000),
      ...data,
    }
    return Promise.resolve(newItem)
  })
  mockPrismaClient.workItem.update.mockImplementation(({ data, where }) => {
    const existingItem = mockWorkItemData.find(
      (item) => item.id === where.id || item.azureId === where.azureId,
    )
    if (!existingItem) {
      throw new Error('Record not found')
    }
    const updatedItem = { ...existingItem, ...data }
    return Promise.resolve(updatedItem)
  })
  mockPrismaClient.workItem.upsert.mockImplementation(
    ({ create, update, where }) => {
      const existingItem = mockWorkItemData.find(
        (item) => item.id === where.id || item.azureId === where.azureId,
      )
      if (existingItem) {
        const updatedItem = { ...existingItem, ...update }
        return Promise.resolve(updatedItem)
      } else {
        const newItem = {
          id: Math.floor(Math.random() * 10000),
          ...create,
        }
        return Promise.resolve(newItem)
      }
    },
  )
  mockPrismaClient.$connect.mockResolvedValue(undefined)
  mockPrismaClient.$disconnect.mockResolvedValue(undefined)
  mockPrismaClient.$transaction.mockImplementation(async (operations) => {
    // For normal operation, execute all operations and return array of results
    if (Array.isArray(operations)) {
      return await Promise.all(operations)
    } else {
      // Handle function-based transactions
      return await operations(mockPrismaClient)
    }
  })
}

// Mock the @prisma/client module
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => mockPrismaClient),
}))
