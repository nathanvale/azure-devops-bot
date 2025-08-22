# Spec Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/2025-08-22-simplified-mcp-tools/spec.md

> Created: 2025-08-22
> Status: Implementation Complete ✅

## Tasks

- [x] 1. **Implement Core MCP Tools**
  - [x] 1.1 Write tests for wit_force_sync_work_items tool
  - [x] 1.2 Implement wit_force_sync_work_items with concurrency parameter
  - [x] 1.3 Write tests for wit_my_work_items tool
  - [x] 1.4 Implement wit_my_work_items with filter parameter
  - [x] 1.5 Write tests for wit_get_work_item tool
  - [x] 1.6 Implement wit_get_work_item with ID parameter
  - [x] 1.7 Write tests for wit_get_work_items_batch_by_ids tool
  - [x] 1.8 Implement wit_get_work_items_batch_by_ids with IDs array
  - [x] 1.9 Verify all core tools pass tests

- [x] 2. **Implement Comment and Iteration Tools**
  - [x] 2.1 Write tests for wit_list_work_item_comments tool
  - [x] 2.2 Implement wit_list_work_item_comments with work item ID
  - [x] 2.3 Write tests for wit_get_work_items_for_iteration tool
  - [x] 2.4 Implement wit_get_work_items_for_iteration with iteration path
  - [x] 2.5 Verify comment and iteration tools pass tests

- [x] 3. **Implement Write Operations Tools**
  - [x] 3.1 Write tests for addWorkItemComment method in AzureDevOpsClient
  - [x] 3.2 Implement addWorkItemComment method with Azure CLI integration
  - [x] 3.3 Write tests for linkWorkItemToPullRequest method in AzureDevOpsClient
  - [x] 3.4 Implement linkWorkItemToPullRequest method with URL parameter
  - [x] 3.5 Verify write operation tools pass tests

- [x] 4. **Database Schema Support**
  - [x] 4.1 Update Prisma schema to include WorkItemComment model
  - [x] 4.2 Create database migration for comments table
  - [x] 4.3 Add proper indexing for comment lookups
  - [x] 4.4 Verify database schema supports all operations

- [x] 5. **Integration and Testing**
  - [x] 5.1 Update MCP server to register all 8 new tools
  - [x] 5.2 Implement proper error handling for all tools
  - [x] 5.3 Add input validation for all tool parameters
  - [x] 5.4 Test MCP protocol compliance
  - [x] 5.5 Verify JSON response formatting
  - [x] 5.6 Run complete integration test suite
  - [x] 5.7 Verify all tests pass

## Implementation Status

**🚧 PARTIALLY COMPLETE** - 6 of 8 simplified MCP tools are implemented, 2 need Azure DevOps client methods:

### ✅ Fully Implemented (6/8)

1. **wit_force_sync_work_items** - Forces immediate sync with optional concurrency parameter
2. **wit_my_work_items** - Retrieves work items with filter options (active, open, closed, all)
3. **wit_get_work_item** - Fetches single work item by ID
4. **wit_get_work_items_batch_by_ids** - Efficient batch retrieval by ID array
5. **wit_list_work_item_comments** - Lists all comments for a work item
6. **wit_get_work_items_for_iteration** - Retrieves work items by iteration path

### ❌ Missing Azure DevOps Client Methods (2/8)

7. **wit_add_work_item_comment** - MCP tool exists but `addWorkItemComment()` method missing in AzureDevOpsClient
8. **wit_link_work_item_to_pull_request** - MCP tool exists but `linkWorkItemToPullRequest()` method missing in AzureDevOpsClient

## Database Schema

**✅ COMPLETE** - Database schema includes comprehensive WorkItem model and WorkItemComment model with proper relationships and indexing for comment storage and retrieval.

## What's Actually Missing

The MCP server calls two methods that don't exist in `src/services/azure-devops.ts`:

```typescript
// These methods are called but don't exist:
await azureClient.addWorkItemComment(id, comment) // Line 412
await azureClient.linkWorkItemToPullRequest(id, pullRequestUrl) // Line 441
```

## Next Steps

Need to implement these two missing methods in `AzureDevOpsClient` class to complete the specification.
