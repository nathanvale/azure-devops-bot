import type { z } from 'zod'

import type { DatabaseService } from '../../../services/database.js'
import type { SyncMetrics } from '../../../utils/sync-metrics.js'

import {
  WorkItemGetResponseEnvelope,
  WorkItemListResponseEnvelope,
  WorkItemRelationsResponseEnvelope,
  SyncSummaryResponseEnvelope,
} from '../../schemas/envelopes.js'
import {
  WorkItemIdSchema,
  WorkItemFiltersSchema,
  IterationFilterSchema,
  CacheOptionsSchema,
  createSuccessResponse,
  createTimestamp,
} from '../../schemas/index.js'
import { SyncStatusSchema } from '../../schemas/sync.js'
import { BaseDomain } from '../../types/base.js'

/**
 * Cache domain for local database operations
 * Provides fast, read-only access to locally cached Azure DevOps data
 */
export class CacheDomain extends BaseDomain {
  constructor(
    private db: DatabaseService,
    private syncMetrics: SyncMetrics,
    private userEmails: string[] = [],
  ) {
    super()
    this.initializeTools()
  }

  getName(): string {
    return 'cache'
  }

  private initializeTools(): void {
    this.tools = [
      {
        name: 'cache_get_work_item',
        description:
          'Get a single work item from local cache by ID with normalized JSON output',
        inputSchema: WorkItemIdSchema.merge(CacheOptionsSchema.partial()),
        outputSchema: WorkItemGetResponseEnvelope,
        handler: this.handleGetWorkItem.bind(this) as (args: unknown) => Promise<unknown>,
      },
      {
        name: 'cache_list_work_items',
        description:
          'List work items from local cache with optional filtering and pagination',
        inputSchema: WorkItemFiltersSchema,
        outputSchema: WorkItemListResponseEnvelope,
        handler: this.handleListWorkItems.bind(this) as (args: unknown) => Promise<unknown>,
      },
      {
        name: 'cache_get_work_item_relations',
        description:
          'Get work item relationships (parent/child, related items) from local cache',
        inputSchema: WorkItemIdSchema,
        outputSchema: WorkItemRelationsResponseEnvelope,
        handler: this.handleGetWorkItemRelations.bind(this) as (args: unknown) => Promise<unknown>,
      },
      {
        name: 'cache_list_iteration_work_items',
        description:
          'List work items for a specific iteration or current sprint from local cache',
        inputSchema: IterationFilterSchema,
        outputSchema: WorkItemListResponseEnvelope,
        handler: this.handleListIterationWorkItems.bind(this) as (args: unknown) => Promise<unknown>,
      },
      {
        name: 'cache_get_sync_summary',
        description:
          'Get structured JSON summary of sync metrics and status (cache domain access)',
        inputSchema: SyncStatusSchema.partial(),
        outputSchema: SyncSummaryResponseEnvelope,
        handler: this.handleGetSyncSummary.bind(this) as (args: unknown) => Promise<unknown>,
      },
      {
        name: 'cache_list_my_work_items',
        description:
          'List work items assigned to configured user emails with state filtering',
        inputSchema: WorkItemFiltersSchema.partial(),
        outputSchema: WorkItemListResponseEnvelope,
        handler: this.handleListMyWorkItems.bind(this) as (args: unknown) => Promise<unknown>,
      },
    ]
  }

  /**
   * Get a single work item by ID
   */
  private async handleGetWorkItem(args: {
    id: number
    includeRaw?: boolean
    includeRelations?: boolean
  }): Promise<z.infer<typeof WorkItemGetResponseEnvelope>> {
    const workItem = await this.db.getWorkItemById(args.id)

    if (!workItem) {
      throw new Error(`Work item ${args.id} not found in cache`)
    }

    const normalized = this.normalizeWorkItem(workItem)
    const response: Record<string, unknown> = {
      item: normalized,
    }

    if (args.includeRaw) {
      response.rawJson = workItem.rawJson || null
    }

    if (args.includeRelations) {
      const relations = await this.db.getWorkItemWithFullRelations(args.id)
      response.relations = relations?.relationships || {
        outgoing: [],
        incoming: [],
      }
    }

    return createSuccessResponse(response) as z.infer<typeof WorkItemGetResponseEnvelope>
  }

