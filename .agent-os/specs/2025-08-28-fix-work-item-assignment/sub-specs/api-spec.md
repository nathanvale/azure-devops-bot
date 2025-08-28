# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-08-28-fix-work-item-assignment/spec.md

> Created: 2025-08-28
> Version: 1.0.0

## MCP Tool Updates

### Updated Tools (No Interface Changes)

The following existing MCP tools will continue to work with the same interface but will now return correct results:

#### wit_my_work_items

**Purpose**: Retrieve work items assigned to the authenticated user
**Current Issue**: Returns 0 results due to email/display name mismatch
**After Fix**: Returns correct results by joining Person table on email

```typescript
// Input (unchanged)
interface MyWorkItemsArgs {
  // No parameters - uses authenticated user's email from AZURE_DEVOPS_USER_EMAILS
}

// Output (enhanced with person data)
interface MyWorkItemsResponse {
  workItems: Array<{
    id: number
    title: string
    state: string
    type: string
    assignedTo: {
      id: string
      displayName: string
      uniqueName: string // Email address
      imageUrl?: string
    }
    iterationPath?: string
    storyPoints?: number
    lastUpdatedAt: string
    // ... all other existing fields
  }>
  totalCount: number
  userEmail: string
}
```

#### wit_get_work_items_batch_by_ids

**Purpose**: Retrieve multiple work items by IDs
**Enhancement**: Include complete person data in response

#### wit_get_work_items_for_iteration

**Purpose**: Retrieve work items for a specific iteration/sprint  
**Enhancement**: Person data available for filtering and display

## Azure DevOps Client Updates

### Provider Changes (AzureDevOpsProvider)

#### Enhanced Person Data Extraction

```typescript
// Current: Only extract display name
private extractPersonName(
  person: AzureDevOpsPerson | string | undefined,
): string | undefined {
  if (!person) return undefined
  if (typeof person === 'string') return person
  return person.displayName || person.uniqueName || person.id
}

// New: Extract complete person object
private extractPersonData(
  person: AzureDevOpsPerson | string | undefined,
): PersonData | null {
  if (!person) return null
  if (typeof person === 'string') {
    // Handle legacy string assignments
    return {
      id: `legacy-${person}`,
      displayName: person,
      uniqueName: person, // Assume it's an email if it contains @
      inactive: false
    }
  }

  return {
    id: person.id,
    displayName: person.displayName,
    uniqueName: person.uniqueName, // Critical: This is the email
    url: person.url,
    imageUrl: person.imageUrl,
    descriptor: person.descriptor,
    inactive: false // Default for active assignments
  }
}
```

#### Updated WorkItemData Interface

```typescript
// Enhanced WorkItemData to include person objects
export interface WorkItemData {
  id: string | number
  title: string
  state: string
  type: string

  // Updated: Person objects instead of strings
  assignedToPerson?: PersonData
  createdByPerson?: PersonData
  changedByPerson?: PersonData
  closedByPerson?: PersonData
  resolvedByPerson?: PersonData
  activatedByPerson?: PersonData
  authorizedAsPerson?: PersonData

  createdDate: string
  changedDate: string
  description?: string
  tags?: string[]

  // All other fields remain unchanged
  iterationPath?: string
  areaPath?: string
  storyPoints?: number
  // ...

  // Raw data for future-proofing (unchanged)
  raw: Record<string, unknown>
}

// New: Person data interface
export interface PersonData {
  id: string
  displayName: string
  uniqueName: string // Email address - critical for queries
  url?: string
  imageUrl?: string
  descriptor?: string
  inactive: boolean
}
```

#### Updated Mapping Method

