# Spec Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/2025-08-22-merge-readiness-fixes/spec.md

> Created: 2025-08-22
> Status: Ready for Implementation

## Tasks

- [x] 1. Fix Test Suite (Critical Priority)
  - [x] 1.1 Write tests to fix resilience policy structure assertions in azure-devops.test.ts
  - [x] 1.2 Update mock implementations to match production code behavior
  - [x] 1.3 Fix needsCommentSync test logic in database.test.ts
  - [x] 1.4 Repair parallel processing timing issues in sync-service.test.ts
  - [x] 1.5 Run full test suite and verify all 348 tests pass consistently
  - [x] 1.6 Ensure no flaky tests by running suite 5 times

- [x] 2. Dependency Management and Build Stability
  - [x] 2.1 Generate pnpm-lock.yaml file from current package.json
  - [x] 2.2 Add .npmrc configuration for pnpm settings
  - [x] 2.3 Test fresh install with clean node_modules
  - [x] 2.4 Verify all peer dependencies are satisfied
  - [x] 2.5 Lock @orchestr8/resilience to specific version

- [x] 3. Database Initialization and Schema Alignment
  - [x] 3.1 Create database initialization script for fresh installs
  - [x] 3.2 Generate Prisma migration for missing fields (reason, watermark, url, etc.)
  - [x] 3.3 Update Prisma schema to match WorkItemData interface exactly
  - [x] 3.4 Add database startup checks and auto-migration
  - [x] 3.5 Test migration rollback procedure
  - [x] 3.6 Verify all tests pass with updated schema

- [x] 4. Remove NLP Components (Architecture Cleanup)
  - [x] 4.1 Delete src/services/semantic-search.ts and associated tests
  - [x] 4.2 Delete src/services/enhanced-query-engine.ts and associated tests
  - [x] 4.3 Simplify QueryEngine to basic filtering only (remove semantic processing)
  - [x] 4.4 Update MCP tools to return raw JSON without NLP processing
  - [x] 4.5 Remove unused NLP dependencies from package.json
  - [x] 4.6 Update all imports and references throughout codebase
  - [x] 4.7 Verify all tests pass after NLP removal

- [x] 5. Performance Optimization
  - [x] 5.1 Implement batch database operations using Prisma transactions
  - [x] 5.2 Add parallel comment sync with concurrency control (max 5 concurrent)
  - [x] 5.3 Replace sequential work item sync with batched upserts
  - [x] 5.4 Add progress reporting for long-running sync operations
  - [x] 5.5 Test performance improvements meet 50% faster sync target
  - [x] 5.6 Verify memory usage stays under 500MB during large syncs

- [x] 6. Error Handling and Resilience
  - [x] 6.1 Add try-catch blocks to all database operations in DatabaseService
  - [x] 6.2 Implement exponential backoff for Azure CLI failures
  - [x] 6.3 Add transaction rollback handling for partial failures
  - [x] 6.4 Improve error messages for authentication and rate limiting
  - [x] 6.5 Add circuit breaker logging and monitoring
  - [x] 6.6 Test error recovery mechanisms with deliberate failures

- [x] 7. Final Validation and Quality Assurance
  - [x] 7.1 Run complete test suite and ensure 100% pass rate
  - [x] 7.2 Test fresh application install and first-run experience
  - [x] 7.3 Verify sync performance meets under 5-minute target for 1000 items
  - [x] 7.4 Confirm no console errors or warnings during normal operation
  - [x] 7.5 Validate codebase follows all architectural decisions in decisions.md
  - [x] 7.6 Run integration tests with real Azure DevOps instance
  - [x] 7.7 Document any breaking changes or migration steps required