  /**
   * List work items with filtering
   */
  private async handleListWorkItems(args: {
    states?: string[]
    assignee?: string
    type?: string
    areaPath?: string
    iterationPath?: string
    top?: number
    skip?: number
  }): Promise<z.infer<typeof WorkItemListResponseEnvelope>> {
    // Start with all work items
    let items = await this.db.getAllWorkItems()

    // Apply filters
    if (args.states && args.states.length > 0) {
      items = items.filter((item) => args.states!.includes(item.state))
    }

    if (args.assignee) {
      items = items.filter((item) => {
        const assignedTo = (item as any).assignedToPerson?.uniqueName || item.assignedTo
        return assignedTo === args.assignee
      })
    }

    if (args.type) {
      items = items.filter((item) => item.type === args.type)
    }

    if (args.areaPath) {
      items = items.filter((item) => item.areaPath === args.areaPath)
    }

    if (args.iterationPath) {
      items = items.filter((item) => item.iterationPath === args.iterationPath)
    }

    const totalMatched = items.length

    // Apply pagination
    const skip = args.skip || 0
    const top = args.top || 50
    const paginatedItems = items.slice(skip, skip + top)

    const normalized = paginatedItems.map((item) =>
      this.normalizeWorkItem(item),
    )

    const response: Record<string, unknown> = {
      items: normalized,
      count: normalized.length,
      totalMatched,
      filters: {
        states: args.states,
        assignee: args.assignee,
        type: args.type,
        areaPath: args.areaPath,
        iterationPath: args.iterationPath,
      },
      pagination: {
        skip,
        top,
        hasMore: skip + top < totalMatched,
      },
    }

    return createSuccessResponse(response as any) as z.infer<typeof WorkItemListResponseEnvelope>
  }

  /**
   * Get work item relations
   */
  private async handleGetWorkItemRelations(args: {
    id: number
  }): Promise<z.infer<typeof WorkItemRelationsResponseEnvelope>> {
    const workItem = await this.db.getWorkItemById(args.id)

    if (!workItem) {
      throw new Error(`Work item ${args.id} not found in cache`)
    }

    const relations = await this.db.getWorkItemWithFullRelations(args.id)

    if (!relations) {
      throw new Error(`Relations for work item ${args.id} not found`)
    }

    return createSuccessResponse({
      workItem: this.normalizeWorkItem(workItem),
      relations: relations?.relationships || { outgoing: [], incoming: [] },
    } as any) as z.infer<typeof WorkItemRelationsResponseEnvelope>
  }

  /**
   * List iteration work items
   */
  private async handleListIterationWorkItems(args: {
    iteration: string
    top?: number
  }): Promise<z.infer<typeof WorkItemListResponseEnvelope>> {
    let items

    if (args.iteration.toLowerCase() === 'current') {
      items = await this.db.getCurrentSprintItems()
    } else {
      items = await this.db.getWorkItemsByIteration(args.iteration)
    }

    const totalMatched = items.length
    const top = Math.min(args.top || 100, 500)
    const trimmed = items.slice(0, top)
    const normalized = trimmed.map((item) => this.normalizeWorkItem(item))

    return createSuccessResponse(
      {
        iterationRequested: args.iteration,
        items: normalized as any, // Type assertion needed for complex normalized objects
        count: normalized.length,
        totalMatched,
        hasMore: totalMatched > top,
      },
      {
        count: normalized.length,
        total: totalMatched,
        filters: { iteration: args.iteration },
      },
    ) as z.infer<typeof WorkItemListResponseEnvelope>
  }

