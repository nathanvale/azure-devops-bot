# MCP Server Testing Plan

## Overview

This testing plan is based on the sophisticated testing architecture from the mnemosynes repository and adapted for MCP (Model Context Protocol) servers. It emphasizes test-first development using Vitest, MSW for API mocking, and Prisma mocking for database operations.

## Testing Architecture

### 1. Vitest Configuration Setup

**`vitest.config.ts`** for both MCP servers:
```typescript
export default defineConfig({
  test: {
    projects: [
      {
        // MCP Server Unit/Integration Tests
        resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
        test: {
          environment: 'node',
          globals: true,
          setupFiles: './tests/vitest.setup.ts',
          include: ['./**/*.test.ts'],
          coverage: {
            reporter: ['text', 'json', 'html'],
            exclude: ['node_modules/', 'dist/', 'tests/'],
          },
        },
      },
      {
        // MCP Integration Tests (with actual MCP protocol)
        test: {
          name: 'mcp-integration',
          environment: 'node',
          setupFiles: './tests/mcp-integration.setup.ts',
          include: ['./tests/integration/**/*.test.ts'],
          timeout: 30000, // Longer timeout for integration tests
        },
      },
    ],
  },
})
```

### 2. Test Structure and Organization

```
src/
├── services/
│   ├── __tests__/           # Service unit tests
│   │   ├── azure-devops.test.ts
│   │   ├── database.test.ts
│   │   └── query-engine.test.ts
├── tools/
│   ├── __tests__/           # Tool handler tests
│   │   ├── work-item-tools.test.ts
│   │   └── git-tools.test.ts
├── utils/
│   └── __tests__/           # Utility tests
│       ├── auth.test.ts
│       └── validators.test.ts
├── mocks/                   # MSW and mock setup
│   ├── handlers/
│   │   ├── azure-devops.handlers.ts
│   │   └── git.handlers.ts
│   ├── server.ts
│   └── prisma.mock.ts
└── tests/
    ├── integration/         # Full MCP integration tests
    │   ├── azure-devops-server.test.ts
    │   └── dev-tools-server.test.ts
    ├── fixtures/            # Test data
    │   ├── work-items.json
    │   └── git-responses.json
    └── utils/               # Test utilities
        ├── mcp-client.ts
        └── test-helpers.ts
```

### 3. MSW Setup for External APIs

**Azure DevOps API Handlers** (`src/mocks/handlers/azure-devops.handlers.ts`):
```typescript
import { http, HttpResponse } from 'msw'

export const workItemsHandler = http.get(
  'https://dev.azure.com/:org/:project/_apis/wit/workitems',
  () => HttpResponse.json({
    count: 2,
    value: [
      {
        id: 1234,
        fields: {
          'System.Title': 'Test User Story',
          'System.State': 'Active',
          'System.AssignedTo': { displayName: 'Nathan Vale' }
        }
      }
    ]
  })
)

export const createWorkItemHandler = http.post(
  'https://dev.azure.com/:org/:project/_apis/wit/workitems/$:type',
  () => HttpResponse.json({
    id: 5678,
    fields: {
      'System.Title': 'New Work Item',
      'System.State': 'New'
    }
  })
)

export const createErrorHandler = (status: number, message: string) =>
  http.get('https://dev.azure.com/*', () =>
    HttpResponse.json({ message }, { status })
  )
```

### 4. Prisma Mock Setup

**Database Mock** (`src/mocks/prisma.mock.ts`):
```typescript
import { vi } from 'vitest'
import { PrismaClient } from '@prisma/client'

export const mockPrismaClient = {
  workItem: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    upsert: vi.fn(),
  },
  $disconnect: vi.fn(),
  $connect: vi.fn(),
} as unknown as PrismaClient

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => mockPrismaClient),
}))
```

### 5. MCP Protocol Testing

