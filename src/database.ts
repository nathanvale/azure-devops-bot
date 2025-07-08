import { PrismaClient } from '@prisma/client';
import { WorkItemData, AzureDevOpsClient } from './azure-devops.js';

export class DatabaseService {
  private prisma: PrismaClient;
  
  constructor() {
    this.prisma = new PrismaClient();
  }
  
  async syncWorkItems(workItems: WorkItemData[]): Promise<void> {
    for (const item of workItems) {
      await this.prisma.workItem.upsert({
        where: { id: item.id },
        update: {
          title: item.title,
          state: item.state,
          type: item.type,
          assignedTo: item.assignedTo,
          lastUpdatedAt: item.lastUpdatedAt,
          azureUrl: AzureDevOpsClient.buildWorkItemUrl(item.id),
          lastSyncedAt: new Date()
        },
        create: {
          id: item.id,
          title: item.title,
          state: item.state,
          type: item.type,
          assignedTo: item.assignedTo,
          lastUpdatedAt: item.lastUpdatedAt,
          azureUrl: AzureDevOpsClient.buildWorkItemUrl(item.id),
          lastSyncedAt: new Date()
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