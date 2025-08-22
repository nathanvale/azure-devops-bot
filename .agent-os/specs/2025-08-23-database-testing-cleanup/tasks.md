# Spec Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/2025-08-23-database-testing-cleanup/spec.md

> Created: 2025-08-23
> Status: Ready for Implementation

## Tasks

- [ ] 1. Pre-removal Documentation and Analysis
  - [ ] 1.1 Document current test coverage statistics and passing tests
  - [ ] 1.2 Create backup branch with current state for reference
  - [ ] 1.3 Identify all files importing database mocks using grep/search
  - [ ] 1.4 Verify project builds and all tests pass before changes

- [ ] 2. Remove Database Mock Infrastructure
  - [ ] 2.1 Delete `src/mocks/prisma.mock.ts` file
  - [ ] 2.2 Delete `src/mocks/handlers/azure-devops.handlers.ts` database-related handlers (keep API mocking)
  - [ ] 2.3 Remove database-specific utilities from `tests/utils/test-helpers.ts`
  - [ ] 2.4 Verify build still compiles after mock infrastructure removal

- [ ] 3. Remove Database-Dependent Test Files
  - [ ] 3.1 Delete `src/services/__tests__/database.test.ts`
  - [ ] 3.2 Delete `src/services/__tests__/schema-migration.test.ts`
  - [ ] 3.3 Delete `src/services/__tests__/sync-service.test.ts`
  - [ ] 3.4 Delete `src/__tests__/mcp-server.test.ts`
  - [ ] 3.5 Delete `src/services/__tests__/query-engine.test.ts`
  - [ ] 3.6 Verify remaining tests still pass after file removal

- [ ] 4. Clean Up References and Imports
  - [ ] 4.1 Remove all imports referencing `@/mocks/prisma.mock`
  - [ ] 4.2 Remove references to `mockPrismaClient`, `resetPrismaMocks()`, `setupPrismaDefaults()`
  - [ ] 4.3 Clean up any remaining database mock references in test files
  - [ ] 4.4 Verify TypeScript compilation succeeds with no import errors

- [ ] 5. Update Vitest Configuration
  - [ ] 5.1 Update `vitest.config.ts` to exclude deleted test files
  - [ ] 5.2 Remove any mock-specific configuration settings
  - [ ] 5.3 Prepare configuration comments for future in-memory SQLite setup
  - [ ] 5.4 Verify all Vitest configurations work correctly

- [ ] 6. Update Package.json Scripts
  - [ ] 6.1 Review and update test scripts to reflect new testing approach
  - [ ] 6.2 Remove any scripts specific to database mocking setup
  - [ ] 6.3 Ensure all npm scripts execute successfully
  - [ ] 6.4 Verify build and test scripts work in CI environment

- [ ] 7. Documentation and Guidelines
  - [ ] 7.1 Update project README with new testing approach
  - [ ] 7.2 Document future in-memory SQLite implementation strategy
  - [ ] 7.3 Create guidelines for when and how to add database tests in future
  - [ ] 7.4 Update CLAUDE.md with testing strategy changes

- [ ] 8. Final Validation and Cleanup
  - [ ] 8.1 Run full test suite to ensure all remaining tests pass
  - [ ] 8.2 Verify TypeScript build completes without errors
  - [ ] 8.3 Check ESLint passes without unused import warnings
  - [ ] 8.4 Document before/after test coverage statistics
  - [ ] 8.5 Verify project starts and functions correctly without mocks
