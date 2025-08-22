import { PrismaClient } from '@prisma/client'

import type { WorkItemData, WorkItemCommentData } from './azure-devops.js'

import { AzureDevOpsClient } from './azure-devops.js'

export class DatabaseService {
  private prisma: PrismaClient

  constructor() {
    this.prisma = new PrismaClient()
  }

  async syncWorkItems(workItems: WorkItemData[]): Promise<void> {
    const BATCH_SIZE = 100
    const totalBatches = Math.ceil(workItems.length / BATCH_SIZE)

    console.log(
      `💾 Starting database sync of ${workItems.length} work items in ${totalBatches} batches...`,
    )

    for (let i = 0; i < workItems.length; i += BATCH_SIZE) {
      const batch = workItems.slice(i, i + BATCH_SIZE)
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1
      const batchStartTime = Date.now()

      try {
        await this.prisma.$transaction(
          batch.map((item) => {
            const commonData = {
              title: item.title,
              state: item.state,
              type: item.type,
              assignedTo: item.assignedTo,
              lastUpdatedAt: item.lastUpdatedAt,
              azureUrl: AzureDevOpsClient.buildWorkItemUrl(item.id),
              lastSyncedAt: new Date(),
              description: item.description,

              // Sprint/Board Info
              iterationPath: item.iterationPath,
              areaPath: item.areaPath,
              boardColumn: item.boardColumn,
              boardColumnDone: item.boardColumnDone || false,

              // Priority/Tags
              priority: item.priority,
              severity: item.severity,
              tags: item.tags,

              // All the dates
              createdDate: item.createdDate,
              changedDate: item.changedDate,
              closedDate: item.closedDate,
              resolvedDate: item.resolvedDate,
              activatedDate: item.activatedDate,
              stateChangeDate: item.stateChangeDate,

              // People
              createdBy: item.createdBy,
              changedBy: item.changedBy,
              closedBy: item.closedBy,
              resolvedBy: item.resolvedBy,

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

              // Complete raw JSON backup
              rawJson: item.rawJson,
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

        const batchDuration = Date.now() - batchStartTime
        const processed = i + batch.length
        const percentComplete = Math.round((processed / workItems.length) * 100)
        console.log(
          `💾 Batch ${batchNumber}/${totalBatches} complete: ${processed}/${workItems.length} items (${percentComplete}%) - ${batchDuration}ms`,
        )
      } catch (error) {
        console.error(
          `Failed to sync batch ${batchNumber}/${totalBatches} (${batch.length} work items starting at index ${i}):`,
          error,
        )

        // Check if this is a transaction rollback scenario
        if (error instanceof Error && error.message.includes('SQLITE_BUSY')) {
          console.warn(`Database busy for batch ${batchNumber}, will retry...`)
        } else if (
          error instanceof Error &&
          error.message.includes('UNIQUE constraint failed')
        ) {
          console.warn(
            `Unique constraint violation in batch ${batchNumber}, skipping problematic items...`,
          )
        }

        throw new Error(
          `Batch sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        )
      }
    }

    console.log(
      `✅ Database sync complete: ${workItems.length} work items stored`,
    )
  }

  async getAllWorkItems() {
    try {
      return await this.prisma.workItem.findMany({
        orderBy: { lastUpdatedAt: 'desc' },
      })
    } catch (error) {
      console.error('Failed to retrieve work items:', error)
      throw new Error(
        `Database query failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  async getWorkItemsByState(state: string) {
    try {
      return await this.prisma.workItem.findMany({
        where: { state },
        orderBy: { lastUpdatedAt: 'desc' },
      })
    } catch (error) {
      console.error(`Failed to retrieve work items by state '${state}':`, error)
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
      console.error(`Failed to retrieve work items by type '${type}':`, error)
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
        orderBy: { lastUpdatedAt: 'desc' },
      })
    } catch (error) {
      console.error(
        `Failed to retrieve work items for users [${userEmails.join(', ')}]:`,
        error,
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
          assignedTo: {
            in: userEmails,
          },
        },
        orderBy: { lastUpdatedAt: 'desc' },
      })
    } catch (error) {
      console.error(
        `Failed to retrieve work items by state '${state}' for users [${userEmails.join(', ')}]:`,
        error,
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
          assignedTo: {
            in: userEmails,
          },
        },
        orderBy: { lastUpdatedAt: 'desc' },
      })
    } catch (error) {
      console.error(
        `Failed to retrieve work items by type '${type}' for users [${userEmails.join(', ')}]:`,
        error,
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
      console.error('Failed to retrieve last sync time:', error)
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
      console.log(
        `💬 Starting comment sync of ${comments.length} comments in ${totalBatches} batches...`,
      )
    }

    for (let i = 0; i < comments.length; i += BATCH_SIZE) {
      const batch = comments.slice(i, i + BATCH_SIZE)
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1

      try {
        await this.prisma.$transaction(
          batch.map((comment) => {
            return this.prisma.workItemComment.upsert({
              where: { id: parseInt(comment.id, 10) },
              update: {
                text: comment.text,
                createdBy: comment.createdBy,
                createdDate: comment.createdDate,
                modifiedBy: comment.modifiedBy,
                modifiedDate: comment.modifiedDate,
              },
              create: {
                id: parseInt(comment.id, 10),
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

        if (comments.length > 10 && totalBatches > 1) {
          const processed = i + batch.length
          const percentComplete = Math.round(
            (processed / comments.length) * 100,
          )
          console.log(
            `💬 Comment batch ${batchNumber}/${totalBatches}: ${processed}/${comments.length} (${percentComplete}%)`,
          )
        }
      } catch (error) {
        console.error(
          `Failed to sync comment batch ${batchNumber}/${totalBatches} (${batch.length} comments starting at index ${i}):`,
          error,
        )

        // Check if this is a transaction rollback scenario
        if (error instanceof Error && error.message.includes('SQLITE_BUSY')) {
          console.warn(
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
      console.log(
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
      console.error(
        `Failed to retrieve comments for work item ${workItemId}:`,
        error,
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
      console.error(
        `Failed to retrieve recent comments (limit: ${limit}):`,
        error,
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
    if (commentCount === 0) {
      return false
    }

    if (!lastSyncTime || !changedDate) {
      return true
    }

    return changedDate > lastSyncTime
  }

  async close(): Promise<void> {
    try {
      await this.prisma.$disconnect()
    } catch (error) {
      console.error('Failed to disconnect from database:', error)
      throw new Error(
        `Database disconnect failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }
}
