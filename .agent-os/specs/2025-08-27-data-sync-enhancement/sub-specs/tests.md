# Tests Specification

This is the tests coverage details for the spec detailed in @.agent-os/specs/2025-08-27-data-sync-enhancement/spec.md

> Created: 2025-08-27
> Version: 1.0.0

## Test Coverage Approach

Light smoke tests only - no full TDD. Focus on critical paths and basic functionality verification.

## Smoke Tests

### Comment Sync Verification

**File:** `src/services/__tests__/comment-sync-smoke.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SyncService } from '../sync-service'
import { DatabaseService } from '../database'
import { PrismaClient } from '@prisma/client'

describe('Comment Sync Smoke Tests', () => {
  let syncService: SyncService
  let prisma: PrismaClient
  
  beforeEach(async () => {
    prisma = new PrismaClient()
    await prisma.$connect()
    syncService = new SyncService()
  })
  
  it('should populate comments table when work item has comments', async () => {
    // Setup: Clear comments table
    await prisma.workItemComment.deleteMany()
    
    // Create a work item with known comment count
    await prisma.workItem.create({
      data: {
        id: 999,
        title: 'Test Work Item',
        state: 'Active',
        type: 'Task',
        assignedTo: 'test@example.com',
        lastUpdatedAt: new Date(),
        azureUrl: 'https://test.url',
        commentCount: 3,
        rawJson: JSON.stringify({ id: 999 })
      }
    })
    
    // Run sync (mocked to return test comments)
    vi.spyOn(syncService['client'], 'fetchWorkItemComments')
      .mockResolvedValue([
        {
          id: '1',
          workItemId: 999,
          text: 'Test comment 1',
          createdBy: 'user1@test.com',
          createdDate: new Date(),
          modifiedBy: null,
          modifiedDate: null
        },
        {
          id: '2',
          workItemId: 999,
          text: 'Test comment 2',
          createdBy: 'user2@test.com',
          createdDate: new Date(),
          modifiedBy: null,
          modifiedDate: null
        }
      ])
    
    // Execute sync for single work item
    await syncService['syncSingleWorkItemComments']({ 
      id: 999, 
      commentCount: 2 
    } as any)
    
    // Verify comments were stored
    const storedComments = await prisma.workItemComment.findMany({
      where: { workItemId: 999 }
    })
    
    expect(storedComments).toHaveLength(2)
    expect(storedComments[0].text).toBe('Test comment 1')
    expect(storedComments[1].text).toBe('Test comment 2')
  })
  
  it('should handle empty comments gracefully', async () => {
    const workItem = { id: 1000, commentCount: 0 }
    
    vi.spyOn(syncService['client'], 'fetchWorkItemComments')
      .mockResolvedValue([])
    
    // Should not throw
    await expect(
      syncService['syncSingleWorkItemComments'](workItem as any)
    ).resolves.toBe(0)
  })
})
```

### Field Extraction Smoke Test

**File:** `src/services/__tests__/field-extraction-smoke.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { AzureDevOpsClient } from '../azure-devops'

describe('Field Extraction Smoke Tests', () => {
  let client: AzureDevOpsClient
  
  beforeEach(() => {
    process.env.AZURE_DEVOPS_PAT = 'test-token'
    client = new AzureDevOpsClient()
  })
  
  it('should extract all standard fields from raw JSON', () => {
    const mockRawWorkItem = {
      id: 123,
      rev: 5,
      fields: {
        'System.Title': 'Test Item',
        'System.State': 'Active',
        'System.WorkItemType': 'Bug',
        'System.AssignedTo': { displayName: 'John Doe' },
        'System.CreatedDate': '2025-01-01T00:00:00Z',
        'System.ChangedDate': '2025-01-02T00:00:00Z',
        'System.IterationPath': 'Sprint 15',
        'System.AreaPath': 'Team A',
        'System.BoardColumn': 'In Progress',
        'System.BoardColumnDone': 'False',
        'Microsoft.VSTS.Common.Priority': 1,
        'Microsoft.VSTS.Scheduling.StoryPoints': 5,
        'Custom.ClientName': 'ACME Corp'
      },
      relations: [
        {
          rel: 'System.LinkTypes.Hierarchy-Reverse',
          url: 'https://dev.azure.com/org/_apis/wit/workItems/100'
        }
      ],
      _links: {
        self: { href: 'https://test.url' }
      }
    }
    
    const result = client['transformRestWorkItem']({
      id: 123,
      raw: mockRawWorkItem
    } as any)
    
    // Verify core fields
    expect(result.id).toBe(123)
    expect(result.title).toBe('Test Item')
    expect(result.state).toBe('Active')
    expect(result.type).toBe('Bug')
    expect(result.assignedTo).toBe('John Doe')
    
    // Verify dates are parsed
    expect(result.createdDate).toBeInstanceOf(Date)
    expect(result.changedDate).toBeInstanceOf(Date)
    
    // Verify sprint info
    expect(result.iterationPath).toBe('Sprint 15')
    expect(result.areaPath).toBe('Team A')
    expect(result.boardColumn).toBe('In Progress')
    expect(result.boardColumnDone).toBe(false)
    
    // Verify parent extraction
    expect(result.parentId).toBe(100)
    
    // Verify raw JSON is preserved
    expect(result.rawJson).toBeDefined()
    const parsed = JSON.parse(result.rawJson)
    expect(parsed.id).toBe(123)
  })
  
  it('should extract custom fields', () => {
    const mockRawWorkItem = {
      id: 124,
      fields: {
        'System.Title': 'Test',
        'Custom.ClientName': 'ACME',
        'OrgSpecific.ProjectCode': 'PROJ-123',
        'CustomField.Priority': 'High'
      }
    }
    
    const customFields = client['extractCustomFields'](mockRawWorkItem.fields)
    
    expect(customFields).toEqual({
      'Custom.ClientName': 'ACME',
      'OrgSpecific.ProjectCode': 'PROJ-123',
      'CustomField.Priority': 'High'
    })
  })
})
```

