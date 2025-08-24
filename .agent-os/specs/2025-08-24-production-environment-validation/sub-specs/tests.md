# Tests Specification

This is the tests coverage details for the spec detailed in @.agent-os/specs/2025-08-24-production-environment-validation/spec.md

> Created: 2025-08-24
> Version: 1.0.0

## Test Coverage

### Integration Tests

**Production Authentication**
- PAT authentication against real fwcdev Azure DevOps organization
- Token permission validation for work items read & write access
- Organization and project configuration validation

**MCP Tools Production Validation**
- wit_my_work_items with real user data and work item assignments
- wit_get_work_item with actual work item IDs from Customer Services Platform
- wit_get_work_items_batch_by_ids with production work item ID batches
- wit_list_work_item_comments with real work item comment history
- wit_get_work_items_for_iteration with actual sprint iteration data
- wit_add_work_item_comment with real work item comment creation
- wit_link_work_item_to_pull_request with actual GitHub PR integration
- wit_force_sync_work_items with production data synchronization

**Data Sync Production Testing**
- Full sync of 1,056+ work items from Customer Services Platform project
- Comprehensive field extraction validation against Azure DevOps web interface
- Comment synchronization accuracy with real work item discussion history
- Raw JSON backup validation for data completeness

### Performance Tests

**Sync Performance Benchmarking**
- Measure complete project sync time with 1,056+ work items (target: ≤ 30 seconds)
- Monitor memory usage during large data synchronization operations
- Validate batch processing efficiency with real Azure DevOps API responses
- Test rate limiting handling with X-RateLimit-Remaining header monitoring

**Query Performance Validation**
- SQLite query response times under production data load (target: ≤ 100ms)
- Database indexing effectiveness with real data patterns
- Concurrent query handling with multiple MCP tool requests
- Memory usage stability during high-frequency query operations

### Reliability Tests

**Error Handling Scenarios**
- Network connectivity failures during sync operations
- Azure DevOps API authentication token expiration handling
- Rate limiting response and exponential backoff behavior
- Partial sync failure recovery and data consistency maintenance

**PM2 Service Management**
- Process crash recovery and automatic restart functionality
- Memory leak detection during extended operation periods
- Boot persistence and LaunchAgent configuration validation
- Service health monitoring and status reporting accuracy

### Data Integrity Tests

**Production Data Accuracy**
- Work item field mapping accuracy between Azure DevOps and local SQLite
- Comment synchronization completeness and chronological ordering
- User assignment and metadata preservation across sync cycles
- Special character and Unicode handling in work item descriptions

**Edge Case Validation**
- Large work item descriptions (>10KB text content)
- Work items with extensive comment histories (50+ comments)
- Work items with complex parent/child relationships
- Custom field handling for organization-specific Azure DevOps configuration

## Mocking Requirements

**No Mocking for Production Validation**
- All tests use real Azure DevOps API connections and data
- Actual PAT authentication with production organization access
- Real SQLite database operations with production data volumes
- Genuine PM2 process management testing

**Environment Configuration**
- **AZURE_DEVOPS_PAT**: Production Personal Access Token with work items permissions
- **AZURE_DEVOPS_ORG**: "fwcdev" organization name
- **AZURE_DEVOPS_PROJECT**: "Customer Services Platform" project name
- **Test Duration**: Minimum 30-minute extended operation test for reliability validation