# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-08-27-data-sync-enhancement/spec.md

> Created: 2025-08-27
> Version: 1.0.0

## New MCP Tools

### wit_get_work_items_by_assignee

**Purpose:** Query work items assigned to a specific user (not just the authenticated user)

**Implementation:**

```typescript
// In mcp-server.ts - Tool definition
{
  name: 'wit_get_work_items_by_assignee',
  description: 'Get all work items assigned to a specific user with optional state filter',
  inputSchema: {
    type: 'object',
    properties: {
      email: {
        type: 'string',
        description: 'Email address of the assignee',
      },
      state: {
        type: 'string',
        description: 'Optional filter by work item state',
        enum: ['Active', 'New', 'Resolved', 'Closed', 'Done', 'Removed', 'all'],
      },
      includeComments: {
        type: 'boolean',
        description: 'Include recent comments for each work item',
        default: false,
      },
    },
    required: ['email'],
  },
}

// Handler implementation
private async handleGetWorkItemsByAssignee(args?: {
  email?: string
  state?: string
  includeComments?: boolean
}) {
  const logger = getLogger()
  
  if (!args?.email) {
    throw new Error('Email address is required')
  }
  
  logger.info('Querying work items by assignee', {
    component: 'mcp-server',
    assignee: args.email,
    state: args.state || 'all',
    includeComments: args.includeComments || false,
    operation: 'get_by_assignee'
  })
  
  const workItems = await this.db.getWorkItemsByAssignee(
    args.email,
    args.state,
    args.includeComments
  )
  
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          assignee: args.email,
          state: args.state || 'all',
          count: workItems.length,
          workItems: workItems,
        }, null, 2),
      },
    ],
  }
}
```

### wit_get_current_sprint_items

**Purpose:** Get all work items in the current sprint/iteration

**Implementation:**

```typescript
// Tool definition
{
  name: 'wit_get_current_sprint_items',
  description: 'Get all work items in the current sprint with optional filters',
  inputSchema: {
    type: 'object',
    properties: {
      state: {
        type: 'string',
        description: 'Filter by state',
        enum: ['Active', 'Done', 'New', 'all'],
      },
      assignee: {
        type: 'string',
        description: 'Filter by assignee email (optional)',
      },
      includeUnassigned: {
        type: 'boolean',
        description: 'Include unassigned items',
        default: true,
      },
      groupBy: {
        type: 'string',
        description: 'Group results by field',
        enum: ['assignee', 'state', 'type', 'priority', 'none'],
        default: 'none',
      },
    },
  },
}

// Handler
private async handleGetCurrentSprintItems(args?: {
  state?: string
  assignee?: string
  includeUnassigned?: boolean
  groupBy?: string
}) {
  const logger = getLogger()
  
  logger.info('Fetching current sprint items', {
    component: 'mcp-server',
    filters: {
      state: args?.state || 'all',
      assignee: args?.assignee || 'all',
      includeUnassigned: args?.includeUnassigned ?? true,
    },
    operation: 'get_current_sprint'
  })
  
  const items = await this.db.getCurrentSprintItems(args)
  
  // Group if requested
  let result = items
  if (args?.groupBy && args.groupBy !== 'none') {
    result = this.groupWorkItems(items, args.groupBy)
  }
  
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          sprint: this.detectCurrentSprint(items),
          filters: args,
          count: items.length,
          data: result,
        }, null, 2),
      },
    ],
  }
}
```

### wit_get_work_items_by_state

**Purpose:** Filter work items by their current state

**Implementation:**

```typescript
// Tool definition
{
  name: 'wit_get_work_items_by_state',
  description: 'Get work items filtered by state with optional additional filters',
  inputSchema: {
    type: 'object',
    properties: {
      state: {
        type: 'string',
        description: 'Work item state to filter by',
        enum: ['Active', 'New', 'Resolved', 'Closed', 'Done', 'Removed'],
      },
      type: {
        type: 'string',
        description: 'Optional work item type filter',
        enum: ['Bug', 'Task', 'User Story', 'Feature', 'Epic', 'all'],
      },
      limit: {
        type: 'number',
        description: 'Maximum number of items to return',
        default: 100,
      },
      sortBy: {
        type: 'string',
        description: 'Sort results by field',
        enum: ['priority', 'changedDate', 'createdDate', 'stackRank'],
        default: 'changedDate',
      },
    },
    required: ['state'],
  },
}

// Handler
private async handleGetWorkItemsByState(args?: {
  state?: string
  type?: string
  limit?: number
  sortBy?: string
}) {
  if (!args?.state) {
    throw new Error('State is required')
  }
  
  const logger = getLogger()
  logger.info('Querying work items by state', {
    component: 'mcp-server',
    state: args.state,
    type: args.type || 'all',
    limit: args.limit || 100,
    sortBy: args.sortBy || 'changedDate',
    operation: 'get_by_state'
  })
  
  const items = await this.db.getWorkItemsByState(
    args.state,
    args.type,
    args.limit,
    args.sortBy
  )
  
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          state: args.state,
          filters: args,
          count: items.length,
          workItems: items,
        }, null, 2),
      },
    ],
  }
}
```

