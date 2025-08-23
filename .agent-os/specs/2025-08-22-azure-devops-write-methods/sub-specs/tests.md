# Tests Specification

This is the tests coverage details for the spec detailed in @.agent-os/specs/2025-08-22-azure-devops-write-methods/spec.md

> Created: 2025-08-22
> Version: 1.0.0

## Test Coverage

### Unit Tests - addWorkItemComment

**AzureDevOpsClient.addWorkItemComment**

- Should successfully add comment to work item
- Should validate comment text is not empty
- Should use correct Azure CLI command format
- Should handle Azure CLI authentication errors
- Should handle work item not found errors
- Should handle API rate limiting errors
- Should apply resilience policy for network failures
- Should log operation for debugging

### Unit Tests - linkWorkItemToPullRequest

**AzureDevOpsClient.linkWorkItemToPullRequest**

- Should successfully link work item to pull request
- Should validate pull request URL format
- Should use correct JSON patch format
- Should handle Azure CLI authentication errors
- Should handle work item not found errors
- Should handle existing link conflicts
- Should apply resilience policy for network failures
- Should log operation for debugging

### Integration Tests

**MCP Tool Integration**

- Should successfully add comment via wit_add_work_item_comment tool
- Should successfully link work item via wit_link_work_item_to_pull_request tool
- Should trigger automatic sync after comment addition
- Should return proper error messages for invalid inputs

### Error Scenario Tests

**Authentication Failures**

- Should detect Azure CLI not authenticated responses
- Should provide helpful error messages with login guidance
- Should not retry on authentication errors

**Network Failures**

- Should retry transient network errors
- Should fail gracefully after max retry attempts
- Should log circuit breaker events appropriately

**Input Validation**

- Should reject empty comment text
- Should reject malformed pull request URLs
- Should handle special characters in comments properly

## Mocking Requirements

- **Azure CLI Commands**: Mock `execAsync` calls for both methods
- **Resilience Policy**: Mock `applyPolicy` to test error handling paths
- **Console Logging**: Mock console methods to verify logging behavior
- **Network Responses**: Mock various Azure CLI response scenarios
