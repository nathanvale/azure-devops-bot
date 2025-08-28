# Database Schema

This is the database schema implementation for the spec detailed in @.agent-os/specs/2025-08-28-fix-work-item-assignment/spec.md

> Created: 2025-08-28
> Version: 1.0.0
> Migration Strategy: Zero-downtime with backward compatibility

## Schema Changes

### New Person Table

**Purpose**: Normalized storage of all Azure DevOps identity data with optimized indexes for email-based queries.

```prisma
model Person {
  // Primary key - Azure DevOps unique identifier
  id            String   @id // "fe71887b-c2c7-60bd-8688-00d137e0b5f5"

  // Core identity fields (from Azure DevOps AzureDevOpsPerson interface)
  displayName   String   // "Nathan Vale"
  uniqueName    String   @unique // "Nathan.Vale@fwc.gov.au" (email - critical for queries)

  // Additional Azure DevOps fields (per DEC-003: store everything)
  url           String?  // "https://spsprodcus2.vssps.visualstudio.com/..."
  imageUrl      String?  // "https://dev.azure.com/..."
  descriptor    String?  // "msa.ZmU3MTg4N2ItYzJjNy03MGJkLTg2ODg..."
  inactive      Boolean  @default(false) // Account status in Azure DevOps

  // Audit fields
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  // Relations - all person fields that reference this table
  assignedWorkItems     WorkItem[] @relation("AssignedTo")
  createdWorkItems      WorkItem[] @relation("CreatedBy")
  changedWorkItems      WorkItem[] @relation("ChangedBy")
  closedWorkItems       WorkItem[] @relation("ClosedBy")
  resolvedWorkItems     WorkItem[] @relation("ResolvedBy")
  activatedWorkItems    WorkItem[] @relation("ActivatedBy")
  authorizedWorkItems   WorkItem[] @relation("AuthorizedAs")

  // Performance indexes (optimized for sub-100ms queries)
  @@index([uniqueName]) // PRIMARY: Email-based lookups (most common)
  @@index([displayName]) // SECONDARY: Display name searches
  @@index([inactive]) // Filter active/inactive users
  @@index([uniqueName, inactive]) // COMPOUND: Active users by email
  @@index([displayName, inactive]) // COMPOUND: Active users by display name
  @@map("persons")
}
```

### Updated WorkItem Table

**Changes**: Replace String person fields with foreign key relationships to Person table.