```typescript
// Updated mapWorkItemToData method
private mapWorkItemToData(workItem: WorkItem): WorkItemData {
  const fields = workItem.fields

  return {
    id: workItem.id,
    title: fields['System.Title'] || '',
    state: fields['System.State'] || '',
    type: fields['System.WorkItemType'] || '',

    // Updated: Extract person objects instead of strings
    assignedToPerson: this.extractPersonData(fields['System.AssignedTo']),
    createdByPerson: this.extractPersonData(fields['System.CreatedBy']),
    changedByPerson: this.extractPersonData(fields['System.ChangedBy']),
    closedByPerson: this.extractPersonData(fields['Microsoft.VSTS.Common.ClosedBy']),
    resolvedByPerson: this.extractPersonData(fields['Microsoft.VSTS.Common.ResolvedBy']),
    activatedByPerson: this.extractPersonData(fields['Microsoft.VSTS.Common.ActivatedBy']),
    authorizedAsPerson: this.extractPersonData(fields['System.AuthorizedAs']),

    createdDate: fields['System.CreatedDate'] || '',
    changedDate: fields['System.ChangedDate'] || '',
    description: fields['System.Description'],
    tags: this.parseTags(fields['System.Tags']),

    // Keep all other existing fields
    iterationPath: fields['System.IterationPath'],
    areaPath: fields['System.AreaPath'],
    storyPoints: parseFloat(fields['Microsoft.VSTS.Scheduling.StoryPoints']) || undefined,
    // ... all other fields remain unchanged

    raw: {
      ...fields,
      _links: workItem._links,
      relations: workItem.relations,
      url: workItem.url,
      rev: workItem.rev,
    },
  }
}
```

### Database Service Updates

#### New Person Management Methods

```typescript
export class DatabaseService {
  // New: Person record management
  async upsertPerson(personData: PersonData): Promise<string> {
    if (!personData.id || !personData.uniqueName) {
      throw new Error('Person must have id and uniqueName (email)')
    }

    const person = await this.prisma.person.upsert({
      where: { id: personData.id },
      update: {
        displayName: personData.displayName,
        uniqueName: personData.uniqueName,
        url: personData.url,
        imageUrl: personData.imageUrl,
        descriptor: personData.descriptor,
        inactive: personData.inactive,
        updatedAt: new Date(),
      },
      create: personData,
    })

    return person.id
  }

  async getPersonByEmail(email: string): Promise<Person | null> {
    return await this.prisma.person.findUnique({
      where: { uniqueName: email },
    })
  }

  async getPersonByDisplayName(displayName: string): Promise<Person | null> {
    return await this.prisma.person.findFirst({
      where: { displayName },
    })
  }
}
```

#### Updated Sync Method

```typescript
async syncWorkItems(workItems: WorkItemData[]): Promise<void> {
  const BATCH_SIZE = 100
  const totalBatches = Math.ceil(workItems.length / BATCH_SIZE)

  this.logger.info(`Starting enhanced work item sync with Person data: ${workItems.length} items`)

  for (let i = 0; i < workItems.length; i += BATCH_SIZE) {
    const batch = workItems.slice(i, i + BATCH_SIZE)
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1

    try {
      // Step 1: Ensure all Person records exist
      const personIds: Record<string, string | null> = {}

      for (const item of batch) {
        // Process all person fields in the work item
        const personFields = [
          { key: 'assignedTo', person: item.assignedToPerson },
          { key: 'createdBy', person: item.createdByPerson },
          { key: 'changedBy', person: item.changedByPerson },
          { key: 'closedBy', person: item.closedByPerson },
          { key: 'resolvedBy', person: item.resolvedByPerson },
          { key: 'activatedBy', person: item.activatedByPerson },
          { key: 'authorizedAs', person: item.authorizedAsPerson }
        ]

        for (const field of personFields) {
          if (field.person) {
            try {
              const personId = await this.upsertPerson(field.person)
              personIds[`${item.id}-${field.key}`] = personId
            } catch (error) {
              this.logger.warn(`Failed to upsert person for work item ${item.id}, field ${field.key}:`, error)
              personIds[`${item.id}-${field.key}`] = null
            }
          } else {
            personIds[`${item.id}-${field.key}`] = null
          }
        }
      }

      // Step 2: Sync work items with person references
      await this.prisma.$transaction(
        batch.map((item) => {
          const commonData = {
            title: item.title,
            state: item.state,
            type: item.type,

            // Updated: Use person IDs instead of strings
            assignedToId: personIds[`${item.id}-assignedTo`],
            createdById: personIds[`${item.id}-createdBy`],
            changedById: personIds[`${item.id}-changedBy`],
            closedById: personIds[`${item.id}-closedBy`],
            resolvedById: personIds[`${item.id}-resolvedBy`],
            activatedById: personIds[`${item.id}-activatedBy`],
            authorizedAsId: personIds[`${item.id}-authorizedAs`],

            lastUpdatedAt: item.lastUpdatedAt,
            azureUrl: AzureDevOpsClient.buildWorkItemUrl(item.id),
            lastSyncedAt: new Date(),

            // All other fields remain the same
            description: item.description,
            iterationPath: item.iterationPath,
            areaPath: item.areaPath,
            boardColumn: item.boardColumn,
            // ... all existing fields

            // Ensure rawJson is populated (already working)
            rawJson: item.rawJson || JSON.stringify(item.raw),
          }

          return this.prisma.workItem.upsert({
            where: { id: item.id },
            update: commonData,
            create: {
              id: item.id,
              ...commonData,
            },
          })
        }),
      )

      this.logger.info(`Enhanced batch ${batchNumber}/${totalBatches} sync completed with Person data`)
    } catch (error) {
      this.logger.error(`Enhanced sync failed for batch ${batchNumber}:`, error)
      throw error
    }
  }
}
```

