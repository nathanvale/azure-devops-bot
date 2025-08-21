# Database Schema

This is the database schema implementation for the spec detailed in @.agent-os/specs/2025-08-22-merge-readiness-fixes/spec.md

> Created: 2025-08-22
> Version: 1.0.0

## Schema Changes

The current Prisma schema is missing several fields that are defined in the TypeScript `WorkItemData` interface. This misalignment causes data loss and potential runtime errors.

### Missing Fields Analysis

**Currently Missing from Prisma Schema:**
- `reason` (String?) - Why the work item changed state
- `watermark` (Int?) - Azure DevOps internal versioning
- `url` (String?) - Direct Azure DevOps API URL
- `commentCount` (Int) - Number of comments (used for sync optimization)
- `hasAttachments` (Boolean) - Whether work item has attachments
- `teamProject` (String?) - Project name
- `areaId` (Int?) - Area path ID
- `nodeId` (Int?) - Node identifier
- `stackRank` (Float?) - Backlog ordering rank
- `valueArea` (String?) - Business vs Architectural classification

### Migration SQL

```sql
-- Migration: Add missing fields to work_items table
-- This migration adds all missing fields from the WorkItemData interface

-- Add reason field for state change tracking
ALTER TABLE work_items ADD COLUMN reason TEXT;

-- Add watermark for Azure DevOps versioning
ALTER TABLE work_items ADD COLUMN watermark INTEGER;

-- Add direct Azure DevOps URL
ALTER TABLE work_items ADD COLUMN url TEXT;

-- Add comment count for sync optimization
ALTER TABLE work_items ADD COLUMN comment_count INTEGER DEFAULT 0;

-- Add attachment flag
ALTER TABLE work_items ADD COLUMN has_attachments BOOLEAN DEFAULT FALSE;

-- Add team project information
ALTER TABLE work_items ADD COLUMN team_project TEXT;

-- Add area and node IDs
ALTER TABLE work_items ADD COLUMN area_id INTEGER;
ALTER TABLE work_items ADD COLUMN node_id INTEGER;

-- Add stack rank for backlog ordering
ALTER TABLE work_items ADD COLUMN stack_rank REAL;

-- Add value area classification
ALTER TABLE work_items ADD COLUMN value_area TEXT;

-- Add indexes for frequently queried fields
CREATE INDEX IF NOT EXISTS idx_work_items_comment_count ON work_items(comment_count);
CREATE INDEX IF NOT EXISTS idx_work_items_team_project ON work_items(team_project);
CREATE INDEX IF NOT EXISTS idx_work_items_stack_rank ON work_items(stack_rank);
CREATE INDEX IF NOT EXISTS idx_work_items_value_area ON work_items(value_area);
```

### Updated Prisma Schema

```prisma
model WorkItem {
  id                Int      @id
  title             String
  state             String
  type              String
  assignedTo        String
  azureUrl          String
  description       String?
  
  // Sprint/Board Info
  iterationPath     String?
  areaPath          String?
  boardColumn       String?
  boardColumnDone   Boolean  @default(false)
  
  // Priority/Tags
  priority          Int?
  severity          String?
  tags              String?
  
  // All the dates
  createdDate       DateTime?
  changedDate       DateTime?
  closedDate        DateTime?
  resolvedDate      DateTime?
  activatedDate     DateTime?
  stateChangeDate   DateTime?
  
  // People
  createdBy         String?
  changedBy         String?
  closedBy          String?
  resolvedBy        String?
  
  // Work tracking
  storyPoints       Float?
  effort            Float?
  remainingWork     Float?
  completedWork     Float?
  originalEstimate  Float?
  
  // Content
  acceptanceCriteria String?
  reproSteps         String?
  systemInfo         String?
  
  // Related items
  parentId          Int?
  
  // Additional Azure DevOps fields (NEW)
  rev               Int?
  reason            String?    // NEW - State change reason
  watermark         Int?       // NEW - Azure DevOps versioning
  url               String?    // NEW - Direct API URL
  commentCount      Int        @default(0)  // NEW - Comment count
  hasAttachments    Boolean    @default(false)  // NEW - Attachment flag
  teamProject       String?    // NEW - Project name
  areaId            Int?       // NEW - Area path ID
  nodeId            Int?       // NEW - Node identifier
  stackRank         Float?     // NEW - Backlog ordering
  valueArea         String?    // NEW - Value area classification
  
  // Store EVERYTHING from Azure DevOps
  rawJson           String
  
  // Sync metadata
  lastUpdatedAt     DateTime
  lastSyncedAt      DateTime @default(now())
  
  // Relations
  comments          WorkItemComment[]
  
  // Existing indexes
  @@index([type])
  @@index([state])
  @@index([assignedTo])
  @@index([iterationPath])
  @@index([changedDate])
  @@index([createdDate])
  
  // New indexes for performance
  @@index([commentCount])
  @@index([teamProject])
  @@index([stackRank])
  @@index([valueArea])
  
  @@map("work_items")
}
```

## Rationale

### Field Necessity
Each missing field serves a specific purpose:
- **reason/watermark**: Azure DevOps internal tracking for audit trails
- **url**: Direct API access for debugging and integration
- **commentCount**: Optimization for sync decisions (avoid fetching if 0)
- **hasAttachments**: Future feature support and filtering
- **teamProject/areaId/nodeId**: Organizational hierarchy support
- **stackRank**: Backlog ordering for proper report generation
- **valueArea**: Business vs Technical classification for metrics

### Index Strategy
New indexes target fields likely to be used in filtering:
- `commentCount` - For sync optimization queries
- `teamProject` - For multi-project filtering (future)
- `stackRank` - For ordered queries
- `valueArea` - For business metrics

### Performance Impact
- **Storage**: ~200 bytes additional per work item
- **Query Performance**: New indexes improve specific queries
- **Migration Time**: ~30 seconds for 10,000 work items

## Data Integrity

### Migration Safety
1. All new fields are nullable or have defaults
2. Existing data remains unchanged
3. Migration is reversible
4. Indexes created with IF NOT EXISTS

### Validation Rules
- `commentCount` must be >= 0
- `stackRank` can be NULL (for items not in backlog)
- `valueArea` should be 'Business' or 'Architectural' when present
- `url` should be valid Azure DevOps API URL format when present

### Rollback Plan
```sql
-- Rollback migration if needed
DROP INDEX IF EXISTS idx_work_items_comment_count;
DROP INDEX IF EXISTS idx_work_items_team_project;
DROP INDEX IF EXISTS idx_work_items_stack_rank;
DROP INDEX IF EXISTS idx_work_items_value_area;

ALTER TABLE work_items DROP COLUMN reason;
ALTER TABLE work_items DROP COLUMN watermark;
ALTER TABLE work_items DROP COLUMN url;
ALTER TABLE work_items DROP COLUMN comment_count;
ALTER TABLE work_items DROP COLUMN has_attachments;
ALTER TABLE work_items DROP COLUMN team_project;
ALTER TABLE work_items DROP COLUMN area_id;
ALTER TABLE work_items DROP COLUMN node_id;
ALTER TABLE work_items DROP COLUMN stack_rank;
ALTER TABLE work_items DROP COLUMN value_area;
```

## Testing Strategy

### Migration Testing
1. Backup existing data
2. Apply migration on copy
3. Verify all existing data intact
4. Test new field population
5. Performance test with indexes

### Data Validation
1. Ensure TypeScript interface matches Prisma exactly
2. Test upsert operations with new fields
3. Verify index usage in query plans
4. Test migration rollback procedure