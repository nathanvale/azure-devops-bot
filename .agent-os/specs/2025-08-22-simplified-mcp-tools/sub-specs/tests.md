# Tests Specification

This is the tests coverage details for the spec detailed in @.agent-os/specs/2025-08-22-simplified-mcp-tools/spec.md

> Created: 2025-08-22
> Version: 1.0.0

## Test Coverage

### Unit Tests

**MCP Tools**

- Each tool validates input parameters correctly
- Each tool returns proper JSON structure
- Each tool handles database errors gracefully
- Each tool respects authentication requirements

**Database Operations**

- Comment table CRUD operations work correctly
- Work item queries with new indexes perform within targets
- Batch operations handle empty results and partial failures
- Foreign key constraints prevent orphaned comments

### Integration Tests

**MCP Server Protocol**

- All 8 new tools are properly registered and callable
- Tool responses conform to MCP protocol standards
- Error responses follow MCP error handling conventions
- Legacy tools are removed and no longer accessible

**Azure CLI Integration**

- Comment creation calls correct Azure CLI commands
- Work item linking executes proper az boards commands
- Authentication failures are handled with proper error messages
- Rate limiting triggers appropriate backoff behavior

**End-to-End Workflows**

- Complete work item retrieval with comments
- Batch work item fetching returns consistent results
- Force sync updates local database correctly
- Comment addition syncs back to local storage

### Performance Tests

**Query Performance**

- Single work item lookup completes under 1ms
- User work items query completes under 50ms
- Batch queries handle 100 IDs under 10ms
- Iteration queries complete under 25ms
- Comment queries complete under 5ms

**Load Testing**

- Concurrent MCP tool calls don't cause race conditions
- Memory usage remains stable under sustained load
- Database connections are properly managed and released

### Mocking Requirements

**Azure CLI Commands**

- Mock `az boards work-item comment add` for comment creation
- Mock `az boards work-item relation add` for pull request linking
- Mock command failures and authentication errors
- Mock rate limiting scenarios with delayed responses

**Database Operations**

- Use in-memory SQLite for test isolation
- Mock Prisma client for error simulation
- Mock network timeouts and connection failures

**MCP Protocol**

- Mock stdio transport for integration tests
- Mock client requests and validate server responses
- Test malformed requests and error recovery

## Test Data Requirements

### Sample Work Items

```typescript
const sampleWorkItems = [
  {
    id: 1001,
    title: 'User authentication bug',
    state: 'Active',
    assignedTo: 'dev@example.com',
  },
  {
    id: 1002,
    title: 'Dashboard performance',
    state: 'Resolved',
    assignedTo: 'lead@example.com',
  },
  { id: 1003, title: 'New feature request', state: 'New', assignedTo: null },
]
```

### Sample Comments

```typescript
const sampleComments = [
  {
    id: 'comment-1',
    workItemId: 1001,
    text: 'Investigating root cause',
    author: 'dev@example.com',
  },
  {
    id: 'comment-2',
    workItemId: 1001,
    text: 'Fixed in PR #123',
    author: 'dev@example.com',
  },
]
```

### Sample Iterations

```typescript
const sampleIterations = [
  'Customer Services Platform\\Sprint 1',
  'Customer Services Platform\\Sprint 2\\Week 1',
]
```

## Error Scenarios to Test

### Authentication Errors

- Azure CLI not logged in
- Azure CLI token expired
- Insufficient permissions for work item access

### Database Errors

- SQLite database locked
- Disk space exhaustion
- Corrupted database file
- Foreign key constraint violations

### Azure DevOps API Errors

- Work item not found
- Comment text too long
- Invalid iteration path
- Pull request URL malformed
- Rate limiting exceeded

### Input Validation Errors

- Invalid work item IDs (negative, non-integer)
- Empty required parameters
- Array parameters with invalid elements
- String parameters exceeding length limits

## Test Organization

```
src/services/__tests__/
├── mcp-tools.test.ts          # All 8 MCP tool functions
├── mcp-server-integration.test.ts  # Full MCP protocol integration
├── database-comments.test.ts   # Comment table operations
├── performance.test.ts        # Query performance validation
└── error-handling.test.ts     # Comprehensive error scenarios

tests/integration/
├── simplified-mcp-tools.test.ts   # End-to-end tool testing
└── azure-cli-integration.test.ts  # Real Azure CLI command testing
```

## Success Criteria

- **Code Coverage**: > 80% for new MCP tools and database operations
- **Performance Tests**: All query time targets met consistently
- **Integration Tests**: All 8 tools pass MCP protocol validation
- **Error Handling**: All error scenarios return proper error responses
- **Regression Tests**: Existing functionality remains unaffected
