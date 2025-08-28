import { describe, it, expect } from 'vitest'

import { MarkdownFormatter } from '../markdown-formatter.js'

describe('MarkdownFormatter', () => {
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
        'This is a comprehensive test work item that demonstrates various features and functionality requirements for the system.',
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
    it('should format work items as proper markdown', () => {
      const formatted = MarkdownFormatter.formatWorkItems(mockWorkItems)

      expect(formatted).toContain('# Azure DevOps Work Items Report')
      expect(formatted).toContain('## Summary')
      expect(formatted).toContain('Found **2** work items')
      expect(formatted).toContain('## Work Items')
    })

    it('should format individual work items with proper headers', () => {
      const formatted = MarkdownFormatter.formatWorkItems(mockWorkItems)

      expect(formatted).toContain('### 1. Test Work Item 1')
      expect(formatted).toContain('### 2. Test Work Item 2')
    })

    it('should include all work item metadata', () => {
      const formatted = MarkdownFormatter.formatWorkItems(mockWorkItems)

      expect(formatted).toContain('- **ID:** 1')
      expect(formatted).toContain('- **State:** Active')
      expect(formatted).toContain('- **Assigned To:** user1@company.com')
      expect(formatted).toContain('- **Type:** User Story')

      expect(formatted).toContain('- **ID:** 2')
      expect(formatted).toContain('- **State:** Closed')
      expect(formatted).toContain('- **Assigned To:** Unassigned')
      expect(formatted).toContain('- **Type:** Bug')
    })

    it('should include descriptions when available', () => {
      const formatted = MarkdownFormatter.formatWorkItems(mockWorkItems)

      expect(formatted).toContain('**Description:**')
      expect(formatted).toContain(
        'This is a comprehensive test work item that demonstrates',
      )
    })

    it('should not include empty descriptions', () => {
      const formatted = MarkdownFormatter.formatWorkItems(mockWorkItems)

      // Should have description for first item but not second
      const lines = formatted.split('\n')
      const firstItemLines = lines.slice(
        lines.findIndex((line) => line.includes('### 1. Test Work Item 1')),
        lines.findIndex((line) => line.includes('### 2. Test Work Item 2')),
      )
      const secondItemLines = lines.slice(
        lines.findIndex((line) => line.includes('### 2. Test Work Item 2')),
      )

      expect(firstItemLines.join('\n')).toContain('**Description:**')
      expect(secondItemLines.join('\n')).not.toContain('**Description:**')
    })

    it('should include metadata when provided', () => {
      const metadata = {
        query: 'my active work items',
        source: 'azure-devops-api',
        executionTime: '2025-08-27T10:00:00Z',
      }

      const formatted = MarkdownFormatter.formatWorkItems(
        mockWorkItems,
        metadata,
      )

      expect(formatted).toContain('*Generated: 2025-08-27T10:00:00Z*')
      expect(formatted).toContain('*Query: my active work items*')
    })

    it('should handle empty work items array', () => {
      const formatted = MarkdownFormatter.formatWorkItems([])

      expect(formatted).toContain('# Azure DevOps Work Items Report')
      expect(formatted).toContain('## Summary')
      expect(formatted).toContain('Found **0** work items')
      expect(formatted).not.toContain('## Work Items')
    })

    it('should handle missing fields gracefully', () => {
      const incompleteItems = [
        { id: 1 }, // Missing title, state, etc.
        { title: 'No ID Item' }, // Missing ID
        { id: 2, title: 'Partial Item', state: null }, // Null state
      ]

      const formatted = MarkdownFormatter.formatWorkItems(incompleteItems)

      expect(formatted).toContain('### 1. Work Item 1')
      expect(formatted).toContain('### 2. No ID Item')
      expect(formatted).toContain('### 3. Partial Item')
      expect(formatted).toContain('- **State:** Unknown')
    })

    it('should handle special characters and escaping', () => {
      const specialCharItems = [
        {
          id: 1,
          title: 'Item with *asterisks* and **bold** and `code`',
          state: 'Active',
          assignedTo: 'user@company.com',
          workItemType: 'User Story',
          description:
            'Description with [links](http://example.com) and ## headers',
        },
      ]

      const formatted = MarkdownFormatter.formatWorkItems(specialCharItems)

      // Should preserve markdown characters in content
      expect(formatted).toContain(
        'Item with *asterisks* and **bold** and `code`',
      )
      expect(formatted).toContain(
        'Description with [links](http://example.com) and ## headers',
      )
    })

    it('should generate properly structured markdown', () => {
      const formatted = MarkdownFormatter.formatWorkItems(mockWorkItems)

      // Should have proper heading hierarchy
      expect(formatted).toMatch(/^# Azure DevOps Work Items Report/m)
      expect(formatted).toMatch(/^## Summary/m)
      expect(formatted).toMatch(/^## Work Items/m)
      expect(formatted).toMatch(/^### \d+\./m)

      // Should have proper list formatting
      expect(formatted).toMatch(/^- \*\*ID:\*\*/m)
      expect(formatted).toMatch(/^- \*\*State:\*\*/m)
      expect(formatted).toMatch(/^- \*\*Assigned To:\*\*/m)
    })

    it('should handle large datasets efficiently', () => {
      const largeDataset = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        title: `Work Item ${i + 1}`,
        state: ['New', 'Active', 'Resolved', 'Closed'][i % 4],
        assignedTo: i % 3 === 0 ? null : `user${i % 10}@company.com`,
        workItemType: ['User Story', 'Bug', 'Task'][i % 3],
      }))

      const start = Date.now()
      const formatted = MarkdownFormatter.formatWorkItems(largeDataset)
      const elapsed = Date.now() - start

      expect(formatted).toContain('Found **100** work items')
      expect(formatted).toContain('### 1. Work Item 1')
      expect(formatted).toContain('### 100. Work Item 100')
      expect(elapsed).toBeLessThan(100) // Should format quickly
    })

    it('should maintain consistent formatting across items', () => {
      const formatted = MarkdownFormatter.formatWorkItems(mockWorkItems)
      const lines = formatted.split('\n')

      // Should have consistent bullet point formatting
      const bulletPoints = lines.filter((line) => line.match(/^- \*\*/))
      expect(bulletPoints.length).toBeGreaterThan(0)

      // All bullet points should follow the same format
      bulletPoints.forEach((line) => {
        expect(line).toMatch(/^- \*\*[^*]+:\*\* /)
      })
    })
  })

  describe('formatSyncSummary', () => {
    it('should format sync summary as proper markdown', () => {
      const formatted = MarkdownFormatter.formatSyncSummary(mockSyncSummary)

      expect(formatted).toContain('# Sync Summary Report')
      expect(formatted).toContain('## Statistics')
    })

    it('should include completion timestamp', () => {
      const formatted = MarkdownFormatter.formatSyncSummary(mockSyncSummary)

      expect(formatted).toMatch(
        /\*Completed: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\*/,
      )
    })

    it('should include duration when available', () => {
      const formatted = MarkdownFormatter.formatSyncSummary(mockSyncSummary)

      expect(formatted).toContain('**Duration:** 8432ms')
    })

    it('should not include duration when not available', () => {
      const summaryWithoutDuration = {
        totalItems: 42,
        totalComments: 5,
        successRate: 95,
      }

      const formatted = MarkdownFormatter.formatSyncSummary(
        summaryWithoutDuration,
      )

      expect(formatted).not.toContain('**Duration:**')
    })

    it('should include all statistics as a list', () => {
      const formatted = MarkdownFormatter.formatSyncSummary(mockSyncSummary)

      expect(formatted).toContain('- **Total Items:** 156')
      expect(formatted).toContain('- **Total Comments:** 23')
      expect(formatted).toContain('- **Success Rate:** 100%')
    })

    it('should handle zero and null values', () => {
      const zeroSummary = {
        totalItems: 0,
        totalComments: null,
        successRate: undefined,
        durationMs: 0,
      }

      const formatted = MarkdownFormatter.formatSyncSummary(zeroSummary)

      expect(formatted).toContain('- **Total Items:** 0')
      expect(formatted).toContain('- **Total Comments:** 0')
      expect(formatted).toContain('- **Success Rate:** 100%')
      expect(formatted).toContain('**Duration:** 0ms')
    })

    it('should handle missing statistics gracefully', () => {
      const minimalSummary = {
        totalItems: 10,
      }

      const formatted = MarkdownFormatter.formatSyncSummary(minimalSummary)

      expect(formatted).toContain('- **Total Items:** 10')
      expect(formatted).toContain('- **Total Comments:** 0')
      expect(formatted).toContain('- **Success Rate:** 100%')
    })

    it('should include additional fields when present', () => {
      const extendedSummary = {
        ...mockSyncSummary,
        errors: ['Error 1', 'Error 2'],
        warnings: ['Warning 1'],
        customMetric: 42,
      }

      const formatted = MarkdownFormatter.formatSyncSummary(extendedSummary)

      // Should still include basic structure
      expect(formatted).toContain('# Sync Summary Report')
      expect(formatted).toContain('## Statistics')
      expect(formatted).toContain('- **Total Items:** 156')
    })

    it('should generate valid markdown structure', () => {
      const formatted = MarkdownFormatter.formatSyncSummary(mockSyncSummary)

      // Should have proper heading hierarchy
      expect(formatted).toMatch(/^# Sync Summary Report$/m)
      expect(formatted).toMatch(/^## Statistics$/m)

      // Should have proper list formatting
      expect(formatted).toMatch(/^- \*\*Total Items:\*\*/m)
      expect(formatted).toMatch(/^- \*\*Total Comments:\*\*/m)
      expect(formatted).toMatch(/^- \*\*Success Rate:\*\*/m)
    })
  })

  describe('edge cases and error handling', () => {
    it('should handle null and undefined inputs', () => {
      const nullFormatted = MarkdownFormatter.formatWorkItems(null as any)
      expect(nullFormatted).toContain('# Azure DevOps Work Items Report')
      expect(nullFormatted).toContain('Found **0** work items')

      const undefinedFormatted = MarkdownFormatter.formatWorkItems(
        undefined as any,
      )
      expect(undefinedFormatted).toContain('# Azure DevOps Work Items Report')
      expect(undefinedFormatted).toContain('Found **0** work items')
    })

    it('should handle work items with unicode and special characters', () => {
      const unicodeItems = [
        {
          id: 1,
          title: 'Unicode test: 中文, émojis 🚀, ñoño',
          state: 'Activé',
          assignedTo: 'üser@cømpany.cøm',
          workItemType: 'Históriá de Usuário',
          description: 'Descripción with spéciál chárácters and 中文字符',
        },
      ]

      const formatted = MarkdownFormatter.formatWorkItems(unicodeItems)

      expect(formatted).toContain('Unicode test: 中文, émojis 🚀, ñoño')
      expect(formatted).toContain('- **State:** Activé')
      expect(formatted).toContain('- **Assigned To:** üser@cømpany.cøm')
      expect(formatted).toContain('- **Type:** Históriá de Usuário')
      expect(formatted).toContain(
        'Descripción with spéciál chárácters and 中文字符',
      )
    })

    it('should handle extremely long content', () => {
      const longContentItem = [
        {
          id: 1,
          title: 'A'.repeat(500),
          state: 'Active',
          assignedTo: 'user@company.com',
          workItemType: 'User Story',
          description: 'B'.repeat(2000),
        },
      ]

      const formatted = MarkdownFormatter.formatWorkItems(longContentItem)

      expect(formatted).toContain('A'.repeat(500))
      expect(formatted).toContain('B'.repeat(2000))
      expect(formatted).toContain('### 1. ' + 'A'.repeat(500))
    })

    it('should maintain markdown validity with special content', () => {
      const specialContentItems = [
        {
          id: 1,
          title: 'Title with # hash and * stars and _ underscores',
          state: 'Active',
          assignedTo: 'user@company.com',
          workItemType: 'Task',
          description:
            'Content with **bold** and *italic* and `code` and [link](http://example.com)',
        },
      ]

      const formatted = MarkdownFormatter.formatWorkItems(specialContentItems)

      // Should preserve markdown formatting in content
      expect(formatted).toContain(
        'Title with # hash and * stars and _ underscores',
      )
      expect(formatted).toContain(
        'Content with **bold** and *italic* and `code` and [link](http://example.com)',
      )
    })

    it('should handle work items with no title', () => {
      const noTitleItems = [
        { id: 1, state: 'Active' },
        { id: 2, title: '', state: 'Closed' },
        { id: 3, title: null, state: 'New' },
      ]

      const formatted = MarkdownFormatter.formatWorkItems(noTitleItems)

      expect(formatted).toContain('### 1. Work Item 1')
      expect(formatted).toContain('### 2. Work Item 2')
      expect(formatted).toContain('### 3. Work Item 3')
    })

    it('should generate consistent line endings', () => {
      const formatted = MarkdownFormatter.formatWorkItems(mockWorkItems)

      // Should use consistent line endings
      expect(formatted).not.toContain('\r\n') // No Windows line endings
      expect(formatted.split('\n').length).toBeGreaterThan(10) // Should have multiple lines
    })

    it('should handle metadata with special characters', () => {
      const specialMeta = {
        query: 'items with "quotes" and & symbols',
        source: 'api/v1',
        executionTime: '2025-08-27T10:00:00Z',
      }

      const formatted = MarkdownFormatter.formatWorkItems(
        mockWorkItems,
        specialMeta,
      )

      expect(formatted).toContain('*Query: items with "quotes" and & symbols*')
    })

    it('should handle missing metadata fields', () => {
      const incompleteMeta = {
        query: 'test query',
        // missing source and executionTime
      }

      const formatted = MarkdownFormatter.formatWorkItems(
        mockWorkItems,
        incompleteMeta,
      )

      expect(formatted).toContain('*Query: test query*')
      // Should not fail when other fields are missing
    })
  })
})
