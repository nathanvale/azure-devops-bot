# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-08-27-data-sync-enhancement/spec.md

> Created: 2025-08-27
> Version: 1.0.0

## Technical Requirements

### Comment Synchronization Fix

The current comment sync code exists but isn't populating the database. Investigation shows the sync runs but data doesn't persist.

**Root Cause Analysis Required:**

- Verify REST API returns comments with proper authentication
- Check if comment IDs are being parsed correctly (string vs number)
- Ensure transaction commits are happening
- Validate Prisma upsert operations

### Complete Field Extraction

Current implementation stores raw JSON but doesn't extract all available fields. We need comprehensive field mapping.

**Fields Currently Missing:**

- Work item relations (System.Relations)
- Work item links (\_links beyond basic URL)
- Custom organization fields
- Board lane states
- Pull request associations

### Query Performance Requirements

- All queries must return in under 100ms
- Use SQLite indexes on commonly queried fields
- Batch operations where possible
- Minimize N+1 query problems

### Logging Requirements

Use the existing logger pattern from `src/utils/logger.ts`:

- Component-based logging
- Structured metadata
- Performance metrics
- Error context with retry information

## Implementation Approach

### Phase 1: Fix Comment Synchronization

**Current Implementation Analysis:**

```typescript
// Current code in sync-service.ts (line 270-288)
private async syncSingleWorkItemComments(
  workItem: WorkItemData,
): Promise<number> {
  const comments = await this.client.fetchWorkItemComments(workItem.id)
  await this.db.storeWorkItemComments(comments)
  return comments.length
}
```

**Issue Identified:** The comment sync appears to run but the `storeWorkItemComments` method may have issues with ID type conversion or transaction handling.

**Fix Implementation:**

```typescript
// Enhanced sync-service.ts with comprehensive logging
private async syncSingleWorkItemCommentsWithTracking(
  workItem: WorkItemData,
  errorAggregator: ErrorAggregator,
): Promise<number> {
  const logger = getLogger()

  try {
    logger.debug('Fetching comments for work item', {
      component: 'sync-service',
      workItemId: workItem.id,
      expectedCount: workItem.commentCount || 0,
      operation: 'fetch_comments'
    })

    const comments = await this.client.fetchWorkItemComments(workItem.id)

    if (comments.length > 0) {
      logger.debug('Storing comments batch', {
        component: 'sync-service',
        workItemId: workItem.id,
        commentCount: comments.length,
        operation: 'store_comments'
      })

      await this.db.storeWorkItemComments(comments)

      logger.info('Comments stored successfully', {
        component: 'sync-service',
        workItemId: workItem.id,
        storedCount: comments.length,
        operation: 'comments_stored'
      })
    }

    return comments.length
  } catch (error) {
    logger.error('Failed to sync comments', {
      component: 'sync-service',
      workItemId: workItem.id,
      error: error instanceof Error ? error.message : String(error),
      operation: 'comment_sync_error'
    })
    throw error
  }
}
```

**Database Storage Fix:**

```typescript
// Fix in database.ts for storeWorkItemComments
async storeWorkItemComments(comments: WorkItemCommentData[]): Promise<void> {
  if (comments.length === 0) return

  const logger = getLogger()
  const BATCH_SIZE = 50

  logger.info('Starting comment storage', {
    component: 'database-service',
    totalComments: comments.length,
    batches: Math.ceil(comments.length / BATCH_SIZE),
    operation: 'store_comments_start'
  })

  for (let i = 0; i < comments.length; i += BATCH_SIZE) {
    const batch = comments.slice(i, i + BATCH_SIZE)
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1

    try {
      await this.prisma.$transaction(
        batch.map((comment) => {
          // Ensure ID is properly typed
          const commentId = typeof comment.id === 'string'
            ? parseInt(comment.id, 10)
            : comment.id

          logger.debug('Processing comment', {
            component: 'database-service',
            commentId,
            workItemId: comment.workItemId,
            textLength: comment.text?.length || 0,
            operation: 'process_comment'
          })

          return this.prisma.workItemComment.upsert({
            where: { id: commentId },
            update: {
              text: comment.text,
              createdBy: comment.createdBy,
              createdDate: comment.createdDate,
              modifiedBy: comment.modifiedBy,
              modifiedDate: comment.modifiedDate,
            },
            create: {
              id: commentId,
              workItemId: comment.workItemId,
              text: comment.text,
              createdBy: comment.createdBy,
              createdDate: comment.createdDate,
              modifiedBy: comment.modifiedBy,
              modifiedDate: comment.modifiedDate,
            },
          })
        }),
      )

      logger.debug('Comment batch stored', {
        component: 'database-service',
        batchNumber,
        batchSize: batch.length,
        operation: 'batch_stored'
      })
    } catch (error) {
      logger.error('Failed to store comment batch', {
        component: 'database-service',
        batchNumber,
        error: error instanceof Error ? error.message : String(error),
        operation: 'batch_storage_error'
      })
      throw error
    }
  }

  logger.info('All comments stored successfully', {
    component: 'database-service',
    totalStored: comments.length,
    operation: 'store_comments_complete'
  })
}
```

