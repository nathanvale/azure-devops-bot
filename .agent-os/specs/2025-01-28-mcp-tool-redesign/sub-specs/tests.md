# Tests Specification

This is the tests coverage details for the spec detailed in @.agent-os/specs/2025-01-28-mcp-tool-redesign/spec.md

> Created: 2025-01-28
> Version: 1.0.0

## Test Coverage

### Unit Tests

**Zod Schema Validation**

- Schema validation for all input parameters across domains
- Invalid input rejection with clear error messages
- Optional parameter handling with proper defaults
- Type coercion and transformation testing
- Boundary value testing (min/max limits, edge cases)

**Domain Classes**

- Tool registration and discovery within each domain
- Handler method routing and parameter passing
- Error handling and propagation patterns
- Tool metadata generation (names, descriptions, schemas)

**Tool Registry**

- Domain registration and retrieval
- Tool filtering by enabled domains
- Backward compatibility tool generation
- Tool name collision detection

**Response Validation**

- Output schema validation for all tool responses
- Error response format consistency
- Data transformation and normalization
- Null/undefined value handling

### Integration Tests

**MCP Protocol Integration**

- Tool discovery through ListToolsRequestSchema
- Tool execution through CallToolRequestSchema
- Schema validation integration with MCP framework
- Request/response serialization and deserialization

**Database Integration**

- Cache domain database queries with real SQLite data
- Person relationship resolution and joins
- Work item filtering and pagination
- Comment and relation data retrieval

**Azure DevOps API Integration (WIT Domain)**

- Work item creation with required fields
- Work item updates with partial field changes
- Comment addition and verification
- Pull request linking operations
- API error handling and retry logic

**Cross-Domain Workflows**

- Sync operations followed by cache queries
- Admin health checks with database verification
- Work item creation followed by cache retrieval
- Comment sync integration across domains

### Mocking Requirements

**Azure DevOps REST API**

- Mock work item creation/update responses using MSW
- Mock comment addition API endpoints
- Mock pull request linking API responses
- Mock project information and metadata endpoints
- Simulate API rate limiting and error conditions

**Database Operations (Minimal)**

- Use in-memory SQLite for integration tests per DEC-006
- Mock external dependencies only (file system, network)
- Avoid complex Prisma client mocking in favor of real database operations

**Time-Based Tests**

- Mock Date.now() for consistent timestamp testing
- Mock setTimeout/setInterval for sync scheduling tests
- Control time progression in multi-step integration tests

## Test Organization Structure

```
src/mcp-tools/
├── __tests__/
│   ├── unit/
│   │   ├── schemas/
│   │   │   ├── work-item.test.ts
│   │   │   ├── sync.test.ts
│   │   │   └── admin.test.ts
│   │   ├── domains/
│   │   │   ├── cache-domain.test.ts
│   │   │   ├── sync-domain.test.ts
│   │   │   ├── admin-domain.test.ts
│   │   │   ├── wit-domain.test.ts
│   │   │   └── core-domain.test.ts
│   │   └── registry.test.ts
│   ├── integration/
│   │   ├── mcp-protocol.test.ts
│   │   ├── database-operations.test.ts
│   │   ├── azure-api-integration.test.ts
│   │   └── cross-domain-workflows.test.ts
│   └── fixtures/
│       ├── work-items.json
│       ├── azure-api-responses.json
│       └── database-seed.sql
```

## Specific Test Cases

### Zod Schema Validation Tests

```typescript
// work-item.test.ts
describe('WorkItemIdSchema', () => {
  it('accepts valid work item ID', () => {
    const result = WorkItemIdSchema.parse({ id: 12345 })
    expect(result.id).toBe(12345)
  })

  it('rejects negative work item ID', () => {
    expect(() => WorkItemIdSchema.parse({ id: -1 })).toThrow(
      'Number must be greater than 0',
    )
  })

  it('rejects non-integer work item ID', () => {
    expect(() => WorkItemIdSchema.parse({ id: 12.5 })).toThrow(
      'Expected integer, received float',
    )
  })
})

describe('WorkItemFiltersSchema', () => {
  it('applies default top value when not provided', () => {
    const result = WorkItemFiltersSchema.parse({})
    expect(result.top).toBe(50)
  })

  it('enforces maximum top limit', () => {
    expect(() => WorkItemFiltersSchema.parse({ top: 1000 })).toThrow(
      'Number must be less than or equal to 500',
    )
  })

  it('validates email format for assignee', () => {
    expect(() =>
      WorkItemFiltersSchema.parse({ assignee: 'invalid-email' }),
    ).toThrow('Invalid email')
  })
})
```

