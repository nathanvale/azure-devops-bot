import { PrismaClient, type Person } from '@prisma/client'

import type { PersonData } from '../packages/azure-devops-client/src/types/person.js'
import type {
  ComprehensiveWorkItemData,
  ComprehensiveWorkItemDataWithPersons,
} from '../types/database.js'
import { hasPersonData } from '../types/database.js'
import type { WorkItemCommentData } from './azure-devops.js'

import { LoggerFactory } from '../utils/logger.js'
import { AzureDevOpsClient } from './azure-devops.js'

export class DatabaseService {
  private prisma: PrismaClient
  private logger = LoggerFactory.createForComponent('database')

  constructor() {
    this.prisma = new PrismaClient()
  }

  get client() {
    return this.prisma
  }

  async syncWorkItems(
    workItems: ComprehensiveWorkItemData[] | ComprehensiveWorkItemDataWithPersons[],
  ): Promise<void> {
    const BATCH_SIZE = 100
    const totalBatches = Math.ceil(workItems.length / BATCH_SIZE)
    const syncStartTime = Date.now()

    this.logger.debug(
      `💾 Starting database sync of ${workItems.length} work items in ${totalBatches} batches...`,
    )

    this.logger.info('Starting work items database sync', {
      operation: 'sync_work_items',
      totalItems: workItems.length,
      batchSize: BATCH_SIZE,
      totalBatches,
    })

    // Extract and sync all persons before work items (if WorkItemDataWithPersons)
    if (workItems.length > 0 && workItems[0] && 'assignedToPerson' in workItems[0]) {
      const workItemsWithPersons = workItems as ComprehensiveWorkItemDataWithPersons[]
      this.logger.debug(
        `👥 Extracting persons from ${workItemsWithPersons.length} work items...`,
      )
      const personsMap = new Map<string, PersonData>()

      workItemsWithPersons.forEach((item) => {
        // Collect unique persons from all person fields
        const personFields = [
          item.assignedToPerson,
          item.createdByPerson,
          item.changedByPerson,
          item.closedByPerson,
          item.resolvedByPerson,
          item.activatedByPerson,
          item.authorizedAsPerson,
        ]

        personFields.forEach((person) => {
          if (person && !personsMap.has(person.id)) {
            personsMap.set(person.id, person)
          }
        })
      })

      const uniquePersons = Array.from(personsMap.values())
      this.logger.debug(
        `👥 Found ${uniquePersons.length} unique persons to sync`,
      )

      if (uniquePersons.length > 0) {
        await this.upsertPersonsBatch(uniquePersons)
      }
    }

    for (let i = 0; i < workItems.length; i += BATCH_SIZE) {
      const batch = workItems.slice(i, i + BATCH_SIZE)
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1
      const batchStartTime = Date.now()

      try {
        await this.prisma.$transaction(
          batch.map((item) => {
            // Check if this is ComprehensiveWorkItemDataWithPersons
            const itemWithPersons = item as ComprehensiveWorkItemDataWithPersons
            const itemHasPersonData = hasPersonData(item)

            // Convert id to number if it's a string
            const workItemId =
              typeof item.id === 'string' ? parseInt(item.id, 10) : item.id

            const commonData = {
              title: item.title || '',
              state: item.state || '',
              type: item.type || '',
              // Backward compatibility: use string field or Person displayName
              assignedTo:
                item.assignedTo ||
                (itemHasPersonData &&
                  itemWithPersons.assignedToPerson?.displayName) ||
                'Unassigned',
              lastUpdatedAt: new Date(
                item.changedDate || new Date().toISOString(),
              ),
              azureUrl: AzureDevOpsClient.buildWorkItemUrl(workItemId),
              lastSyncedAt: new Date(),
              description: item.description || '',

              // Sprint/Board Info
              iterationPath: item.iterationPath,
              areaPath: item.areaPath,
              boardColumn: item.boardColumn,
              boardColumnDone: item.boardColumnDone || false,

              // Priority/Tags
              priority: item.priority,
              severity: item.severity,
              // Convert tags array to string if needed
              tags: Array.isArray(item.tags) ? item.tags.join(', ') : item.tags,

              // All the dates - convert strings to Date objects if present
              createdDate: item.createdDate
                ? new Date(item.createdDate)
                : undefined,
              changedDate: item.changedDate
                ? new Date(item.changedDate)
                : undefined,
              closedDate: item.closedDate
                ? new Date(item.closedDate)
                : undefined,
              resolvedDate: item.resolvedDate
                ? new Date(item.resolvedDate)
                : undefined,
              activatedDate: item.activatedDate
                ? new Date(item.activatedDate)
                : undefined,
              stateChangeDate: item.stateChangeDate
                ? new Date(item.stateChangeDate)
                : undefined,

              // People - with backward compatibility
              createdBy:
                item.createdBy ||
                (itemHasPersonData ? itemWithPersons.createdByPerson?.displayName : undefined) ||
                undefined,
              changedBy:
                item.changedBy ||
                (itemHasPersonData ? itemWithPersons.changedByPerson?.displayName : undefined) ||
                undefined,
              closedBy:
                item.closedBy ||
                (itemHasPersonData ? itemWithPersons.closedByPerson?.displayName : undefined) ||
                undefined,
              resolvedBy:
                item.resolvedBy ||
                (itemHasPersonData ? itemWithPersons.resolvedByPerson?.displayName : undefined) ||
                undefined,

              // NEW: Person foreign key relationships (if available)
              ...(itemHasPersonData && 
                Object.fromEntries(
                  Object.entries({
                    assignedToId: itemWithPersons.assignedToPerson?.id,
                    createdById: itemWithPersons.createdByPerson?.id,
                    changedById: itemWithPersons.changedByPerson?.id,
                    closedById: itemWithPersons.closedByPerson?.id,
                    resolvedById: itemWithPersons.resolvedByPerson?.id,
                    activatedById: itemWithPersons.activatedByPerson?.id,
                    authorizedAsId: itemWithPersons.authorizedAsPerson?.id,
                    activatedBy:
                      item.activatedBy ||
                      itemWithPersons.activatedByPerson?.displayName,
                    authorizedAs:
                      item.authorizedAs ||
                      itemWithPersons.authorizedAsPerson?.displayName,
                  }).filter(([, value]) => value !== undefined)
                )
              ),

              // Work tracking
              storyPoints: item.storyPoints,
              effort: item.effort,
              remainingWork: item.remainingWork,
              completedWork: item.completedWork,
              originalEstimate: item.originalEstimate,

              // Content
              acceptanceCriteria: item.acceptanceCriteria,
              reproSteps: item.reproSteps,
              systemInfo: item.systemInfo,

              // Related items
              parentId: item.parentId,

              // Additional Azure DevOps fields
              rev: item.rev,
              reason: item.reason,
              watermark: item.watermark,
              url: item.url,
              commentCount: item.commentCount || 0,
              hasAttachments: item.hasAttachments || false,
              teamProject: item.teamProject,
              areaId: item.areaId,
              nodeId: item.nodeId,
              stackRank: item.stackRank,
              valueArea: item.valueArea,

              // Complete raw JSON backup (default to empty object if not provided)
              rawJson: item.rawJson || JSON.stringify(item.raw || {}),
            }

            return this.prisma.workItem.upsert({
              where: { id: workItemId },
              update: commonData,
              create: {
                id: workItemId,
                ...commonData,
              },
            })
          }),
        )

        const batchDuration = Date.now() - batchStartTime
        const processed = i + batch.length
        const percentComplete = Math.round((processed / workItems.length) * 100)
        this.logger.debug(
          `💾 Batch ${batchNumber}/${totalBatches} complete: ${processed}/${workItems.length} items (${percentComplete}%) - ${batchDuration}ms`,
        )

        this.logger.debug('Database batch completed', {
          operation: 'sync_work_items_batch',
          batchNumber,
          totalBatches,
          processed,
          totalItems: workItems.length,
          percentComplete,
          batchDurationMs: batchDuration,
        })
      } catch (error) {
        this.logger.error(
          `Failed to sync batch ${batchNumber}/${totalBatches} (${batch.length} work items starting at index ${i}):`,
          { error: error instanceof Error ? error.message : String(error) },
        )

        this.logger.error('Database batch sync failed', {
          operation: 'sync_work_items_batch',
          batchNumber,
          totalBatches,
          batchSize: batch.length,
          startIndex: i,
          error: error instanceof Error ? error.message : String(error),
        })

        // Check if this is a transaction rollback scenario
        if (error instanceof Error && error.message.includes('SQLITE_BUSY')) {
          console.warn(`Database busy for batch ${batchNumber}, will retry...`)
          this.logger.warn('Database busy, retry needed', {
            operation: 'sync_work_items_batch',
            batchNumber,
            errorType: 'SQLITE_BUSY',
          })
        } else if (
          error instanceof Error &&
          error.message.includes('UNIQUE constraint failed')
        ) {
          console.warn(
            `Unique constraint violation in batch ${batchNumber}, skipping problematic items...`,
          )
          this.logger.warn('Unique constraint violation in batch', {
            operation: 'sync_work_items_batch',
            batchNumber,
            errorType: 'UNIQUE_CONSTRAINT',
          })
        }

        throw new Error(
          `Batch sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        )
      }
    }

    const syncDuration = Date.now() - syncStartTime
    this.logger.debug(
      `✅ Database sync complete: ${workItems.length} work items stored`,
    )

    this.logger.info('Work items database sync completed', {
      operation: 'sync_work_items',
      totalItems: workItems.length,
      totalBatches,
      syncDurationMs: syncDuration,
      performanceMs: Math.round((syncDuration / workItems.length) * 100) / 100, // ms per item
    })

    // Store relationships and links for all work items
    this.logger.debug(`💾 Starting relationship and link storage...`)
    const relationshipStartTime = Date.now()
    let totalRelationships = 0
    let totalLinks = 0

    for (const item of workItems) {
      if (item.relationships && item.relationships.length > 0) {
        try {
          // Extract relations from rawJson if available
          const rawData = item.rawJson ? JSON.parse(item.rawJson) : null
          const relations = rawData?.relations || []

          if (relations.length > 0) {
            await this.storeWorkItemRelations(Number(item.id), relations)
            const { relationships, links } = this.extractWorkItemRelationships(
              Number(item.id),
              relations,
            )
            totalRelationships += relationships.length
            totalLinks += links.length
          }
        } catch (error) {
          this.logger.error('Failed to store relationships for work item', {
            workItemId: item.id,
            error: error instanceof Error ? error.message : String(error),
          })
          this.logger.error(
            `Failed to store relationships for work item ${item.id}:`,
            { error: error instanceof Error ? error.message : String(error) },
          )
        }
      }
    }

    const relationshipDuration = Date.now() - relationshipStartTime
    this.logger.debug(
      `✅ Stored ${totalRelationships} relationships and ${totalLinks} links in ${relationshipDuration}ms`,
    )

    this.logger.info('Relationships and links storage completed', {
      operation: 'store_relationships_and_links',
      totalRelationships,
      totalLinks,
      durationMs: relationshipDuration,
      workItemsProcessed: workItems.filter(
        (item) => item.relationships && item.relationships.length > 0,
      ).length,
    })
  }

  async getAllWorkItems() {
    try {
      return await this.prisma.workItem.findMany({
        orderBy: { lastUpdatedAt: 'desc' },
      })
    } catch (error) {
      this.logger.error('Failed to retrieve work items:', { 
        error: error instanceof Error ? error.message : String(error) 
      })
      throw new Error(
        `Database query failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  async getWorkItemsByType(type: string) {
    try {
      return await this.prisma.workItem.findMany({
        where: { type },
        orderBy: { lastUpdatedAt: 'desc' },
      })
    } catch (error) {
      this.logger.error(
        `Failed to retrieve work items by type '${type}':`,
        { error: error instanceof Error ? error.message : String(error) },
      )
      throw new Error(
        `Database query failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  async getWorkItemsForUsers(userEmails: string[]) {
    try {
      if (!userEmails || userEmails.length === 0) {
        return await this.getAllWorkItems()
      }

      return await this.prisma.workItem.findMany({
        where: {
          OR: [
            // PRIMARY: Person-based email search (optimized with indexes)
            {
              assignedToPerson: {
                uniqueName: {
                  in: userEmails,
                },
              },
              state: {
                notIn: ['Closed', 'Resolved', 'Done', 'Completed'],
              },
            },
            {
              assignedToPerson: {
                uniqueName: {
                  in: userEmails,
                },
              },
              state: {
                in: ['Closed', 'Resolved', 'Done', 'Completed'],
              },
            },
            // FALLBACK: Legacy string-based search for backward compatibility
            {
              assignedTo: {
                in: userEmails,
              },
              state: {
                notIn: ['Closed', 'Resolved', 'Done', 'Completed'],
              },
            },
            {
              assignedTo: {
                in: userEmails,
              },
              state: {
                in: ['Closed', 'Resolved', 'Done', 'Completed'],
              },
            },
          ],
        },
        include: {
          assignedToPerson: true, // Include person data in results
          createdByPerson: true,
          changedByPerson: true,
        },
        orderBy: { lastUpdatedAt: 'desc' },
      })
    } catch (error) {
      this.logger.error(
        `Failed to retrieve work items for users [${userEmails.join(', ')}]:`,
        { error: error instanceof Error ? error.message : String(error) },
      )
      throw new Error(
        `Database query failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  async getWorkItemsByStateForUsers(state: string, userEmails: string[]) {
    try {
      if (!userEmails || userEmails.length === 0) {
        return await this.getWorkItemsByState(state)
      }

      return await this.prisma.workItem.findMany({
        where: {
          state,
          OR: [
            // PRIMARY: Person-based email search (optimized)
            {
              assignedToPerson: {
                uniqueName: {
                  in: userEmails,
                },
              },
            },
            // FALLBACK: Legacy string-based search
            {
              assignedTo: {
                in: userEmails,
              },
            },
          ],
        },
        include: {
          assignedToPerson: true,
        },
        orderBy: { lastUpdatedAt: 'desc' },
      })
    } catch (error) {
      this.logger.error(
        `Failed to retrieve work items by state '${state}' for users [${userEmails.join(', ')}]:`,
        { error: error instanceof Error ? error.message : String(error) },
      )
      throw new Error(
        `Database query failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  async getWorkItemsByTypeForUsers(type: string, userEmails: string[]) {
    try {
      if (!userEmails || userEmails.length === 0) {
        return await this.getWorkItemsByType(type)
      }

      return await this.prisma.workItem.findMany({
        where: {
          type,
          OR: [
            // PRIMARY: Person-based email search (optimized)
            {
              assignedToPerson: {
                uniqueName: {
                  in: userEmails,
                },
              },
            },
            // FALLBACK: Legacy string-based search
            {
              assignedTo: {
                in: userEmails,
              },
            },
          ],
        },
        include: {
          assignedToPerson: true,
        },
        orderBy: { lastUpdatedAt: 'desc' },
      })
    } catch (error) {
      this.logger.error(
        `Failed to retrieve work items by type '${type}' for users [${userEmails.join(', ')}]:`,
        { error: error instanceof Error ? error.message : String(error) },
      )
      throw new Error(
        `Database query failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  async getLastSyncTime(): Promise<Date | null> {
    try {
      const lastItem = await this.prisma.workItem.findFirst({
        orderBy: { lastSyncedAt: 'desc' },
        select: { lastSyncedAt: true },
      })
      return lastItem?.lastSyncedAt || null
    } catch (error) {
      this.logger.error('Failed to retrieve last sync time:', { 
        error: error instanceof Error ? error.message : String(error) 
      })
      throw new Error(
        `Database query failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  async storeWorkItemComments(comments: WorkItemCommentData[]): Promise<void> {
    if (comments.length === 0) return

    const BATCH_SIZE = 50
    const totalBatches = Math.ceil(comments.length / BATCH_SIZE)

    if (comments.length > 10) {
      this.logger.debug(
        `💬 Starting comment sync of ${comments.length} comments in ${totalBatches} batches...`,
      )
    }

    for (let i = 0; i < comments.length; i += BATCH_SIZE) {
      const batch = comments.slice(i, i + BATCH_SIZE)
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1

      try {
        await this.prisma.$transaction(
          batch
            .map((comment) => {
              // Safely parse comment ID - handle both string and number types
              let commentId: number
              if (typeof comment.id === 'string') {
                commentId = parseInt(comment.id, 10)
                if (isNaN(commentId)) {
                  console.warn(
                    `⚠️ Invalid comment ID "${comment.id}" for work item ${comment.workItemId}, skipping...`,
                  )
                  return null
                }
              } else if (typeof comment.id === 'number') {
                commentId = comment.id
              } else {
                console.warn(
                  `⚠️ Unexpected comment ID type "${typeof comment.id}" for work item ${comment.workItemId}, skipping...`,
                )
                return null
              }

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
            })
            .filter((operation) => operation !== null), // Filter out null operations from invalid IDs
        )

        if (comments.length > 10 && totalBatches > 1) {
          const processed = i + batch.length
          const percentComplete = Math.round(
            (processed / comments.length) * 100,
          )
          this.logger.debug(
            `💬 Comment batch ${batchNumber}/${totalBatches}: ${processed}/${comments.length} (${percentComplete}%)`,
          )
        }
      } catch (error) {
        this.logger.error(
          `Failed to sync comment batch ${batchNumber}/${totalBatches} (${batch.length} comments starting at index ${i}):`,
          { error: error instanceof Error ? error.message : String(error) },
        )

        // Check if this is a transaction rollback scenario
        if (error instanceof Error && error.message.includes('SQLITE_BUSY')) {
          this.logger.warn(
            `Database busy for comment batch ${batchNumber}, will retry...`,
          )
        } else if (
          error instanceof Error &&
          error.message.includes('UNIQUE constraint failed')
        ) {
          console.warn(
            `Unique constraint violation in comment batch ${batchNumber}, skipping problematic items...`,
          )
        }

        throw new Error(
          `Comment batch sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        )
      }
    }

    if (comments.length > 10) {
      this.logger.debug(
        `✅ Comment sync complete: ${comments.length} comments stored`,
      )
    }
  }

  async getWorkItemComments(workItemId: number) {
    try {
      return await this.prisma.workItemComment.findMany({
        where: { workItemId },
        orderBy: { createdDate: 'asc' },
      })
    } catch (error) {
      this.logger.error(
        `Failed to retrieve comments for work item ${workItemId}:`,
        { error: error instanceof Error ? error.message : String(error) },
      )
      throw new Error(
        `Database query failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  async getRecentComments(limit: number = 50) {
    try {
      return await this.prisma.workItemComment.findMany({
        orderBy: { createdDate: 'desc' },
        take: limit,
      })
    } catch (error) {
      this.logger.error(
        `Failed to retrieve recent comments (limit: ${limit}):`,
        { error: error instanceof Error ? error.message : String(error) },
      )
      throw new Error(
        `Database query failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  async needsCommentSync(
    workItemId: number,
    commentCount: number,
    changedDate: Date | null,
    lastSyncTime?: Date | null,
  ): Promise<boolean> {
    // If work item has no comments, don't sync
    if (commentCount === 0) {
      return false
    }

    // Check if we have any comments stored for this work item
    const existingComments = await this.prisma.workItemComment.count({
      where: { workItemId },
    })

    // If we have no comments stored but the work item has comments, force sync
    if (existingComments === 0 && commentCount > 0) {
      this.logger.debug('Forcing comment sync - no existing comments', {
        workItemId,
        commentCount,
        existingComments,
      })
      return true
    }

    // If no last sync time or changed date, sync to be safe
    if (!lastSyncTime || !changedDate) {
      return true
    }

    // Sync if work item changed after last sync
    return changedDate > lastSyncTime
  }

  async getWorkItemById(id: number) {
    try {
      return await this.prisma.workItem.findUnique({
        where: { id },
      })
    } catch (error) {
      this.logger.error(`Failed to retrieve work item by ID ${id}:`, { 
        error: error instanceof Error ? error.message : String(error) 
      })
      throw new Error(
        `Database query failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  async getWorkItemsByIds(ids: number[]) {
    try {
      if (!ids || ids.length === 0) {
        return []
      }

      return await this.prisma.workItem.findMany({
        where: {
          id: {
            in: ids,
          },
        },
        orderBy: { lastUpdatedAt: 'desc' },
      })
    } catch (error) {
      this.logger.error(
        `Failed to retrieve work items by IDs [${ids.join(', ')}]:`,
        { error: error instanceof Error ? error.message : String(error) },
      )
      throw new Error(
        `Database query failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  async getWorkItemsByIteration(iterationPath: string) {
    try {
      return await this.prisma.workItem.findMany({
        where: { iterationPath },
        orderBy: { lastUpdatedAt: 'desc' },
      })
    } catch (error) {
      this.logger.error(
        `Failed to retrieve work items by iteration '${iterationPath}':`,
        { error: error instanceof Error ? error.message : String(error) },
      )
      throw new Error(
        `Database query failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * Get work items by assignee name
   */
  async getWorkItemsByAssignee(assigneeEmail: string) {
    const queryStartTime = Date.now()
    this.logger.debug(
      `🔍 Querying work items by assignee email: ${assigneeEmail}`,
    )

    this.logger.debug('Starting query by assignee', {
      operation: 'get_work_items_by_assignee',
      assigneeEmail,
    })

    try {
      const workItems = await this.prisma.workItem.findMany({
        where: {
          OR: [
            // PRIMARY: Person-based email lookup (optimized with indexes)
            {
              assignedToPerson: {
                uniqueName: assigneeEmail,
              },
            },
            // FALLBACK: Legacy string contains search for backward compatibility
            {
              assignedTo: {
                contains: assigneeEmail,
              },
            },
          ],
        },
        include: {
          assignedToPerson: true,
        },
        orderBy: { changedDate: 'desc' },
      })

      const queryDuration = Date.now() - queryStartTime
      this.logger.debug(
        `✅ Found ${workItems.length} work items for assignee ${assigneeEmail} (${queryDuration}ms)`,
      )

      this.logger.info('Query by assignee completed', {
        operation: 'get_work_items_by_assignee',
        assigneeEmail,
        resultCount: workItems.length,
        queryDurationMs: queryDuration,
      })

      return workItems
    } catch (error) {
      const queryDuration = Date.now() - queryStartTime
      this.logger.error(
        `Failed to retrieve work items by assignee ${assigneeEmail}:`,
        { error: error instanceof Error ? error.message : String(error) },
      )

      this.logger.error('Query by assignee failed', {
        operation: 'get_work_items_by_assignee',
        assigneeEmail,
        queryDurationMs: queryDuration,
        error: error instanceof Error ? error.message : String(error),
      })

      throw new Error(
        `Database query failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * Get work items by sprint/iteration path
   */
  async getWorkItemsBySprint(sprintPath: string) {
    this.logger.debug(`🔍 Querying work items by sprint: ${sprintPath}`)
    try {
      const workItems = await this.prisma.workItem.findMany({
        where: {
          iterationPath: {
            contains: sprintPath,
          },
        },
        orderBy: { changedDate: 'desc' },
      })
      this.logger.debug(
        `✅ Found ${workItems.length} work items in sprint ${sprintPath}`,
      )
      return workItems
    } catch (error) {
      this.logger.error(
        `Failed to retrieve work items by sprint ${sprintPath}:`,
        { error: error instanceof Error ? error.message : String(error) },
      )
      throw new Error(
        `Database query failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * Get work items by state (enhanced version)
   */
  async getWorkItemsByState(state: string) {
    this.logger.debug(`🔍 Querying work items by state: ${state}`)
    try {
      const workItems = await this.prisma.workItem.findMany({
        where: {
          state: {
            equals: state,
          },
        },
        orderBy: { changedDate: 'desc' },
      })
      this.logger.debug(
        `✅ Found ${workItems.length} work items with state ${state}`,
      )
      return workItems
    } catch (error) {
      this.logger.error(
        `Failed to retrieve work items by state ${state}:`,
        { error: error instanceof Error ? error.message : String(error) },
      )
      throw new Error(
        `Database query failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * Get work items for current sprint by detecting most recent iteration
   */
  async getCurrentSprintItems() {
    const queryStartTime = Date.now()
    this.logger.debug('🔍 Detecting current sprint and fetching work items')

    this.logger.debug('Starting current sprint detection', {
      operation: 'get_current_sprint_items',
    })

    try {
      // Find the most recent iteration path from all work items
      const recentItem = await this.prisma.workItem.findFirst({
        where: {
          iterationPath: { not: null },
          state: { notIn: ['Closed', 'Resolved', 'Done', 'Completed'] },
        },
        orderBy: { changedDate: 'desc' },
        select: { iterationPath: true },
      })

      if (!recentItem?.iterationPath) {
        const queryDuration = Date.now() - queryStartTime
        this.logger.debug('⚠️  No current sprint detected')

        this.logger.warn('No current sprint detected', {
          operation: 'get_current_sprint_items',
          queryDurationMs: queryDuration,
        })

        return []
      }

      this.logger.debug(
        `🎯 Current sprint detected: ${recentItem.iterationPath}`,
      )

      const workItems = await this.prisma.workItem.findMany({
        where: {
          iterationPath: recentItem.iterationPath,
        },
        orderBy: { changedDate: 'desc' },
      })

      const queryDuration = Date.now() - queryStartTime
      this.logger.debug(
        `✅ Found ${workItems.length} work items in current sprint`,
      )

      this.logger.info('Current sprint items retrieved', {
        operation: 'get_current_sprint_items',
        currentSprint: recentItem.iterationPath,
        resultCount: workItems.length,
        queryDurationMs: queryDuration,
      })

      return workItems
    } catch (error) {
      const queryDuration = Date.now() - queryStartTime
      this.logger.error('Failed to retrieve current sprint items:', { 
        error: error instanceof Error ? error.message : String(error) 
      })

      this.logger.error('Current sprint items query failed', {
        operation: 'get_current_sprint_items',
        queryDurationMs: queryDuration,
        error: error instanceof Error ? error.message : String(error),
      })

      throw new Error(
        `Database query failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * Get work item with full relationships and links
   */
  async getWorkItemWithFullRelations(workItemId: number) {
    const queryStartTime = Date.now()
    this.logger.debug(
      `🔍 Querying work item ${workItemId} with full relationships`,
    )

    this.logger.debug('Starting work item with relations query', {
      operation: 'get_work_item_with_full_relations',
      workItemId,
    })

    try {
      // Get the work item itself
      const workItem = await this.prisma.workItem.findUnique({
        where: { id: workItemId },
      })

      if (!workItem) {
        this.logger.warn('Work item not found', {
          operation: 'get_work_item_with_full_relations',
          workItemId,
        })
        throw new Error(`Work item ${workItemId} not found`)
      }

      // Get relationships and links
      const [relationships, links] = await Promise.all([
        this.getWorkItemRelationships(workItemId),
        this.getWorkItemLinks(workItemId),
      ])

      const result = {
        ...workItem,
        relationships: relationships,
        links: links,
      }

      const queryDuration = Date.now() - queryStartTime
      this.logger.debug(
        `✅ Retrieved work item ${workItemId} with ${relationships.outgoing.length} outgoing and ${relationships.incoming.length} incoming relationships, ${links.length} links`,
      )

      this.logger.info('Work item with relations retrieved', {
        operation: 'get_work_item_with_full_relations',
        workItemId,
        outgoingRelations: relationships.outgoing.length,
        incomingRelations: relationships.incoming.length,
        linksCount: links.length,
        queryDurationMs: queryDuration,
      })

      return result
    } catch (error) {
      const queryDuration = Date.now() - queryStartTime
      this.logger.error(
        `Failed to retrieve work item ${workItemId} with relationships:`,
        { error: error instanceof Error ? error.message : String(error) },
      )

      this.logger.error('Work item with relations query failed', {
        operation: 'get_work_item_with_full_relations',
        workItemId,
        queryDurationMs: queryDuration,
        error: error instanceof Error ? error.message : String(error),
      })

      throw new Error(
        `Database query failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * Get work items by team (area path)
   */
  async getWorkItemsByTeam(teamPath: string) {
    this.logger.debug(`🔍 Querying work items by team: ${teamPath}`)
    try {
      const workItems = await this.prisma.workItem.findMany({
        where: {
          areaPath: {
            contains: teamPath,
          },
        },
        orderBy: { changedDate: 'desc' },
      })
      this.logger.debug(
        `✅ Found ${workItems.length} work items for team ${teamPath}`,
      )
      return workItems
    } catch (error) {
      this.logger.error(
        `Failed to retrieve work items by team ${teamPath}:`,
        { error: error instanceof Error ? error.message : String(error) },
      )
      throw new Error(
        `Database query failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * Get work items by multiple criteria with comprehensive logging
   */
  async getWorkItemsByFilters(filters: {
    assignee?: string
    sprint?: string
    state?: string
    team?: string
    type?: string
  }) {
    this.logger.debug(
      `🔍 Querying work items with filters:`,
      { filters: JSON.stringify(filters, null, 2) },
    )

    try {
      const where: Record<string, unknown> = {}

      if (filters.assignee) {
        where.assignedTo = {
          contains: filters.assignee,
        }
        this.logger.debug(
          `  📝 Filter: assignee contains "${filters.assignee}"`,
        )
      }

      if (filters.sprint) {
        where.iterationPath = {
          contains: filters.sprint,
        }
        this.logger.debug(`  📝 Filter: sprint contains "${filters.sprint}"`)
      }

      if (filters.state) {
        where.state = {
          equals: filters.state,
        }
        this.logger.debug(`  📝 Filter: state equals "${filters.state}"`)
      }

      if (filters.team) {
        where.areaPath = {
          contains: filters.team,
        }
        this.logger.debug(`  📝 Filter: team contains "${filters.team}"`)
      }

      if (filters.type) {
        where.type = {
          equals: filters.type,
        }
        this.logger.debug(`  📝 Filter: type equals "${filters.type}"`)
      }

      const workItems = await this.prisma.workItem.findMany({
        where,
        orderBy: { changedDate: 'desc' },
      })

      this.logger.debug(
        `✅ Multi-filter query returned ${workItems.length} work items`,
      )
      return workItems
    } catch (error) {
      this.logger.error('Failed to retrieve work items by filters:', { 
        error: error instanceof Error ? error.message : String(error) 
      })
      throw new Error(
        `Database query failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * Extract work item relationships and links from relations array in raw JSON
   */
  extractWorkItemRelationships(
    workItemId: number,
    relations: Array<Record<string, unknown>>,
  ): {
    relationships: Array<{
      sourceId: number
      targetId: number
      relationshipType: string
      attributes?: string
    }>
    links: Array<{
      workItemId: number
      linkType: string
      linkUrl: string
      linkTitle: string
      attributes?: string
    }>
  } {
    if (!relations || !Array.isArray(relations)) {
      return { relationships: [], links: [] }
    }

    const relationships: Array<{
      sourceId: number
      targetId: number
      relationshipType: string
      attributes?: string
    }> = []

    const links: Array<{
      workItemId: number
      linkType: string
      linkUrl: string
      linkTitle: string
      attributes?: string
    }> = []

    relations.forEach((relation) => {
      const relationAny = relation as any
      if (relationAny.rel && relationAny.url) {
        // Check if this is a work item relationship
        const workItemUrlMatch = relationAny.url.match(/workItems\/(\d+)$/)
        if (workItemUrlMatch) {
          const targetId = parseInt(workItemUrlMatch[1], 10)
          if (!isNaN(targetId)) {
            relationships.push({
              sourceId: workItemId,
              targetId: targetId,
              relationshipType: relationAny.rel,
              attributes: relationAny.attributes
                ? JSON.stringify(relationAny.attributes)
                : undefined,
            })
          }
        } else {
          // This is an external link (PR, commit, attachment, etc.)
          let linkTitle = 'Link'

          // Determine link title based on relation type and attributes
          if (relationAny.rel === 'ArtifactLink') {
            if (relationAny.url.includes('PullRequestId')) {
              linkTitle = 'Pull Request'
            } else if (relationAny.url.includes('Git/Commit')) {
              linkTitle = 'Fixed in Commit'
            } else {
              linkTitle = 'Artifact Link'
            }
          } else if (relationAny.rel === 'AttachedFile') {
            linkTitle = relationAny.attributes?.name || 'Attached File'
          } else {
            linkTitle = relationAny.attributes?.name || relationAny.rel
          }

          links.push({
            workItemId: workItemId,
            linkType: relationAny.rel,
            linkUrl: relationAny.url,
            linkTitle: linkTitle,
            attributes: relationAny.attributes
              ? JSON.stringify(relationAny.attributes)
              : undefined,
          })
        }
      }
    })

    this.logger.debug(
      `📊 Extracted ${relationships.length} relationships and ${links.length} links for work item ${workItemId}`,
    )
    return { relationships, links }
  }

  /**
   * Store work item relationships and links in batch
   */
  async storeWorkItemRelations(
    workItemId: number,
    relations: Array<Record<string, unknown>>,
  ): Promise<void> {
    const { relationships, links } = this.extractWorkItemRelationships(
      workItemId,
      relations,
    )

    if (relationships.length === 0 && links.length === 0) {
      return
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        // Clear existing relationships and links for this work item
        await tx.workItemRelation.deleteMany({
          where: { sourceId: workItemId },
        })
        await tx.workItemLink.deleteMany({
          where: { workItemId: workItemId },
        })

        // Filter relationships to only include those where target exists
        if (relationships.length > 0) {
          const targetIds = relationships.map((r) => r.targetId)
          const existingTargets = await tx.workItem.findMany({
            where: { id: { in: targetIds } },
            select: { id: true },
          })
          const existingTargetIds = new Set(existingTargets.map((t) => t.id))

          const validRelationships = relationships.filter((r) =>
            existingTargetIds.has(r.targetId),
          )

          if (validRelationships.length > 0) {
            await tx.workItemRelation.createMany({
              data: validRelationships,
            })
          }

          const skippedCount = relationships.length - validRelationships.length
          if (skippedCount > 0) {
            this.logger.debug(
              `Skipped ${skippedCount} relationships with missing targets`,
              {
                workItemId,
                totalRelationships: relationships.length,
                validRelationships: validRelationships.length,
              },
            )
          }
        }

        // Store links (no foreign key constraints)
        if (links.length > 0) {
          await tx.workItemLink.createMany({
            data: links,
          })
        }
      })

      if (relationships.length > 0 || links.length > 0) {
        this.logger.debug(
          `✅ Stored relationships and links for work item ${workItemId}`,
        )
      }
    } catch (error) {
      this.logger.error(
        `Failed to store relationships for work item ${workItemId}:`,
        { error: error instanceof Error ? error.message : String(error) },
      )
      throw new Error(
        `Relationship storage failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * Get all relationships for a work item (both as source and target)
   */
  async getWorkItemRelationships(workItemId: number) {
    try {
      const [sourceRelations, targetRelations] = await Promise.all([
        this.prisma.workItemRelation.findMany({
          where: { sourceId: workItemId },
          include: {
            targetWorkItem: {
              select: { id: true, title: true, state: true, type: true },
            },
          },
        }),
        this.prisma.workItemRelation.findMany({
          where: { targetId: workItemId },
          include: {
            sourceWorkItem: {
              select: { id: true, title: true, state: true, type: true },
            },
          },
        }),
      ])

      return {
        outgoing: sourceRelations,
        incoming: targetRelations,
      }
    } catch (error) {
      this.logger.error(
        `Failed to retrieve relationships for work item ${workItemId}:`,
        { error: error instanceof Error ? error.message : String(error) },
      )
      throw new Error(
        `Database query failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * Get all links for a work item
   */
  async getWorkItemLinks(workItemId: number) {
    try {
      return await this.prisma.workItemLink.findMany({
        where: { workItemId },
        orderBy: { linkType: 'asc' },
      })
    } catch (error) {
      this.logger.error(
        `Failed to retrieve links for work item ${workItemId}:`,
        { error: error instanceof Error ? error.message : String(error) },
      )
      throw new Error(
        `Database query failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * Create or update a Person record from Azure DevOps PersonData
   * Handles both new person creation and existing person updates
   * Per DEC-009: Normalized Person table for identity management
   */
  async upsertPerson(personData: PersonData): Promise<void> {
    const upsertStartTime = Date.now()

    this.logger.debug(
      `👤 Upserting person: ${personData.displayName} (${personData.uniqueName})`,
    )

    try {
      await this.prisma.person.upsert({
        where: { id: personData.id },
        update: {
          displayName: personData.displayName,
          uniqueName: personData.uniqueName,
          url: personData.url || null,
          imageUrl: personData.imageUrl || null,
          descriptor: personData.descriptor || null,
          inactive: personData.inactive ?? false,
          updatedAt: new Date(),
        },
        create: {
          id: personData.id,
          displayName: personData.displayName,
          uniqueName: personData.uniqueName,
          url: personData.url || null,
          imageUrl: personData.imageUrl || null,
          descriptor: personData.descriptor || null,
          inactive: personData.inactive ?? false,
        },
      })

      const upsertDuration = Date.now() - upsertStartTime
      this.logger.debug(
        `✅ Person upserted: ${personData.displayName} (${upsertDuration}ms)`,
      )
    } catch (error) {
      this.logger.error(
        `Failed to upsert person ${personData.displayName}:`,
        { error: error instanceof Error ? error.message : String(error) },
      )

      // Handle unique constraint violation on uniqueName (email)
      if (
        error instanceof Error &&
        error.message.includes('UNIQUE constraint failed')
      ) {
        this.logger.warn(
          'Person email uniqueness violation - may be duplicate person data',
          {
            personId: personData.id,
            uniqueName: personData.uniqueName,
            displayName: personData.displayName,
          },
        )
        // Don't throw - allow sync to continue
        return
      }

      throw new Error(
        `Person upsert failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * Get Person by email (uniqueName field)
   * Optimized for sub-100ms queries using indexed uniqueName field
   */
  async getPersonByEmail(email: string): Promise<Person | null> {
    const queryStartTime = Date.now()

    this.logger.debug(`🔍 Querying person by email: ${email}`)

    try {
      const person = await this.prisma.person.findUnique({
        where: { uniqueName: email },
      })

      const queryDuration = Date.now() - queryStartTime

      if (person) {
        this.logger.debug(
          `✅ Found person: ${person.displayName} (${queryDuration}ms)`,
        )
      } else {
        this.logger.debug(
          `❌ Person not found for email: ${email} (${queryDuration}ms)`,
        )
      }

      return person
    } catch (error) {
      const queryDuration = Date.now() - queryStartTime
      this.logger.error(`Failed to retrieve person by email ${email}:`, { 
        error: error instanceof Error ? error.message : String(error) 
      })

      this.logger.error('Person lookup by email failed', {
        operation: 'get_person_by_email',
        email,
        queryDurationMs: queryDuration,
        error: error instanceof Error ? error.message : String(error),
      })

      throw new Error(
        `Database query failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * Batch upsert multiple persons for performance
   * Used during work item sync to efficiently handle person data
   */
  async upsertPersonsBatch(personsData: PersonData[]): Promise<void> {
    if (personsData.length === 0) return

    const BATCH_SIZE = 50
    const totalBatches = Math.ceil(personsData.length / BATCH_SIZE)
    const batchStartTime = Date.now()

    this.logger.debug(
      `👥 Starting batch person upsert: ${personsData.length} persons in ${totalBatches} batches`,
    )

    for (let i = 0; i < personsData.length; i += BATCH_SIZE) {
      const batch = personsData.slice(i, i + BATCH_SIZE)
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1

      try {
        await this.prisma.$transaction(
          batch.map((personData) =>
            this.prisma.person.upsert({
              where: { id: personData.id },
              update: {
                displayName: personData.displayName,
                uniqueName: personData.uniqueName,
                url: personData.url || null,
                imageUrl: personData.imageUrl || null,
                descriptor: personData.descriptor || null,
                inactive: personData.inactive ?? false,
                updatedAt: new Date(),
              },
              create: {
                id: personData.id,
                displayName: personData.displayName,
                uniqueName: personData.uniqueName,
                url: personData.url || null,
                imageUrl: personData.imageUrl || null,
                descriptor: personData.descriptor || null,
                inactive: personData.inactive ?? false,
              },
            }),
          ),
        )

        this.logger.debug(
          `👥 Person batch ${batchNumber}/${totalBatches} complete`,
        )
      } catch (error) {
        this.logger.error(
          `Failed to sync person batch ${batchNumber}/${totalBatches}:`,
          { error: error instanceof Error ? error.message : String(error) },
        )
        // Continue with other batches rather than failing entire sync
      }
    }

    const batchDuration = Date.now() - batchStartTime
    this.logger.debug(
      `✅ Person batch upsert complete: ${personsData.length} persons (${batchDuration}ms)`,
    )
  }

  async close(): Promise<void> {
    try {
      await this.prisma.$disconnect()
    } catch (error) {
      this.logger.error('Failed to disconnect from database:', { 
        error: error instanceof Error ? error.message : String(error) 
      })
      throw new Error(
        `Database disconnect failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }
}
