import { DatabaseService } from './database.js';
import { EnhancedQueryEngine } from './enhanced-query-engine.js';

export class QueryEngine {
  private db: DatabaseService;
  private enhancedEngine: EnhancedQueryEngine;
  
  constructor(db: DatabaseService) {
    this.db = db;
    this.enhancedEngine = new EnhancedQueryEngine(db);
  }
  
  async processQuery(query: string, userEmails?: string[]): Promise<string> {
    // Try enhanced query processing first
    const enhancedResult = await this.tryEnhancedQuery(query, userEmails);
    if (enhancedResult) {
      return enhancedResult;
    }

    // Fall back to legacy simple queries for backwards compatibility
    return this.processLegacyQuery(query, userEmails);
  }

  private async tryEnhancedQuery(query: string, userEmails?: string[]): Promise<string | null> {
    const normalizedQuery = query.toLowerCase().trim();
    
    // Use enhanced engine for complex queries
    if (this.isComplexQuery(normalizedQuery)) {
      return await this.enhancedEngine.processQuery(query, userEmails);
    }
    
    return null;
  }

  private isComplexQuery(query: string): boolean {
    const normalizedQuery = query.trim().toLowerCase();
    
    // Check for simple legacy patterns FIRST to override enhanced indicators
    const simpleLegacyQueries = [
      // Exact matches
      'bugs', 'bug', 'tasks', 'task', 'stories', 'story', 'user stories', 'user story',
      'today', 'working', 'current', 'open', 'active', 'closed', 'completed', 'done',
      'historical', 'history', 'past', 'old', 'previous', 'backlog', 'summary', 'all',
      
      // Common variations
      'show me bugs', 'show me tasks', 'show me stories', 'show me user stories',
      'show me open work items', 'show me open work', 'show me active items',
      'show me all work items', 'show me my backlog', 'give me a summary',
      'what am i working on', 'what am i working on today', 'what stories do i have',
      'show me active work items', 'show me open items'
    ];

    if (simpleLegacyQueries.includes(normalizedQuery)) {
      return false;
    }

    // Enhanced query indicators - only check after ruling out simple legacy patterns
    const enhancedIndicators = [
      // Content search with specific patterns
      'containing', 'related to', 'mention', 'about authentication', 'about database',
      // Date ranges  
      'last month', 'last year', 'this year', 'in 202', 'since 202', 'from 202',
      // Complex combinations 
      'bugs containing', 'stories with', 'tasks about', 'work items with',
      // Past tense (completed work) - be specific
      'fixed', 'solved', 'finished',
      // Quoted searches
      '"'
    ];

    // Check for enhanced indicators
    if (enhancedIndicators.some(indicator => normalizedQuery.includes(indicator))) {
      return true;
    }

    return false;
  }

  private async processLegacyQuery(query: string, userEmails?: string[]): Promise<string> {
    const normalizedQuery = query.toLowerCase().trim();
    
    // Simple keyword matching
    if (this.matchesKeywords(normalizedQuery, ['today', 'working', 'current'])) {
      return this.getCurrentWork(userEmails);
    }
    
    if (this.matchesKeywords(normalizedQuery, ['open', 'active'])) {
      return this.getOpenWork(userEmails);
    }
    
    if (this.matchesKeywords(normalizedQuery, ['user story', 'stories'])) {
      return this.getUserStories(userEmails);
    }
    
    if (this.matchesKeywords(normalizedQuery, ['bug', 'bugs'])) {
      return this.getBugs(userEmails);
    }
    
    if (this.matchesKeywords(normalizedQuery, ['task', 'tasks'])) {
      return this.getTasks(userEmails);
    }
    
    if (this.matchesKeywords(normalizedQuery, ['closed', 'completed', 'done', 'finished'])) {
      return this.getClosedWork(userEmails);
    }
    
    if (this.matchesKeywords(normalizedQuery, ['historical', 'history', 'past', 'old', 'previous'])) {
      return this.getHistoricalWork(userEmails);
    }
    
    if (this.matchesKeywords(normalizedQuery, ['backlog', 'summary', 'all'])) {
      return this.getBacklogSummary(userEmails);
    }
    
    // Default: show all work items
    return this.getBacklogSummary(userEmails);
  }
  
  private matchesKeywords(query: string, keywords: string[]): boolean {
    return keywords.some(keyword => query.includes(keyword));
  }
  
  private async getCurrentWork(userEmails?: string[]): Promise<string> {
    const activeItems = await this.db.getWorkItemsByStateForUsers('Active', userEmails || []);
    const inProgressItems = await this.db.getWorkItemsByStateForUsers('In Progress', userEmails || []);
    const allCurrentItems = [...activeItems, ...inProgressItems];
    
    if (allCurrentItems.length === 0) {
      return "You don't have any active work items today.";
    }
    
    return this.formatWorkItems(allCurrentItems, "Here's what you're working on today:");
  }
  