**MCP Client Test Utility** (`tests/utils/mcp-client.ts`):
```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { spawn } from 'child_process'

export class TestMCPClient {
  private client: Client
  private transport: StdioClientTransport
  private process: any

  async connect(serverPath: string) {
    this.process = spawn('node', [serverPath])
    this.transport = new StdioClientTransport({
      readable: this.process.stdout,
      writable: this.process.stdin
    })
    
    this.client = new Client({
      name: 'test-client',
      version: '1.0.0'
    }, {
      capabilities: {}
    })
    
    await this.client.connect(this.transport)
  }

  async callTool(name: string, args: any) {
    return await this.client.callTool({ name, arguments: args })
  }

  async listTools() {
    return await this.client.listTools()
  }

  async close() {
    await this.client.close()
    this.process.kill()
  }
}
```

### 6. Test-First Development Patterns

**Example: Work Item Creation Tool (TDD)**

**Step 1: Write the test first** (`src/tools/__tests__/work-item-tools.test.ts`):
```typescript
describe('createWorkItem tool', () => {
  it('should create a new work item with valid data', async () => {
    // Arrange
    const mockCreatedItem = {
      id: 1234,
      fields: {
        'System.Title': 'Test Story',
        'System.State': 'New',
        'System.WorkItemType': 'User Story'
      }
    }
    
    server.use(
      http.post('https://dev.azure.com/fwcdev/Customer%20Services%20Platform/_apis/wit/workitems/$User%20Story', 
        () => HttpResponse.json(mockCreatedItem)
      )
    )

    // Act
    const result = await callTool('create_work_item', {
      title: 'Test Story',
      type: 'User Story',
      description: 'A test user story'
    })

    // Assert
    expect(result.content[0].text).toContain('Work item created successfully')
    expect(result.content[0].text).toContain('ID: 1234')
  })

  it('should handle API errors gracefully', async () => {
    // Arrange
    server.use(
      http.post('https://dev.azure.com/*', 
        () => HttpResponse.json({ message: 'Unauthorized' }, { status: 401 })
      )
    )

    // Act & Assert
    await expect(callTool('create_work_item', {
      title: 'Test Story',
      type: 'User Story'
    })).rejects.toThrow('Unauthorized')
  })
})
```

**Step 2: Implement the tool** (`src/tools/work-item-tools.ts`):
```typescript
// Implementation follows after test is written
export async function createWorkItem(args: CreateWorkItemArgs) {
  // Implementation that makes the test pass
}
```

### 7. Integration Testing Strategy

**Full MCP Server Integration Test** (`tests/integration/azure-devops-server.test.ts`):
```typescript
describe('Azure DevOps MCP Server Integration', () => {
  let client: TestMCPClient

  beforeAll(async () => {
    client = new TestMCPClient()
    await client.connect('./dist/mcp-server.js')
  })

  afterAll(async () => {
    await client.close()
  })

  it('should list all available tools', async () => {
    const tools = await client.listTools()
    
    expect(tools.tools).toHaveLength(4)
    expect(tools.tools.map(t => t.name)).toEqual([
      'get_work_items',
      'query_work',
      'sync_data',
      'get_work_item_url'
    ])
  })

  it('should execute get_work_items tool successfully', async () => {
    server.use(workItemsHandler)
    
    const result = await client.callTool('get_work_items', { filter: 'active' })
    
    expect(result.content).toHaveLength(1)
    expect(result.content[0].type).toBe('text')
    expect(JSON.parse(result.content[0].text)).toHaveLength(2)
  })
})
```

### 8. Database Testing Patterns

**Database Service Testing** (`src/services/__tests__/database.test.ts`):
```typescript
describe('DatabaseService', () => {
  let service: DatabaseService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new DatabaseService()
  })

  it('should fetch work items by state', async () => {
    // Arrange
    const mockWorkItems = [
      { id: 1, title: 'Test Item', state: 'Active' }
    ]
    mockPrismaClient.workItem.findMany.mockResolvedValue(mockWorkItems)

    // Act
    const result = await service.getWorkItemsByState('Active')

    // Assert
    expect(result).toEqual(mockWorkItems)
    expect(mockPrismaClient.workItem.findMany).toHaveBeenCalledWith({
      where: { state: 'Active' }
    })
  })

  it('should handle database errors', async () => {
    // Arrange
    mockPrismaClient.workItem.findMany.mockRejectedValue(
      new Error('Database connection failed')
    )

    // Act & Assert
    await expect(service.getWorkItemsByState('Active'))
      .rejects.toThrow('Database connection failed')
  })
})
```

