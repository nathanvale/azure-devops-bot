# Azure DevOps Bot Test Fix Plan

> Created: 2025-08-27
> Status: In Progress

## Overview

This document outlines the comprehensive plan to fix the 31 failing tests in the Azure DevOps Bot project. The failures were analyzed using Wallaby debugger and runtime values to identify root causes.

## Root Causes Identified

### 1. Resilience Error Wrapping Issue
- **Problem**: Errors from resilience adapter are being wrapped in `RetryExhaustedError` instead of preserving original error types
- **Impact**: Tests expect original error types (ResilienceError, CircuitBreakerError, RateLimitError) but receive wrapped errors
- **Affected Tests**: 6 tests in azure-devops-resilience-integration.test.ts

### 2. Timeout Issues
- **Problem**: Many tests timing out at 5 seconds due to resilience retries taking too long
- **Impact**: 12 tests failing with timeout errors across multiple test files
- **Root Cause**: Tests using real resilience policies with actual retry delays

### 3. Circuit Breaker State Issues
- **Problem**: Circuit breaker is triggering and staying open across tests
- **Impact**: Tests failing with CircuitBreakerOpenError
- **Root Cause**: Circuit breaker state not being reset between tests

### 4. Method Undefined Errors
- **Problem**: REST client methods not properly exposed through the client interface
- **Impact**: Tests expecting `getCurrentUserProfile` and other methods to exist
- **Root Cause**: Interface mismatch between expected and actual REST client methods

### 5. Mock Handler Issues
- **Problem**: MSW handlers not properly intercepting requests in some tests
- **Impact**: Tests making real HTTP requests instead of using mocked responses
- **Root Cause**: Handler registration order and pattern matching issues

## Fix Strategy

### Phase 1: Fix Resilience Error Propagation ✅ IN PROGRESS

**Objective**: Ensure original error types are preserved when thrown from resilience operations

**Changes Made**:
1. ✅ Updated `fetchSingleWorkItem()` in azure-devops.ts to unwrap RetryExhaustedError and throw original error
2. ✅ Updated `fetchWorkItemComments()` with same error unwrapping logic
3. ✅ Updated `addWorkItemComment()` with same error unwrapping logic

**Error Handling Pattern**:
```typescript
try {
  return await this.resilienceAdapter.applyNormalizedPolicy(...)
} catch (error) {
  // Check if this is a RetryExhaustedError that wraps another error
  if (error instanceof Error && error.name === 'RetryExhaustedError' && 'lastError' in error) {
    const lastError = (error as any).lastError
    // If the last error is a resilience-specific error, throw that instead
    if (lastError && lastError.name && (
      lastError.name.includes('ResilienceError') ||
      lastError.name.includes('CircuitBreakerError') ||
      lastError.name.includes('RateLimitError')
    )) {
      throw lastError
    }
  }
  
  // For all other errors, throw as-is
  throw error
}
```

**Files Modified**:
- `src/services/azure-devops.ts`

### Phase 2: Fix Timeout Issues

**Objective**: Prevent test timeouts by mocking resilience policies and using fake timers

**Planned Changes**:
1. Add test timeout configurations to vitest.config.ts
2. Mock resilience policies for unit tests to avoid actual delays
3. Add `vi.useFakeTimers()` for time-sensitive tests
4. Configure fast failure modes in test environments

**Files to Modify**:
- `src/services/__tests__/auth-validation.test.ts` - Add timeout handling for 30s auth timeout test
- `src/services/__tests__/azure-devops.test.ts` - Mock resilience delays
- `src/services/__tests__/integration-fix.test.ts` - Add proper timeouts
- `src/services/__tests__/production-auth.test.ts` - Mock circuit breaker for performance tests
- `src/utils/__tests__/authentication-performance.test.ts` - Use fake timers for load testing
- `src/utils/__tests__/cascade-failure-prevention.test.ts` - Mock policies for cascade tests

### Phase 3: Fix Circuit Breaker Issues

**Objective**: Ensure proper test isolation by resetting circuit breaker state

