# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-08-28-fix-work-item-assignment/spec.md

> Created: 2025-08-28
> Version: 1.0.0
> Database Optimizer Analysis: Included

## Technical Requirements

### Problem Analysis (Database Optimizer Findings)

**Core Issue**: Data mismatch between query expectations and stored data

- System searches for: `Nathan.Vale@fwc.gov.au` (email)
- Database contains: `Nathan Vale` (display name)
- Result: Zero matches, broken functionality

**Performance Impact**:

- Current: String LIKE patterns = ~50ms
- Target: Indexed Person joins = ~2ms (25x improvement)

**Data Loss Assessment**:

- Azure DevOps provides: `{id, uniqueName, displayName, imageUrl, descriptor, url, inactive}`
- Currently stored: Only `displayName`
- Lost data: `uniqueName` (email), `id`, `imageUrl`, `descriptor`, `url`, `inactive`

### Solution Architecture

**Approach**: Normalized Person table with foreign key relationships

**Benefits**:

- ✅ **100% Query Accuracy**: Email searches return correct results
- ✅ **25x Performance Gain**: 50ms → 2ms query times
- ✅ **Complete Data Capture**: All Azure DevOps person fields stored
- ✅ **Referential Integrity**: Database constraints ensure data consistency
- ✅ **Storage Efficiency**: Eliminates person data duplication

## Approach Options

### Option A: Fix String Fields Only

**Description**: Update extraction to store emails instead of display names in existing String fields

- Pros: Minimal schema changes, faster implementation
- Cons: Still loses rich person data, no performance improvement, no referential integrity

### Option B: Normalized Person Table (Selected)

**Description**: Create dedicated Person table with foreign key relationships

- Pros: 25x performance improvement, complete data capture, referential integrity, future-proof
- Cons: More complex migration, additional table to maintain

### Option C: JSON-Only Storage

**Description**: Store all person data as JSON in existing fields

- Pros: Flexible schema, captures all data
- Cons: Poor query performance, no indexes, complex filtering

**Rationale**: Option B provides the optimal balance of performance, data integrity, and future scalability. The 25x performance improvement alone justifies the implementation complexity, and the normalized approach aligns with database best practices.

## External Dependencies

**New Dependencies**: None required

**Schema Dependencies**:

- Prisma migrations for Person table creation
- Database indexes for optimal query performance
- Foreign key constraints for referential integrity

**Justification**: This is purely a database schema optimization using existing tools (Prisma ORM, SQLite). No new external libraries or services required.

## Implementation Details

### Data Flow Architecture

**Current (Broken) Flow**:

```
Azure DevOps API → Person Object {id, uniqueName, displayName, ...}
                ↓
            Extract displayName only
                ↓
            Store "Nathan Vale" in WorkItem.assignedTo (String)
                ↓
            Query WHERE assignedTo = 'Nathan.Vale@fwc.gov.au'
                ↓
            ❌ Zero results (no match found)
```

**New (Fixed) Flow**:

```
Azure DevOps API → Person Object {id, uniqueName, displayName, ...}
                ↓
            Extract complete person data
                ↓
            Upsert Person record with all fields
                ↓
            Store Person.id in WorkItem.assignedToId (Foreign Key)
                ↓
            Query JOIN Person WHERE Person.uniqueName = 'Nathan.Vale@fwc.gov.au'
                ↓
            ✅ Correct results (indexed join, 2ms response)
```

### Code Changes Required

**1. Azure DevOps Provider Updates**:

```typescript
// Current: Only extract display name
private extractPersonName(person: AzureDevOpsPerson | string | undefined): string | undefined {
  if (!person) return undefined
  if (typeof person === 'string') return person
  return person.displayName || person.uniqueName || person.id
}

// New: Extract complete person object
private extractPersonData(person: AzureDevOpsPerson | string | undefined): PersonData | null {
  if (!person || typeof person === 'string') return null
  return {
    id: person.id,
    uniqueName: person.uniqueName,
    displayName: person.displayName,
    url: person.url,
    imageUrl: person.imageUrl,
    descriptor: person.descriptor,
    inactive: false // Default value
  }
}
```

