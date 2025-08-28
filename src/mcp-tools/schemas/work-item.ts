import { z } from 'zod'

/**
 * Work Item ID parameter schema
 */
export const WorkItemIdSchema = z.object({
  id: z.number().int().positive().describe('Work item ID'),
})

/**
 * Work Item batch IDs schema
 */
export const WorkItemIdsSchema = z.object({
  ids: z
    .array(z.number().int().positive())
    .min(1)
    .max(100)
    .describe('Array of work item IDs'),
})

/**
 * Work Item filtering schema
 */
export const WorkItemFiltersSchema = z.object({
  states: z.array(z.string()).optional().describe('Filter by work item states'),
  assignee: z.string().email().optional().describe('Filter by assignee email'),
  type: z.string().optional().describe('Filter by work item type'),
  areaPath: z.string().optional().describe('Filter by area path'),
  iterationPath: z.string().optional().describe('Filter by iteration path'),
  top: z
    .number()
    .int()
    .min(1)
    .max(500)
    .default(50)
    .describe('Maximum items to return'),
  skip: z
    .number()
    .int()
    .min(0)
    .default(0)
    .optional()
    .describe('Number of items to skip'),
})

/**
 * Iteration filtering schema
 */
export const IterationFilterSchema = z.object({
  iteration: z.string().describe('Iteration path or "current" for auto-detect'),
  top: z
    .number()
    .int()
    .min(1)
    .max(500)
    .default(100)
    .describe('Maximum items to return'),
})

/**
 * Person schema
 */
export const PersonSchema = z.object({
  id: z.string().nullable(),
  name: z.string(),
  email: z.string().email(),
  displayName: z.string().optional(),
  uniqueName: z.string().optional(),
  imageUrl: z.string().url().nullable().optional(),
})

/**
 * Work Item metrics schema
 */
export const WorkItemMetricsSchema = z.object({
  commentCount: z.number().int().min(0),
  hasAttachments: z.boolean(),
})

/**
 * Work Item response schema
 */
export const WorkItemResponseSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  state: z.string(),
  type: z.string(),
  assignedTo: PersonSchema.nullable(),
  priority: z.number().int().min(1).max(4).nullable(),
  severity: z.number().int().min(1).max(4).nullable(),
  storyPoints: z.number().min(0).nullable(),
  remainingWork: z.number().min(0).nullable(),
  iterationPath: z.string().nullable(),
  areaPath: z.string().nullable(),
  parentId: z.number().int().positive().nullable(),
  boardColumn: z.string().nullable(),
  boardColumnDone: z.boolean(),
  teamProject: z.string().nullable(),
  tags: z.array(z.string()),
  url: z.string().url().nullable(),
  updatedAt: z.string().datetime().nullable(),
  createdDate: z.string().datetime().nullable(),
  closedDate: z.string().datetime().nullable(),
  metrics: WorkItemMetricsSchema,
})

/**
 * Work Item creation schema
 */
export const CreateWorkItemSchema = z.object({
  type: z
    .enum(['Bug', 'Feature', 'Task', 'User Story', 'Epic', 'Issue'])
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
  storyPoints: z.number().min(0).optional().describe('Story points estimate'),
  tags: z.array(z.string()).optional().describe('Work item tags'),
})

/**
 * Work Item update schema
 */
export const UpdateWorkItemSchema = z.object({
  id: z.number().int().positive().describe('Work item ID'),
  fields: z.record(z.string(), z.any()).describe('Fields to update'),
})

/**
 * Work Item state update schema
 */
export const UpdateWorkItemStateSchema = z.object({
  id: z.number().int().positive().describe('Work item ID'),
  state: z.string().min(1).describe('New state value'),
  reason: z.string().optional().describe('State change reason'),
})

/**
 * Work Item comment schema
 */
export const WorkItemCommentSchema = z.object({
  id: z.number().int().positive().describe('Work item ID'),
  comment: z.string().min(1).max(10000).describe('Comment text'),
})

/**
 * Work Item PR link schema
 */
export const WorkItemPRLinkSchema = z.object({
  id: z.number().int().positive().describe('Work item ID'),
  pullRequestUrl: z.string().url().describe('Full pull request URL'),
})

/**
 * Work Item relation schema
 */
export const WorkItemRelationSchema = z.object({
  relationType: z.string(),
  targetId: z.number().int().positive(),
  targetTitle: z.string(),
  targetState: z.string(),
  targetType: z.string(),
})

/**
 * Work Item relations response schema
 */
export const WorkItemRelationsResponseSchema = z.object({
  workItem: WorkItemResponseSchema,
  relations: z.object({
    outgoing: z.array(WorkItemRelationSchema),
    incoming: z.array(WorkItemRelationSchema),
  }),
})

/**
 * Cache options schema
 */
export const CacheOptionsSchema = z.object({
  includeRaw: z.boolean().default(false).describe('Include raw JSON backup'),
  includeRelations: z
    .boolean()
    .default(false)
    .describe('Include work item relations'),
  includeComments: z
    .boolean()
    .default(false)
    .describe('Include work item comments'),
})

/**
 * List response wrapper schema
 */
export const WorkItemListResponseSchema = z.object({
  items: z.array(WorkItemResponseSchema),
  count: z.number().int().min(0),
  totalMatched: z.number().int().min(0),
  filters: z.record(z.string(), z.any()).optional(),
  pagination: z
    .object({
      skip: z.number().int().min(0),
      top: z.number().int().min(1),
      hasMore: z.boolean(),
    })
    .optional(),
})
