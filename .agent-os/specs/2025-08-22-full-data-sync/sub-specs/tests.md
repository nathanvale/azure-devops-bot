# Tests Specification

This is the tests coverage details for the spec detailed in @.agent-os/specs/2025-08-22-full-data-sync/spec.md

> Created: 2025-08-22
> Version: 1.0.0

## Test Coverage

### Unit Tests

**AzureDevOpsService**

- Test fetchSingleWorkItem with complete mock response
- Test fetchWorkItemsDetailed with parallel processing
- Test error handling for individual work item failures
- Test concurrency limiting behavior
- Test resilience adapter integration with Azure CLI operations

**Resilience Integration**

- Test retry behavior for transient Azure CLI failures
- Test circuit breaker opening/closing with sustained failures
- Test timeout handling for hanging CLI commands
- Test error classification (retryable vs non-retryable)
- Test resilience policy configuration for different operation types

**DatabaseService**

- Test storing work items with expanded field data
- Test rawJson field population and retrieval
- Test handling of null/undefined fields from Azure DevOps
- Test duplicate work item handling (update vs insert)

### Integration Tests

**Full Sync Workflow**

- Test complete sync process from work item list to detailed storage
- Test parallel processing with multiple work items
- Test partial failure scenarios (some items fail, others succeed)
- Test data completeness verification after sync

**Azure CLI Integration**

- Test `az boards work-item show --expand all` command execution
- Test JSON parsing of expanded work item response
- Test command failure and error propagation

### Mocking Requirements

- **Azure CLI Commands**: Mock both `az boards work-item list` and `az boards work-item show` responses
- **Parallel Processing**: Mock concurrent Azure CLI execution with realistic timing
- **Error Scenarios**: Mock various Azure CLI failure modes (network, auth, not found)
- **Complete Work Item Data**: Mock expanded Azure DevOps response with all fields populated
- **Resilience Patterns**: Mock @orchestr8/resilience adapter for testing retry, circuit breaker, and timeout behaviors
- **Time-based Testing**: Mock time progression for circuit breaker recovery testing

### Performance Tests

**Concurrency Testing**

- Verify configurable concurrency limits are respected
- Test performance improvement vs sequential processing
- Test memory usage during parallel processing

**Data Completeness**

- Verify all fields from mock Azure DevOps response are captured
- Test rawJson storage contains complete original response
- Verify no data loss during transformation
