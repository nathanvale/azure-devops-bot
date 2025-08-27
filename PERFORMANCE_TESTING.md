# Performance Testing Guide

## Overview

This project includes comprehensive performance and benchmark tests that validate system requirements like sync timing, query response times, and memory usage. These tests are excluded from regular CI runs and WallabyJS due to their long execution times.

## Test Categories

### Performance Test Files

1. **tests/performance/performance-benchmarking.test.ts**
   - Main comprehensive performance test suite
   - Tests sync timing (≤30s for 1,056+ items)
   - Query performance (≤100ms response times)
   - Memory usage monitoring during load testing
   - Timeout: 3 minutes

2. **src/utils/__tests__/sync-performance-benchmark.test.ts**
   - Sync operation performance benchmarks
   - Validates 30x performance improvement claims
   - Tests batch operations vs individual calls

3. **src/utils/__tests__/authentication-performance.test.ts**
   - Authentication performance with resilience
   - Pre-flight authentication validation
   - Circuit breaker and rate limiting performance

4. **src/utils/__tests__/logger-security-performance.test.ts**
   - Logger security and performance tests
   - Logging operation overhead measurements

5. **src/utils/__tests__/resilience-telemetry-performance.test.ts**
   - Resilience telemetry integration performance
   - Policy application overhead testing

6. **src/utils/__tests__/resilience-adapter-performance.test.ts**
   - ProductionResilienceAdapter memory usage
   - Adapter creation and policy application benchmarks

## Running Performance Tests

### Local Development

```bash
# Run all performance tests once
pnpm run test:performance

# Watch mode for development (use sparingly)
pnpm run test:performance:watch

# Run with specific environment variables
AZURE_DEVOPS_PAT="your-pat-token" \
TEST_USER_EMAIL="your-email@example.com" \
pnpm run test:performance
```

### Requirements for Performance Tests

Most performance tests require a valid Azure DevOps PAT (Personal Access Token) to run against real data. Tests will automatically skip if the PAT is not available:

```bash
# Set required environment variables
export AZURE_DEVOPS_PAT="your-pat-token"
export TEST_USER_EMAIL="your-email@example.com"
export AZURE_DEVOPS_USER_EMAILS="email1@example.com,email2@example.com"
```

### CI/CD

Performance tests are excluded from regular CI runs but can be triggered:

1. **Manual trigger via GitHub Actions**:
   - Go to Actions tab in GitHub
   - Select "Azure DevOps Bot CI" workflow
   - Click "Run workflow"
   - Check "Run performance tests" option

2. **Automatic trigger on main branch**:
   - Include `[run-perf]` in your commit message
   - Example: `git commit -m "feat: improve sync performance [run-perf]"`

## Configuration

### Test Exclusion

Performance tests are excluded from regular test runs via:

1. **vitest.config.ts** - Default configuration excludes performance tests:
   ```typescript
   exclude: [
     '**/performance/**/*.test.ts',
     '**/*performance*.test.ts',
     '**/*benchmark*.test.ts',
   ]
   ```

2. **vitest.config.performance.ts** - Dedicated config for performance tests:
   - 5-minute timeout for long-running tests
   - Sequential execution (maxConcurrency: 1)
   - Coverage disabled

3. **wallaby.js** - WallabyJS excludes performance tests:
   ```javascript
   tests: [
     'src/**/*.test.ts',
     '!**/performance/**/*.test.ts',
     '!**/*performance*.test.ts',
     '!**/*benchmark*.test.ts',
   ]
   ```

## Performance Requirements

The performance tests validate these production requirements:

- **Sync Time**: ≤30 seconds for 1,056+ work items
- **Query Response**: ≤100ms for individual work item queries
- **Memory Growth**: ≤100MB during extended operations
- **Concurrent Queries**: Maintain sub-100ms even under load
- **Error Rate**: <5% during sustained load testing

## Troubleshooting

### Tests Timing Out

If performance tests are timing out:

1. Check that you have a valid AZURE_DEVOPS_PAT set
2. Ensure your network connection is stable
3. Verify Azure DevOps API is accessible
4. Consider increasing timeout in vitest.config.performance.ts

### Tests Running in Regular CI

If performance tests are accidentally running in CI:

1. Verify the exclude patterns in vitest.config.ts
2. Check that test files follow naming convention (*performance*.test.ts)
3. Ensure CI is using the default vitest config, not the performance one

### WallabyJS Running Performance Tests

If WallabyJS is running performance tests:

1. Restart WallabyJS after configuration changes
2. Verify wallaby.js excludes performance test patterns
3. Check that test files match exclusion patterns

## Best Practices

1. **Run performance tests locally** before major releases
2. **Monitor trends** - Performance degradation over time is a concern
3. **Use skipIf** - Always use `it.skipIf(!hasProductionPAT)` for tests requiring real data
4. **Clean up resources** - Ensure afterEach/afterAll hooks properly clean up
5. **Avoid parallel execution** - Performance tests should run sequentially for accurate timing

## Adding New Performance Tests

When adding new performance tests:

1. Follow naming convention: `*performance*.test.ts` or `*benchmark*.test.ts`
2. Place in appropriate directory (tests/performance/ for comprehensive tests)
3. Use proper timeout configuration: `{ timeout: 180000 }`
4. Include skipIf for PAT-dependent tests
5. Document performance requirements being tested
6. Add proper cleanup in afterEach/afterAll hooks

## Monitoring Performance

Track performance metrics over time:

```bash
# Run performance tests and save results
pnpm run test:performance > performance-results-$(date +%Y%m%d).log

# Compare results across runs to identify degradation
```

Consider setting up automated performance tracking in CI for release branches.