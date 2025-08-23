# Future In-Memory SQLite Testing Implementation

> Created: 2025-08-23
> Purpose: Guidelines for implementing real database testing with in-memory SQLite

## Overview

This document outlines the future implementation strategy for database testing using in-memory SQLite instead of complex database mocking infrastructure.

## Benefits of In-Memory SQLite Testing

### Over Database Mocking

- **Real Database Behavior**: Tests actual Prisma queries and database operations
- **No False Confidence**: Catch real database-related bugs that mocks would miss
- **Simpler Setup**: No complex mock configuration or maintenance
- **True Integration**: Test the full stack from service layer to database

### Performance Characteristics

- **Fast**: In-memory databases are extremely fast for testing
- **Isolated**: Each test gets a fresh database instance
- **Concurrent**: Tests can run in parallel without conflicts

## Implementation Strategy

### 1. Test Database Configuration

```typescript
// tests/database.setup.ts
export async function createTestDatabase() {
  const testDb = new PrismaClient({
    datasources: {
      db: {
        url: ':memory:', // or `file:${uuid()}.db`
      },
    },
  })

  // Run migrations on fresh database
  await testDb.$executeRaw`PRAGMA foreign_keys = ON`
  // Apply schema without migrations for speed

  return testDb
}
```

### 2. Test Setup Pattern

```typescript
// Example test structure
describe('DatabaseService', () => {
  let testDb: PrismaClient
  let service: DatabaseService

  beforeEach(async () => {
    testDb = await createTestDatabase()
    service = new DatabaseService(testDb)
  })

  afterEach(async () => {
    await testDb.$disconnect()
  })

  test('should store work item correctly', async () => {
    // Test with real database operations
    const workItem = await service.storeWorkItem(mockWorkItemData)

    // Verify in database
    const stored = await testDb.workItem.findUnique({
      where: { id: workItem.id },
    })

    expect(stored).toMatchObject(expectedData)
  })
})
```

### 3. Vitest Configuration Updates

```typescript
// vitest.config.ts additions
export default defineConfig({
  test: {
    // Enable for database tests
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true, // Prevent SQLite locking issues
      },
    },
    // Setup files for database tests
    setupFiles: ['./tests/database.setup.ts'],
  },
})
```

### 4. Migration Strategy

#### Phase 1: Infrastructure Setup

1. Create in-memory database utilities
2. Set up test database configuration
3. Create example test for one service

#### Phase 2: Gradual Implementation

1. Implement tests for critical database operations first:
   - Work item storage and retrieval
   - Sync operations
   - Comment operations
2. Add tests for edge cases and error conditions
3. Implement transaction testing

#### Phase 3: Full Coverage

1. Test all database services
2. Test complex queries and relationships
3. Performance and concurrency testing

## Test Categories to Implement

### Critical Path Tests

- `DatabaseService.storeWorkItem()`
- `DatabaseService.getAllWorkItems()`
- `DatabaseService.getWorkItemsByUser()`
- `SyncService.syncWorkItems()`

### Edge Case Tests

- Duplicate work item handling
- Database constraint violations
- Transaction rollback scenarios
- Large dataset handling

### Integration Tests

- Full sync workflow with database
- MCP server with real database operations
- Comment storage and retrieval

## Best Practices

### Database Test Design

1. **Start Fresh**: Each test gets a clean database
2. **Use Real Data**: Create realistic test data that matches production
3. **Test Constraints**: Verify database constraints and relationships work
4. **Error Scenarios**: Test how services handle database errors

### Performance Considerations

1. **Parallel Execution**: Use separate database instances for parallel tests
2. **Memory Management**: Ensure databases are properly cleaned up
3. **Query Optimization**: Test that database indexes work as expected

### Maintenance

1. **Schema Changes**: Update test setup when database schema changes
2. **Data Factories**: Create reusable test data factories
3. **Query Testing**: Test both success and failure cases for all queries

## Implementation Timeline

### Week 1: Setup and Infrastructure

- Create database test utilities
- Configure Vitest for database testing
- Implement first example test

### Week 2: Critical Path Coverage

- Test core database operations
- Verify all existing functionality works with real database
- Add error handling tests

### Week 3: Complete Coverage

- Test all database services
- Add integration tests
- Performance and concurrency testing

## Success Criteria

- [ ] All database operations tested with real SQLite
- [ ] No false-positive tests (tests that pass with broken database operations)
- [ ] Tests run in under 10 seconds for full database test suite
- [ ] Tests can run in parallel without conflicts
- [ ] Clear test failure messages that help debug issues
- [ ] 100% confidence that database layer works as expected

## Notes

- This approach eliminates the ~3,800+ lines of database mocking code
- Provides real confidence in database operations
- Establishes a foundation for reliable database testing going forward
- Aligns with the project's goal of simplicity and reliability