### 9. Test Data Management

**Test Fixtures** (`tests/fixtures/work-items.json`):
```json
{
  "activeWorkItems": [
    {
      "id": 1234,
      "fields": {
        "System.Title": "Implement user authentication",
        "System.State": "Active",
        "System.WorkItemType": "User Story"
      }
    }
  ],
  "completedWorkItems": [
    {
      "id": 5678,
      "fields": {
        "System.Title": "Setup CI/CD pipeline",
        "System.State": "Done",
        "System.WorkItemType": "Task"
      }
    }
  ]
}
```

**Test Data Factory** (`tests/utils/test-helpers.ts`):
```typescript
export function createWorkItem(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id: Math.floor(Math.random() * 10000),
    title: 'Test Work Item',
    state: 'Active',
    type: 'User Story',
    assignedTo: 'Nathan Vale',
    ...overrides
  }
}

export function createWorkItemResponse(items: WorkItem[]) {
  return {
    count: items.length,
    value: items.map(item => ({
      id: item.id,
      fields: {
        'System.Title': item.title,
        'System.State': item.state,
        'System.WorkItemType': item.type,
        'System.AssignedTo': { displayName: item.assignedTo }
      }
    }))
  }
}
```

### 10. Test-First Development Workflow

**Recommended TDD Cycle for MCP Features:**

1. **Write Integration Test** - Test the MCP tool end-to-end
2. **Write Unit Tests** - Test individual functions/services
3. **Implement Feature** - Write minimal code to pass tests
4. **Refactor** - Improve code while keeping tests green
5. **Add Edge Cases** - Test error conditions and edge cases

**Example Workflow for "Update Work Item" Feature:**

```bash
# 1. Write failing integration test
npm run test -- update-work-item.integration.test.ts

# 2. Write failing unit tests
npm run test -- work-item-tools.test.ts

# 3. Implement feature
# Edit src/tools/work-item-tools.ts

# 4. Run tests until they pass
npm run test

# 5. Refactor and add error handling
# Add more test cases for edge conditions
```

## Package.json Test Scripts

```json
{
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:coverage": "vitest --coverage",
    "test:integration": "vitest --project=mcp-integration",
    "test:unit": "vitest --project=unit",
    "test:ci": "vitest --run --coverage"
  }
}
```

## Dependencies Required

```json
{
  "devDependencies": {
    "vitest": "^1.0.0",
    "@vitest/coverage-v8": "^1.0.0",
    "msw": "^2.0.0",
    "@types/node": "^20.0.0",
    "@modelcontextprotocol/sdk": "^1.15.0"
  }
}
```

## Implementation Priority

### Phase 1: Basic Testing Infrastructure
1. Setup Vitest configuration
2. Create MSW handlers for Azure DevOps API
3. Setup Prisma mocking
4. Create MCP client test utility

### Phase 2: Core Feature Testing
1. Test existing MCP tools
2. Add integration tests for current features
3. Setup test data fixtures
4. Create test helpers and utilities

### Phase 3: TDD for New Features
1. Use TDD approach for work item creation
2. Test-drive Git integration features
3. Add comprehensive error handling tests
4. Performance and load testing

## Best Practices

1. **Test Isolation**: Each test should be independent and repeatable
2. **Mock External Dependencies**: Use MSW for API calls, mock Prisma for database
3. **Test Error Scenarios**: Always test error conditions and edge cases
4. **Descriptive Test Names**: Tests should clearly describe what they verify
5. **Arrange-Act-Assert**: Structure tests with clear sections
6. **Data Factories**: Use factories for consistent test data creation
7. **Integration Tests**: Test the full MCP protocol flow
8. **Coverage Goals**: Aim for 80%+ code coverage on critical paths

---

*Last Updated: $(date)*
*Version: 1.0*