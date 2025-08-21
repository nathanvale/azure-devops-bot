import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EnhancedQueryEngine, QueryFilter } from '../enhanced-query-engine.js';
import { DatabaseService } from '../database.js';

// Mock the DatabaseService
vi.mock('../database.js');

describe('EnhancedQueryEngine', () => {
  let enhancedEngine: EnhancedQueryEngine;
  let mockDb: any;

  // Test data helper
  const createTestWorkItem = (overrides = {}) => ({
    id: Math.floor(Math.random() * 10000),
    title: 'Test Work Item',
    state: 'Active',
    type: 'User Story',
    assignedTo: 'Test User',
    azureUrl: 'https://dev.azure.com/test',
    description: 'Test description',
    createdDate: new Date('2023-01-01'),
    closedDate: null,
    resolvedDate: null,
    lastUpdatedAt: new Date('2023-01-01'),
    lastSyncedAt: new Date(),
    ...overrides
  });

  beforeEach(() => {
    mockDb = {
      getAllWorkItems: vi.fn()
    };
    enhancedEngine = new EnhancedQueryEngine(mockDb as DatabaseService);
  });

  describe('Query Parsing', () => {
    describe('Type Filtering', () => {
      it('should parse bug queries', async () => {
        const bugItem = createTestWorkItem({ 
          type: 'Bug', 
          title: 'Authentication bug in login' 
        });
        const storyItem = createTestWorkItem({ type: 'User Story' });
        mockDb.getAllWorkItems.mockResolvedValue([bugItem, storyItem]);

        const result = await enhancedEngine.processQuery('bugs containing authentication');
        
        expect(result).toContain('Found 1 work item');
        expect(result).toContain('Authentication bug in login');
        expect(result).not.toContain('User Story');
      });

      it('should parse story queries', async () => {
        const storyItem = createTestWorkItem({ 
          type: 'User Story',
          title: 'User login story'
        });
        const bugItem = createTestWorkItem({ type: 'Bug' });
        mockDb.getAllWorkItems.mockResolvedValue([storyItem, bugItem]);

        const result = await enhancedEngine.processQuery('stories with login');
        
        expect(result).toContain('Found 1 work item');
        expect(result).toContain('User login story');
        expect(result).not.toContain('Bug');
      });

      it('should parse task queries', async () => {
        const taskItem = createTestWorkItem({ 
          type: 'Task',
          title: 'Setup database migration'
        });
        const bugItem = createTestWorkItem({ type: 'Bug' });
        mockDb.getAllWorkItems.mockResolvedValue([taskItem, bugItem]);

        const result = await enhancedEngine.processQuery('tasks about database');
        
        expect(result).toContain('Found 1 work item');
        expect(result).toContain('Setup database migration');
      });
    });

    describe('State Filtering', () => {
      it('should parse completed work queries', async () => {
        const completedItem = createTestWorkItem({ 
          type: 'Bug',
          state: 'Closed',
          closedDate: new Date('2023-06-01'),
          title: 'Completed auth bug'
        });
        const activeItem = createTestWorkItem({ state: 'Active' });
        mockDb.getAllWorkItems.mockResolvedValue([completedItem, activeItem]);

        const result = await enhancedEngine.processQuery('bugs I completed');
        
        expect(result).toContain('Found 1 work item');
        expect(result).toContain('Completed auth bug');
      });

      it('should parse active work queries', async () => {
        const activeItem = createTestWorkItem({ 
          state: 'Active',
          title: 'Active development work'
        });
        const closedItem = createTestWorkItem({ state: 'Closed' });
        mockDb.getAllWorkItems.mockResolvedValue([activeItem, closedItem]);

        const result = await enhancedEngine.processQuery('current active work');
        
        expect(result).toContain('Found 1 work item');
        expect(result).toContain('Active development work');
      });
    });

    describe('Keyword Extraction', () => {
      it('should extract technical keywords', async () => {
        const authItem = createTestWorkItem({ 
          title: 'Fix authentication service',
          description: 'Update login authentication flow'
        });
        const unrelatedItem = createTestWorkItem({ 
          title: 'UI styling updates',
          description: 'Change button colors'
        });
        mockDb.getAllWorkItems.mockResolvedValue([authItem, unrelatedItem]);

        const result = await enhancedEngine.processQuery('work containing authentication');
        
        expect(result).toContain('Found 1 work item');
        expect(result).toContain('Fix authentication service');
        expect(result).not.toContain('UI styling updates');
      });

      it('should extract database keywords', async () => {
        const dbItem = createTestWorkItem({ 
          type: 'Task',
          title: 'Database migration script',
          description: 'Add new tables for user data'
        });
        const otherItem = createTestWorkItem({ 
          type: 'Task',
          title: 'Frontend component',
          description: 'React button component'
        });
        mockDb.getAllWorkItems.mockResolvedValue([dbItem, otherItem]);

        const result = await enhancedEngine.processQuery('tasks related to database');
        
        expect(result).toContain('Found 1 work item');
        expect(result).toContain('Database migration script');
      });

      it('should extract API keywords', async () => {
        const apiItem = createTestWorkItem({ 
          title: 'REST API endpoint',
          description: 'Create user management API'
        });
        const otherItem = createTestWorkItem({ 
          title: 'Documentation update'
        });
        mockDb.getAllWorkItems.mockResolvedValue([apiItem, otherItem]);

        const result = await enhancedEngine.processQuery('stories containing API');
        
        expect(result).toContain('Found 1 work item');
        expect(result).toContain('REST API endpoint');
      });
    });

    describe('Date Range Parsing', () => {
      it('should parse "last month" queries', async () => {
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        
        const recentItem = createTestWorkItem({ 
          type: 'Bug',
          closedDate: lastMonth,
          state: 'Closed',
          title: 'Recent closed item'
        });
        const oldItem = createTestWorkItem({ 
          type: 'Bug',
          closedDate: new Date('2022-01-01'),
          state: 'Closed',
          title: 'Old closed item'
        });
        mockDb.getAllWorkItems.mockResolvedValue([recentItem, oldItem]);

        const result = await enhancedEngine.processQuery('bugs I fixed last month');
        
        expect(result).toContain('Found 1 work item');
        expect(result).toContain('Recent closed item');
        expect(result).not.toContain('Old closed item');
      });

      it('should parse "this year" queries', async () => {
        const currentYear = new Date().getFullYear();
        const thisYearItem = createTestWorkItem({ 
          closedDate: new Date(`${currentYear}-06-01`),
          state: 'Closed',
          title: 'This year item'
        });
        const lastYearItem = createTestWorkItem({ 
          closedDate: new Date(`${currentYear - 1}-06-01`),
          state: 'Closed',
          title: 'Last year item'
        });
        mockDb.getAllWorkItems.mockResolvedValue([thisYearItem, lastYearItem]);

        const result = await enhancedEngine.processQuery('work I completed this year');
        
        expect(result).toContain('Found 1 work item');
        expect(result).toContain('This year item');
        expect(result).not.toContain('Last year item');
      });

      it('should parse specific year queries', async () => {
        const item2023 = createTestWorkItem({ 
          type: 'Bug',
          closedDate: new Date('2023-06-01'),
          state: 'Closed',
          title: '2023 work item'
        });
        const item2024 = createTestWorkItem({ 
          type: 'Bug',
          closedDate: new Date('2024-06-01'),
          state: 'Closed',
          title: '2024 work item'
        });
        mockDb.getAllWorkItems.mockResolvedValue([item2023, item2024]);

        const result = await enhancedEngine.processQuery('bugs I fixed in 2023');
        
        expect(result).toContain('Found 1 work item');
        expect(result).toContain('2023 work item');
        expect(result).not.toContain('2024 work item');
      });
    });

    describe('Historical vs Current Filtering', () => {
      it('should filter historical work', async () => {
        const historicalItem = createTestWorkItem({ 
          type: 'Bug',
          state: 'Closed',
          closedDate: new Date('2023-06-01'),
          title: 'Historical completed work'
        });
        const currentItem = createTestWorkItem({ 
          type: 'Bug',
          state: 'Active',
          title: 'Current active work'
        });
        mockDb.getAllWorkItems.mockResolvedValue([historicalItem, currentItem]);

        const result = await enhancedEngine.processQuery('bugs I fixed before');
        
        expect(result).toContain('Found 1 work item');
        expect(result).toContain('Historical completed work');
        expect(result).not.toContain('Current active work');
      });

      it('should filter current work', async () => {
        const historicalItem = createTestWorkItem({ 
          state: 'Closed',
          closedDate: new Date('2023-06-01'),
          title: 'Historical completed work'
        });
        const currentItem = createTestWorkItem({ 
          state: 'Active',
          title: 'Current active work'
        });
        mockDb.getAllWorkItems.mockResolvedValue([historicalItem, currentItem]);

        const result = await enhancedEngine.processQuery('current work I am working on');
        
        expect(result).toContain('Found 1 work item');
        expect(result).toContain('Current active work');
        expect(result).not.toContain('Historical completed work');
      });
    });
  });

  describe('Complex Query Combinations', () => {
    it('should handle type + keyword + state combinations', async () => {
      const matchingItem = createTestWorkItem({
        type: 'Bug',
        state: 'Closed',
        closedDate: new Date('2023-06-01'),
        title: 'Authentication login bug',
        description: 'Fix authentication issues in login flow'
      });
      const nonMatchingItems = [
        createTestWorkItem({ type: 'User Story', state: 'Closed', closedDate: new Date('2023-06-01'), title: 'Auth story' }),
        createTestWorkItem({ type: 'Bug', state: 'Active', title: 'Auth bug' }),
        createTestWorkItem({ type: 'Bug', state: 'Closed', closedDate: new Date('2023-06-01'), title: 'Database bug' })
      ];
      mockDb.getAllWorkItems.mockResolvedValue([matchingItem, ...nonMatchingItems]);

      const result = await enhancedEngine.processQuery('bugs containing authentication I completed');
      
      expect(result).toContain('Found 1 work item');
      expect(result).toContain('Authentication login bug');
    });

    it('should handle type + keyword + date combinations', async () => {
      const currentYear = new Date().getFullYear();
      const matchingItem = createTestWorkItem({
        type: 'User Story',
        title: 'API endpoint development',
        description: 'REST API for user management',
        closedDate: new Date(`${currentYear}-06-01`)
      });
      const nonMatchingItems = [
        createTestWorkItem({ 
          type: 'Bug', 
          title: 'API bug', 
          closedDate: new Date(`${currentYear}-06-01`) 
        }),
        createTestWorkItem({ 
          type: 'User Story', 
          title: 'Database story', 
          closedDate: new Date(`${currentYear}-06-01`) 
        }),
        createTestWorkItem({ 
          type: 'User Story', 
          title: 'API story', 
          closedDate: new Date(`${currentYear - 1}-06-01`) 
        })
      ];
      mockDb.getAllWorkItems.mockResolvedValue([matchingItem, ...nonMatchingItems]);

      const result = await enhancedEngine.processQuery('stories with API this year');
      
      expect(result).toContain('Found 1 work item');
      expect(result).toContain('API endpoint development');
    });

    it('should handle multiple keywords', async () => {
      const matchingItem = createTestWorkItem({
        title: 'Authentication API service',
        description: 'REST API for user authentication and authorization'
      });
      const partialMatchItems = [
        createTestWorkItem({ title: 'Authentication service', description: 'User auth only' }),
        createTestWorkItem({ title: 'API service', description: 'General API without auth' })
      ];
      mockDb.getAllWorkItems.mockResolvedValue([matchingItem, ...partialMatchItems]);

      const result = await enhancedEngine.processQuery('work containing authentication API');
      
      expect(result).toContain('Found 3 work items');
      expect(result).toContain('Authentication API service');
    });
  });

  describe('Result Formatting', () => {
    it('should show breakdown by type for multiple types', async () => {
      const bugItem = createTestWorkItem({ type: 'Bug', title: 'Auth bug' });
      const storyItem = createTestWorkItem({ type: 'User Story', title: 'Auth story' });
      const taskItem = createTestWorkItem({ type: 'Task', title: 'Auth task' });
      mockDb.getAllWorkItems.mockResolvedValue([bugItem, storyItem, taskItem]);

      const result = await enhancedEngine.processQuery('work containing authentication');
      
      expect(result).toContain('Found 3 work items');
      expect(result).toContain('📊 Breakdown:');
      expect(result).toContain('Bug: 1');
      expect(result).toContain('User Story: 1');
      expect(result).toContain('Task: 1');
    });

    it('should show description snippets for keyword matches', async () => {
      const item = createTestWorkItem({
        title: 'User service',
        description: 'This service handles authentication for user login and manages session tokens for secure access.'
      });
      mockDb.getAllWorkItems.mockResolvedValue([item]);

      const result = await enhancedEngine.processQuery('work containing authentication');
      
      expect(result).toContain('User service');
      expect(result).toContain('💬');
      expect(result).toContain('authentication');
    });

    it('should limit results to 15 items with overflow message', async () => {
      const items = Array.from({ length: 20 }, (_, i) => 
        createTestWorkItem({ 
          id: 1000 + i,
          title: `Authentication work ${i + 1}` 
        })
      );
      mockDb.getAllWorkItems.mockResolvedValue(items);

      const result = await enhancedEngine.processQuery('work containing authentication');
      
      expect(result).toContain('Found 20 work items');
      expect(result).toContain('... and 5 more results');
      expect(result).toContain('Try adding more specific keywords');
    });

    it('should show historical vs current indicators', async () => {
      const historicalItem = createTestWorkItem({ 
        state: 'Closed',
        closedDate: new Date('2023-06-01'),
        title: 'Historical auth work'
      });
      const currentItem = createTestWorkItem({ 
        state: 'Active',
        title: 'Current auth work'
      });
      mockDb.getAllWorkItems.mockResolvedValue([historicalItem, currentItem]);

      const result = await enhancedEngine.processQuery('work containing authentication');
      
      expect(result).toContain('📚'); // Historical indicator
      expect(result).toContain('🔄'); // Current indicator
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty database results', async () => {
      mockDb.getAllWorkItems.mockResolvedValue([]);

      const result = await enhancedEngine.processQuery('bugs containing authentication');
      
      expect(result).toContain('No work items found matching your criteria');
      expect(result).toContain('Try adjusting your search criteria');
    });

    it('should handle null database results', async () => {
      mockDb.getAllWorkItems.mockResolvedValue(null);

      const result = await enhancedEngine.processQuery('bugs containing authentication');
      
      expect(result).toContain('No work items found matching your criteria');
    });

    it('should handle items with missing fields', async () => {
      const itemWithMissingFields = {
        id: 1001,
        title: 'Minimal item',
        state: 'Active',
        type: 'Bug',
        assignedTo: 'Test User',
        azureUrl: 'https://test.com',
        lastUpdatedAt: new Date(),
        lastSyncedAt: new Date(),
        // Missing description, dates, etc.
      };
      mockDb.getAllWorkItems.mockResolvedValue([itemWithMissingFields]);

      const result = await enhancedEngine.processQuery('bugs containing authentication');
      
      expect(result).not.toThrow;
      expect(result).toContain('No work items found'); // Should not match without description
    });

    it('should handle malformed date queries gracefully', async () => {
      const item = createTestWorkItem({ title: 'Test item' });
      mockDb.getAllWorkItems.mockResolvedValue([item]);

      const result = await enhancedEngine.processQuery('work from invalid date format');
      
      expect(result).not.toThrow;
      expect(result).toContain('Found 1 work item'); // Should still find items
    });

    it('should handle very long search queries', async () => {
      const longQuery = 'bugs containing authentication and database and API and performance and security and testing and deployment and monitoring and logging and caching and optimization and refactoring and documentation';
      const item = createTestWorkItem({ 
        type: 'Bug',
        title: 'Complex item',
        description: 'Has authentication, database, API, performance features'
      });
      mockDb.getAllWorkItems.mockResolvedValue([item]);

      const result = await enhancedEngine.processQuery(longQuery);
      
      expect(result).not.toThrow;
      expect(result).toContain('Found 1 work item');
    });
  });

  describe('Query Filter Object Creation', () => {
    it('should create correct filter for complex query', async () => {
      // We'll test this by checking the query parsing indirectly through results
      const bugItem = createTestWorkItem({
        type: 'Bug',
        state: 'Closed',
        title: 'Authentication bug',
        description: 'Fixed login authentication issue',
        closedDate: new Date('2023-06-01'),
      });
      
      const nonMatchingItem = createTestWorkItem({
        type: 'User Story',
        state: 'Active',
        title: 'UI component',
        description: 'Create button component',
        closedDate: null,
      });
      
      mockDb.getAllWorkItems.mockResolvedValue([bugItem, nonMatchingItem]);

      const result = await enhancedEngine.processQuery('bugs containing authentication I completed in 2023');
      
      expect(result).toContain('Found 1 work item');
      expect(result).toContain('Authentication bug');
      expect(result).not.toContain('UI component');
    });
  });
});