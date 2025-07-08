import { DatabaseService } from './database.js';

export class QueryEngine {
  private db: DatabaseService;
  
  constructor(db: DatabaseService) {
    this.db = db;
  }
  
  async processQuery(query: string): Promise<string> {
    const normalizedQuery = query.toLowerCase().trim();
    
    // Simple keyword matching
    if (this.matchesKeywords(normalizedQuery, ['today', 'working', 'current'])) {
      return this.getCurrentWork();
    }
    
    if (this.matchesKeywords(normalizedQuery, ['open', 'active'])) {
      return this.getOpenWork();
    }
    
    if (this.matchesKeywords(normalizedQuery, ['user story', 'stories'])) {
      return this.getUserStories();
    }
    
    if (this.matchesKeywords(normalizedQuery, ['backlog', 'summary', 'all'])) {
      return this.getBacklogSummary();
    }
    
    // Default: show all work items
    return this.getBacklogSummary();
  }
  
  private matchesKeywords(query: string, keywords: string[]): boolean {
    return keywords.some(keyword => query.includes(keyword));
  }
  
  private async getCurrentWork(): Promise<string> {
    const activeItems = await this.db.getWorkItemsByState('Active');
    const inProgressItems = await this.db.getWorkItemsByState('In Progress');
    const allCurrentItems = [...activeItems, ...inProgressItems];
    
    if (allCurrentItems.length === 0) {
      return "You don't have any active work items today.";
    }
    
    return this.formatWorkItems(allCurrentItems, "Here's what you're working on today:");
  }
  
  private async getOpenWork(): Promise<string> {
    const newItems = await this.db.getWorkItemsByState('New');
    const activeItems = await this.db.getWorkItemsByState('Active');
    const inProgressItems = await this.db.getWorkItemsByState('In Progress');
    const allOpenItems = [...newItems, ...activeItems, ...inProgressItems];
    
    if (allOpenItems.length === 0) {
      return "You don't have any open work items.";
    }
    
    return this.formatWorkItems(allOpenItems, "Here are your open work items:");
  }
  
  private async getUserStories(): Promise<string> {
    const userStories = await this.db.getWorkItemsByType('User Story');
    
    if (userStories.length === 0) {
      return "You don't have any user stories assigned.";
    }
    
    return this.formatWorkItems(userStories, "Here are your user stories:");
  }
  
  private async getBacklogSummary(): Promise<string> {
    const allItems = await this.db.getAllWorkItems();
    
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