### wit_get_team_work_items

**Purpose:** Get all work items for a team in a specific area path

**Implementation:**

```typescript
// Tool definition
{
  name: 'wit_get_team_work_items',
  description: 'Get all work items for a specific team area',
  inputSchema: {
    type: 'object',
    properties: {
      areaPath: {
        type: 'string',
        description: 'Team area path (e.g., "Customer Services Platform\\Team A")',
      },
      iterationPath: {
        type: 'string',
        description: 'Optional iteration filter',
      },
      includeSubAreas: {
        type: 'boolean',
        description: 'Include items from sub-areas',
        default: true,
      },
      activeOnly: {
        type: 'boolean',
        description: 'Only show active items',
        default: false,
      },
    },
    required: ['areaPath'],
  },
}

// Handler
private async handleGetTeamWorkItems(args?: {
  areaPath?: string
  iterationPath?: string
  includeSubAreas?: boolean
  activeOnly?: boolean
}) {
  if (!args?.areaPath) {
    throw new Error('Area path is required')
  }
  
  const logger = getLogger()
  logger.info('Fetching team work items', {
    component: 'mcp-server',
    areaPath: args.areaPath,
    iterationPath: args.iterationPath,
    includeSubAreas: args.includeSubAreas ?? true,
    activeOnly: args.activeOnly ?? false,
    operation: 'get_team_items'
  })
  
  const items = await this.db.getTeamWorkItems(args)
  
  // Calculate team metrics
  const metrics = this.calculateTeamMetrics(items)
  
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          team: args.areaPath,
          iteration: args.iterationPath,
          metrics: metrics,
          count: items.length,
          workItems: items,
        }, null, 2),
      },
    ],
  }
}
```

### wit_get_work_item_with_relations

**Purpose:** Get a work item with all its relationships (parent, children, related items)

**Implementation:**

```typescript
// Tool definition
{
  name: 'wit_get_work_item_with_relations',
  description: 'Get a work item with all its relationships and linked items',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'number',
        description: 'Work item ID',
      },
      includeComments: {
        type: 'boolean',
        description: 'Include all comments',
        default: true,
      },
      includeLinks: {
        type: 'boolean',
        description: 'Include external links (PRs, builds)',
        default: true,
      },
      depth: {
        type: 'number',
        description: 'Depth of relationship traversal (1-3)',
        default: 1,
        minimum: 1,
        maximum: 3,
      },
    },
    required: ['id'],
  },
}

// Handler
private async handleGetWorkItemWithRelations(args?: {
  id?: number
  includeComments?: boolean
  includeLinks?: boolean
  depth?: number
}) {
  if (!args?.id) {
    throw new Error('Work item ID is required')
  }
  
  const logger = getLogger()
  logger.info('Fetching work item with relations', {
    component: 'mcp-server',
    workItemId: args.id,
    includeComments: args.includeComments ?? true,
    includeLinks: args.includeLinks ?? true,
    depth: args.depth || 1,
    operation: 'get_with_relations'
  })
  
  const workItem = await this.db.getWorkItemWithFullRelations(
    args.id,
    args.depth || 1
  )
  
  if (!workItem) {
    throw new Error(`Work item ${args.id} not found`)
  }
  
  // Build relationship tree
  const relationshipTree = await this.buildRelationshipTree(
    workItem,
    args.depth || 1
  )
  
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          workItem: workItem,
          relationships: relationshipTree,
          commentCount: workItem.comments?.length || 0,
          linkCount: workItem.links?.length || 0,
        }, null, 2),
      },
    ],
  }
}
```

## Supporting Database Methods

### Database Service Extensions