### Domain Handler Tests

```typescript
// cache-domain.test.ts
describe('CacheDomain', () => {
  let domain: CacheDomain
  let mockDatabase: jest.Mocked<DatabaseService>

  beforeEach(() => {
    mockDatabase = createMockDatabase()
    domain = new CacheDomain(mockDatabase)
  })

  describe('cache_get_work_item', () => {
    it('retrieves work item by ID with person relations', async () => {
      mockDatabase.getWorkItemById.mockResolvedValue(mockWorkItemWithPerson)

      const result = await domain.handleTool('cache_get_work_item', {
        id: 12345,
      })

      expect(result.item.id).toBe(12345)
      expect(result.item.assignedTo.email).toBe('user@example.com')
    })

    it('throws error for non-existent work item', async () => {
      mockDatabase.getWorkItemById.mockResolvedValue(null)

      await expect(
        domain.handleTool('cache_get_work_item', { id: 99999 }),
      ).rejects.toThrow('Work item 99999 not found in cache')
    })
  })
})
```

### MCP Protocol Integration Tests

```typescript
// mcp-protocol.test.ts
describe('MCP Protocol Integration', () => {
  let server: AzureDevOpsMCPServer

  beforeEach(() => {
    server = new AzureDevOpsMCPServer()
  })

  it('registers all domain tools correctly', async () => {
    const response = await server.handleRequest(ListToolsRequestSchema, {})

    expect(response.tools).toHaveLength(25) // Expected tool count
    expect(response.tools.map((t) => t.name)).toContain('cache_get_work_item')
    expect(response.tools.map((t) => t.name)).toContain('sync_force_work_items')
    expect(response.tools.map((t) => t.name)).toContain('admin_health_check')
  })

  it('validates tool input through MCP call', async () => {
    const response = await server.handleRequest(CallToolRequestSchema, {
      name: 'cache_get_work_item',
      arguments: { id: 'invalid' }, // Should be number
    })

    expect(response.content[0].text).toContain(
      'Expected number, received string',
    )
  })
})
```

### Cross-Domain Workflow Tests

```typescript
// cross-domain-workflows.test.ts
describe('Cross-Domain Workflows', () => {
  let server: AzureDevOpsMCPServer

  it('completes sync-to-cache workflow', async () => {
    // Force sync operation
    await server.handleRequest(CallToolRequestSchema, {
      name: 'sync_force_work_items',
      arguments: { concurrency: 3 },
    })

    // Verify data available in cache
    const cacheResponse = await server.handleRequest(CallToolRequestSchema, {
      name: 'cache_list_work_items',
      arguments: { top: 10 },
    })

    const result = JSON.parse(cacheResponse.content[0].text)
    expect(result.items.length).toBeGreaterThan(0)
    expect(result.items[0]).toHaveProperty('id')
    expect(result.items[0]).toHaveProperty('title')
  })
})
```

## Performance Testing

### Schema Validation Performance

- Measure Zod validation overhead for different input sizes
- Compare performance with current JSON Schema validation
- Test with complex nested objects (work items with relations)
- Validate sub-100ms response time target is maintained

### Domain Loading Performance

- Measure tool registration time across all domains
- Test selective domain loading performance impact
- Verify lazy loading reduces startup time
- Memory usage comparison before/after implementation

## Error Handling Test Cases

### Schema Validation Errors

- Invalid field types with clear error messages
- Missing required fields with field-specific errors
- Out-of-range values with boundary information
- Malformed data structures with parsing errors

### Domain-Specific Errors

- Database connection failures in cache domain
- API authentication errors in WIT domain
- System resource errors in admin domain
- Sync operation failures with retry logic

### MCP Protocol Errors

- Unknown tool name handling
- Malformed request structure handling
- Tool execution timeout scenarios
- Response serialization failures
