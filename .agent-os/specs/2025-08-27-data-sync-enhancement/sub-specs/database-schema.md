# Database Schema

This is the database schema implementation for the spec detailed in @.agent-os/specs/2025-08-27-data-sync-enhancement/spec.md

> Created: 2025-08-27
> Version: 1.0.0

## Schema Changes

### New Tables for Relationships

```prisma
// Add to schema.prisma

model WorkItemRelation {
  id            String   @id @default(cuid())
  sourceId      Int      @map("source_id")
  targetId      Int      @map("target_id")
  relationType  String   @map("relation_type")
  attributes    String?  // JSON string for additional attributes
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")
  
  // Relations
  sourceWorkItem WorkItem @relation("SourceRelations", fields: [sourceId], references: [id], onDelete: Cascade)
  targetWorkItem WorkItem @relation("TargetRelations", fields: [targetId], references: [id], onDelete: Cascade)
  
  @@unique([sourceId, targetId, relationType])
  @@index([sourceId])
  @@index([targetId])
  @@index([relationType])
  @@map("work_item_relations")
}

model WorkItemLink {
  id           String   @id @default(cuid())
  workItemId   Int      @map("work_item_id")
  linkType     String   @map("link_type") // PullRequest, Build, Branch, etc.
  url          String
  title        String?
  state        String?  // For PR: Open, Merged, Closed
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")
  
  // Relations
  workItem     WorkItem @relation(fields: [workItemId], references: [id], onDelete: Cascade)
  
  @@unique([workItemId, url])
  @@index([workItemId])
  @@index([linkType])
  @@map("work_item_links")
}
```

### Enhanced WorkItem Model

```prisma
// Updates to existing WorkItem model

model WorkItem {
  // ... existing fields ...
  
  // Additional fields for complete Azure DevOps coverage
  boardLane         String?  @map("board_lane")
  activatedBy       String?  @map("activated_by")
  resolution        String?
  risk              String?
  businessValue     Float?   @map("business_value")
  timeCriticality   Float?   @map("time_criticality")
  
  // Store custom fields as JSON
  customFields      String?  @map("custom_fields") // JSON string
  
  // Enhanced relations
  sourceRelations   WorkItemRelation[] @relation("SourceRelations")
  targetRelations   WorkItemRelation[] @relation("TargetRelations")
  links             WorkItemLink[]
  
  // ... rest of existing model ...
}
```

### Performance Indexes

```prisma
// Additional indexes for query performance

model WorkItem {
  // ... existing fields and indexes ...
  
  @@index([assignedTo, state])
  @@index([iterationPath, state])
  @@index([areaPath])
  @@index([boardColumn, boardColumnDone])
  @@index([parentId])
  @@index([type, state])
  @@index([priority, state])
  
  // ... rest of model ...
}
```

## Migration SQL

```sql
-- Migration to add relationship tables and new fields

-- Create work_item_relations table
CREATE TABLE IF NOT EXISTS "work_item_relations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source_id" INTEGER NOT NULL,
    "target_id" INTEGER NOT NULL,
    "relation_type" TEXT NOT NULL,
    "attributes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "work_item_relations_source_id_fkey" 
        FOREIGN KEY ("source_id") REFERENCES "work_items" ("id") 
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "work_item_relations_target_id_fkey" 
        FOREIGN KEY ("target_id") REFERENCES "work_items" ("id") 
        ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create unique constraint
CREATE UNIQUE INDEX "work_item_relations_source_id_target_id_relation_type_key" 
    ON "work_item_relations"("source_id", "target_id", "relation_type");

-- Create indexes
CREATE INDEX "work_item_relations_source_id_idx" ON "work_item_relations"("source_id");
CREATE INDEX "work_item_relations_target_id_idx" ON "work_item_relations"("target_id");
CREATE INDEX "work_item_relations_relation_type_idx" ON "work_item_relations"("relation_type");

-- Create work_item_links table
CREATE TABLE IF NOT EXISTS "work_item_links" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "work_item_id" INTEGER NOT NULL,
    "link_type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "state" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "work_item_links_work_item_id_fkey" 
        FOREIGN KEY ("work_item_id") REFERENCES "work_items" ("id") 
        ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create unique constraint
CREATE UNIQUE INDEX "work_item_links_work_item_id_url_key" 
    ON "work_item_links"("work_item_id", "url");

-- Create indexes
CREATE INDEX "work_item_links_work_item_id_idx" ON "work_item_links"("work_item_id");
CREATE INDEX "work_item_links_link_type_idx" ON "work_item_links"("link_type");

-- Add new columns to work_items table
ALTER TABLE "work_items" ADD COLUMN "board_lane" TEXT;
ALTER TABLE "work_items" ADD COLUMN "activated_by" TEXT;
ALTER TABLE "work_items" ADD COLUMN "resolution" TEXT;
ALTER TABLE "work_items" ADD COLUMN "risk" TEXT;
ALTER TABLE "work_items" ADD COLUMN "business_value" REAL;
ALTER TABLE "work_items" ADD COLUMN "time_criticality" REAL;
ALTER TABLE "work_items" ADD COLUMN "custom_fields" TEXT;

-- Create performance indexes
CREATE INDEX IF NOT EXISTS "work_items_assignee_state_idx" 
    ON "work_items"("assigned_to", "state");
CREATE INDEX IF NOT EXISTS "work_items_iteration_state_idx" 
    ON "work_items"("iteration_path", "state");
CREATE INDEX IF NOT EXISTS "work_items_area_idx" 
    ON "work_items"("area_path");
CREATE INDEX IF NOT EXISTS "work_items_board_idx" 
    ON "work_items"("board_column", "board_column_done");
CREATE INDEX IF NOT EXISTS "work_items_parent_idx" 
    ON "work_items"("parent_id");
CREATE INDEX IF NOT EXISTS "work_items_type_state_idx" 
    ON "work_items"("type", "state");
CREATE INDEX IF NOT EXISTS "work_items_priority_state_idx" 
    ON "work_items"("priority", "state");
```