**Planned Changes**:
1. Add circuit breaker reset in `afterEach` hooks
2. Mock circuit breaker state for unit tests
3. Ensure proper test isolation between runs

**Implementation**:
```typescript
afterEach(() => {
  // Reset circuit breaker state
  if (client.resilienceAdapter) {
    client.resilienceAdapter.resetCircuitBreakers?.()
  }
  vi.clearAllMocks()
})
```

### Phase 4: Fix Method Access Issues

**Objective**: Properly expose REST client methods through interface

**Planned Changes**:
1. Fix `getRestClient()` method to return correct interface
2. Ensure all required methods are available and properly typed
3. Update interface definitions if needed

**Files to Check**:
- `src/packages/azure-devops-client/src/client.ts`
- `src/packages/azure-devops-client/src/interfaces/client.ts`

### Phase 5: Fix Mock Handlers

**Objective**: Ensure MSW handlers properly intercept test requests

**Planned Changes**:
1. Update MSW handler patterns to match actual request URLs
2. Fix handler registration order
3. Ensure handlers are properly reset between tests
4. Add debug logging for handler matching

## Test Categories and Specific Fixes

### Resilience Integration Tests (6 failing)
- **File**: `src/services/__tests__/azure-devops-resilience-integration.test.ts`
- **Fix**: Phase 1 error propagation changes should resolve these
- **Tests**:
  - should have access to resilience adapter through rest provider
  - should not wrap resilience errors in generic error messages
  - should preserve @orchestr8/resilience error telemetry context
  - should handle authentication errors without retry wrapping
  - should handle rate limiting errors with proper @orchestr8 context
  - should apply batch policy for bulk operations

### Timeout Tests (12 failing)
- **Files**: Multiple test files
- **Fix**: Phase 2 timeout configuration and mocking
- **Common Pattern**: "Test timed out in 5000ms"

### Circuit Breaker Tests (4 failing)
- **Files**: production-auth.test.ts, resilience-integration.test.ts
- **Fix**: Phase 3 circuit breaker reset
- **Error**: "CircuitBreakerOpenError: Circuit breaker 'azure-devops-sync' is open"

### Performance Tests (3 failing)
- **Files**: cascade-failure-prevention.test.ts, authentication-performance.test.ts
- **Fix**: Combination of Phases 2 and 3
- **Issues**: Incorrect attempt counts, timing issues

## Testing Approach

### Using Wallaby for Debugging
1. **Runtime Values**: Use `mcp__wallaby__wallaby_runtimeValues` to inspect actual vs expected values
2. **Covered Lines**: Use `mcp__wallaby__wallaby_coveredLinesForFile` to ensure test paths are executed
3. **Test-Specific Runtime**: Use `mcp__wallaby__wallaby_runtimeValuesByTest` for specific failing tests

### Incremental Testing Strategy
1. Run specific test files after each phase
2. Use `mcp__wallaby__wallaby_failingTests` to track progress
3. Verify no regressions with each fix
4. Focus on one error type at a time

## Expected Outcomes

### After Phase 1 (Error Propagation)
- 6 resilience integration tests should pass
- Error types should be preserved correctly
- No more RetryExhaustedError wrapping issues

### After Phase 2 (Timeouts)
- 12 timeout-related test failures should be resolved
- Tests should complete within reasonable time limits
- Performance tests should run with mocked delays

### After Phase 3 (Circuit Breaker)
- Circuit breaker state isolation between tests
- No more cross-test contamination
- Production auth tests should pass

### After Phase 4 (Method Access)
- Interface compatibility tests should pass
- All expected REST client methods available
- Proper type definitions

### After Phase 5 (Mock Handlers)
- MSW handlers properly intercepting requests
- No more real HTTP requests in tests
- Consistent mocked responses

## Success Metrics

- **Target**: 0 failing tests
- **Current**: 31 failing tests
- **Progress Tracking**: Use Wallaby failingTests tool
- **Quality Gate**: All tests pass with proper error handling and isolation

## Notes

- Fixes should maintain backward compatibility
- No changes to production behavior, only test isolation
- Follow existing code patterns and conventions
- Document any architectural changes made during fixes