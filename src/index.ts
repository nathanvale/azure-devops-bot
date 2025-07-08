#!/usr/bin/env node

import { SyncService } from './sync-service.js';
import { DatabaseService } from './database.js';
import { QueryEngine } from './query-engine.js';

class AzureDevOpsBot {
  private syncService: SyncService;
  private db: DatabaseService;
  private queryEngine: QueryEngine;
  
  constructor() {
    this.syncService = new SyncService();
    this.db = new DatabaseService();
    this.queryEngine = new QueryEngine(this.db);
  }
  
  async start(): Promise<void> {
    try {
      // Check if we need to sync
      const shouldSync = await this.syncService.shouldSync();
      if (shouldSync) {
        console.log('🔄 Syncing work items...');
        await this.syncService.performSync();
      }
      
      // Start background sync
      await this.syncService.startBackgroundSync();
      
      // Get query from command line args
      const query = process.argv.slice(2).join(' ') || 'summary';
      
      // Process query
      const response = await this.queryEngine.processQuery(query);
      console.log('\n' + response);
      
    } catch (error) {
      console.error('❌ Error:', error);
      process.exit(1);
    }
  }
  
  async stop(): Promise<void> {
    await this.syncService.close();
  }
}

// Handle graceful shutdown
const bot = new AzureDevOpsBot();

process.on('SIGINT', async () => {
  console.log('\n👋 Shutting down...');
  await bot.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n👋 Shutting down...');
  await bot.stop();
  process.exit(0);
});

// Start the bot
bot.start().catch(console.error);