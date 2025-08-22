# Database Schema

This is the database schema implementation for the spec detailed in @.agent-os/specs/2025-08-21-comprehensive-schema/spec.md

> Created: 2025-08-21
> Version: 1.0.0

## Schema Changes

### New Fields to Add

Based on Azure DevOps `--expand all` output, the following fields need to be added to the WorkItem model:

**Work Item Fields:**

- `rev` (Int) - Revision number
- `reason` (String) - State change reason
- `watermark` (Int) - Change tracking watermark
- `url` (String) - Full REST API URL
- `commentCount` (Int) - Number of comments
- `hasAttachments` (Boolean) - Has file attachments
- `teamProject` (String) - Project name
- `areaId` (Int) - Area path ID
- `nodeId` (Int) - Iteration path ID
- `boardId` (Int) - Board identifier

**Custom Fields Support:**

- `customFields` (String) - JSON storage for any custom fields
- `microsoftVSTSCommonResolvedReason` (String) - Resolution reason
- `microsoftVSTSCommonStackRank` (Float) - Stack ranking value
- `microsoftVSTSCommonValueArea` (String) - Value area classification

**Relations:**

- `relations` (String) - JSON array of work item relationships
- `hyperlinks` (String) - JSON array of hyperlink relationships

### Migration SQL

```sql
-- Add comprehensive Azure DevOps fields
ALTER TABLE work_items ADD COLUMN rev INTEGER;
ALTER TABLE work_items ADD COLUMN reason TEXT;
ALTER TABLE work_items ADD COLUMN watermark INTEGER;
ALTER TABLE work_items ADD COLUMN url TEXT;
ALTER TABLE work_items ADD COLUMN commentCount INTEGER DEFAULT 0;
ALTER TABLE work_items ADD COLUMN hasAttachments BOOLEAN DEFAULT FALSE;
ALTER TABLE work_items ADD COLUMN teamProject TEXT;
ALTER TABLE work_items ADD COLUMN areaId INTEGER;
ALTER TABLE work_items ADD COLUMN nodeId INTEGER;
ALTER TABLE work_items ADD COLUMN boardId INTEGER;

-- Custom and dynamic fields
ALTER TABLE work_items ADD COLUMN customFields TEXT; -- JSON storage
ALTER TABLE work_items ADD COLUMN microsoftVSTSCommonResolvedReason TEXT;
ALTER TABLE work_items ADD COLUMN microsoftVSTSCommonStackRank REAL;
ALTER TABLE work_items ADD COLUMN microsoftVSTSCommonValueArea TEXT;

-- Relationships
ALTER TABLE work_items ADD COLUMN relations TEXT; -- JSON array
ALTER TABLE work_items ADD COLUMN hyperlinks TEXT; -- JSON array

-- Performance indexes for new commonly-queried fields
CREATE INDEX idx_work_items_rev ON work_items(rev);
CREATE INDEX idx_work_items_watermark ON work_items(watermark);
CREATE INDEX idx_work_items_teamProject ON work_items(teamProject);
CREATE INDEX idx_work_items_commentCount ON work_items(commentCount);
CREATE INDEX idx_work_items_hasAttachments ON work_items(hasAttachments);
```

## Rationale

**Field Selection:** Based on analysis of `az boards work-item show --expand all` JSON output
**Data Types:** Conservative approach using nullable fields to handle missing data
**JSON Storage:** Custom fields stored as JSON to handle organization-specific customizations
**Indexing Strategy:** Focus on fields likely to be used in queries and filters
**Backward Compatibility:** All existing fields preserved, only additions made

## Data Integrity

- All new fields are nullable to handle existing records
- Default values provided where appropriate (commentCount: 0, hasAttachments: false)
- rawJson field continues to provide complete backup of all Azure DevOps data
- Migration is additive-only to prevent data loss
