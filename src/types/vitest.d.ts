// Vitest global type declarations

import type { WorkItem, WorkItemComment } from '@prisma/client'
import type { SetupServer } from 'msw/node'
import type { Mock } from 'vitest'

declare global {
  // Extend globalThis for vitest setup
  namespace globalThis {
    var mockServer: SetupServer
    var testWorkItems: WorkItem[]
    var prismaClient: PrismaMock
  }

  // Mock function types for Prisma operations
  interface PrismaMock {
    syncMetadata?: unknown
    mockReset?: () => void
    workItem: {
      findMany: Mock<[], Promise<WorkItem[]>>
      findUnique: Mock<[], Promise<WorkItem | null>>
      findFirst: Mock<[], Promise<WorkItem | null>>
      create: Mock<[], Promise<WorkItem>>
      update: Mock<[], Promise<WorkItem>>
      upsert: Mock<[], Promise<WorkItem>>
    }
    workItemComment: {
      findMany: Mock<[], Promise<WorkItemComment[]>>
      upsert: Mock<[], Promise<WorkItemComment>>
    }
    $disconnect: Mock<[], Promise<void>>
    $transaction: Mock<[], Promise<unknown>>
  }
}

export {}