```typescript
// In database.ts - New query methods

async getWorkItemsByAssignee(
  email: string,
  state?: string,
  includeComments?: boolean
) {
  const where: any = { assignedTo: email }
  if (state && state !== 'all') {
    where.state = state
  }
  
  return await this.prisma.workItem.findMany({
    where,
    include: includeComments ? {
      comments: {
        orderBy: { createdDate: 'desc' },
        take: 5,
      },
    } : undefined,
    orderBy: [
      { priority: 'asc' },
      { changedDate: 'desc' },
    ],
  })
}

async getCurrentSprintItems(filters?: {
  state?: string
  assignee?: string
  includeUnassigned?: boolean
}) {
  const where: any = {}
  
  // Find current sprint pattern (customize for your org)
  const currentDate = new Date()
  const sprintNumber = Math.floor((currentDate.getDate() - 1) / 14) + 1
  where.iterationPath = {
    contains: `Sprint ${sprintNumber}`,
  }
  
  if (filters?.state && filters.state !== 'all') {
    where.state = filters.state
  }
  
  if (filters?.assignee) {
    where.assignedTo = filters.assignee
  } else if (!filters?.includeUnassigned) {
    where.assignedTo = { not: 'Unassigned' }
  }
  
  return await this.prisma.workItem.findMany({
    where,
    include: {
      comments: {
        orderBy: { createdDate: 'desc' },
        take: 3,
      },
    },
    orderBy: [
      { boardColumn: 'asc' },
      { priority: 'asc' },
      { stackRank: 'asc' },
    ],
  })
}

async getWorkItemsByState(
  state: string,
  type?: string,
  limit?: number,
  sortBy?: string
) {
  const where: any = { state }
  if (type && type !== 'all') {
    where.type = type
  }
  
  const orderBy: any = {}
  switch (sortBy) {
    case 'priority':
      orderBy.priority = 'asc'
      break
    case 'createdDate':
      orderBy.createdDate = 'desc'
      break
    case 'stackRank':
      orderBy.stackRank = 'asc'
      break
    default:
      orderBy.changedDate = 'desc'
  }
  
  return await this.prisma.workItem.findMany({
    where,
    orderBy,
    take: limit || 100,
  })
}

async getTeamWorkItems(options: {
  areaPath: string
  iterationPath?: string
  includeSubAreas?: boolean
  activeOnly?: boolean
}) {
  const where: any = {}
  
  if (options.includeSubAreas) {
    where.areaPath = {
      startsWith: options.areaPath,
    }
  } else {
    where.areaPath = options.areaPath
  }
  
  if (options.iterationPath) {
    where.iterationPath = options.iterationPath
  }
  
  if (options.activeOnly) {
    where.state = {
      notIn: ['Closed', 'Done', 'Removed'],
    }
  }
  
  return await this.prisma.workItem.findMany({
    where,
    include: {
      comments: {
        orderBy: { createdDate: 'desc' },
        take: 1,
      },
    },
    orderBy: [
      { type: 'asc' },
      { priority: 'asc' },
      { stackRank: 'asc' },
    ],
  })
}

async getWorkItemWithFullRelations(
  workItemId: number,
  depth: number = 1
) {
  const workItem = await this.prisma.workItem.findUnique({
    where: { id: workItemId },
    include: {
      comments: true,
      sourceRelations: {
        include: {
          targetWorkItem: true,
        },
      },
      targetRelations: {
        include: {
          sourceWorkItem: true,
        },
      },
      links: true,
    },
  })
  
  if (!workItem || depth <= 0) {
    return workItem
  }
  
  // Recursively fetch related items up to depth
  const relatedIds = [
    ...workItem.sourceRelations.map(r => r.targetId),
    ...workItem.targetRelations.map(r => r.sourceId),
  ]
  
  if (relatedIds.length > 0 && depth > 1) {
    const relatedItems = await Promise.all(
      relatedIds.map(id =>
        this.getWorkItemWithFullRelations(id, depth - 1)
      )
    )
    
    return {
      ...workItem,
      relatedItems,
    }
  }
  
  return workItem
}
```

## Error Responses

All MCP tools should return consistent error responses:

```typescript
// Error response format
{
  content: [
    {
      type: 'text',
      text: JSON.stringify({
        error: true,
        message: 'Descriptive error message',
        code: 'ERROR_CODE',
        details: {
          // Additional error context
        },
      }, null, 2),
    },
  ],
}
```

## Performance Considerations

- Use database indexes for all filter fields
- Limit default result sets to 100 items
- Use pagination for large result sets
- Cache current sprint detection
- Implement request throttling for expensive queries