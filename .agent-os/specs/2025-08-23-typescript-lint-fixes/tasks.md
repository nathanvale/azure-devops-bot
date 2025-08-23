# Spec Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/2025-08-23-typescript-lint-fixes/spec.md

> Created: 2025-08-23
> Status: Ready for Implementation

## Tasks

- [x] 1. **Fix Compilation Blockers**
  - [x] 1.1 Write tests for missing database methods (getWorkItemById, getWorkItemsByIds, getWorkItemsByIteration)
  - [x] 1.2 Add getWorkItemById method to DatabaseService
  - [x] 1.3 Add getWorkItemsByIds method to DatabaseService
  - [x] 1.4 Add getWorkItemsByIteration method to DatabaseService
  - [x] 1.5 Fix import path resolution (@/ alias issues in test files)
  - [x] 1.6 Add global type definitions (NodeJS.Timer, URL, etc.)
  - [x] 1.7 Verify TypeScript compilation succeeds for core files

- [x] 2. **Fix Type Safety - Core Services**
  - [x] 2.1 Write type definitions for Azure DevOps API responses
  - [x] 2.2 Replace any types in azure-devops.ts with proper interfaces
  - [x] 2.3 Replace any types in database.ts with Prisma types
  - [x] 2.4 Replace any types in sync-service.ts with proper types
  - [x] 2.5 Fix exec function return types throughout codebase
  - [x] 2.6 Verify all service tests pass with new types

- [ ] 3. **Fix Type Safety - Mocks and Tests**
  - [ ] 3.1 Write proper types for Prisma mock parameters
  - [ ] 3.2 Fix mock parameter types in prisma.mock.ts (where, data, etc.)
  - [ ] 3.3 Replace any types in test utility functions
  - [ ] 3.4 Fix Azure DevOps handler parameter types
  - [ ] 3.5 Add proper types for test global assignments
  - [ ] 3.6 Verify all mock implementations work with new types

- [ ] 4. **ESLint Compliance and Cleanup**
  - [ ] 4.1 Remove or rename unused variables throughout codebase
  - [ ] 4.2 Fix no-undef violations (URL, NodeJS references)
  - [ ] 4.3 Clean up unused imports and exports
  - [ ] 4.4 Add underscore prefix to legitimate unused parameters
  - [ ] 4.5 Verify ESLint passes with zero violations
  - [ ] 4.6 Run complete test suite to ensure no regressions

- [ ] 5. **Final Validation and Documentation**
  - [ ] 5.1 Run full TypeScript compilation check (pnpm type-check)
  - [ ] 5.2 Run full ESLint validation (pnpm lint)
  - [ ] 5.3 Run complete test suite (pnpm test)
  - [ ] 5.4 Verify production build succeeds (pnpm build)
  - [ ] 5.5 Update documentation with any type changes
  - [ ] 5.6 Create summary of fixes made
