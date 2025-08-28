# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-01-28-mcp-tool-redesign/spec.md

> Created: 2025-01-28
> Version: 1.0.0

## Tool Catalog by Domain

### Cache Domain (Local Database Operations)

**Purpose:** Fast, local database queries with normalized JSON output

#### `cache_get_work_item`

**Parameters:**

- `id` (number, required): Work item ID
- `includeRaw` (boolean, optional): Include raw JSON backup

**Response:** Normalized work item object with person relations

#### `cache_list_work_items`

**Parameters:**

- `states` (string[], optional): Filter by work item states
- `assignee` (string, optional): Filter by assignee email
- `top` (number, optional, default: 50, max: 500): Max items to return

**Response:** Array of normalized work item objects

#### `cache_get_work_item_relations`

**Parameters:**

- `id` (number, required): Work item ID

**Response:** Object with `outgoing` and `incoming` relationship arrays

#### `cache_list_iteration_work_items`

**Parameters:**

- `iteration` (string, required): Iteration path or "current"
- `top` (number, optional, default: 100, max: 500): Max items to return

**Response:** Array of work items for specified iteration

#### `cache_get_sync_summary`

**Parameters:**

- `includeHistory` (boolean, optional): Include recent sync history
- `historyLimit` (number, optional, default: 5, max: 20): Number of historical syncs

**Response:** Structured sync status and metrics

### Sync Domain (Data Synchronization)

**Purpose:** Control and monitor Azure DevOps data synchronization

#### `sync_force_work_items`

**Parameters:**

- `concurrency` (number, optional, default: 5, max: 20): Parallel fetch limit

**Response:** Sync completion status and summary

#### `sync_force_comments`

**Parameters:**

- `workItemIds` (number[], optional): Specific work items to sync comments for

**Response:** Comment sync results with count processed

#### `sync_get_status`

**Parameters:**

- `includeHistory` (boolean, optional): Include sync history
- `includeErrors` (boolean, optional): Include error details

**Response:** Comprehensive sync health report

#### `sync_get_metrics`

**Parameters:**

- `timeframe` (string, optional, default: "24h"): Metrics timeframe ("1h", "24h", "7d")

**Response:** Performance metrics and error trends

### Admin Domain (System Management)

**Purpose:** Health monitoring and system administration

#### `admin_health_check`

**Parameters:** None

**Response:** System health status with database connectivity, disk usage, memory usage

#### `admin_verify_tables`

**Parameters:** None

**Response:** Record counts for all database tables (WorkItem, Person, Comments, Relations, etc.)

#### `admin_get_statistics`

**Parameters:**

- `includePersons` (boolean, optional): Include person statistics
- `includeRelations` (boolean, optional): Include relationship statistics

**Response:** Database statistics and data distribution

#### `admin_cleanup_orphans`

**Parameters:**

- `dryRun` (boolean, optional, default: true): Preview changes without executing

**Response:** Orphaned record cleanup results

### Work Items Domain (Direct API Operations)

**Purpose:** Azure DevOps API operations for work item modifications

#### `wit_create_work_item`

**Parameters:**

- `type` (string, required): Work item type ("Bug", "Feature", "Task")
- `title` (string, required): Work item title
- `description` (string, optional): Work item description
- `assignedTo` (string, optional): Assignee email
- `areaPath` (string, optional): Area path
- `iterationPath` (string, optional): Iteration path

**Response:** Created work item object

#### `wit_update_work_item`

**Parameters:**

- `id` (number, required): Work item ID
- `fields` (object, required): Fields to update (title, state, assignedTo, etc.)

**Response:** Updated work item object

#### `wit_add_comment`

**Parameters:**

- `id` (number, required): Work item ID
- `comment` (string, required): Comment text

**Response:** Comment creation confirmation

#### `wit_link_to_pull_request`

**Parameters:**

- `id` (number, required): Work item ID
- `pullRequestUrl` (string, required): Full PR URL

**Response:** Link creation confirmation

#### `wit_update_state`

**Parameters:**

- `id` (number, required): Work item ID
- `state` (string, required): New state value
- `reason` (string, optional): State change reason

**Response:** State update confirmation

### Core Domain (Project-Level Operations)

**Purpose:** Azure DevOps project and organizational data access

#### `core_get_project_info`

**Parameters:** None

