# Spec Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/2025-08-22-comment-storage-sync/spec.md

> Created: 2025-08-22
> Status: Ready for Implementation

## Tasks

- [x] 1. Implement Azure CLI comment fetching in AzureDevOpsClient
  - [x] 1.1 Write tests for comment fetching with mock Azure CLI responses
  - [x] 1.2 Add fetchWorkItemComments method to AzureDevOpsClient class
  - [x] 1.3 Implement comment data mapping from Azure CLI JSON to interface
  - [x] 1.4 Add resilience policy for comment fetching operations
  - [x] 1.5 Verify all tests pass for comment fetching functionality

- [x] 2. Enhance database service with comment storage operations
  - [x] 2.1 Write tests for comment upsert and retrieval operations
  - [x] 2.2 Add storeWorkItemComments method to DatabaseService class
  - [x] 2.3 Implement incremental comment sync logic with change detection
  - [x] 2.4 Add comment retrieval methods for MCP tool consumption
  - [x] 2.5 Verify all tests pass for database comment operations

- [x] 3. Integrate comment sync into existing sync workflow
  - [x] 3.1 Write tests for sync service comment integration
  - [x] 3.2 Modify sync service to include comment sync for changed work items
  - [x] 3.3 Add comment sync performance monitoring and error handling
  - [x] 3.4 Update sync service to handle comment sync failures gracefully
  - [x] 3.5 Verify all tests pass for integrated sync workflow

- [ ] 4. Enhance MCP tools to expose comment data
  - [ ] 4.1 Write tests for enhanced MCP tool responses including comments
  - [ ] 4.2 Update wit_get_work_item tool to include comment data in response
  - [ ] 4.3 Implement wit_list_work_item_comments tool for comment-specific queries
  - [ ] 4.4 Add comment data formatting for AI agent consumption
  - [ ] 4.5 Verify all tests pass for MCP tool comment integration
