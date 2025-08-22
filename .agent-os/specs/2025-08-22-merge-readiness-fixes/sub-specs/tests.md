# Tests Specification

This is the tests coverage details for the spec detailed in @.agent-os/specs/2025-08-22-merge-readiness-fixes/spec.md

> Created: 2025-08-22
> Version: 1.0.0

## Test Coverage

### Current Test Failures (13 failing tests)

**azure-devops.test.ts Failures:**

- Resilience policy assertion structure mismatch (5 tests)
- Mock implementation not aligned with production code (3 tests)

**database.test.ts Failures:**

- needsCommentSync logic tests expecting incorrect behavior (2 tests)
- Batch operation tests missing (1 test)

**sync-service.test.ts Failures:**

- Parallel processing tests failing due to timing issues (2 tests)

### Required Test Fixes

#### Unit Tests

**AzureDevOpsClient**

- Fix resilience policy test assertions to match actual structure
- Update mock implementations for new database fields
- Add comprehensive error handling tests
- Test batch fetching with concurrency control

```typescript
// Fixed test expectation
expect(mockApplyPolicy).toHaveBeenCalledWith(expect.any(Function), {
  retry: {
    maxAttempts: 3,
    initialDelay: 300,
    maxDelay: 3000,
    backoffStrategy: 'exponential',
    jitterStrategy: 'full-jitter',
  },
  timeout: 10000,
  circuitBreaker: {
    key: 'azure-devops-comments',
    failureThreshold: 3,
    recoveryTime: 30000,
    sampleSize: 5,
    halfOpenPolicy: 'single-probe',
  },
})
```

**DatabaseService**

- Fix needsCommentSync test logic
- Add batch upsert operation tests
- Test new database fields mapping
- Add transaction rollback tests

```typescript
// Fixed needsCommentSync test
it('should return true when work item has comments and changed after last sync', () => {
  const workItemId = 123
  const commentCount = 5
  const changedDate = new Date('2025-01-10T10:00:00Z')
  const lastSyncTime = new Date('2025-01-09T10:00:00Z')

  const result = db.needsCommentSync(
    workItemId,
    commentCount,
    changedDate,
    lastSyncTime,
  )
  expect(result).toBe(true)
})
```

**SyncService**

- Fix parallel processing timing tests
- Add concurrency control tests
- Test error recovery mechanisms
- Add progress reporting tests

#### Integration Tests

**Database Migration Tests**

- Test fresh database initialization
- Test migration rollback scenarios
- Test schema validation after migration
- Test data integrity during migration

**End-to-End Sync Tests**

- Test complete sync workflow
- Test partial failure recovery
- Test Azure CLI timeout handling
- Test large dataset performance

**MCP Protocol Tests**

- Test all MCP tools return valid JSON
- Test error responses are properly formatted
- Test concurrent tool usage
- Test tool parameter validation

### Mocking Requirements

#### Azure CLI Mocking

```typescript
// Mock for successful work item fetch
vi.mock('child_process', () => ({
  exec: vi.fn().mockImplementation((command, options, callback) => {
    if (command.includes('az boards query')) {
      callback(null, {
        stdout: JSON.stringify([{ id: 123 }, { id: 456 }]),
        stderr: '',
      })
    } else if (command.includes('az boards work-item show')) {
      callback(null, {
        stdout: JSON.stringify(mockWorkItemData),
        stderr: '',
      })
    }
  }),
}))
```

#### Resilience Adapter Mocking

```typescript
// Mock resilience adapter to match production structure
const mockApplyPolicy = vi.fn().mockImplementation(async (fn, policy) => {
  return await fn()
})

vi.mock('@orchestr8/resilience', () => ({
  ProductionResilienceAdapter: vi.fn().mockImplementation(() => ({
    applyPolicy: mockApplyPolicy,
  })),
}))
```

#### Database Mocking

```typescript
// Mock Prisma with proper transaction support
const mockPrismaClient = {
  workItem: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    upsert: vi.fn(),
  },
  workItemComment: {
    findMany: vi.fn(),
    upsert: vi.fn(),
  },
  $transaction: vi
    .fn()
    .mockImplementation((operations) =>
      Promise.all(operations.map((op: any) => op)),
    ),
  $disconnect: vi.fn(),
}
```

### Performance Tests

#### Sync Performance Tests

- Test sync of 1000 work items completes under 5 minutes
- Test batch operations are 50% faster than sequential
- Test memory usage remains under 500MB during large sync
- Test concurrent comment fetching doesn't exceed rate limits

#### Database Performance Tests

- Test query response time under 100ms for typical queries
- Test batch insert performance vs sequential
- Test index usage in query execution plans
- Test database file size growth patterns

### Error Scenario Testing

#### Azure CLI Failure Scenarios

```typescript
describe('Azure CLI Error Handling', () => {
  it('should handle authentication timeout', async () => {
    mockExec.mockRejectedValue(new Error('Authentication timeout'))

    await expect(client.fetchWorkItems()).rejects.toThrow(
      'Authentication timeout',
    )
    expect(mockApplyPolicy).toHaveBeenCalledTimes(3) // Retry attempts
  })

  it('should handle rate limiting', async () => {
    mockExec.mockRejectedValue(new Error('Rate limit exceeded'))

    await expect(client.fetchWorkItems()).rejects.toThrow('Rate limit exceeded')
    // Should trigger circuit breaker
  })

  it('should handle malformed JSON response', async () => {
    mockExec.mockResolvedValue({ stdout: 'invalid json', stderr: '' })

    await expect(client.fetchWorkItems()).rejects.toThrow()
  })
})
```

#### Database Error Scenarios

```typescript
describe('Database Error Recovery', () => {
  it('should rollback transaction on partial failure', async () => {
    const workItems = [validWorkItem, invalidWorkItem]
    mockPrisma.workItem.upsert.mockRejectedValueOnce(
      new Error('Constraint violation'),
    )

    await expect(db.syncWorkItems(workItems)).rejects.toThrow()
    expect(mockPrisma.$transaction).toHaveBeenCalled()
    // Transaction should be rolled back
  })

  it('should handle database lock errors', async () => {
    mockPrisma.workItem.upsert.mockRejectedValue(new Error('Database locked'))

    await expect(db.syncWorkItems([workItem])).rejects.toThrow(
      'Database locked',
    )
    // Should implement retry logic
  })
})
```

### Test Automation

#### CI/CD Integration

- All tests must pass before merge
- Test coverage must remain above 80%
- Performance benchmarks must not regress
- Integration tests run on multiple Node.js versions

#### Test Data Management

- Use factory functions for test data creation
- Ensure test isolation with database cleanup
- Mock external services consistently
- Use realistic test data volumes

#### Debugging Support

- Add detailed logging for failing tests
- Include performance metrics in test output
- Provide clear error messages for assertion failures
- Support for running individual test suites

### Validation Criteria

#### Pre-Merge Requirements

1. All 348 tests passing consistently
2. No flaky tests (95% reliability over 10 runs)
3. Test execution time under 60 seconds
4. Code coverage above 80% for critical paths
5. Integration tests validate real Azure CLI behavior

#### Quality Gates

- Zero test timeouts or hanging processes
- All async operations properly awaited
- Mock implementations match production behavior exactly
- Error scenarios comprehensively tested