  private async getOpenWork(userEmails?: string[]): Promise<string> {
    const newItems = await this.db.getWorkItemsByStateForUsers('New', userEmails || []);
    const activeItems = await this.db.getWorkItemsByStateForUsers('Active', userEmails || []);
    const inProgressItems = await this.db.getWorkItemsByStateForUsers('In Progress', userEmails || []);
    const allOpenItems = [...newItems, ...activeItems, ...inProgressItems];
    
    if (allOpenItems.length === 0) {
      return "You don't have any open work items.";
    }
    
    return this.formatWorkItems(allOpenItems, "Here are your open work items:");
  }
  
  private async getUserStories(userEmails?: string[]): Promise<string> {
    const userStories = await this.db.getWorkItemsByTypeForUsers('User Story', userEmails || []);
    
    if (userStories.length === 0) {
      return "You don't have any user stories assigned.";
    }
    
    return this.formatWorkItems(userStories, "Here are your user stories:");
  }
  
  private async getBugs(userEmails?: string[]): Promise<string> {
    const bugs = await this.db.getWorkItemsByTypeForUsers('Bug', userEmails || []);
    
    if (bugs.length === 0) {
      return "You don't have any bugs assigned.";
    }
    
    return this.formatWorkItems(bugs, "Here are your bugs:");
  }
  
  private async getTasks(userEmails?: string[]): Promise<string> {
    const tasks = await this.db.getWorkItemsByTypeForUsers('Task', userEmails || []);
    
    if (tasks.length === 0) {
      return "You don't have any tasks assigned.";
    }
    
    return this.formatWorkItems(tasks, "Here are your tasks:");
  }
  
  private async getClosedWork(userEmails?: string[]): Promise<string> {
    const closedItems = await this.db.getWorkItemsByStateForUsers('Closed', userEmails || []);
    
    if (closedItems.length === 0) {
      return "You don't have any closed work items.";
    }
    
    return this.formatWorkItems(closedItems, "Here are your completed work items:");
  }
  
  private async getHistoricalWork(userEmails?: string[]): Promise<string> {
    const allItems = userEmails && userEmails.length > 0 
      ? await this.db.getWorkItemsForUsers(userEmails)
      : await this.db.getAllWorkItems();
    const historicalItems = allItems.filter((item: any) => 
      ['Closed', 'Resolved', 'Done', 'Completed'].includes(item.state) &&
      (item.closedDate || item.resolvedDate)
    );
    
    if (historicalItems.length === 0) {
      return "No historical work items found. Complete some work items to see your history.";
    }
    
    const stats = {
      total: historicalItems.length,
      byType: historicalItems.reduce((acc: Record<string, number>, item: any) => {
        acc[item.type] = (acc[item.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byState: historicalItems.reduce((acc: Record<string, number>, item: any) => {
        acc[item.state] = (acc[item.state] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };
    
    let result = `📚 Historical Work Items (${stats.total} total)\n\n`;
    result += `📊 By Type:\n`;
    Object.entries(stats.byType).forEach(([type, count]) => {
      result += `  • ${type}: ${count}\n`;
    });
    result += `\n📊 By State:\n`;
    Object.entries(stats.byState).forEach(([state, count]) => {
      result += `  • ${state}: ${count}\n`;
    });
    result += `\n🔍 Recent Historical Items:\n\n`;
    
    // Show most recent 10 historical items
    const recentItems = historicalItems
      .sort((a: any, b: any) => new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime())
      .slice(0, 10);
    
    recentItems.forEach((item: any) => {
      result += `• [${item.id}] ${item.title} - ${item.state}\n`;
      if (item.description) {
        result += `  📝 ${item.description.substring(0, 100)}${item.description.length > 100 ? '...' : ''}\n`;
      }
      result += `  ${item.azureUrl}\n\n`;
    });
    
    return result.trim();
  }

  private async getBacklogSummary(userEmails?: string[]): Promise<string> {
    const allItems = userEmails && userEmails.length > 0 
      ? await this.db.getWorkItemsForUsers(userEmails)
      : await this.db.getAllWorkItems();
    
    if (allItems.length === 0) {
      return "Your backlog is empty.";
    }
    
    return this.formatWorkItems(allItems, "Here's your backlog summary:");
  }
  
  private formatWorkItems(items: any[], title: string): string {
    let result = `${title}\n\n`;
    
    items.forEach(item => {
      result += `• [${item.id}] ${item.title} - ${item.state}\n`;
      result += `  ${item.azureUrl}\n\n`;
    });
    
    return result.trim();
  }
}