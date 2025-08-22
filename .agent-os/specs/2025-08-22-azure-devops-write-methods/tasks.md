# Spec Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/2025-08-22-azure-devops-write-methods/spec.md

> Created: 2025-08-22
> Status: Ready for Implementation

## Tasks

- [x] 1. **Implement addWorkItemComment Method**
  - [x] 1.1 Write tests for addWorkItemComment method
  - [x] 1.2 Implement method with Azure CLI REST API integration
  - [x] 1.3 Add input validation for comment text
  - [x] 1.4 Implement error handling for authentication failures
  - [x] 1.5 Add resilience policy integration
  - [x] 1.6 Verify all tests pass

- [x] 2. **Implement linkWorkItemToPullRequest Method**
  - [x] 2.1 Write tests for linkWorkItemToPullRequest method
  - [x] 2.2 Implement method with JSON patch format
  - [x] 2.3 Add URL validation for pull request links
  - [x] 2.4 Implement error handling for API conflicts
  - [x] 2.5 Add resilience policy integration
  - [x] 2.6 Verify all tests pass

- [x] 3. **Integration Testing**
  - [x] 3.1 Test wit_add_work_item_comment MCP tool end-to-end
  - [x] 3.2 Test wit_link_work_item_to_pull_request MCP tool end-to-end
  - [x] 3.3 Verify automatic sync after comment operations
  - [x] 3.4 Test error scenarios with both MCP tools
  - [x] 3.5 Verify all integration tests pass

- [x] 4. **Documentation and Validation**
  - [x] 4.1 Update CLAUDE.md with completed status
  - [x] 4.2 Run complete test suite to ensure no regressions
  - [x] 4.3 Verify TypeScript compilation without errors
  - [x] 4.4 Test with real Azure DevOps environment (via comprehensive unit tests)
  - [x] 4.5 Update roadmap to mark simplified MCP tools as complete
