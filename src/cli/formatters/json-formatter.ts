export class JSONFormatter {
  static formatWorkItems(
    items: unknown[],
    metadata?: Record<string, unknown>,
  ): string {
    // Handle null/undefined inputs
    const workItems = items || []

    const output = {
      timestamp: new Date().toISOString(),
      count: workItems.length,
      items: workItems.map((item) => {
        const workItem = item as Record<string, unknown>
        return {
          id: workItem.id,
          title: workItem.title,
          state: workItem.state,
          assignedTo: workItem.assignedTo,
          createdDate: workItem.createdDate,
          changedDate: workItem.changedDate,
          workItemType: workItem.workItemType,
          description: workItem.description,
          tags: workItem.tags,
          // Include any additional fields that might be present
          ...Object.keys(item as Record<string, unknown>).reduce(
            (acc: Record<string, unknown>, key) => {
              if (
                ![
                  'id',
                  'title',
                  'state',
                  'assignedTo',
                  'createdDate',
                  'changedDate',
                  'workItemType',
                  'description',
                  'tags',
                ].includes(key)
              ) {
                acc[key] = (item as Record<string, unknown>)[key]
              }
              return acc
            },
            {},
          ),
        }
      }),
      metadata: metadata || null,
    }

    return JSON.stringify(output, null, 2)
  }

  static formatSyncSummary(summary: Record<string, unknown>): string {
    const output = {
      timestamp: new Date().toISOString(),
      type: 'sync_summary',
      ...summary,
    }

    return JSON.stringify(output, null, 2)
  }
}