#### Updated Query Methods

```typescript
// Updated to use Person table joins
async getWorkItemsForUsers(userEmails: string[]) {
  try {
    if (!userEmails || userEmails.length === 0) {
      return await this.getAllWorkItems()
    }

    // Use optimized Person join query (2ms vs 50ms)
    const workItems = await this.prisma.workItem.findMany({
      where: {
        OR: [
          {
            assignedTo: {
              uniqueName: { in: userEmails },
              inactive: false
            },
            state: { not: 'Closed' }
          },
          {
            assignedTo: {
              uniqueName: { in: userEmails },
              inactive: false
            },
            state: { not: 'Removed' }
          }
        ]
      },
      include: {
        assignedTo: true,
        createdBy: true,
        changedBy: true,
        closedBy: true,
        resolvedBy: true
      },
      orderBy: { lastUpdatedAt: 'desc' }
    })

    this.logger.debug(`Found ${workItems.length} work items for users: ${userEmails.join(', ')}`)
    return workItems
  } catch (error) {
    this.logger.error(`Failed to retrieve work items for users [${userEmails.join(', ')}]:`, error)
    throw error
  }
}

async getWorkItemsByStateForUsers(state: string, userEmails: string[]) {
  try {
    if (!userEmails || userEmails.length === 0) {
      return await this.getWorkItemsByState(state)
    }

    // Optimized query with Person join
    const workItems = await this.prisma.workItem.findMany({
      where: {
        state,
        assignedTo: {
          uniqueName: { in: userEmails },
          inactive: false
        }
      },
      include: {
        assignedTo: true
      },
      orderBy: { lastUpdatedAt: 'desc' }
    })

    this.logger.debug(`Found ${workItems.length} ${state} work items for users: ${userEmails.join(', ')}`)
    return workItems
  } catch (error) {
    this.logger.error(`Failed to retrieve ${state} work items for users [${userEmails.join(', ')}]:`, error)
    throw error
  }
}
```

## Backward Compatibility

### During Migration Period

- **Old String fields**: Remain populated until Phase 4 cleanup
- **MCP tool responses**: Include both old and new person data during transition
- **Query fallback**: If Person join fails, fallback to string matching with warning

### Error Handling

```typescript
// Graceful fallback for missing person data
async getWorkItemsWithPersonFallback(userEmails: string[]) {
  try {
    // Try optimized Person join first
    return await this.getWorkItemsForUsers(userEmails)
  } catch (error) {
    this.logger.warn('Person join query failed, falling back to string matching:', error)

    // Fallback to old string-based query (temporary)
    return await this.prisma.workItem.findMany({
      where: {
        OR: userEmails.map(email => ({
          assignedTo: { contains: email }
        }))
      }
    })
  }
}
```

This API specification ensures that the fixes are implemented with complete backward compatibility while delivering the promised performance improvements.
