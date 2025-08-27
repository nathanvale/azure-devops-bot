export class JSONFormatter {
  static formatWorkItems(items: any[], metadata?: any): string {
    // Handle null/undefined inputs
    const workItems = items || [];
    
    const output = {
      timestamp: new Date().toISOString(),
      count: workItems.length,
      items: workItems.map(item => ({
        id: item.id,
        title: item.title,
        state: item.state,
        assignedTo: item.assignedTo,
        createdDate: item.createdDate,
        changedDate: item.changedDate,
        workItemType: item.workItemType,
        description: item.description,
        tags: item.tags,
        // Include any additional fields that might be present
        ...Object.keys(item).reduce((acc: any, key) => {
          if (!['id', 'title', 'state', 'assignedTo', 'createdDate', 'changedDate', 'workItemType', 'description', 'tags'].includes(key)) {
            acc[key] = item[key];
          }
          return acc;
        }, {})
      })),
      metadata: metadata || null
    };

    return JSON.stringify(output, null, 2);
  }

  static formatSyncSummary(summary: any): string {
    const output = {
      timestamp: new Date().toISOString(),
      type: 'sync_summary',
      ...summary
    };

    return JSON.stringify(output, null, 2);
  }
}