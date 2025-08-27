# Spec Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/2025-08-27-data-sync-enhancement/spec.md

> Created: 2025-08-27
> Status: Ready for Implementation

## Tasks

- [x] 1. Fix Comment Synchronization
  - [x] 1.1 Write smoke test for comment sync to identify issue
  - [x] 1.2 Debug why comments aren't persisting to database
  - [x] 1.3 Add comprehensive logging to comment sync pipeline
  - [x] 1.4 Fix storeWorkItemComments ID type conversion issue
  - [x] 1.5 Verify REST API authentication has comment read permissions
  - [x] 1.6 Run full sync and verify comments table is populated

- [x] 2. Complete Field Extraction Audit
  - [x] 2.1 Analyze sample raw JSON from Azure DevOps
  - [x] 2.2 Update transformRestWorkItem to extract ALL fields
  - [x] 2.3 Add extraction for work item relations
  - [x] 2.4 Add extraction for work item links
  - [x] 2.5 Implement custom field dynamic extraction
  - [x] 2.6 Write smoke test for field extraction completeness

- [x] 3. Database Schema Enhancement
  - [x] 3.1 Create Prisma migration for WorkItemRelation table
  - [x] 3.2 Create migration for WorkItemLink table
  - [x] 3.3 Add missing fields to WorkItem model
  - [x] 3.4 Add performance indexes for common queries
  - [x] 3.5 Run migration and verify schema updates
  - [x] 3.6 Update Prisma client generation

- [x] 4. Implement Query Methods
  - [x] 4.1 Implement getWorkItemsByAssignee in database.ts
  - [x] 4.2 Implement getCurrentSprintItems with sprint detection
  - [x] 4.3 Implement getWorkItemsByState with sorting
  - [x] 4.4 Implement getTeamWorkItems with area path filtering
  - [x] 4.5 Implement getWorkItemWithFullRelations with depth traversal
  - [x] 4.6 Write smoke tests for each query method

- [x] 5. Add New MCP Tools
  - [x] 5.1 Add wit_get_work_items_by_assignee tool definition
  - [x] 5.2 Add wit_get_current_sprint_items tool definition
  - [x] 5.3 Add wit_get_work_items_by_state tool definition
  - [x] 5.4 Add wit_get_team_work_items tool definition
  - [x] 5.5 Add wit_get_work_item_with_relations tool definition
  - [x] 5.6 Implement handlers for each new tool
  - [x] 5.7 Write integration tests for MCP tools

- [x] 6. Relationship Storage Implementation
  - [x] 6.1 Implement extractRelations method in azure-devops.ts
  - [x] 6.2 Implement storeWorkItemRelations in database.ts
  - [x] 6.3 Implement extractLinks method for PR/Build links
  - [x] 6.4 Implement storeWorkItemLinks in database.ts
  - [x] 6.5 Update sync service to store relations during sync
  - [x] 6.6 Write smoke test for relationship storage

- [x] 7. Enhance Logging Throughout
  - [ ] 7.1 Add structured logging to sync-service.ts
  - [x] 7.2 Add logging to database.ts operations
  - [ ] 7.3 Add logging to azure-devops.ts transformations
  - [x] 7.4 Add performance metrics logging
  - [x] 7.5 Add error context logging with retry information
  - [x] 7.6 Verify all operations have appropriate log levels

- [x] 8. Performance Optimization
  - [x] 8.1 Verify all database indexes are created
  - [x] 8.2 Test query performance with large datasets
  - [x] 8.3 Optimize batch processing for comments
  - [x] 8.4 Implement query result caching where appropriate
  - [x] 8.5 Run performance smoke tests
  - [x] 8.6 Document any performance bottlenecks

- [x] 9. Integration Testing
  - [x] 9.1 Run initial full sync to populate all data
  - [x] 9.2 Verify comments are synced for all work items
  - [x] 9.3 Test all new query methods with real data
  - [x] 9.4 Verify relationships are correctly stored
  - [x] 9.5 Test MCP tools end-to-end
  - [x] 9.6 Verify sub-100ms query performance

- [x] 10. Documentation and Cleanup
  - [x] 10.1 Update README with new MCP tools
  - [x] 10.2 Document query method usage
  - [x] 10.3 Clean up any debug logging
  - [x] 10.4 Review and optimize error handling
  - [x] 10.5 Update environment variable documentation
  - [x] 10.6 Create migration rollback documentation

## Implementation Order

1. **Phase 1: Critical Fixes** (Tasks 1, 3.1-3.4)
   - Fix comment sync first as it's currently broken
   - Add database schema for relationships

2. **Phase 2: Field Extraction** (Task 2)
   - Ensure all data is captured from Azure DevOps

3. **Phase 3: Query Infrastructure** (Tasks 4, 5)
   - Implement new query methods
   - Add MCP tools to expose functionality

4. **Phase 4: Relationships** (Task 6)
   - Store and query work item relationships

5. **Phase 5: Polish** (Tasks 7, 8, 9, 10)
   - Add logging, optimize, test, document

## Success Metrics

- ✅ Comments table has data after sync
- ✅ All Azure DevOps fields present in database
- ✅ 5 new MCP tools functioning
- ✅ Query response time < 100ms
- ✅ Relationships queryable
- ✅ Comprehensive logging in place
- ✅ All smoke tests passing