### Phase 2: Complete Field Extraction

**Enhanced Field Extraction with ALL Azure DevOps Fields:**

```typescript
// Enhanced transformation in azure-devops.ts
private transformRestWorkItem(restWorkItem: RestWorkItemData): WorkItemData {
  const raw = restWorkItem.raw as any
  const fields = raw.fields || {}
  const logger = getLogger()

  logger.debug('Transforming work item', {
    component: 'azure-devops-client',
    workItemId: raw.id,
    fieldCount: Object.keys(fields).length,
    operation: 'transform_work_item'
  })

  // Extract standard fields
  const standardFields = {
    id: raw.id,
    title: fields['System.Title'],
    state: fields['System.State'],
    type: fields['System.WorkItemType'],
    assignedTo: fields['System.AssignedTo']?.displayName || 'Unassigned',
    lastUpdatedAt: new Date(fields['System.ChangedDate']),
    description: fields['System.Description'],

    // Sprint/Board Info
    iterationPath: fields['System.IterationPath'],
    areaPath: fields['System.AreaPath'],
    boardColumn: fields['System.BoardColumn'],
    boardColumnDone: fields['System.BoardColumnDone'] === 'True',
    boardLane: fields['System.BoardLane'],

    // Priority/Tags
    priority: fields['Microsoft.VSTS.Common.Priority'],
    severity: fields['Microsoft.VSTS.Common.Severity'],
    tags: fields['System.Tags'],

    // All dates
    createdDate: fields['System.CreatedDate'] ? new Date(fields['System.CreatedDate']) : undefined,
    changedDate: fields['System.ChangedDate'] ? new Date(fields['System.ChangedDate']) : undefined,
    closedDate: fields['Microsoft.VSTS.Common.ClosedDate'] ? new Date(fields['Microsoft.VSTS.Common.ClosedDate']) : undefined,
    resolvedDate: fields['Microsoft.VSTS.Common.ResolvedDate'] ? new Date(fields['Microsoft.VSTS.Common.ResolvedDate']) : undefined,
    activatedDate: fields['Microsoft.VSTS.Common.ActivatedDate'] ? new Date(fields['Microsoft.VSTS.Common.ActivatedDate']) : undefined,
    stateChangeDate: fields['Microsoft.VSTS.Common.StateChangeDate'] ? new Date(fields['Microsoft.VSTS.Common.StateChangeDate']) : undefined,

    // People
    createdBy: fields['System.CreatedBy']?.displayName,
    changedBy: fields['System.ChangedBy']?.displayName,
    closedBy: fields['Microsoft.VSTS.Common.ClosedBy']?.displayName,
    resolvedBy: fields['Microsoft.VSTS.Common.ResolvedBy']?.displayName,
    activatedBy: fields['Microsoft.VSTS.Common.ActivatedBy']?.displayName,

    // Work tracking
    storyPoints: fields['Microsoft.VSTS.Scheduling.StoryPoints'],
    effort: fields['Microsoft.VSTS.Scheduling.Effort'],
    remainingWork: fields['Microsoft.VSTS.Scheduling.RemainingWork'],
    completedWork: fields['Microsoft.VSTS.Scheduling.CompletedWork'],
    originalEstimate: fields['Microsoft.VSTS.Scheduling.OriginalEstimate'],

    // Content fields
    acceptanceCriteria: fields['Microsoft.VSTS.Common.AcceptanceCriteria'],
    reproSteps: fields['Microsoft.VSTS.TCM.ReproSteps'],
    systemInfo: fields['Microsoft.VSTS.TCM.SystemInfo'],
    resolution: fields['Microsoft.VSTS.Common.Resolution'],

    // Related items
    parentId: this.extractParentId(raw.relations),

    // Azure DevOps metadata
    rev: raw.rev,
    reason: fields['System.Reason'],
    watermark: raw.watermark,
    url: raw.url || raw._links?.self?.href,
    commentCount: fields['System.CommentCount'] || 0,
    hasAttachments: (raw.relations || []).some(r => r.rel === 'AttachedFile'),
    teamProject: fields['System.TeamProject'],
    areaId: fields['System.AreaId'],
    nodeId: fields['System.NodeId'],
    stackRank: fields['Microsoft.VSTS.Common.StackRank'],
    valueArea: fields['Microsoft.VSTS.Common.ValueArea'],

    // Risk and business fields
    risk: fields['Microsoft.VSTS.Common.Risk'],
    businessValue: fields['Microsoft.VSTS.Common.BusinessValue'],
    timeCriticality: fields['Microsoft.VSTS.Common.TimeCriticality'],

    // Always preserve complete raw JSON
    rawJson: JSON.stringify(raw)
  }

  // Extract custom fields dynamically
  const customFields = this.extractCustomFields(fields)
  if (Object.keys(customFields).length > 0) {
    logger.debug('Found custom fields', {
      component: 'azure-devops-client',
      workItemId: raw.id,
      customFieldCount: Object.keys(customFields).length,
      customFieldNames: Object.keys(customFields),
      operation: 'extract_custom_fields'
    })
  }

  return {
    ...standardFields,
    customFields: JSON.stringify(customFields)
  }
}

private extractParentId(relations: any[]): number | undefined {
  if (!relations || !Array.isArray(relations)) return undefined

  const parentRelation = relations.find(r =>
    r.rel === 'System.LinkTypes.Hierarchy-Reverse'
  )

  if (parentRelation && parentRelation.url) {
    const match = parentRelation.url.match(/\/workItems\/(\d+)$/)
    return match ? parseInt(match[1], 10) : undefined
  }

  return undefined
}

private extractCustomFields(fields: any): Record<string, any> {
  const customFields: Record<string, any> = {}

  // Extract any field that doesn't start with System. or Microsoft.
  for (const [key, value] of Object.entries(fields)) {
    if (!key.startsWith('System.') && !key.startsWith('Microsoft.')) {
      customFields[key] = value
    }
  }

  return customFields
}
```

