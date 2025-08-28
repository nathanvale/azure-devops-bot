import { describe, it, expect } from 'vitest'

import { TextFormatter } from '../text-formatter.js'

describe('TextFormatter', () => {
  const mockWorkItems = [
    {
      id: 1,
      title: 'Test Work Item 1',
      state: 'Active',
      assignedTo: 'user1@company.com',
      workItemType: 'User Story',
      createdDate: '2025-08-01T10:00:00Z',
      changedDate: '2025-08-26T15:30:00Z',
      description:
        'This is a detailed description of the work item that explains what needs to be done.',
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
    },
    {
      id: 3,
      title: 'Test Work Item 3',
      state: 'New',
      assignedTo: 'another.user@company.com',
      workItemType: 'Task',
      createdDate: '2025-08-20T16:45:00Z',
      changedDate: '2025-08-26T11:22:00Z',
      description: 'Short desc',
    },
  ]

  const mockSyncSummary = {
    totalItems: 156,
    totalComments: 23,
    successRate: 100,
    durationMs: 8432,
    syncStartTime: '2025-08-27T10:00:00Z',
    syncEndTime: '2025-08-27T10:08:32Z',
  }

  describe('formatWorkItems', () => {
    it('should format work items with proper structure and colors', () => {
      const formatted = TextFormatter.formatWorkItems(mockWorkItems)

      expect(formatted).toContain('📋 Work Items')
      expect(formatted).toContain('(3 found)')
      expect(formatted).toContain('Test Work Item 1')
      expect(formatted).toContain('Test Work Item 2')
      expect(formatted).toContain('Test Work Item 3')
      expect(formatted).toContain('[Active]')
      expect(formatted).toContain('[Closed]')
      expect(formatted).toContain('[New]')
    })

    it('should handle empty work items array', () => {
      const formatted = TextFormatter.formatWorkItems([])
      expect(formatted).toContain('No work items found')
    })

    it('should display assigned users correctly', () => {
      const formatted = TextFormatter.formatWorkItems(mockWorkItems)
      expect(formatted).toContain('@user1@company.com')
      expect(formatted).toContain('unassigned')
      expect(formatted).toContain('@another.user@company.com')
    })

    it('should show descriptions when available', () => {
      const formatted = TextFormatter.formatWorkItems(mockWorkItems)
      expect(formatted).toContain(
        'This is a detailed description of the work item that explains what needs to be d...',
      )
      expect(formatted).toContain('Short desc')
    })

    it('should truncate long descriptions', () => {
      const longDescriptionItem = [
        {
          id: 999,
          title: 'Long Description Item',
          state: 'Active',
          assignedTo: 'user@company.com',
          description:
            'This is a very long description that exceeds the 80 character limit and should be truncated properly with ellipsis to indicate there is more content available than what is shown here.',
        },
      ]

      const formatted = TextFormatter.formatWorkItems(longDescriptionItem)
      expect(formatted).toContain(
        'This is a very long description that exceeds the 80 character limit and should b...',
      )
      expect(formatted).not.toContain('more content available')
    })

    it('should handle missing fields gracefully', () => {
      const incompleteItems = [
        { id: 1 }, // Missing title and state
        { title: 'No ID Item' }, // Missing ID
        { id: 2, title: 'Partial Item', state: null }, // Null state
      ]

      const formatted = TextFormatter.formatWorkItems(incompleteItems)
      expect(formatted).toContain('Work Item 1')
      expect(formatted).toContain('No ID Item')
      expect(formatted).toContain('Partial Item')
    })

    it('should number items correctly', () => {
      const formatted = TextFormatter.formatWorkItems(mockWorkItems)
      expect(formatted).toMatch(/1\.\s+Test Work Item 1/)
      expect(formatted).toMatch(/2\.\s+Test Work Item 2/)
      expect(formatted).toMatch(/3\.\s+Test Work Item 3/)
    })

    it('should format different work item states with appropriate colors', () => {
      const stateItems = [
        { id: 1, title: 'New Item', state: 'New' },
        { id: 2, title: 'Active Item', state: 'Active' },
        { id: 3, title: 'Resolved Item', state: 'Resolved' },
        { id: 4, title: 'Closed Item', state: 'Closed' },
        { id: 5, title: 'Removed Item', state: 'Removed' },
        { id: 6, title: 'Unknown Item', state: 'CustomState' },
      ]

      const formatted = TextFormatter.formatWorkItems(stateItems)
      expect(formatted).toContain('[New]')
      expect(formatted).toContain('[Active]')
      expect(formatted).toContain('[Resolved]')
      expect(formatted).toContain('[Closed]')
      expect(formatted).toContain('[Removed]')
      expect(formatted).toContain('[CustomState]')
    })

    it('should handle large datasets efficiently', () => {
      const largeDataset = Array.from({ length: 500 }, (_, i) => ({
        id: i + 1,
        title: `Work Item ${i + 1}`,
        state: ['New', 'Active', 'Resolved', 'Closed'][i % 4],
        assignedTo: i % 3 === 0 ? null : `user${i % 10}@company.com`,
      }))

      const start = Date.now()
      const formatted = TextFormatter.formatWorkItems(largeDataset)
      const elapsed = Date.now() - start

      expect(formatted).toContain('(500 found)')
      expect(formatted).toContain('Work Item 1')
      expect(formatted).toContain('Work Item 500')
      expect(elapsed).toBeLessThan(100) // Should format quickly
    })
  })

  describe('formatSyncSummary', () => {
    it('should format sync summary with duration and stats', () => {
      const formatted = TextFormatter.formatSyncSummary(mockSyncSummary)

      expect(formatted).toContain('✅ Sync Complete')
      expect(formatted).toContain('in 8432ms')
      expect(formatted).toContain('156 work items')
      expect(formatted).toContain('23 comments')
      expect(formatted).toContain('100% success rate')
    })

    it('should handle sync summary without duration', () => {
      const summaryWithoutDuration = {
        totalItems: 42,
        totalComments: 5,
        successRate: 95,
      }

      const formatted = TextFormatter.formatSyncSummary(summaryWithoutDuration)
      expect(formatted).toContain('✅ Sync Complete')
      expect(formatted).not.toContain('in ')
      expect(formatted).toContain('42 work items')
      expect(formatted).toContain('95% success rate')
    })

    it('should handle missing stats gracefully', () => {
      const incompleteSummary = {
        totalItems: 10,
      }

      const formatted = TextFormatter.formatSyncSummary(incompleteSummary)
      expect(formatted).toContain('10 work items')
      expect(formatted).toContain('0 comments')
      expect(formatted).toContain('100% success rate')
    })

    it('should format zero values correctly', () => {
      const zeroSummary = {
        totalItems: 0,
        totalComments: 0,
        successRate: 0,
        durationMs: 0,
      }

      const formatted = TextFormatter.formatSyncSummary(zeroSummary)
      expect(formatted).toContain('0 work items')
      expect(formatted).toContain('0 comments')
      expect(formatted).toContain('0% success rate')
      expect(formatted).toContain('in 0ms')
    })

    it('should include proper separators and formatting', () => {
      const formatted = TextFormatter.formatSyncSummary(mockSyncSummary)
      expect(formatted).toMatch(/\n.*✅ Sync Complete.*\n.*•.*•.*\n/)
    })
  })

  describe('edge cases and error handling', () => {
    it('should handle null and undefined input', () => {
      expect(TextFormatter.formatWorkItems(null as any)).toContain(
        'No work items found',
      )
      expect(TextFormatter.formatWorkItems(undefined as any)).toContain(
        'No work items found',
      )
    })

    it('should handle work items with special characters', () => {
      const specialCharItems = [
        {
          id: 1,
          title: 'Item with "quotes" and <tags> & symbols',
          state: 'Active',
          assignedTo: 'user+test@company.co.uk',
          description: 'Description with émojis 🚀 and ünïcødé',
        },
      ]

      const formatted = TextFormatter.formatWorkItems(specialCharItems)
      expect(formatted).toContain('Item with "quotes" and <tags> & symbols')
      expect(formatted).toContain('user+test@company.co.uk')
      expect(formatted).toContain('Description with émojis 🚀 and ünïcødé')
    })

    it('should handle extremely long titles', () => {
      const longTitleItem = [
        {
          id: 1,
          title:
            'This is an extremely long work item title that goes on and on and might cause formatting issues if not handled properly by the text formatter implementation',
          state: 'Active',
          assignedTo: 'user@company.com',
        },
      ]

      expect(() => {
        const formatted = TextFormatter.formatWorkItems(longTitleItem)
        expect(formatted).toContain('This is an extremely long work item title')
      }).not.toThrow()
    })

    it('should handle work items with no assignedTo field vs null assignedTo', () => {
      const mixedAssignmentItems = [
        { id: 1, title: 'No assignedTo field', state: 'Active' },
        {
          id: 2,
          title: 'Null assignedTo field',
          state: 'Active',
          assignedTo: null,
        },
        {
          id: 3,
          title: 'Empty string assignedTo',
          state: 'Active',
          assignedTo: '',
        },
        {
          id: 4,
          title: 'Valid assignedTo',
          state: 'Active',
          assignedTo: 'user@company.com',
        },
      ]

      const formatted = TextFormatter.formatWorkItems(mixedAssignmentItems)
      // Should show 'unassigned' for missing, null, and empty assignments
      expect((formatted.match(/unassigned/g) || []).length).toBe(3)
      expect(formatted).toContain('@user@company.com')
    })

    it('should maintain consistent spacing and formatting', () => {
      const formatted = TextFormatter.formatWorkItems(mockWorkItems)
      const lines = formatted.split('\n')

      // Should have consistent indentation
      const itemLines = lines.filter((line) => line.match(/^\s+\d+\./))
      expect(itemLines.length).toBe(3) // One for each work item

      // Should have consistent detail lines
      const detailLines = lines.filter((line) => line.match(/^\s{5,}/))
      expect(detailLines.length).toBeGreaterThan(0)
    })
  })
})
