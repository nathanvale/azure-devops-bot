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
  
  async startBackgroundSync(): Promise<void> {
    const SYNC_INTERVAL = 30 * 60 * 1000; // 30 minutes
    
    this.syncInterval = setInterval(async () => {
      try {
        await this.performSync();
      } catch (error) {
        console.error('Background sync failed:', error);
      }
    }, SYNC_INTERVAL);
    
    console.log('🔄 Background sync started (every 30 minutes)');
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