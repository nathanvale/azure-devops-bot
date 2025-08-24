# Performance Tests - Repository Health Validation

**This directory contains repository health validation tests that ensure the entire Azure DevOps Bot system works correctly with real production data.**

## Purpose - Repository Health Validation

These performance tests serve as **comprehensive health checks** for the repository by:

- ✅ **Validating Authentication**: Real PAT token authentication with fwcdev Azure DevOps organization
- ✅ **Testing Production Integration**: All 8 MCP tools against 1000+ real work items  
- ✅ **Verifying System Performance**: Sync and query benchmarks with production data scale
- ✅ **Ensuring Error Recovery**: Robust handling of real API failures and network issues
- ✅ **Confirming End-to-End Functionality**: Complete MCP server workflow validation

## When to Run - Critical Checkpoints

**Repository Health Validation Checkpoints:**

- 🚀 **Before Major Releases**: Validate all systems work with production data
- 🔧 **After Azure DevOps Client Changes**: Ensure REST API integration remains functional  
- 🐛 **When Debugging Production Issues**: Validate connectivity and authentication
- 📅 **Periodic Health Checks**: Weekly/monthly validation against production data
- 📦 **After Dependency Updates**: Ensure third-party changes don't break Azure DevOps integration
- ⚙️ **Before Infrastructure Changes**: Validate system health before CI/CD updates

## Requirements

- Valid `AZURE_DEVOPS_PAT` environment variable with **work items read & write permissions**
- Access to **fwcdev organization** and **Customer Services Platform project** 
- **Stable internet connection** (tests make real API calls to Azure DevOps)
- **1000+ work items** in the project for meaningful validation

## Running Performance Tests

**These tests are excluded from regular test runs, CI, and Wallaby.js to avoid slow development cycles.**

### Quick Commands

```bash
# Repository health check - run all performance tests
pnpm test:performance

# Individual health check categories
pnpm test:performance tests/performance/production-auth.test.ts         # Authentication validation
pnpm test:performance tests/performance/mcp-tools-production.test.ts    # MCP tools with real data  
pnpm test:performance tests/performance/error-handling-scenarios.test.ts # Error recovery validation
pnpm test:performance tests/performance/production-validation-suite.test.ts # Full system validation
```

### Detailed Commands

```bash
# Full performance test suite with verbose output
pnpm vitest --config vitest.performance.config.ts --reporter=verbose

# Run specific test with detailed logging  
pnpm vitest --config vitest.performance.config.ts tests/performance/mcp-tools-production.test.ts --reporter=verbose

# Run with coverage (if needed for analysis)
pnpm vitest --config vitest.performance.config.ts --coverage
```

## Test Categories - Health Check Coverage

### 1. **Authentication Validation** (`production-auth.test.ts`)
**Health Check**: PAT authentication and Azure DevOps connectivity

- ✅ PAT token authentication with fwcdev organization
- ✅ Work item fetching from Customer Services Platform project
- ✅ Performance benchmarks (≤30s for full sync, ≤100ms for queries)
- ✅ Batch operations efficiency
- ✅ Rate limiting and error recovery

### 2. **MCP Tools Production Validation** (`mcp-tools-production.test.ts`)
**Health Check**: All 8 MCP tools with real Azure DevOps data

- **wit_my_work_items**: User-assigned work item filtering with real assignments
- **wit_get_work_item**: Individual work item retrieval with production IDs
- **wit_force_sync_work_items**: Manual sync functionality with 1000+ items
- **wit_get_work_items_batch_by_ids**: Batch operations with real work item IDs
- **wit_list_work_item_comments**: Comment retrieval from real work items
- **wit_get_work_items_for_iteration**: Sprint filtering with actual iterations
- **wit_add_work_item_comment**: Write operations (adds test comments)
- **wit_link_work_item_to_pull_request**: PR linking functionality

### 3. **Error Handling Scenarios** (`error-handling-scenarios.test.ts`)
**Health Check**: System resilience with real API failure conditions