### Phase 3: Work Item Relationships

**Extract and Store Relationships:**

```typescript
// New method in azure-devops.ts
private extractRelations(rawWorkItem: any): WorkItemRelation[] {
  const relations: WorkItemRelation[] = []
  const logger = getLogger()

  if (!rawWorkItem.relations || !Array.isArray(rawWorkItem.relations)) {
    return relations
  }

  logger.debug('Extracting relations', {
    component: 'azure-devops-client',
    workItemId: rawWorkItem.id,
    relationCount: rawWorkItem.relations.length,
    operation: 'extract_relations'
  })

  for (const relation of rawWorkItem.relations) {
    const targetMatch = relation.url?.match(/\/workItems\/(\d+)$/)
    if (targetMatch) {
      relations.push({
        sourceId: rawWorkItem.id,
        targetId: parseInt(targetMatch[1], 10),
        relationType: relation.rel,
        attributes: relation.attributes ? JSON.stringify(relation.attributes) : null
      })
    }
  }

  return relations
}

// Store relations in database
async storeWorkItemRelations(relations: WorkItemRelation[]): Promise<void> {
  if (relations.length === 0) return

  const logger = getLogger()
  logger.info('Storing work item relations', {
    component: 'database-service',
    relationCount: relations.length,
    operation: 'store_relations'
  })

  await this.prisma.workItemRelation.createMany({
    data: relations,
    skipDuplicates: true
  })
}
```

### Phase 4: Enhanced Query Methods

**New Query Implementations:**