**2. Database Service Updates**:

```typescript
// New: Person management methods
async upsertPerson(personData: PersonData): Promise<string> {
  const person = await this.prisma.person.upsert({
    where: { id: personData.id },
    update: personData,
    create: personData
  })
  return person.id
}

// Updated: WorkItem sync with Person references
async syncWorkItems(workItems: WorkItemData[]): Promise<void> {
  for (const item of workItems) {
    // First, ensure all person records exist
    const assignedToId = item.assignedToPerson
      ? await this.upsertPerson(item.assignedToPerson)
      : null

    const createdById = item.createdByPerson
      ? await this.upsertPerson(item.createdByPerson)
      : null

    // Then sync work item with person references
    await this.prisma.workItem.upsert({
      where: { id: item.id },
      update: {
        ...item,
        assignedToId,
        createdById,
        // ... other person ID fields
      },
      create: {
        id: item.id,
        ...item,
        assignedToId,
        createdById,
        // ... other person ID fields
      }
    })
  }
}
```

**3. Query Method Updates**:

```typescript
// Updated: Email-based queries with Person joins
async getWorkItemsForUsers(userEmails: string[]) {
  return await this.prisma.workItem.findMany({
    where: {
      OR: [
        {
          assignedTo: {
            uniqueName: { in: userEmails }
          }
        },
        {
          assignedTo: {
            uniqueName: { in: userEmails }
          },
          state: { not: 'Closed' }
        }
      ]
    },
    include: {
      assignedTo: true,
      createdBy: true,
      changedBy: true
    },
    orderBy: { lastUpdatedAt: 'desc' }
  })
}
```

### Performance Optimization Strategy

**Index Design** (Critical for sub-100ms performance):

```sql
-- Primary email lookup (most common query)
CREATE INDEX "persons_unique_name_idx" ON "persons"("unique_name");

-- Display name searches (secondary)
CREATE INDEX "persons_display_name_idx" ON "persons"("display_name");

-- Account status filtering
CREATE INDEX "persons_inactive_idx" ON "persons"("inactive");

-- Compound index for active users by email
CREATE INDEX "persons_active_email_idx" ON "persons"("unique_name", "inactive");

-- WorkItem person relationship indexes
CREATE INDEX "work_items_assigned_to_id_idx" ON "work_items"("assigned_to_id");
CREATE INDEX "work_items_created_by_id_idx" ON "work_items"("created_by_id");

-- Compound indexes for common query patterns
CREATE INDEX "work_items_assigned_state_idx" ON "work_items"("assigned_to_id", "state");
CREATE INDEX "work_items_assigned_iteration_idx" ON "work_items"("assigned_to_id", "iteration_path");
```

**Query Performance Projections**:

- Current: `WHERE assignedTo LIKE '%email%'` = ~50ms (table scan)
- New: `JOIN persons ON persons.id = work_items.assigned_to_id WHERE persons.unique_name = 'email'` = ~2ms (index seek + join)
- **Result**: 25x performance improvement with 98ms headroom under 100ms target

### Error Handling Strategy

**Migration Failure Scenarios**:

1. **Person extraction fails**: Log warning, continue with null assignment
2. **Duplicate person IDs**: Use upsert to handle gracefully
3. **Foreign key violations**: Validate Person records exist before WorkItem updates
4. **Index creation fails**: Migration rollback with detailed error logging

**Runtime Error Handling**:

1. **Person record missing**: Create on-the-fly during sync
2. **Email query fails**: Fallback to display name search with warning
3. **Database constraint violations**: Log error, skip record, continue processing

This technical approach ensures robust implementation while maintaining the sub-100ms performance target and zero-downtime migration requirements.