### Query Methods Smoke Test

**File:** `src/services/__tests__/query-methods-smoke.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { DatabaseService } from '../database'
import { PrismaClient } from '@prisma/client'

describe('Query Methods Smoke Tests', () => {
  let db: DatabaseService
  let prisma: PrismaClient
  
  beforeEach(async () => {
    prisma = new PrismaClient()
    await prisma.$connect()
    db = new DatabaseService()
    
    // Setup test data
    await prisma.workItem.createMany({
      data: [
        {
          id: 1,
          title: 'Item 1',
          state: 'Active',
          type: 'Task',
          assignedTo: 'user1@test.com',
          iterationPath: 'Project\\Sprint 15',
          areaPath: 'Project\\Team A',
          priority: 1,
          lastUpdatedAt: new Date(),
          azureUrl: 'https://test1',
          rawJson: '{}'
        },
        {
          id: 2,
          title: 'Item 2',
          state: 'Done',
          type: 'Bug',
          assignedTo: 'user2@test.com',
          iterationPath: 'Project\\Sprint 15',
          areaPath: 'Project\\Team B',
          priority: 2,
          lastUpdatedAt: new Date(),
          azureUrl: 'https://test2',
          rawJson: '{}'
        },
        {
          id: 3,
          title: 'Item 3',
          state: 'Active',
          type: 'Task',
          assignedTo: 'user1@test.com',
          iterationPath: 'Project\\Sprint 14',
          areaPath: 'Project\\Team A',
          priority: 3,
          lastUpdatedAt: new Date(),
          azureUrl: 'https://test3',
          rawJson: '{}'
        }
      ]
    })
  })
  
  it('should query work items by assignee', async () => {
    const items = await db.getWorkItemsByAssignee('user1@test.com')
    
    expect(items).toHaveLength(2)
    expect(items.every(item => item.assignedTo === 'user1@test.com')).toBe(true)
  })
  
  it('should query work items by assignee and state', async () => {
    const items = await db.getWorkItemsByAssignee('user1@test.com', 'Active')
    
    expect(items).toHaveLength(2)
    expect(items.every(item => 
      item.assignedTo === 'user1@test.com' && item.state === 'Active'
    )).toBe(true)
  })
  
  it('should query current sprint items', async () => {
    const items = await db.getCurrentSprintItems()
    
    expect(items).toHaveLength(2)
    expect(items.every(item => 
      item.iterationPath.includes('Sprint 15')
    )).toBe(true)
  })
  
  it('should query work items by state', async () => {
    const items = await db.getWorkItemsByState('Active')
    
    expect(items).toHaveLength(2)
    expect(items.every(item => item.state === 'Active')).toBe(true)
  })
  
  it('should query team work items', async () => {
    const items = await db.getTeamWorkItems({
      areaPath: 'Project\\Team A',
      includeSubAreas: false
    })
    
    expect(items).toHaveLength(2)
    expect(items.every(item => item.areaPath === 'Project\\Team A')).toBe(true)
  })
})
```

### Relationship Storage Smoke Test

