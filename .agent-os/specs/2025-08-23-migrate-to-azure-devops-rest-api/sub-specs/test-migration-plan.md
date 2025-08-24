# Test Migration Plan

This is the comprehensive test migration strategy for migrating from Azure CLI mocks to REST API mocks in the spec detailed in @.agent-os/specs/2025-08-23-migrate-to-azure-devops-rest-api/spec.md

> Created: 2025-08-23
> Version: 1.0.0
> Status: Critical - 114 Tests Failing

## Problem Statement

The Azure DevOps REST API migration implementation is complete and technically reviewed, but **114 out of 338 tests are failing** because the test suite still uses Azure CLI mocking patterns while the production code now uses REST API calls.

**Current Test Failure Rate: 33.7%**

### Root Cause Analysis

1. **Missing Environment Variable (80% of failures)**
   - Error: "AZURE_DEVOPS_PAT environment variable is required"
   - Files affected: All test files instantiating AzureDevOpsClient
   - Impact: Tests fail immediately on client initialization

2. **Mock Strategy Mismatch (15% of failures)**
   - Old approach: Mock `child_process.exec` for Azure CLI subprocess calls
   - New reality: Code uses HTTP client with REST provider
   - Impact: Mocks don't intercept actual API calls

3. **Import Path Issues (5% of failures)**
   - New package structure exports not resolving correctly
   - Type definitions not properly imported
   - Impact: TypeScript compilation errors in tests

## Migration Strategy

### Phase 1: Environment Setup & Basic Mocking

#### 1.1 Test Environment Configuration

```typescript
// Add to vitest.setup.ts or test files
beforeEach(() => {
  // Set required environment variable
  process.env.AZURE_DEVOPS_PAT = 'test-token-123'
  process.env.AZURE_DEVOPS_ORG = 'fwcdev'
  process.env.AZURE_DEVOPS_PROJECT = 'Customer Services Platform'

  vi.clearAllMocks()
})
```

#### 1.2 Provider Mock Setup

```typescript
// Mock the entire package
vi.mock('../packages/azure-devops-client/dist/index.js', () => ({
  AzureDevOpsProvider: vi.fn().mockImplementation(() => mockProvider),
  AzureDevOpsRestClient: vi.fn(),
  // Other exports as needed
}))

// Create consistent mock provider
const mockProvider = {
  queryWorkItems: vi.fn(),
  getWorkItem: vi.fn(),
  getWorkItemsBatch: vi.fn(),
  getWorkItemComments: vi.fn(),
  addComment: vi.fn(),
  linkToPullRequest: vi.fn(),
  getProviderInfo: vi.fn().mockReturnValue({
    name: 'Azure DevOps REST Provider',
    version: '1.0.0',
    capabilities: ['batch', 'comments', 'links'],
  }),
}
```

### Phase 2: Test Category-Specific Migration

#### 2.1 Unit Tests (azure-devops.test.ts)

**Old Pattern (CLI-based):**

```typescript
mockExecAsync.mockResolvedValue({
  stdout: JSON.stringify(mockAzureResponse),
})

const result = await client.fetchWorkItems()
expect(mockExecAsync).toHaveBeenCalledWith(expectedCliCommand)
```

**New Pattern (REST-based):**

```typescript
const mockWorkItems = [
  /* work item data */
]
mockProvider.queryWorkItems.mockResolvedValue(mockWorkItems)

const result = await client.fetchWorkItems()
expect(mockProvider.queryWorkItems).toHaveBeenCalledWith({
  filters: { type: ['User Story', 'Product Backlog Item', 'Bug', 'Task'] },
  orderBy: 'changedDate',
  orderDirection: 'desc',
})
```

#### 2.2 Integration Tests (azure-devops-rest-integration.test.ts)

**MSW Handler Setup:**

```typescript
import { rest } from 'msw'
import { setupServer } from 'msw/node'

const server = setupServer(
  rest.post('https://dev.azure.com/fwcdev/_apis/wit/wiql', (req, res, ctx) => {
    return res(ctx.json({ workItems: [{ id: 1234, url: '...' }] }))
  }),

  rest.post(
    'https://dev.azure.com/fwcdev/_apis/wit/workitemsbatch',
    (req, res, ctx) => {
      return res(
        ctx.json({
          value: [
            /* batch work item data */
          ],
          count: 200,
        }),
      )
    },
  ),
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

#### 2.3 Performance Tests (batch-performance.test.ts)

**Fix Race Conditions:**

```typescript
// Old approach had timing issues with subprocess mocks
// New approach: Use MSW with proper request/response patterns

const batchHandler = rest.post('*/workitemsbatch', async (req, res, ctx) => {
  const body = await req.json()
  const ids = body.ids || []

  // Simulate batch processing time
  await new Promise((resolve) => setTimeout(resolve, 100))

  return res(
    ctx.json({
      value: ids.map((id) => ({ id, fields: mockFields })),
    }),
  )
})
```

#### 2.4 MCP Integration Tests (azure-devops-server.test.ts)

**Full Stack Testing:**

```typescript
// Keep integration approach but fix provider initialization
const client = new AzureDevOpsClient() // Now uses REST provider
const server = new McpServer(client)