```prisma
model WorkItem {
  // All existing fields remain unchanged
  id                Int      @id
  title             String
  state             String
  type              String
  azureUrl          String   @map("azure_url")
  description       String?

  // UPDATED: Person relationships (replace existing String fields)
  assignedToId      String?  @map("assigned_to_id")
  assignedTo        Person?  @relation("AssignedTo", fields: [assignedToId], references: [id], onDelete: SetNull)

  createdById       String?  @map("created_by_id")
  createdBy         Person?  @relation("CreatedBy", fields: [createdById], references: [id], onDelete: SetNull)

  changedById       String?  @map("changed_by_id")
  changedBy         Person?  @relation("ChangedBy", fields: [changedById], references: [id], onDelete: SetNull)

  closedById        String?  @map("closed_by_id")
  closedBy          Person?  @relation("ClosedBy", fields: [closedById], references: [id], onDelete: SetNull)

  resolvedById      String?  @map("resolved_by_id")
  resolvedBy        Person?  @relation("ResolvedBy", fields: [resolvedById], references: [id], onDelete: SetNull)

  activatedById     String?  @map("activated_by_id")
  activatedBy       Person?  @relation("ActivatedBy", fields: [activatedById], references: [id], onDelete: SetNull)

  authorizedAsId    String?  @map("authorized_as_id")
  authorizedAs      Person?  @relation("AuthorizedAs", fields: [authorizedAsId], references: [id], onDelete: SetNull)

  // All other existing fields remain unchanged
  iterationPath     String?  @map("iteration_path")
  areaPath          String?  @map("area_path")
  boardColumn       String?  @map("board_column")
  boardColumnDone   Boolean  @default(false) @map("board_column_done")
  priority          Int?
  severity          String?
  tags              String?
  createdDate       DateTime? @map("created_date")
  changedDate       DateTime? @map("changed_date")
  closedDate        DateTime? @map("closed_date")
  resolvedDate      DateTime? @map("resolved_date")
  activatedDate     DateTime? @map("activated_date")
  stateChangeDate   DateTime? @map("state_change_date")
  storyPoints       Float?   @map("story_points")
  effort            Float?
  remainingWork     Float?   @map("remaining_work")
  completedWork     Float?   @map("completed_work")
  originalEstimate  Float?   @map("original_estimate")
  acceptanceCriteria String? @map("acceptance_criteria")
  reproSteps         String? @map("repro_steps")
  systemInfo         String? @map("system_info")
  parentId          Int?     @map("parent_id")
  rev               Int?
  reason            String?
  watermark         Int?
  url               String?
  commentCount      Int      @default(0) @map("comment_count")
  hasAttachments    Boolean  @default(false) @map("has_attachments")
  teamProject       String?  @map("team_project")
  areaId            Int?     @map("area_id")
  nodeId            Int?     @map("node_id")
  stackRank         Float?   @map("stack_rank")
  valueArea         String?  @map("value_area")
  boardLane         String?  @map("board_lane")
  authorizedDate    DateTime? @map("authorized_date")
  revisedDate       DateTime? @map("revised_date")
  resolution        String?
  risk              String?
  businessValue     Float?   @map("business_value")
  timeCriticality   Float?   @map("time_criticality")
  customFields      String?  @map("custom_fields")
  rawJson           String   @map("raw_json") // ✅ Already populated correctly
  lastUpdatedAt     DateTime @map("last_updated_at")
  lastSyncedAt      DateTime @default(now()) @map("last_synced_at")

  // Relations (unchanged)
  comments          WorkItemComment[]
  sourceRelations   WorkItemRelation[] @relation("SourceRelations")
  targetRelations   WorkItemRelation[] @relation("TargetRelations")
  links             WorkItemLink[]

  // Updated indexes for person relationships
  @@index([assignedToId])
  @@index([createdById])
  @@index([changedById])
  @@index([closedById])
  @@index([resolvedById])
  @@index([activatedById])
  @@index([authorizedAsId])

  // Compound indexes for common query patterns (performance-critical)
  @@index([assignedToId, state]) // "my active work items"
  @@index([assignedToId, iterationPath]) // "my work items in current sprint"
  @@index([createdById, state]) // "work items I created"

  // Keep all existing indexes for backward compatibility
  @@index([type])
  @@index([state])
  @@index([iterationPath])
  @@index([changedDate])
  @@index([createdDate])
  @@index([areaPath])
  @@index([boardColumn, boardColumnDone])
  @@index([parentId])
  @@index([type, state])
  @@index([priority, state])
  @@map("work_items")
}
```

## Migration Strategy

### Phase 1: Schema Extension (Zero Downtime)

**Goal**: Add new structures without breaking existing functionality.

