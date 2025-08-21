import { AzureAuth } from './auth.js';
import { AzureDevOpsClient } from './azure-devops.js';
import { DatabaseService } from './database.js';

export class SyncService {
  private auth: AzureAuth;
  private client: AzureDevOpsClient;
  private db: DatabaseService;
  private syncInterval: NodeJS.Timeout | null = null;
  
  constructor() {
    this.auth = new AzureAuth();
    this.client = new AzureDevOpsClient();
    this.db = new DatabaseService();
  }
  
  async performSync(): Promise<void> {
    try {
      await this.auth.ensureAuth();
      const workItems = await this.client.fetchWorkItems();
      await this.db.syncWorkItems(workItems);
      console.log(`✅ Synced ${workItems.length} work items`);
    } catch (error) {
      console.error('❌ Sync failed:', error);
      throw error;
    }
  }

  async performSyncDetailed(concurrencyLimit: number = 5): Promise<void> {
    const startTime = Date.now();
    
    try {
      await this.auth.ensureAuth();
      
      // Step 1: Discover work item IDs using fast WIQL query
      const workItemIds = await this.client.fetchWorkItems();
      const idList = workItemIds.map((item: any) => item.id);
      
      console.log(`🔍 Discovered ${idList.length} work items for detailed sync`);
      
      // Step 2: Fetch detailed data in parallel with controlled concurrency
      const detailedWorkItems = await this.client.fetchWorkItemsDetailed(idList, concurrencyLimit);
      
      // Step 3: Store all detailed work items
      await this.db.syncWorkItems(detailedWorkItems);
      
      // Step 4: Sync comments for work items that need it
      await this.syncCommentsForWorkItems(detailedWorkItems);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log(`✅ Synced ${detailedWorkItems.length} work items with detailed data`);
      console.log(`⏱️  Detailed sync completed in ${duration}ms`);
      console.log(`📊 Work items: ${idList.length} discovered, ${detailedWorkItems.length} detailed fetched with concurrency ${concurrencyLimit}`);
      
    } catch (error) {
      console.error('❌ Detailed sync failed:', error);
      throw error;
    }
  }

  private async syncCommentsForWorkItems(workItems: any[]): Promise<void> {
    const lastSyncTime = await this.db.getLastSyncTime();
    let checkedCount = 0;
    let syncedCount = 0;
    const startTime = Date.now();

    for (const workItem of workItems) {
      try {
        checkedCount++;
        
        // Check if this work item needs comment sync
        const needsSync = await this.db.needsCommentSync(
          workItem.id,
          workItem.commentCount || 0,
          workItem.changedDate,
          lastSyncTime
        );

        if (needsSync) {
          // Fetch and store comments for this work item
          const comments = await this.client.fetchWorkItemComments(workItem.id);
          await this.db.storeWorkItemComments(comments);
          syncedCount++;
        }
      } catch (error) {
        console.warn(`⚠️  Failed to sync comments for work item ${workItem.id}:`, error);
        // Continue with other work items even if one fails
      }
    }

    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`📝 Comment sync: ${checkedCount} work items checked, ${syncedCount} had comments synced in ${duration}ms`);
  }
  
  private getSyncInterval(): number {
    const envInterval = process.env.AZURE_DEVOPS_SYNC_INTERVAL_MINUTES;
    const defaultInterval = 5; // 5 minutes default
    
    if (envInterval) {
      const parsed = parseInt(envInterval, 10);
      if (isNaN(parsed) || parsed <= 0) {
        console.warn(`⚠️  Invalid AZURE_DEVOPS_SYNC_INTERVAL_MINUTES value: ${envInterval}. Using default ${defaultInterval} minutes.`);
        return defaultInterval * 60 * 1000;
      }
      return parsed * 60 * 1000;
    }
    
    return defaultInterval * 60 * 1000;
  }

  async startBackgroundSync(useDetailedSync: boolean = true): Promise<void> {
    const SYNC_INTERVAL = this.getSyncInterval();
    const intervalMinutes = SYNC_INTERVAL / (60 * 1000);
    
    this.syncInterval = setInterval(async () => {
      try {
        if (useDetailedSync) {
          await this.performSyncDetailed();
        } else {
          await this.performSync();
        }
      } catch (error) {
        console.error('Background sync failed:', error);
      }
    }, SYNC_INTERVAL);
    
    const syncType = useDetailedSync ? 'detailed sync' : 'sync';
    console.log(`🔄 Background ${syncType} started (every ${intervalMinutes} minutes)`);
  }
  
  stopBackgroundSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('⏹️  Background sync stopped');
    }
  }
  
  async shouldSync(): Promise<boolean> {
    const lastSync = await this.db.getLastSyncTime();
    if (!lastSync) return true;
    
    const now = new Date();
    const timeSinceSync = now.getTime() - lastSync.getTime();
    const fiveMinutes = 5 * 60 * 1000;
    
    return timeSinceSync > fiveMinutes;
  }
  
  async close(): Promise<void> {
    this.stopBackgroundSync();
    await this.db.close();
  }
}