- 🛡️ Network timeout recovery during sync operations
- 🛡️ Invalid work item ID handling (non-existent IDs)
- 🛡️ PAT token expiration and re-authentication
- 🛡️ Rate limiting detection and backoff strategies
- 🛡️ Malformed API response handling
- 🛡️ Partial data sync failure recovery

### 4. **Production Validation Suite** (`production-validation-suite.test.ts`)
**Health Check**: Complete end-to-end system validation

- 🔄 MCP server startup and shutdown with production configuration
- 🔄 Background sync process with 1000+ work items
- 🔄 Database consistency checks after sync
- 🔄 Query performance benchmarks with production data
- 🔄 Memory usage stability during long operations
- 🔄 Resource cleanup and connection management

## Performance Benchmarks - Health Check Criteria

Performance tests validate the repository meets these production requirements:

```typescript
// Repository Health Benchmarks
✅ Full Sync Performance: ≤30 seconds for 1000+ work items
✅ Individual Query Speed: ≤100ms response time  
✅ Batch Operation Efficiency: ≤5 seconds for batch of 10 items
✅ Memory Usage Stability: No memory leaks during long operations
✅ Error Recovery Time: ≤2 seconds to recover from API failures
✅ Connection Management: Proper cleanup of all resources
```

## Expected Health Check Results

**🟢 Healthy Repository**: All performance tests pass with benchmarks met

```bash
✅ Authentication Validation: All PAT and connectivity tests pass
✅ MCP Tools Validation: All 8 tools work correctly with real data  
✅ Error Handling: System recovers gracefully from all failure scenarios
✅ Full System Validation: End-to-end workflows complete successfully

📊 Performance Metrics Met:
  - Sync: 1,234 work items in 24.5 seconds ✅
  - Queries: Average 45ms response time ✅  
  - Memory: Stable usage throughout test suite ✅
  - Recovery: All error scenarios handled correctly ✅
```

**🟡 Issues Detected**: Some tests fail - investigate before proceeding

**🔴 Unhealthy Repository**: Multiple failures - do not proceed with release

## Performance Test Timing

- **Individual Tests**: 30-120 seconds each
- **Full Suite**: 5-10 minutes depending on data size and network speed
- **Authentication Tests**: ~2 minutes  
- **MCP Tools Tests**: ~3-4 minutes
- **Error Handling Tests**: ~2-3 minutes
- **Full Validation Suite**: ~3-4 minutes

## Troubleshooting Health Check Failures

### Authentication Issues
```bash
❌ Error: AZURE_DEVOPS_PAT environment variable is required
✅ Solution: Set valid PAT with "Work Items (read & write)" permissions
```

### Performance Benchmark Failures
```bash  
❌ Error: Sync took 45s, expected ≤30s
✅ Solution: Check network speed, Azure DevOps API performance, work item count growth
```

### Network/Connectivity Issues
```bash
❌ Error: Network timeout during sync  
✅ Solution: Verify internet connection and Azure DevOps service status
```

### PAT Permission Issues
```bash
❌ Error: Access denied for work item operations
✅ Solution: Regenerate PAT with proper "Work Items (read & write)" scope
```

## Why These Are Repository Health Checks

Performance tests are **repository health validation tools** separate from unit tests because they:

1. **🌐 Require External Dependencies**: Valid PAT, network connectivity, Azure DevOps service availability
2. **⏱️ Take Significant Time**: 5-10 minutes for full health check (unsuitable for TDD workflows)  
3. **🔗 Test Real Integration**: Validate against actual Azure DevOps service with 1000+ work items
4. **🎯 Focus on Production Readiness**: Ensure system works with real-world data and conditions
5. **🛡️ Validate System Resilience**: Test error recovery and performance under production load

## Health Check Schedule Recommendations

- **🔄 Before Each Release**: Full performance test suite
- **📅 Weekly**: Authentication and basic connectivity tests
- **📊 Monthly**: Full system validation with performance benchmarks  
- **⚠️ On Demand**: When investigating production issues or after major changes

---

**🎯 Goal**: Ensure the Azure DevOps Bot repository is healthy and production-ready by validating all systems work correctly with real Azure DevOps data at scale.