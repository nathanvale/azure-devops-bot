import { DatabaseService } from './database.js';

export interface QueryFilter {
  types?: string[];           // ['Bug', 'User Story', 'Task']
  states?: string[];          // ['Closed', 'Resolved', 'Active']
  keywords?: string[];        // ['authentication', 'database', 'API']
  dateRange?: {
    start?: Date;
    end?: Date;
    field?: 'createdDate' | 'closedDate' | 'lastUpdatedAt';
  };
  isHistorical?: boolean;     // true = completed work, false = current work
  completedBy?: 'me' | 'anyone';  // filter by who completed it
}

export interface QueryResult {
  items: any[];
  totalCount: number;
  summary: string;
  filters: QueryFilter;
}

export class EnhancedQueryEngine {
  private db: DatabaseService;
  
  constructor(db: DatabaseService) {
    this.db = db;
  }

  async processQuery(query: string, userEmails?: string[]): Promise<string> {
    // Parse the natural language query into structured filters
    const filters = this.parseQuery(query);
    
    // Execute the filtered search
    const result = await this.executeQuery(filters, userEmails);
    
    // Format the results for display
    return this.formatResults(result);
  }

  private parseQuery(query: string): QueryFilter {
    const normalizedQuery = query.toLowerCase().trim();
    const filters: QueryFilter = {};

    // Parse work item types
    if (this.containsAny(normalizedQuery, ['bug', 'bugs'])) {
      filters.types = ['Bug'];
    } else if (this.containsAny(normalizedQuery, ['story', 'stories', 'user story'])) {
      filters.types = ['User Story', 'Product Backlog Item'];
    } else if (this.containsAny(normalizedQuery, ['task', 'tasks'])) {
      filters.types = ['Task'];
    }

    // Parse states
    if (this.containsAny(normalizedQuery, ['completed', 'closed', 'finished', 'done', 'resolved'])) {
      filters.states = ['Closed', 'Resolved', 'Done', 'Completed'];
      filters.completedBy = 'me';
    } else if (this.containsAny(normalizedQuery, ['active', 'working', 'current', 'open'])) {
      filters.states = ['Active', 'In Progress', 'New'];
    }

    // Parse historical vs current
    if (this.containsAny(normalizedQuery, ['historical', 'history', 'past', 'previous', 'before', 'completed', 'fixed', 'solved'])) {
      filters.isHistorical = true;
    } else if (this.containsAny(normalizedQuery, ['current', 'today', 'now', 'working on'])) {
      filters.isHistorical = false;
    }

    // Parse content keywords
    const keywords = this.extractKeywords(normalizedQuery);
    if (keywords.length > 0) {
      filters.keywords = keywords;
    }

    // Parse date ranges
    const dateRange = this.parseDateRange(normalizedQuery);
    if (dateRange) {
      filters.dateRange = dateRange;
    }

    return filters;
  }

  private containsAny(text: string, keywords: string[]): boolean {
    return keywords.some(keyword => text.includes(keyword));
  }

  private extractKeywords(query: string): string[] {
    // Common technical keywords that are likely to be meaningful search terms
    const technicalKeywords = [
      'authentication', 'auth', 'login', 'password', 'security',
      'database', 'db', 'sql', 'query', 'migration',
      'api', 'rest', 'endpoint', 'service', 'microservice',
      'frontend', 'backend', 'ui', 'interface', 'component',
      'performance', 'optimization', 'cache', 'caching',
      'test', 'testing', 'unit test', 'integration',
      'deployment', 'ci/cd', 'pipeline', 'build',
      'docker', 'kubernetes', 'cloud', 'aws', 'azure',
      'react', 'angular', 'vue', 'javascript', 'typescript',
      'python', 'java', 'c#', 'node', 'express'
    ];

    const keywords: string[] = [];
    
    // Extract quoted phrases
    const quotedMatches = query.match(/"([^"]+)"/g);
    if (quotedMatches) {
      keywords.push(...quotedMatches.map(match => match.slice(1, -1)));
    }