  /**
   * Get sync summary from cache perspective
   */
  private async handleGetSyncSummary(args: {
    includeHistory?: boolean
    historyLimit?: number
  }): Promise<z.infer<typeof SyncSummaryResponseEnvelope>> {
    const includeHistory = args.includeHistory || false
    const historyLimit = Math.min(args.historyLimit || 5, 20)

    const summary = await this.syncMetrics.getSyncSummary().catch(() => null)
    const latest = await this.syncMetrics.getLatestSync().catch(() => null)

    let history: Array<Record<string, unknown>> = []
    if (includeHistory) {
      const recent = await this.syncMetrics
        .getRecentSyncs(historyLimit)
        .catch(() => [])
      history = recent.map(item => item as any) as Record<string, unknown>[]
    }

    return createSuccessResponse(
      {
        summary,
        latest,
        history: includeHistory ? (history as Record<string, unknown>[]) : undefined,
      } as any,
      {
        timestamp: createTimestamp(),
      },
    ) as z.infer<typeof SyncSummaryResponseEnvelope>
  }

  /**
   * List my work items (user-specific)
   */
  private async handleListMyWorkItems(args: {
    states?: string[]
    top?: number
  }): Promise<z.infer<typeof WorkItemListResponseEnvelope>> {
    const states = args.states || []
    const top = Math.min(args.top || 50, 500)

    const allItems = await this.db.getWorkItemsForUsers(this.userEmails)

    let filteredItems = allItems
    if (states.length > 0) {
      filteredItems = allItems.filter((item) => states.includes(item.state))
    }

    const trimmed = filteredItems.slice(0, top)
    const normalized = trimmed.map((item) => this.normalizeWorkItem(item))

    return createSuccessResponse(
      {
        items: normalized,
        count: normalized.length,
        totalMatched: filteredItems.length,
        filtersApplied: { states },
        userEmails: this.userEmails,
      } as any,
      {
        count: normalized.length,
        total: filteredItems.length,
        filters: { states, userEmails: this.userEmails },
      },
    ) as z.infer<typeof WorkItemListResponseEnvelope>
  }

  /**
   * Normalize work item to standard response format
   */
  private normalizeWorkItem(
    raw: Record<string, unknown>,
  ): Record<string, unknown> {
    const tagsArray = raw.tags
      ? Array.isArray(raw.tags)
        ? (raw.tags as string[])
        : String(raw.tags)
            .split(/[,;]/)
            .map((t: string) => t.trim())
            .filter(Boolean)
      : []

    return {
      id: raw.id,
      title: raw.title || '',
      type: raw.type || raw.workItemType || '',
      state: raw.state || '',
      iterationPath: raw.iterationPath || null,
      areaPath: raw.areaPath || null,
      parentId: raw.parentId || null,
      assignedTo: raw.assignedToPerson && typeof raw.assignedToPerson === 'object' && 'id' in raw.assignedToPerson
        ? {
            id: (raw.assignedToPerson as any).id || null,
            name: (raw.assignedToPerson as any).displayName || '',
            email: (raw.assignedToPerson as any).uniqueName || '',
          }
        : raw.assignedTo
          ? { id: null, name: raw.assignedTo, email: raw.assignedTo }
          : null,
      priority: raw.priority ?? null,
      severity: raw.severity ?? null,
      storyPoints: raw.storyPoints ?? null,
      remainingWork: raw.remainingWork ?? null,
      boardColumn: raw.boardColumn || null,
      boardColumnDone: !!raw.boardColumnDone,
      teamProject: raw.teamProject || null,
      tags: tagsArray,
      url: raw.azureUrl || raw.url || null,
      updatedAt: raw.changedDate || raw.lastUpdatedAt || null,
      createdDate: raw.createdDate || null,
      closedDate: raw.closedDate || null,
      metrics: {
        commentCount: raw.commentCount ?? 0,
        hasAttachments: !!raw.hasAttachments,
      },
    }
  }
}