## Data Types and Constraints

### Relation Types
Common Azure DevOps relation types to store:
- `System.LinkTypes.Hierarchy-Forward` (Child)
- `System.LinkTypes.Hierarchy-Reverse` (Parent)
- `System.LinkTypes.Related` (Related)
- `System.LinkTypes.Duplicate-Forward` (Duplicate)
- `System.LinkTypes.Duplicate-Reverse` (Duplicate Of)
- `System.LinkTypes.Dependency-Forward` (Successor)
- `System.LinkTypes.Dependency-Reverse` (Predecessor)

### Link Types
Common link types to track:
- `PullRequest` - Associated pull requests
- `Build` - Related builds
- `Branch` - Source control branches
- `Commit` - Git commits
- `VersionedItem` - Files or artifacts
- `WikiPage` - Documentation links
- `ExternalLink` - External URLs

### Custom Fields JSON Structure
```json
{
  "Custom.FieldName1": "value1",
  "Custom.FieldName2": 123,
  "Custom.FieldName3": true,
  "OrgSpecific.CustomField": "custom value"
}
```

## Query Performance Considerations

### Optimized Queries

```sql
-- Query work items with their comments count
SELECT 
  w.*,
  COUNT(c.id) as comment_count
FROM work_items w
LEFT JOIN work_item_comments c ON w.id = c.work_item_id
GROUP BY w.id;

-- Query work items with their relationships
SELECT 
  w.*,
  json_group_array(
    json_object(
      'targetId', r.target_id,
      'relationType', r.relation_type,
      'targetTitle', tw.title
    )
  ) as relations
FROM work_items w
LEFT JOIN work_item_relations r ON w.id = r.source_id
LEFT JOIN work_items tw ON r.target_id = tw.id
GROUP BY w.id;

-- Query current sprint items with parent info
SELECT 
  w.*,
  p.title as parent_title,
  p.state as parent_state
FROM work_items w
LEFT JOIN work_items p ON w.parent_id = p.id
WHERE w.iteration_path LIKE '%Sprint%'
  AND w.state != 'Closed'
ORDER BY w.priority ASC, w.stack_rank ASC;
```

## Rollback Strategy

```sql
-- Rollback script if needed

-- Drop new tables
DROP TABLE IF EXISTS "work_item_relations";
DROP TABLE IF EXISTS "work_item_links";

-- Remove new columns from work_items
-- Note: SQLite doesn't support DROP COLUMN directly
-- Would need to recreate table without new columns
```

## Data Migration Notes

1. After schema migration, run full sync to populate:
   - Relations from existing raw JSON
   - Links from existing raw JSON
   - New fields from existing raw JSON

2. Ensure backward compatibility:
   - New fields are nullable
   - Existing queries continue to work
   - Raw JSON remains source of truth

3. Performance testing required for:
   - Queries with new indexes
   - JOIN operations with relations
   - Large dataset performance