    // Extract technical keywords
    technicalKeywords.forEach(keyword => {
      if (query.includes(keyword)) {
        keywords.push(keyword);
      }
    });

    // Extract words that look like technical terms (camelCase, kebab-case, etc.)
    const technicalWords = query.match(/\b[a-z]+[A-Z][a-zA-Z]*\b|\b[a-z]+-[a-z]+\b/g);
    if (technicalWords) {
      keywords.push(...technicalWords);
    }

    return [...new Set(keywords)]; // Remove duplicates
  }

  private parseDateRange(query: string): QueryFilter['dateRange'] | null {
    const now = new Date();
    
    // Last month/last X months
    if (query.includes('last month')) {
      const start = new Date(now);
      start.setMonth(start.getMonth() - 1);
      return { start, field: 'closedDate' };
    }
    
    const lastMonthsMatch = query.match(/last (\d+) months?/);
    if (lastMonthsMatch) {
      const months = parseInt(lastMonthsMatch[1]);
      const start = new Date(now);
      start.setMonth(start.getMonth() - months);
      return { start, field: 'closedDate' };
    }

    const lastWeeksMatch = query.match(/last (\d+) weeks?/);
    if (lastWeeksMatch) {
      const weeks = parseInt(lastWeeksMatch[1]);
      const start = new Date(now);
      start.setDate(start.getDate() - (weeks * 7));
      return { start, field: 'closedDate' };
    }

    // This year, last year
    if (query.includes('this year')) {
      const start = new Date(now.getFullYear(), 0, 1);
      return { start, field: 'closedDate' };
    }

    if (query.includes('last year')) {
      const start = new Date(now.getFullYear() - 1, 0, 1);
      const end = new Date(now.getFullYear() - 1, 11, 31);
      return { start, end, field: 'closedDate' };
    }

    // Specific year
    const yearMatch = query.match(/\b(20\d{2})\b/);
    if (yearMatch) {
      const year = parseInt(yearMatch[1]);
      const start = new Date(year, 0, 1);
      const end = new Date(year, 11, 31);
      return { start, end, field: 'closedDate' };
    }

    return null;
  }

  private async executeQuery(filters: QueryFilter, userEmails?: string[]): Promise<QueryResult> {
    // Get work items based on user filter
    let items = userEmails && userEmails.length > 0 
      ? await this.db.getWorkItemsForUsers(userEmails)
      : await this.db.getAllWorkItems();
    
    // Ensure items is an array
    if (!Array.isArray(items)) {
      items = [];
    }

    // Apply filters
    if (filters.types && filters.types.length > 0) {
      items = items.filter(item => filters.types!.includes(item.type));
    }

    if (filters.states && filters.states.length > 0) {
      items = items.filter(item => filters.states!.includes(item.state));
    }

    if (filters.isHistorical !== undefined) {
      if (filters.isHistorical) {
        // Historical work: items that are completed (closed/resolved) and have completion data
        items = items.filter(item => 
          ['Closed', 'Resolved', 'Done', 'Completed'].includes(item.state) &&
          (item.closedDate || item.resolvedDate)
        );
      } else {
        // Current work: items that are active/assigned to me
        items = items.filter(item => 
          !['Closed', 'Resolved', 'Done', 'Completed'].includes(item.state)
        );
      }
    }

    if (filters.keywords && filters.keywords.length > 0) {
      items = items.filter(item => {
        const searchText = `${item.title} ${item.description || ''}`.toLowerCase();
        return filters.keywords!.some(keyword => 
          searchText.includes(keyword.toLowerCase())
        );
      });
    }

    if (filters.dateRange) {
      items = items.filter(item => {
        const dateField = filters.dateRange!.field || 'closedDate';
        const itemDate = item[dateField];
        if (!itemDate) return false;
        
        const date = new Date(itemDate);
        const { start, end } = filters.dateRange!;
        
        if (start && date < start) return false;
        if (end && date > end) return false;
        
        return true;
      });
    }

    // Sort by most recent first
    items.sort((a, b) => {
      const dateA = new Date(a.lastUpdatedAt || a.closedDate || 0);
      const dateB = new Date(b.lastUpdatedAt || b.closedDate || 0);
      return dateB.getTime() - dateA.getTime();
    });

    return {
      items,
      totalCount: items.length,
      summary: this.generateSummary(items, filters),
      filters
    };
  }

  private generateSummary(items: any[], filters: QueryFilter): string {
    if (items.length === 0) {
      return "No work items found matching your criteria.";
    }

    let summary = `Found ${items.length} work item${items.length !== 1 ? 's' : ''}`;
    
    if (filters.keywords && filters.keywords.length > 0) {
      summary += ` containing "${filters.keywords.join('", "')}"`;
    }
    
    if (filters.types && filters.types.length > 0) {
      summary += ` (${filters.types.join(', ')})`;
    }

    if (filters.dateRange) {
      if (filters.dateRange.start && !filters.dateRange.end) {
        summary += ` since ${filters.dateRange.start.toLocaleDateString()}`;
      } else if (filters.dateRange.start && filters.dateRange.end) {
        summary += ` from ${filters.dateRange.start.toLocaleDateString()} to ${filters.dateRange.end.toLocaleDateString()}`;
      }
    }

    return summary;
  }

  private formatResults(result: QueryResult): string {
    if (result.items.length === 0) {
      return result.summary + "\n\nTry adjusting your search criteria or check if you need to run the historical import first.";
    }

    let output = `${result.summary}\n\n`;

    // Show breakdown by type if multiple types found
    const typeCount = result.items.reduce((acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    if (Object.keys(typeCount).length > 1) {
      output += "📊 Breakdown:\n";
      Object.entries(typeCount).forEach(([type, count]) => {
        output += `  • ${type}: ${count}\n`;
      });
      output += "\n";
    }

    // Show top results (limit to 15 to avoid overwhelming output)
    const displayItems = result.items.slice(0, 15);
    output += "🔍 Results:\n\n";

    displayItems.forEach((item, index) => {
      const number = index + 1;
      const isHistorical = (['Closed', 'Resolved', 'Done', 'Completed'].includes(item.state) && (item.closedDate || item.resolvedDate)) ? "📚" : "🔄";
      
      output += `${number}. ${isHistorical} [${item.id}] ${item.title}\n`;
      output += `   ${item.type} • ${item.state}`;
      
      if (item.closedDate) {
        output += ` • Closed ${new Date(item.closedDate).toLocaleDateString()}`;
      }
      
      output += `\n   ${item.azureUrl}\n`;
      
      // Show snippet of description if keywords match
      if (result.filters.keywords && item.description) {
        const snippet = this.getDescriptionSnippet(item.description, result.filters.keywords);
        if (snippet) {
          output += `   💬 ${snippet}\n`;
        }
      }
      
      output += "\n";
    });

    if (result.items.length > 15) {
      output += `... and ${result.items.length - 15} more results. Try adding more specific keywords to narrow your search.\n`;
    }

    return output.trim();
  }

  private getDescriptionSnippet(description: string, keywords: string[]): string | null {
    const lowerDescription = description.toLowerCase();
    
    for (const keyword of keywords) {
      const lowerKeyword = keyword.toLowerCase();
      const index = lowerDescription.indexOf(lowerKeyword);
      
      if (index !== -1) {
        // Extract context around the keyword
        const start = Math.max(0, index - 50);
        const end = Math.min(description.length, index + keyword.length + 50);
        let snippet = description.substring(start, end);
        
        if (start > 0) snippet = "..." + snippet;
        if (end < description.length) snippet = snippet + "...";
        
        return snippet;
      }
    }
    
    return null;
  }
}