```typescript
// In database.ts - Query by specific assignee
async getWorkItemsByAssignee(email: string, state?: string) {
  const logger = getLogger()
  const startTime = Date.now()

  logger.debug('Querying work items by assignee', {
    component: 'database-service',
    assignee: email,
    state: state || 'all',
    operation: 'query_by_assignee'
  })

  try {
    const where: any = { assignedTo: email }
    if (state && state !== 'all') {
      where.state = state
    }

    const items = await this.prisma.workItem.findMany({
      where,
      orderBy: { changedDate: 'desc' },
      include: {
        comments: true
      }
    })

    logger.info('Query completed', {
      component: 'database-service',
      assignee: email,
      resultCount: items.length,
      durationMs: Date.now() - startTime,
      operation: 'query_by_assignee_complete'
    })

    return items
  } catch (error) {
    logger.error('Query failed', {
      component: 'database-service',
      assignee: email,
      error: error instanceof Error ? error.message : String(error),
      operation: 'query_by_assignee_error'
    })
    throw error
  }
}

// Query by current sprint
async getWorkItemsForCurrentSprint() {
  const logger = getLogger()
  const startTime = Date.now()

  // Determine current sprint (example logic - adjust for your org)
  const currentDate = new Date()
  const sprintPattern = `%Sprint%` // Adjust pattern for your naming

  logger.debug('Querying current sprint items', {
    component: 'database-service',
    pattern: sprintPattern,
    operation: 'query_current_sprint'
  })

  const items = await this.prisma.workItem.findMany({
    where: {
      iterationPath: {
        contains: 'Sprint', // Adjust for your sprint naming
      },
      state: {
        not: 'Closed'
      }
    },
    orderBy: [
      { priority: 'asc' },
      { stackRank: 'asc' }
    ],
    include: {
      comments: {
        orderBy: { createdDate: 'desc' },
        take: 5 // Latest 5 comments
      }
    }
  })

  logger.info('Current sprint query completed', {
    component: 'database-service',
    resultCount: items.length,
    durationMs: Date.now() - startTime,
    operation: 'query_current_sprint_complete'
  })

  return items
}

// Query with relationships
async getWorkItemWithRelations(workItemId: number) {
  const logger = getLogger()

  logger.debug('Fetching work item with relations', {
    component: 'database-service',
    workItemId,
    operation: 'query_with_relations'
  })

  // Get work item
  const workItem = await this.prisma.workItem.findUnique({
    where: { id: workItemId },
    include: {
      comments: true
    }
  })

  if (!workItem) return null

  // Get relations
  const relations = await this.prisma.$queryRaw`
    SELECT
      r.*,
      w.title as targetTitle,
      w.state as targetState,
      w.type as targetType
    FROM work_item_relations r
    LEFT JOIN work_items w ON r.target_id = w.id
    WHERE r.source_id = ${workItemId}

    UNION

    SELECT
      r.*,
      w.title as targetTitle,
      w.state as targetState,
      w.type as targetType
    FROM work_item_relations r
    LEFT JOIN work_items w ON r.source_id = w.id
    WHERE r.target_id = ${workItemId}
  `

  return {
    ...workItem,
    relations
  }
}
```

## Performance Optimization

### Database Indexes

```sql
-- Add these indexes for query performance
CREATE INDEX idx_work_items_assignee_state ON work_items(assigned_to, state);
CREATE INDEX idx_work_items_iteration_state ON work_items(iteration_path, state);
CREATE INDEX idx_work_items_area_path ON work_items(area_path);
CREATE INDEX idx_work_items_parent ON work_items(parent_id);
CREATE INDEX idx_comments_work_item_date ON work_item_comments(work_item_id, created_date DESC);
CREATE INDEX idx_relations_source ON work_item_relations(source_id);
CREATE INDEX idx_relations_target ON work_item_relations(target_id);
```

## Error Handling

All operations should use the existing resilience patterns:

```typescript
// Example with resilience
async performOperationWithResilience(operation: string, fn: () => Promise<any>) {
  const logger = getLogger()
  const startTime = Date.now()

  try {
    logger.debug(`Starting ${operation}`, {
      component: 'sync-service',
      operation: operation,
      timestamp: new Date().toISOString()
    })

    const result = await fn()

    logger.info(`${operation} completed`, {
      component: 'sync-service',
      operation: operation,
      durationMs: Date.now() - startTime,
      success: true
    })

    return result
  } catch (error) {
    logger.error(`${operation} failed`, {
      component: 'sync-service',
      operation: operation,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
      retryable: true
    })

    throw error
  }
}
```

## External Dependencies

No new external dependencies required. Uses existing:

- Prisma ORM
- SQLite
- Existing logger utilities
- Existing resilience adapter

## Migration Strategy

1. Run Prisma migration to add new tables
2. Update sync service with enhanced field extraction
3. Perform full sync to populate all fields
4. Verify comment data is populated
5. Add new MCP tools
6. Test query performance