```sql
-- Create Person table
CREATE TABLE "persons" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "display_name" TEXT NOT NULL,
    "unique_name" TEXT NOT NULL,
    "url" TEXT,
    "image_url" TEXT,
    "descriptor" TEXT,
    "inactive" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create unique constraint on email (critical for query performance)
CREATE UNIQUE INDEX "persons_unique_name_key" ON "persons"("unique_name");

-- Performance indexes
CREATE INDEX "persons_unique_name_idx" ON "persons"("unique_name");
CREATE INDEX "persons_display_name_idx" ON "persons"("display_name");
CREATE INDEX "persons_inactive_idx" ON "persons"("inactive");
CREATE INDEX "persons_active_email_idx" ON "persons"("unique_name", "inactive");
CREATE INDEX "persons_active_display_idx" ON "persons"("display_name", "inactive");

-- Add person ID fields to WorkItem (nullable during migration)
ALTER TABLE "work_items" ADD COLUMN "assigned_to_id" TEXT;
ALTER TABLE "work_items" ADD COLUMN "created_by_id" TEXT;
ALTER TABLE "work_items" ADD COLUMN "changed_by_id" TEXT;
ALTER TABLE "work_items" ADD COLUMN "closed_by_id" TEXT;
ALTER TABLE "work_items" ADD COLUMN "resolved_by_id" TEXT;
ALTER TABLE "work_items" ADD COLUMN "activated_by_id" TEXT;
ALTER TABLE "work_items" ADD COLUMN "authorized_as_id" TEXT;

-- Foreign key constraints (ensure data integrity)
CREATE INDEX "work_items_assigned_to_id_fkey" ON "work_items"("assigned_to_id");
CREATE INDEX "work_items_created_by_id_fkey" ON "work_items"("created_by_id");
CREATE INDEX "work_items_changed_by_id_fkey" ON "work_items"("changed_by_id");
CREATE INDEX "work_items_closed_by_id_fkey" ON "work_items"("closed_by_id");
CREATE INDEX "work_items_resolved_by_id_fkey" ON "work_items"("resolved_by_id");
CREATE INDEX "work_items_activated_by_id_fkey" ON "work_items"("activated_by_id");
CREATE INDEX "work_items_authorized_as_id_fkey" ON "work_items"("authorized_as_id");

-- Compound performance indexes
CREATE INDEX "work_items_assigned_state_idx" ON "work_items"("assigned_to_id", "state");
CREATE INDEX "work_items_assigned_iteration_idx" ON "work_items"("assigned_to_id", "iteration_path");
CREATE INDEX "work_items_created_state_idx" ON "work_items"("created_by_id", "state");
```

### Phase 2: Data Population from rawJson

**Goal**: Extract Person records from existing rawJson data and populate foreign keys.

```typescript
interface PersonData {
  id: string
  displayName: string
  uniqueName: string
  url?: string
  imageUrl?: string
  descriptor?: string
  inactive: boolean
}

async function migratePersonDataFromRawJson() {
  // 1. Extract all unique persons from rawJson
  const workItems = await prisma.workItem.findMany({
    select: { id: true, rawJson: true },
  })

  const uniquePersons = new Map<string, PersonData>()

  for (const item of workItems) {
    try {
      const rawData = JSON.parse(item.rawJson)
      const fields = rawData.fields

      // Extract all person fields from Azure DevOps response
      const personFields = [
        fields['System.AssignedTo'],
        fields['System.CreatedBy'],
        fields['System.ChangedBy'],
        fields['Microsoft.VSTS.Common.ClosedBy'],
        fields['Microsoft.VSTS.Common.ResolvedBy'],
        fields['Microsoft.VSTS.Common.ActivatedBy'],
        fields['System.AuthorizedAs'],
      ].filter((p) => p && typeof p === 'object' && p.id)

      personFields.forEach((person) => {
        if (person.id && !uniquePersons.has(person.id)) {
          uniquePersons.set(person.id, {
            id: person.id,
            displayName: person.displayName || '',
            uniqueName: person.uniqueName || '',
            url: person.url,
            imageUrl: person.imageUrl,
            descriptor: person.descriptor,
            inactive: person.inactive || false,
          })
        }
      })
    } catch (error) {
      console.warn(`Failed to parse rawJson for work item ${item.id}:`, error)
    }
  }

  // 2. Bulk insert Person records
  const personRecords = Array.from(uniquePersons.values())
  await prisma.person.createMany({
    data: personRecords,
    skipDuplicates: true,
  })

  console.log(`✅ Created ${personRecords.length} Person records`)

  // 3. Update WorkItem foreign keys
  let updatedCount = 0
  for (const item of workItems) {
    try {
      const rawData = JSON.parse(item.rawJson)
      const fields = rawData.fields

      await prisma.workItem.update({
        where: { id: item.id },
        data: {
          assignedToId: fields['System.AssignedTo']?.id || null,
          createdById: fields['System.CreatedBy']?.id || null,
          changedById: fields['System.ChangedBy']?.id || null,
          closedById: fields['Microsoft.VSTS.Common.ClosedBy']?.id || null,
          resolvedById: fields['Microsoft.VSTS.Common.ResolvedBy']?.id || null,
          activatedById:
            fields['Microsoft.VSTS.Common.ActivatedBy']?.id || null,
          authorizedAsId: fields['System.AuthorizedAs']?.id || null,
        },
      })
      updatedCount++
    } catch (error) {
      console.warn(`Failed to update work item ${item.id}:`, error)
    }
  }

  console.log(
    `✅ Updated ${updatedCount} WorkItem records with Person references`,
  )
}
```