**Response:** Project information (name, URL, teams, areas, iterations)

#### `core_list_teams`

**Parameters:** None

**Response:** Array of team information with area paths

#### `core_list_iterations`

**Parameters:**

- `includeActive` (boolean, optional): Include only active iterations

**Response:** Array of iteration paths with date ranges

#### `core_get_user_info`

**Parameters:** None

**Response:** Authenticated user information and permissions

## Zod Schema Examples

```typescript
// Work Item Schemas
export const WorkItemIdSchema = z.object({
  id: z.number().int().positive().describe('Work item ID'),
})

export const WorkItemFiltersSchema = z.object({
  states: z.array(z.string()).optional().describe('Filter by states'),
  assignee: z.string().email().optional().describe('Filter by assignee email'),
  type: z.string().optional().describe('Filter by work item type'),
  top: z
    .number()
    .int()
    .min(1)
    .max(500)
    .default(50)
    .describe('Max items to return'),
})

export const WorkItemResponseSchema = z.object({
  id: z.number(),
  title: z.string(),
  state: z.string(),
  type: z.string(),
  assignedTo: z
    .object({
      id: z.string().nullable(),
      name: z.string(),
      email: z.string().email(),
    })
    .nullable(),
  priority: z.number().nullable(),
  severity: z.number().nullable(),
  storyPoints: z.number().nullable(),
  iterationPath: z.string().nullable(),
  areaPath: z.string().nullable(),
  tags: z.array(z.string()),
  url: z.string().url().nullable(),
  updatedAt: z.string().datetime().nullable(),
  createdDate: z.string().datetime().nullable(),
  metrics: z.object({
    commentCount: z.number(),
    hasAttachments: z.boolean(),
  }),
})

// Sync Schemas
export const SyncForceSchema = z.object({
  concurrency: z
    .number()
    .int()
    .min(1)
    .max(20)
    .default(5)
    .describe('Parallel processing limit'),
})

export const SyncStatusSchema = z.object({
  includeHistory: z.boolean().default(false).describe('Include sync history'),
  includeErrors: z.boolean().default(false).describe('Include error details'),
  historyLimit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe('Max history entries'),
})

// Admin Schemas
export const TableVerificationSchema = z.object({
  workItems: z.number().int().min(0),
  comments: z.number().int().min(0),
  relations: z.number().int().min(0),
  links: z.number().int().min(0),
  persons: z.number().int().min(0),
  syncMetrics: z.number().int().min(0),
})

// Work Item Creation Schema
export const CreateWorkItemSchema = z.object({
  type: z
    .enum(['Bug', 'Feature', 'Task', 'User Story', 'Epic'])
    .describe('Work item type'),
  title: z.string().min(1).max(255).describe('Work item title'),
  description: z
    .string()
    .max(10000)
    .optional()
    .describe('Work item description'),
  assignedTo: z.string().email().optional().describe('Assignee email address'),
  areaPath: z.string().optional().describe('Area path for categorization'),
  iterationPath: z.string().optional().describe('Iteration/sprint path'),
  priority: z
    .number()
    .int()
    .min(1)
    .max(4)
    .optional()
    .describe('Priority (1=Critical, 4=Low)'),
  severity: z
    .number()
    .int()
    .min(1)
    .max(4)
    .optional()
    .describe('Severity (1=Critical, 4=Low)'),
})
```

## Error Response Format

All tools return errors in consistent format:

```typescript
export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
    validation: z
      .array(
        z.object({
          field: z.string(),
          message: z.string(),
        }),
      )
      .optional(),
  }),
})
```

## Backward Compatibility Mapping

During migration period, legacy tools will be mapped to new implementations:

```typescript
const TOOL_MIGRATION_MAP = {
  // Legacy -> New Tool Mapping
  cache_list_my_work_items: 'cache_list_work_items',
  wit_force_sync_work_items: 'sync_force_work_items',
  wit_my_work_items: 'cache_list_work_items',
  wit_get_work_item: 'cache_get_work_item',
  wit_add_work_item_comment: 'wit_add_comment',
  wit_link_work_item_to_pull_request: 'wit_link_to_pull_request',
  wit_sync_status: 'sync_get_status',
  cache_sync_summary: 'cache_get_sync_summary',
} as const
```

Legacy tools will include deprecation warnings and redirect to new implementations while maintaining identical response formats during the transition period.
