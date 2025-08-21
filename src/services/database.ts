import { PrismaClient } from '@prisma/client';
import { WorkItemData, AzureDevOpsClient } from './azure-devops.js';

export class DatabaseService {
  private prisma: PrismaClient;
  
  constructor() {
    this.prisma = new PrismaClient();
  }
  
  async syncWorkItems(workItems: WorkItemData[]): Promise<void> {
    for (const item of workItems) {
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
        rawJson: item.rawJson
      };
      
      await this.prisma.workItem.upsert({
        where: { id: item.id },
        update: commonData,
        create: {
          id: item.id,
          ...commonData
        }
      });
    }
  }
  
  async getAllWorkItems() {
    return await this.prisma.workItem.findMany({
      orderBy: { lastUpdatedAt: 'desc' }
    });
  }
  
  async getWorkItemsByState(state: string) {
    return await this.prisma.workItem.findMany({
      where: { state },
      orderBy: { lastUpdatedAt: 'desc' }
    });
  }
  
  async getWorkItemsByType(type: string) {
    return await this.prisma.workItem.findMany({
      where: { type },
      orderBy: { lastUpdatedAt: 'desc' }
    });
  }

  async getWorkItemsForUsers(userEmails: string[]) {
    if (!userEmails || userEmails.length === 0) {
      return await this.getAllWorkItems();
    }

    return await this.prisma.workItem.findMany({
      where: {
        OR: [
          {
            assignedTo: {
              in: userEmails
            },
            state: {
              notIn: ['Closed', 'Resolved', 'Done', 'Completed']
            }
          },
          {
            assignedTo: {
              in: userEmails
            },
            state: {
              in: ['Closed', 'Resolved', 'Done', 'Completed']
            }
          }
        ]
      },
      orderBy: { lastUpdatedAt: 'desc' }
    });
  }

  async getWorkItemsByStateForUsers(state: string, userEmails: string[]) {
    if (!userEmails || userEmails.length === 0) {
      return await this.getWorkItemsByState(state);
    }

    return await this.prisma.workItem.findMany({
      where: { 
        state,
        assignedTo: {
          in: userEmails
        }
      },
      orderBy: { lastUpdatedAt: 'desc' }
    });
  }
  
  async getWorkItemsByTypeForUsers(type: string, userEmails: string[]) {
    if (!userEmails || userEmails.length === 0) {
      return await this.getWorkItemsByType(type);
    }

    return await this.prisma.workItem.findMany({
      where: { 
        type,
        assignedTo: {
          in: userEmails
        }
      },
      orderBy: { lastUpdatedAt: 'desc' }
    });
  }
  
  async getLastSyncTime(): Promise<Date | null> {
    const lastItem = await this.prisma.workItem.findFirst({
      orderBy: { lastSyncedAt: 'desc' },
      select: { lastSyncedAt: true }
    });
    return lastItem?.lastSyncedAt || null;
  }
  
  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }
}