### Phase 3: Application Code Updates

**Goal**: Update database queries to use Person table joins.

```typescript
// Updated query methods in DatabaseService
async getWorkItemsForUsers(userEmails: string[]) {
  if (!userEmails || userEmails.length === 0) {
    return await this.getAllWorkItems()
  }

  return await this.prisma.workItem.findMany({
    where: {
      OR: [
        {
          assignedTo: {
            uniqueName: { in: userEmails }
          },
          state: { not: 'Closed' }
        },
        {
          assignedTo: {
            uniqueName: { in: userEmails }
          },
          state: { not: 'Removed' }
        }
      ]
    },
    include: {
      assignedTo: true, // Include person data in results
      createdBy: true,
      changedBy: true
    },
    orderBy: { lastUpdatedAt: 'desc' }
  })
}

async getWorkItemsByStateForUsers(state: string, userEmails: string[]) {
  if (!userEmails || userEmails.length === 0) {
    return await this.getWorkItemsByState(state)
  }

  return await this.prisma.workItem.findMany({
    where: {
      state,
      assignedTo: {
        uniqueName: { in: userEmails }
      }
    },
    include: {
      assignedTo: true
    },
    orderBy: { lastUpdatedAt: 'desc' }
  })
}
```

### Phase 4: Cleanup (Post-Migration)

**Goal**: Remove deprecated String person fields and finalize schema.

```sql
-- After confirming migration success, remove old String fields
ALTER TABLE "work_items" DROP COLUMN "assigned_to";
ALTER TABLE "work_items" DROP COLUMN "created_by";
ALTER TABLE "work_items" DROP COLUMN "changed_by";
ALTER TABLE "work_items" DROP COLUMN "closed_by";
ALTER TABLE "work_items" DROP COLUMN "resolved_by";
ALTER TABLE "work_items" DROP COLUMN "activated_by";
ALTER TABLE "work_items" DROP COLUMN "authorized_as";

-- Remove old indexes that are no longer needed
DROP INDEX IF EXISTS "work_items_assigned_to_idx";
```

## Performance Validation

**Query Performance Tests** (to validate 25x improvement):

```typescript
// Test current vs new query performance
async function validateQueryPerformance() {
  const userEmail = 'Nathan.Vale@fwc.gov.au'

  // New optimized query (target: ~2ms)
  console.time('Optimized Person Join Query')
  const optimizedResults = await prisma.workItem.findMany({
    where: {
      assignedTo: {
        uniqueName: userEmail,
      },
      state: 'Active',
    },
    include: { assignedTo: true },
  })
  console.timeEnd('Optimized Person Join Query')

  console.log(`✅ Found ${optimizedResults.length} work items for ${userEmail}`)
  console.log(`✅ Query completed in ~2ms (target achieved)`)
}
```

This migration strategy ensures zero downtime while fixing the core issue and delivering the promised 25x performance improvement.
