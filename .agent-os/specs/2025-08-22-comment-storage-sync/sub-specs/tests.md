# Tests Specification

This is the tests coverage details for the spec detailed in @.agent-os/specs/2025-08-22-comment-storage-sync/spec.md

> Created: 2025-08-22
> Version: 1.0.0

## Test Coverage

### Unit Tests

**AzureDevOpsClient**

- Test comment fetching with valid work item ID
- Test comment fetching with invalid work item ID
- Test comment data mapping from Azure DevOps JSON to WorkItemData interface
- Test error handling for Azure CLI command failures
- Test resilience policy application during comment sync

**DatabaseService**

- Test comment storage with valid comment data
- Test comment upsert logic for existing vs new comments
- Test comment retrieval by work item ID
- Test comment deletion when work item is removed
- Test transaction rollback on comment sync failures

**SyncService**

- Test incremental comment sync based on work item change detection
- Test comment sync integration with existing work item sync workflow
- Test comment sync performance impact on overall sync time
- Test comment sync error handling without breaking main sync

### Integration Tests

**Comment Sync Workflow**

- End-to-end test of work item with comments sync from Azure DevOps to database
- Test comment sync with multiple work items containing varying comment counts
- Test incremental sync behavior when work items have new comments added
- Test sync recovery after Azure CLI failures during comment fetching

**MCP Server Integration**

- Test work item retrieval includes comment data in response
- Test new comment-specific MCP tools return proper JSON format
- Test MCP tool error handling for work items with no comments
- Test MCP tool performance with work items containing many comments

### Mocking Requirements

- **Azure CLI Commands:** Mock `az boards work-item relation list-url` responses with sample comment data
- **Database Operations:** Use in-memory SQLite for isolated test database state
- **Resilience Policies:** Mock @orchestr8/resilience to test retry and timeout scenarios
- **Time-based Tests:** Mock Date objects for testing comment timestamp handling and incremental sync logic

## Performance Test Scenarios

### Comment Sync Load Testing

- Test comment sync with work items containing 0, 1, 10, and 100+ comments
- Measure impact of comment sync on overall sync cycle time
- Test concurrent comment fetching for multiple work items
- Verify memory usage remains stable during large comment sync operations

### Database Performance Testing

- Test comment query performance with 1000+ comments across multiple work items
- Test comment insertion performance with batch operations
- Verify database indexes provide sub-100ms query times for comment retrieval
- Test database transaction performance during comment upsert operations

## Error Scenario Testing

### Azure CLI Failure Scenarios

- Test comment sync when Azure CLI returns empty response
- Test comment sync when Azure CLI returns malformed JSON
- Test comment sync when work item has comments but CLI command fails
- Test graceful degradation when comment sync fails but work item sync succeeds

### Data Integrity Testing

- Test comment sync preserves referential integrity with work items
- Test comment sync handles Azure DevOps comment ID changes correctly
- Test comment sync maintains proper timestamps during updates
- Test comment sync rollback scenarios on database constraint violations
