# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-08-22-comment-storage-sync/spec.md

> Created: 2025-08-22
> Version: 1.0.0

## Technical Requirements

- Extend existing Azure DevOps sync service to fetch work item comments using `az boards work-item relation list-url` command
- Implement incremental comment syncing based on work item `changedDate` to avoid re-syncing unchanged items
- Add comment storage logic to database service using existing Prisma WorkItemComment model
- Integrate comment sync into existing background sync workflow without impacting performance
- Handle Azure CLI rate limiting and error scenarios gracefully using existing resilience policies
- Provide comment access through enhanced MCP tools for AI agent consumption

## Approach Options

**Option A:** Sync all comments for all work items on every sync cycle

- Pros: Simple implementation, guaranteed data completeness
- Cons: Very slow, high API usage, unnecessary work

**Option B:** Incremental sync based on work item change detection (Selected)

- Pros: Fast sync cycles, efficient API usage, scalable approach
- Cons: Requires change tracking logic, slightly more complex

**Option C:** Real-time comment webhooks

- Pros: Instant updates, minimal API usage
- Cons: Complex webhook setup, not aligned with local-only philosophy

**Rationale:** Option B provides the best balance of performance and simplicity while maintaining the local-first architecture. It leverages existing work item metadata to determine when comment sync is needed.

## External Dependencies

No new external dependencies required. Implementation uses:

- **Azure CLI** - Already in use for work item fetching
- **@orchestr8/resilience** - Already configured for Azure CLI resilience policies
- **Prisma** - Existing ORM with WorkItemComment model already defined

## Implementation Details

### Azure CLI Comment Commands

```bash
# List all comments for a work item
az boards work-item relation list-url --id 12345 --output json

# Alternative approach if relation command doesn't work
az rest --method GET --uri "https://dev.azure.com/{organization}/{project}/_apis/wit/workItems/{id}/comments?api-version=7.0"
```

### Comment Data Mapping

Map Azure DevOps comment JSON to WorkItemComment model:

- `id` → Azure comment ID (string)
- `workItemId` → Parent work item ID (number)
- `text` → Comment content (string)
- `createdBy` → Author display name (string)
- `createdDate` → Creation timestamp (DateTime)
- `modifiedBy` → Last modifier (string, nullable)
- `modifiedDate` → Last modification timestamp (DateTime, nullable)

### Sync Strategy

1. During work item sync, check if `commentCount > 0` and `changedDate` is newer than last sync
2. If comments need syncing, fetch all comments for that work item
3. Compare with existing stored comments and upsert only changed/new comments
4. Update work item `lastSyncedAt` timestamp after successful comment sync

### Error Handling

- Use existing resilience policies for Azure CLI commands
- Skip comment sync for individual work items if Azure CLI fails
- Log comment sync failures without breaking overall sync process
- Retry comment fetching with exponential backoff on transient failures
