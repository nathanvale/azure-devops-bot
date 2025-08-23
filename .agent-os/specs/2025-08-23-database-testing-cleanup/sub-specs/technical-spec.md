# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-08-23-database-testing-cleanup/spec.md

> Created: 2025-08-23
> Version: 1.0.0

## Technical Requirements

### File Removal Requirements

- Delete `src/mocks/prisma.mock.ts` (240 lines of complex Prisma mocking)
- Delete `src/services/__tests__/database.test.ts` (1,240 lines of mocked database tests)
- Delete `src/services/__tests__/schema-migration.test.ts` (460 lines of schema testing)
- Delete `src/services/__tests__/sync-service.test.ts` (925 lines of service testing)
- Delete `src/__tests__/mcp-server.test.ts` (470 lines of MCP server testing)
- Delete `src/services/__tests__/query-engine.test.ts` (463 lines of query engine testing)

### Code Cleanup Requirements

- Remove all imports referencing `@/mocks/prisma.mock`
- Remove references to `mockPrismaClient`, `resetPrismaMocks()`, `setupPrismaDefaults()`
- Clean up `tests/utils/test-helpers.ts` by removing database-specific utilities
- Update remaining tests to remove database mock dependencies

### Configuration Updates

- Update Vitest configuration to exclude deleted test files
- Prepare test environment configuration for future in-memory SQLite
- Update package.json scripts to reflect new testing approach

## Approach Options

**Option A: Complete Immediate Removal** (Selected)

- Pros: Eliminates maintenance burden immediately, simplifies codebase, removes false confidence
- Cons: Temporarily reduces test coverage for database operations

**Option B: Gradual Migration**

- Pros: Maintains some test coverage during transition
- Cons: Prolongs maintenance of complex mocking infrastructure, delayed benefits

**Option C: Rewrite Mocks to be Simpler**

- Pros: Keeps some database testing
- Cons: Still maintaining mock infrastructure, doesn't solve core reliability issues

**Rationale:** Option A provides immediate relief from complex maintenance while establishing a clean foundation for future in-memory SQLite implementation. The current mocks provide false confidence and break frequently, so removing them eliminates more problems than it creates.

## External Dependencies

No new external dependencies required for the removal phase. Future in-memory SQLite implementation will use:

- **SQLite**: Already included in Node.js runtime
- **Vitest**: Already configured in project
- **Prisma**: Already configured for SQLite support

**Justification:** Using built-in tools and existing dependencies minimizes complexity and aligns with project's simplicity goals.

## Implementation Strategy

### Phase 1: Safe Removal

1. Identify all files importing database mocks
2. Remove test files that cannot function without mocks
3. Clean up remaining references and imports
4. Verify build and remaining tests pass

### Phase 2: Configuration Preparation

1. Update Vitest configurations to exclude deleted tests
2. Prepare environment variables for future test database URLs
3. Document migration path for future in-memory SQLite implementation

### Phase 3: Documentation

1. Update project README with new testing approach
2. Document future implementation strategy
3. Create guidelines for when to add new database tests

## Performance Considerations

- **Build Time**: Will improve by removing ~3,800 lines of test code
- **Test Execution**: Remaining tests will run faster without complex mock setup
- **Memory Usage**: Reduced by eliminating large mock objects and complex test utilities
- **Developer Experience**: Simplified test structure reduces cognitive load

## Migration Path for Future Implementation

When ready to implement in-memory SQLite testing:

1. **Database URL Configuration**: Use `file::memory:?cache=shared` for true in-memory or `file:./test.db` for file-based
2. **Test Setup**: Implement `beforeEach` hooks to reset database state
3. **Migration Strategy**: Run `prisma migrate dev` against test database
4. **Cleanup Strategy**: Delete all data between tests for isolation
5. **Environment Separation**: Separate test and development database configurations