// Mock the provider methods instead of CLI calls
mockProvider.queryWorkItems.mockResolvedValue(expectedWorkItems)

const response = await server.handleRequest({
  method: 'tools/call',
  params: { name: 'wit_my_work_items', arguments: {} },
})
```

### Phase 3: Import Path Resolution

#### 3.1 Package Export Issues

```typescript
// Problematic import (may not resolve correctly)
import {
  WorkItemData,
  CommentData,
} from '../packages/azure-devops-client/dist/index.js'

// Better approach - import from source during tests
import {
  WorkItemData,
  CommentData,
} from '../packages/azure-devops-client/src/types/work-items.js'

// Or mock the types entirely
interface TestWorkItemData {
  id: number
  title: string
  // ... other required fields
}
```

#### 3.2 Type Definition Fixes

```typescript
// Create test-specific type definitions if needed
declare module '../packages/azure-devops-client/dist/index.js' {
  export interface WorkItemData {
    id: number
    title: string
    state: string
    // ... other fields
  }

  export interface AzureDevOpsClientConfig {
    organization: string
    project: string
    pat: string
    // ... other config
  }
}
```

## WallabyJS Integration Strategy

### Real-Time Test Debugging

```typescript
// Use WallabyJS runtime values to inspect transformations
export function debugTransformation(data: any) {
  console.log('WallabyJS Debug:', data) // Will show in Wallaby output
  return data
}

// Monitor mock calls in real-time
mockProvider.queryWorkItems.mockImplementation((query) => {
  console.log('Query called with:', query) // Visible in Wallaby
  return Promise.resolve(mockWorkItems)
})
```

### Coverage Validation

- Use WallabyJS to ensure critical paths remain covered
- Verify data transformation logic is properly tested
- Monitor test execution times for performance regressions

## Test File Migration Priority

### High Priority (Blocking Production)

1. **src/services/**tests**/azure-devops.test.ts** - Core client functionality
2. **src/services/**tests**/azure-devops-rest-integration.test.ts** - Integration layer
3. **tests/integration/azure-devops-server.test.ts** - MCP server integration

### Medium Priority

4. **src/services/**tests**/field-discovery.test.ts** - Data discovery features
5. **src/services/**tests**/batch-performance.test.ts** - Performance validation

### Low Priority (Non-blocking)

6. Other test files with minimal dependencies on Azure DevOps client

## Success Criteria

### Test Execution Metrics

- **Target**: 0 failing tests (currently 114 failing)
- **Requirement**: All 338 tests must pass
- **Performance**: Test suite should complete in under 30 seconds

### Coverage Requirements (per DEC-005)

- **Focus**: Critical paths only (data fetching, storage, MCP protocol)
- **Approach**: Light coverage, not comprehensive
- **Tools**: Use WallabyJS for real-time feedback

### Integration Validation

- All MCP tools work with new REST provider
- Data transformations preserve existing formats
- Performance improvements maintained in test scenarios

## Risk Mitigation

### Potential Issues

1. **Mock Data Format Mismatches**: REST API responses differ from CLI output
2. **Timing Issues**: Async patterns may differ between CLI and HTTP calls
3. **Error Handling**: Different error types between subprocess and HTTP failures

### Mitigation Strategies

1. **Use Real API Responses**: Base mocks on actual Azure DevOps REST API responses
2. **Preserve Data Contracts**: Ensure transformed data matches existing interfaces
3. **Test Error Scenarios**: Mock various HTTP error conditions (401, 429, 500)

## Implementation Timeline

### Phase 1 (Day 1): Environment & Basic Mocks

- Set up environment variables in test configuration
- Create basic provider mock structure
- Fix 80% of failures (environment variable issues)

### Phase 2 (Day 1-2): Core Test Migration

- Migrate high-priority test files (azure-devops.test.ts, integration tests)
- Update MSW handlers for REST endpoints
- Fix remaining mock strategy mismatches

### Phase 3 (Day 2): Cleanup & Validation

- Fix import path issues
- Run full test suite with WallabyJS
- Validate performance and coverage requirements

**Total Estimated Time: 1-2 days**

## Post-Migration Validation

### Checklist

- [ ] All 338 tests pass in WallabyJS
- [ ] Test suite completes in under 30 seconds
- [ ] Coverage maintained on critical paths
- [ ] Integration tests work with real-like data
- [ ] Performance tests validate 30x improvement
- [ ] Error handling scenarios properly tested

### Continuous Integration

- Update CI/CD pipeline to set AZURE_DEVOPS_PAT in test environment
- Ensure test artifacts are properly generated
- Monitor test execution times for regressions

---

_This test migration plan ensures the Azure DevOps REST API implementation can be safely deployed to production with full test coverage and validation._