**File:** `src/services/__tests__/relations-smoke.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { DatabaseService } from '../database'
import { PrismaClient } from '@prisma/client'

describe('Relationship Storage Smoke Tests', () => {
  let db: DatabaseService
  let prisma: PrismaClient
  
  beforeEach(async () => {
    prisma = new PrismaClient()
    await prisma.$connect()
    db = new DatabaseService()
    
    // Clear relations
    await prisma.workItemRelation.deleteMany()
  })
  
  it('should store work item relationships', async () => {
    const relations = [
      {
        sourceId: 100,
        targetId: 200,
        relationType: 'System.LinkTypes.Hierarchy-Forward',
        attributes: JSON.stringify({ name: 'Child' })
      },
      {
        sourceId: 100,
        targetId: 300,
        relationType: 'System.LinkTypes.Related',
        attributes: null
      }
    ]
    
    await db.storeWorkItemRelations(relations)
    
    const stored = await prisma.workItemRelation.findMany({
      where: { sourceId: 100 }
    })
    
    expect(stored).toHaveLength(2)
    expect(stored[0].targetId).toBe(200)
    expect(stored[0].relationType).toBe('System.LinkTypes.Hierarchy-Forward')
    expect(stored[1].targetId).toBe(300)
  })
  
  it('should handle duplicate relationships gracefully', async () => {
    const relation = {
      sourceId: 100,
      targetId: 200,
      relationType: 'System.LinkTypes.Hierarchy-Forward',
      attributes: null
    }
    
    // Store twice
    await db.storeWorkItemRelations([relation])
    await db.storeWorkItemRelations([relation])
    
    // Should only have one
    const stored = await prisma.workItemRelation.findMany({
      where: { sourceId: 100 }
    })
    
    expect(stored).toHaveLength(1)
  })
})
```

### MCP Tool Integration Smoke Test

**File:** `src/__tests__/mcp-tools-smoke.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AzureDevOpsMCPServer } from '../mcp-server'

describe('MCP Tools Smoke Tests', () => {
  let server: AzureDevOpsMCPServer
  
  beforeEach(() => {
    process.env.AZURE_DEVOPS_PAT = 'test-token'
    server = new AzureDevOpsMCPServer()
  })
  
  it('should handle wit_get_work_items_by_assignee', async () => {
    vi.spyOn(server['db'], 'getWorkItemsByAssignee')
      .mockResolvedValue([
        { id: 1, title: 'Test', assignedTo: 'user@test.com' } as any
      ])
    
    const result = await server['handleGetWorkItemsByAssignee']({
      email: 'user@test.com',
      state: 'Active'
    })
    
    const content = JSON.parse(result.content[0].text)
    expect(content.assignee).toBe('user@test.com')
    expect(content.count).toBe(1)
    expect(content.workItems).toHaveLength(1)
  })
  
  it('should require email for assignee query', async () => {
    await expect(
      server['handleGetWorkItemsByAssignee']({})
    ).rejects.toThrow('Email address is required')
  })
  
  it('should handle wit_get_current_sprint_items', async () => {
    vi.spyOn(server['db'], 'getCurrentSprintItems')
      .mockResolvedValue([
        { id: 1, iterationPath: 'Sprint 15' } as any,
        { id: 2, iterationPath: 'Sprint 15' } as any
      ])
    
    const result = await server['handleGetCurrentSprintItems']({
      state: 'Active'
    })
    
    const content = JSON.parse(result.content[0].text)
    expect(content.count).toBe(2)
    expect(content.filters.state).toBe('Active')
  })
})
```

## Performance Tests

### Query Performance Smoke Test

```typescript
describe('Query Performance Smoke Tests', () => {
  it('should return queries in under 100ms', async () => {
    const db = new DatabaseService()
    
    // Measure query time
    const startTime = Date.now()
    await db.getWorkItemsByAssignee('test@example.com')
    const duration = Date.now() - startTime
    
    expect(duration).toBeLessThan(100)
  })
  
  it('should handle large result sets efficiently', async () => {
    // Create 1000 test items
    const testData = Array.from({ length: 1000 }, (_, i) => ({
      id: i + 1000,
      title: `Item ${i}`,
      state: i % 2 === 0 ? 'Active' : 'Done',
      type: 'Task',
      assignedTo: `user${i % 10}@test.com`,
      lastUpdatedAt: new Date(),
      azureUrl: `https://test${i}`,
      rawJson: '{}'
    }))
    
    await prisma.workItem.createMany({ data: testData })
    
    const startTime = Date.now()
    const items = await db.getWorkItemsByState('Active')
    const duration = Date.now() - startTime
    
    expect(items).toHaveLength(500)
    expect(duration).toBeLessThan(500) // Should be fast even with 500 results
  })
})
```

## Mocking Requirements

### Azure DevOps API Mocks

Use existing MSW handlers, no new mocks needed:
- Work item batch endpoint already mocked
- Comments endpoint needs mock response
- Relations included in work item response

### Database Mocks

No database mocking - use in-memory SQLite for tests:

```typescript
// Test setup helper
export async function setupTestDatabase() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'file::memory:'
      }
    }
  })
  
  await prisma.$executeRaw`PRAGMA foreign_keys = ON`
  await prisma.$migrate.dev()
  
  return prisma
}
```

## Test Execution

```bash
# Run smoke tests only
pnpm test:smoke

# Run with coverage (minimal)
pnpm test:smoke --coverage

# Run specific smoke test
pnpm test src/services/__tests__/comment-sync-smoke.test.ts
```

## Success Criteria

- [ ] Comments table populates after sync
- [ ] All Azure DevOps fields extracted
- [ ] Query methods return correct results
- [ ] Performance under 100ms for queries
- [ ] Relations stored correctly
- [ ] MCP tools return expected format