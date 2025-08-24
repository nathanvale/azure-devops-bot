# Test Fixing Plan for Azure DevOps REST API Migration

> Created: 2025-08-23
> Version: 1.0.0
> Status: Draft

## Executive Summary

This document outlines a comprehensive strategy to restore test suite health following the migration from Azure CLI to Azure DevOps REST API. Current test suite status shows a 33.7% failure rate, which requires a systematic, multi-phase approach to resolution.

## Current Situation Assessment

### Test Suite Overview

- **Total Tests**: 338
- **Passing Tests**: 202 (59.8%)
- **Failing Tests**: 114 (33.7%)
- **Skipped Tests**: 22 (6.5%)
- **Runtime Errors**: 30

### Primary Migration Challenges

1. Environment variable configuration
2. Mock strategy transformation
3. Import path and type resolution
4. Performance testing adaptation

## Test Failure Categorization

### Category 1: Environment Configuration Failures (80% of Issues)

**Symptoms:**

- Immediate constructor failures
- Missing `AZURE_DEVOPS_PAT` environment variable
- No authentication context for tests

**Affected Files:**

- `src/services/__tests__/azure-devops.test.ts`
- `src/services/__tests__/azure-devops-rest-integration.test.ts`
- `tests/integration/azure-devops-server.test.ts`
- `src/services/__tests__/field-discovery.test.ts`

### Category 2: Mock Strategy Mismatch (15% of Issues)

**Symptoms:**

- Mocks not intercepting HTTP calls
- Undefined results from test methods
- Incompatible mocking between CLI and REST implementations

**Affected Areas:**

- Work item fetching operations
- Comment retrieval functions
- Batch operation testing
- Performance timing tests

### Category 3: Import and Type Resolution (5% of Issues)

**Symptoms:**

- Module resolution errors
- Type definition conflicts
- Package structure incompatibilities

## Fixing Approach

### Phase 1: Environment Setup (Estimated: 30 minutes)

**Objective:** Establish consistent test environment configuration

**Implementation Steps:**

1. Create global test setup file (`vitest.setup.ts`)
2. Add environment variable injection for all test contexts

```typescript
// vitest.setup.ts
beforeEach(() => {
  process.env.AZURE_DEVOPS_PAT = 'test-token-123'
  process.env.AZURE_DEVOPS_ORG = 'fwcdev'
  process.env.AZURE_DEVOPS_PROJECT = 'Customer Services Platform'
})
```

**Expected Outcome:**

- 91/114 tests start passing
- Failure rate drops to 6.8%

### Phase 2: Mock Migration (Estimated: 4-6 hours)

**Objective:** Update test files to use REST-compatible mocking strategies

**File-by-File Migration Plan:**

1. `azure-devops.test.ts` (45 tests)
   - Replace `child_process.exec` mocks
   - Implement MSW handlers for REST endpoints
   - Update assertion patterns

2. `azure-devops-rest-integration.test.ts` (16 tests)
   - Mock provider initialization
   - Set up comprehensive REST endpoint handlers
   - Validate data transformation accuracy

3. `azure-devops-server.test.ts` (25 tests)
   - Update MCP server integration tests
   - Implement end-to-end REST API mocking
   - Validate backward compatibility

4. `batch-performance.test.ts` (12 tests)
   - Recalibrate performance timing tests
   - Address race conditions in MSW handlers
   - Match mock data to REST API response format

**Mock Strategy Template:**

```typescript
// New mocking pattern
import { rest } from 'msw'
import { setupServer } from 'msw/node'

const server = setupServer(
  rest.get('https://dev.azure.com/*/workitems', (req, res, ctx) => {
    return res(ctx.json(mockWorkItemData))
  }),
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

### Phase 3: Cleanup and Validation (Estimated: 2 hours)

**Objectives:**

- Resolve remaining import path issues
- Update field-discovery tests
- Ensure 100% test suite compatibility

## Success Metrics

### Immediate Success Indicators

- [ ] Test failure rate <10%
- [ ] Environment setup working across all test files
- [ ] WallabyJS showing meaningful results

### Complete Success Criteria

- [ ] 0% test failure rate (338/338 passing)
- [ ] Test suite execution time <30 seconds
- [ ] All critical paths covered per project standards
- [ ] WallabyJS providing real-time feedback

## Quality Gates

- No unhandled promise rejections
- All MSW handlers properly configured
- Consistent mock patterns across test files
- Data transformation accuracy validated

## Risk Assessment

### Low Risk

- Environment variable setup
- Import path resolution

### Medium Risk

- Complex mock pattern migrations
- MSW handler configuration
- Data format matching

### High Risk

- Performance test accuracy
- Integration test complexity

## Conclusion

The proposed test fixing plan provides a structured, phased approach to resolving test failures from the Azure DevOps REST API migration. By methodically addressing environment, mocking, and type resolution challenges, we can restore the test suite to full health with minimal disruption.

**Key Recommendation:** Execute phases sequentially, validating progress at each stage.
