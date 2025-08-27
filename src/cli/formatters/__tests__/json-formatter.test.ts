import { describe, it, expect } from 'vitest';
import { JSONFormatter } from '../json-formatter.js';

describe('JSONFormatter', () => {
  const mockWorkItems = [
    {
      id: 1,
      title: 'Test Work Item 1',
      state: 'Active',
      assignedTo: 'user1@company.com',
      workItemType: 'User Story',
      createdDate: '2025-08-01T10:00:00Z',
      changedDate: '2025-08-26T15:30:00Z',
      description: 'This is a test work item description',
      tags: ['urgent', 'frontend']
    },
    {
      id: 2,
      title: 'Test Work Item 2',
      state: 'Closed',
      assignedTo: null,
      workItemType: 'Bug',
      createdDate: '2025-08-15T14:20:00Z',
      changedDate: '2025-08-25T09:15:00Z',
      description: '',
      tags: []
    }
  ];

  const mockSyncSummary = {
    totalItems: 156,
    totalComments: 23,
    successRate: 100,
    durationMs: 8432,
    syncStartTime: '2025-08-27T10:00:00Z',
    syncEndTime: '2025-08-27T10:08:32Z',
    errors: []
  };

  describe('formatWorkItems', () => {
    it('should produce valid JSON output', () => {
      const formatted = JSONFormatter.formatWorkItems(mockWorkItems);
      expect(() => JSON.parse(formatted)).not.toThrow();
    });

    it('should include all required fields in JSON output', () => {
      const formatted = JSONFormatter.formatWorkItems(mockWorkItems);
      const parsed = JSON.parse(formatted);
      
      expect(parsed.timestamp).toBeDefined();
      expect(parsed.count).toBe(2);
      expect(parsed.items).toHaveLength(2);
      expect(parsed.metadata).toBeNull();
    });

    it('should properly format work item data', () => {
      const formatted = JSONFormatter.formatWorkItems(mockWorkItems);
      const parsed = JSON.parse(formatted);
      
      const firstItem = parsed.items[0];
      expect(firstItem.id).toBe(1);
      expect(firstItem.title).toBe('Test Work Item 1');
      expect(firstItem.state).toBe('Active');
      expect(firstItem.assignedTo).toBe('user1@company.com');
      expect(firstItem.createdDate).toBe('2025-08-01T10:00:00Z');
      expect(firstItem.changedDate).toBe('2025-08-26T15:30:00Z');
      expect(firstItem.workItemType).toBe('User Story');
      expect(firstItem.description).toBe('This is a test work item description');
      expect(firstItem.tags).toEqual(['urgent', 'frontend']);
    });

    it('should handle null and empty values correctly', () => {
      const formatted = JSONFormatter.formatWorkItems(mockWorkItems);
      const parsed = JSON.parse(formatted);
      
      const secondItem = parsed.items[1];
      expect(secondItem.assignedTo).toBeNull();
      expect(secondItem.description).toBe('');
      expect(secondItem.tags).toEqual([]);
    });

    it('should include metadata when provided', () => {
      const metadata = {
        query: 'my work items',
        source: 'azure-devops-api',
        executionTime: '2025-08-27T10:00:00Z'
      };
      
      const formatted = JSONFormatter.formatWorkItems(mockWorkItems, metadata);
      const parsed = JSON.parse(formatted);
      
      expect(parsed.metadata).toEqual(metadata);
    });

    it('should handle empty work items array', () => {
      const formatted = JSONFormatter.formatWorkItems([]);
      const parsed = JSON.parse(formatted);
      
      expect(parsed.count).toBe(0);
      expect(parsed.items).toEqual([]);
      expect(parsed.timestamp).toBeDefined();
    });

    it('should handle large datasets efficiently', () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        title: `Work Item ${i + 1}`,
        state: ['New', 'Active', 'Resolved', 'Closed'][i % 4],
        assignedTo: i % 3 === 0 ? null : `user${i % 10}@company.com`,
        workItemType: ['User Story', 'Bug', 'Task'][i % 3],
        createdDate: '2025-08-01T10:00:00Z',
        changedDate: '2025-08-26T15:30:00Z',
        description: `Description for item ${i + 1}`,
        tags: i % 5 === 0 ? ['tag1', 'tag2'] : []
      }));

      const start = Date.now();
      const formatted = JSONFormatter.formatWorkItems(largeDataset);
      const elapsed = Date.now() - start;
      
      const parsed = JSON.parse(formatted);
      expect(parsed.count).toBe(1000);
      expect(parsed.items).toHaveLength(1000);
      expect(elapsed).toBeLessThan(200); // Should format quickly
    });

    it('should preserve special characters and unicode', () => {
      const specialCharItems = [{
        id: 1,
        title: 'Item with "quotes" and <tags> & émojis 🚀',
        state: 'Active',
        assignedTo: 'üser+tëst@cömpany.cø.uk',
        workItemType: 'Bug',
        createdDate: '2025-08-01T10:00:00Z',
        changedDate: '2025-08-26T15:30:00Z',
        description: 'Description with special chars: ñ, ü, €, 中文',
        tags: ['tëst', 'spëcial-chars']
      }];
      
      const formatted = JSONFormatter.formatWorkItems(specialCharItems);
      const parsed = JSON.parse(formatted);
      
      const item = parsed.items[0];
      expect(item.title).toBe('Item with "quotes" and <tags> & émojis 🚀');
      expect(item.assignedTo).toBe('üser+tëst@cömpany.cø.uk');
      expect(item.description).toBe('Description with special chars: ñ, ü, €, 中文');
      expect(item.tags).toEqual(['tëst', 'spëcial-chars']);
    });

    it('should handle missing fields gracefully', () => {
      const incompleteItems = [
        { id: 1, title: 'Minimal Item' },
        { 
          id: 2, 
          title: 'Partial Item', 
          state: 'Active',
          workItemType: 'Bug'
        }
      ];
      
      const formatted = JSONFormatter.formatWorkItems(incompleteItems);
      const parsed = JSON.parse(formatted);
      
      expect(parsed.items[0].id).toBe(1);
      expect(parsed.items[0].title).toBe('Minimal Item');
      expect(parsed.items[0].state).toBeUndefined();
      expect(parsed.items[0].assignedTo).toBeUndefined();
      
      expect(parsed.items[1].state).toBe('Active');
      expect(parsed.items[1].workItemType).toBe('Bug');
    });

    it('should generate valid ISO timestamp', () => {
      const formatted = JSONFormatter.formatWorkItems(mockWorkItems);
      const parsed = JSON.parse(formatted);
      
      expect(parsed.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      
      // Should be a valid date
      const date = new Date(parsed.timestamp);
      expect(date.getTime()).not.toBeNaN();
    });
  });

  describe('formatSyncSummary', () => {
    it('should produce valid JSON output', () => {
      const formatted = JSONFormatter.formatSyncSummary(mockSyncSummary);
      expect(() => JSON.parse(formatted)).not.toThrow();
    });

    it('should include all sync summary data', () => {
      const formatted = JSONFormatter.formatSyncSummary(mockSyncSummary);
      const parsed = JSON.parse(formatted);
      
      expect(parsed.timestamp).toBeDefined();
      expect(parsed.type).toBe('sync_summary');
      expect(parsed.totalItems).toBe(156);
      expect(parsed.totalComments).toBe(23);
      expect(parsed.successRate).toBe(100);
      expect(parsed.durationMs).toBe(8432);
      expect(parsed.syncStartTime).toBe('2025-08-27T10:00:00Z');
      expect(parsed.syncEndTime).toBe('2025-08-27T10:08:32Z');
      expect(parsed.errors).toEqual([]);
    });

    it('should handle minimal sync summary', () => {
      const minimalSummary = {
        totalItems: 42
      };
      
      const formatted = JSONFormatter.formatSyncSummary(minimalSummary);
      const parsed = JSON.parse(formatted);
      
      expect(parsed.type).toBe('sync_summary');
      expect(parsed.totalItems).toBe(42);
      expect(parsed.timestamp).toBeDefined();
    });

    it('should include error information when present', () => {
      const summaryWithErrors = {
        totalItems: 100,
        totalComments: 10,
        successRate: 95,
        errors: [
          'Failed to sync work item 45',
          'Rate limit exceeded for comments'
        ]
      };
      
      const formatted = JSONFormatter.formatSyncSummary(summaryWithErrors);
      const parsed = JSON.parse(formatted);
      
      expect(parsed.errors).toEqual([
        'Failed to sync work item 45',
        'Rate limit exceeded for comments'
      ]);
      expect(parsed.successRate).toBe(95);
    });

    it('should preserve all custom fields', () => {
      const customSummary = {
        totalItems: 50,
        customField: 'custom value',
        nestedObject: {
          key: 'value',
          number: 42
        },
        arrayField: ['item1', 'item2']
      };
      
      const formatted = JSONFormatter.formatSyncSummary(customSummary);
      const parsed = JSON.parse(formatted);
      
      expect(parsed.customField).toBe('custom value');
      expect(parsed.nestedObject).toEqual({ key: 'value', number: 42 });
      expect(parsed.arrayField).toEqual(['item1', 'item2']);
    });

    it('should handle zero and negative values', () => {
      const zeroSummary = {
        totalItems: 0,
        totalComments: 0,
        successRate: 0,
        durationMs: -1 // Edge case
      };
      
      const formatted = JSONFormatter.formatSyncSummary(zeroSummary);
      const parsed = JSON.parse(formatted);
      
      expect(parsed.totalItems).toBe(0);
      expect(parsed.totalComments).toBe(0);
      expect(parsed.successRate).toBe(0);
      expect(parsed.durationMs).toBe(-1);
    });

    it('should generate consistent timestamps', () => {
      const formatted1 = JSONFormatter.formatSyncSummary(mockSyncSummary);
      const formatted2 = JSONFormatter.formatSyncSummary(mockSyncSummary);
      
      const parsed1 = JSON.parse(formatted1);
      const parsed2 = JSON.parse(formatted2);
      
      // Timestamps should be close but potentially different
      const time1 = new Date(parsed1.timestamp).getTime();
      const time2 = new Date(parsed2.timestamp).getTime();
      expect(Math.abs(time1 - time2)).toBeLessThan(1000); // Within 1 second
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle null and undefined inputs', () => {
      const nullFormatted = JSONFormatter.formatWorkItems(null as any);
      const nullParsed = JSON.parse(nullFormatted);
      expect(nullParsed.items).toEqual([]);
      expect(nullParsed.count).toBe(0);

      const undefinedFormatted = JSONFormatter.formatWorkItems(undefined as any);
      const undefinedParsed = JSON.parse(undefinedFormatted);
      expect(undefinedParsed.items).toEqual([]);
      expect(undefinedParsed.count).toBe(0);
    });

    it('should handle circular references in metadata', () => {
      const circularMeta: any = { key: 'value' };
      circularMeta.self = circularMeta;
      
      // Should not throw when handling circular references
      expect(() => {
        JSONFormatter.formatWorkItems(mockWorkItems, circularMeta);
      }).toThrow(); // JSON.stringify will throw on circular references
    });

    it('should handle extremely large numbers', () => {
      const largeSummary = {
        totalItems: Number.MAX_SAFE_INTEGER,
        totalComments: Number.MAX_VALUE,
        successRate: 100.123456789,
        durationMs: 9999999999999
      };
      
      const formatted = JSONFormatter.formatSyncSummary(largeSummary);
      const parsed = JSON.parse(formatted);
      
      expect(parsed.totalItems).toBe(Number.MAX_SAFE_INTEGER);
      expect(parsed.totalComments).toBe(Number.MAX_VALUE);
      expect(parsed.successRate).toBe(100.123456789);
      expect(parsed.durationMs).toBe(9999999999999);
    });

    it('should maintain proper JSON formatting', () => {
      const formatted = JSONFormatter.formatWorkItems(mockWorkItems);
      
      // Should be properly indented JSON
      expect(formatted).toContain('{\n  ');
      expect(formatted).toContain('\n}');
      
      // Should be valid JSON that can be minified and re-parsed
      const parsed = JSON.parse(formatted);
      const minified = JSON.stringify(parsed);
      expect(() => JSON.parse(minified)).not.toThrow();
    });

    it('should handle boolean and numeric work item fields', () => {
      const mixedTypeItems = [{
        id: 1,
        title: 'Mixed Type Item',
        state: 'Active',
        isBlocked: true,
        storyPoints: 5.5,
        priority: 0,
        tags: null,
        customField: false
      }];
      
      const formatted = JSONFormatter.formatWorkItems(mixedTypeItems);
      const parsed = JSON.parse(formatted);
      
      const item = parsed.items[0];
      expect(item.isBlocked).toBe(true);
      expect(item.storyPoints).toBe(5.5);
      expect(item.priority).toBe(0);
      expect(item.tags).toBeNull();
      expect(item.customField).toBe(false);
    });

    it('should preserve array order', () => {
      const orderedItems = [
        { id: 3, title: 'Third' },
        { id: 1, title: 'First' },
        { id: 2, title: 'Second' }
      ];
      
      const formatted = JSONFormatter.formatWorkItems(orderedItems);
      const parsed = JSON.parse(formatted);
      
      expect(parsed.items[0].id).toBe(3);
      expect(parsed.items[1].id).toBe(1);
      expect(parsed.items[2].id).toBe(2);
    });
  });
});