# Database Schema

This is the database schema implementation for the spec detailed in @.agent-os/specs/2025-08-22-simplified-mcp-tools/spec.md

> Created: 2025-08-22
> Version: 1.0.0

## Schema Changes Required

### New Comments Table

The current schema only stores work item data but not comments. Comments are essential for the `wit_list_work_item_comments` tool.

```prisma
model Comment {
  id           String   @id
  workItemId   Int
  text         String
  author       String?
  createdDate  String?
  modifiedDate String?
  workItem     WorkItem @relation(fields: [workItemId], references: [id])

  @@index([workItemId])
  @@map("Comment")
}
```

### Updated WorkItem Model

Add relation to comments:

```prisma
model WorkItem {
  // ... existing fields ...
  comments Comment[]

  // ... existing indexes ...
}
```

## Database Migration

```sql
-- Migration: Add comments table
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workItemId" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "author" TEXT,
    "createdDate" TEXT,
    "modifiedDate" TEXT,
    CONSTRAINT "Comment_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Add index for fast comment lookups by work item
CREATE INDEX "Comment_workItemId_idx" ON "Comment"("workItemId");
```

## Index Optimization

### Existing Indexes (Verify Performance)

Current WorkItem table should have these indexes for optimal query performance:

```sql
-- Essential indexes for new MCP tools
CREATE INDEX IF NOT EXISTS "WorkItem_assignedTo_idx" ON "WorkItem"("assignedTo");
CREATE INDEX IF NOT EXISTS "WorkItem_state_idx" ON "WorkItem"("state");
CREATE INDEX IF NOT EXISTS "WorkItem_iterationPath_idx" ON "WorkItem"("iterationPath");
CREATE INDEX IF NOT EXISTS "WorkItem_createdDate_idx" ON "WorkItem"("createdDate");
CREATE INDEX IF NOT EXISTS "WorkItem_id_idx" ON "WorkItem"("id"); -- Primary key, likely automatic
```

### Query Performance Targets

- **Single work item lookup**: < 1ms
- **User work items query**: < 50ms (up to 1000 items)
- **Batch work items query**: < 10ms (up to 100 IDs)
- **Iteration work items**: < 25ms (typical sprint has 20-50 items)
- **Work item comments**: < 5ms (typical work item has 5-20 comments)

## Data Integrity Constraints

### Foreign Key Relationships

```sql
-- Comments must reference valid work items
CONSTRAINT "Comment_workItemId_fkey"
  FOREIGN KEY ("workItemId") REFERENCES "WorkItem" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE
```

### Data Validation

- **workItemId**: Must be positive integer matching existing WorkItem.id
- **comment.text**: Must be non-empty string, max 8000 characters
- **comment.author**: Should match email format when provided
- **comment.id**: Should match Azure DevOps comment ID format (typically GUID)

## Migration Strategy

1. **Generate Prisma Migration**: `pnpm prisma migrate dev --name add-comments-table`
2. **Verify Schema**: Check that foreign key relationships are properly created
3. **Test Indexes**: Run sample queries to verify performance targets
4. **Backfill Data**: Sync existing comments from Azure DevOps for all work items

## Rollback Plan

```sql
-- Rollback migration if needed
DROP INDEX IF EXISTS "Comment_workItemId_idx";
DROP TABLE IF EXISTS "Comment";
```

## Storage Impact

- **Comments table**: Estimated 10-50KB per work item (typical)
- **Index overhead**: Additional 2-5KB per work item
- **Total impact**: < 100KB per work item for comprehensive comment history
- **Growth rate**: Proportional to team activity, typically 1-5 comments per work item per month
