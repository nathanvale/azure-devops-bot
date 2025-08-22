# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-08-22-simplified-mcp-tools/spec.md

> Created: 2025-08-22
> Version: 1.0.0

## Technical Requirements

- All MCP tools must return structured JSON responses with consistent error handling
- Database queries must be optimized with proper indexing for sub-100ms response times
- Tools must integrate with existing Prisma ORM and SQLite database schema
- Azure CLI integration must handle authentication and rate limiting gracefully
- TypeScript strict mode compliance with proper type definitions
- MCP protocol 1.15+ compatibility with stdio transport

## Approach Options

**Option A: Extend Current MCP Server** (Selected)

- Pros: Leverages existing infrastructure, minimal code changes, maintains compatibility
- Cons: Some legacy code remains temporarily during transition

**Option B: Complete Rewrite of MCP Server**

- Pros: Clean slate, no legacy code
- Cons: High risk, extensive testing required, potential downtime

**Rationale:** Option A allows gradual migration while maintaining service availability. The existing MCP server foundation is solid and only needs tool replacement, not architectural changes.

## MCP Tool Specifications

### wit_force_sync_work_items

- **Purpose**: Force immediate sync of all work items from Azure DevOps
- **Parameters**: None
- **Response**: `{ syncedCount: number, lastSync: string, errors?: string[] }`
- **Implementation**: Call existing sync service directly, return status

### wit_my_work_items

- **Purpose**: Get work items relevant to authenticated user
- **Parameters**: `{ limit?: number, states?: string[] }`
- **Response**: `{ workItems: WorkItem[], total: number }`
- **Implementation**: Query database with user email filter, optional state filtering

### wit_get_work_item

- **Purpose**: Fetch single work item by ID
- **Parameters**: `{ id: number }`
- **Response**: `{ workItem: WorkItem | null }`
- **Implementation**: Direct database lookup by ID with full field population

### wit_get_work_items_batch_by_ids

- **Purpose**: Fetch multiple work items efficiently
- **Parameters**: `{ ids: number[] }`
- **Response**: `{ workItems: WorkItem[], notFound: number[] }`
- **Implementation**: Single SQL query with WHERE id IN clause

### wit_list_work_item_comments

- **Purpose**: Get all comments for work item
- **Parameters**: `{ workItemId: number }`
- **Response**: `{ comments: Comment[], total: number }`
- **Implementation**: Join query between WorkItem and Comment tables

### wit_get_work_items_for_iteration

- **Purpose**: Get work items for specific iteration
- **Parameters**: `{ iterationPath: string, includeCompleted?: boolean }`
- **Response**: `{ workItems: WorkItem[], iterationName: string }`
- **Implementation**: Filter by iterationPath field with optional state filtering

### wit_add_work_item_comment

- **Purpose**: Add comment to work item
- **Parameters**: `{ workItemId: number, text: string }`
- **Response**: `{ success: boolean, commentId?: string, error?: string }`
- **Implementation**: Use Azure CLI to add comment, then sync comment to local DB

### wit_link_work_item_to_pull_request

- **Purpose**: Link work item to pull request
- **Parameters**: `{ workItemId: number, pullRequestUrl: string }`
- **Response**: `{ success: boolean, linkId?: string, error?: string }`
- **Implementation**: Use Azure CLI to create link, store relationship metadata

## Database Schema Requirements

Current schema supports all operations except comments table:

```sql
-- Comments table (new requirement)
CREATE TABLE Comment (
  id TEXT PRIMARY KEY,
  workItemId INTEGER NOT NULL,
  text TEXT NOT NULL,
  author TEXT,
  createdDate TEXT,
  modifiedDate TEXT,
  FOREIGN KEY (workItemId) REFERENCES WorkItem(id)
);

-- Index for fast comment lookups
CREATE INDEX idx_comment_work_item_id ON Comment(workItemId);
```

## Error Handling Strategy

- **Authentication Errors**: Return structured error with guidance to run `az login`
- **Rate Limiting**: Implement exponential backoff with clear error messages
- **Database Errors**: Transaction rollback with detailed error context
- **Validation Errors**: Parameter validation with specific field error messages
- **Azure CLI Failures**: Capture stderr output and provide actionable error messages

## External Dependencies

No new external dependencies required. Uses existing:

- **Azure CLI**: Already installed and configured
- **Prisma**: Current ORM handles all database operations
- **MCP Protocol**: Existing server infrastructure
- **TypeScript**: Current compilation toolchain
