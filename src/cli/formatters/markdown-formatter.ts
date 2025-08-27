export class MarkdownFormatter {
  static formatWorkItems(items: any[], metadata?: any): string {
    const workItems = items || [];
    const output = ['# Azure DevOps Work Items Report\n'];
    
    if (metadata) {
      if (metadata.executionTime) {
        output.push(`*Generated: ${metadata.executionTime}*\n`);
      }
      if (metadata.query) {
        output.push(`*Query: ${metadata.query}*\n`);
      }
    }

    output.push('## Summary\n');
    output.push(`Found **${workItems.length}** work items.\n`);

    if (workItems.length > 0) {
      output.push('## Work Items\n');
      
      workItems.forEach((item, index) => {
        output.push(`### ${index + 1}. ${item.title || `Work Item ${item.id}`}\n`);
        output.push(`- **ID:** ${item.id}`);
        output.push(`- **State:** ${item.state || 'Unknown'}`);
        output.push(`- **Assigned To:** ${item.assignedTo || 'Unassigned'}`);
        output.push(`- **Type:** ${item.workItemType || 'Unknown'}\n`);
        
        if (item.description && item.description.length > 0) {
          output.push(`**Description:**\n${item.description}\n`);
        }
      });
    }

    return output.join('\n');
  }

  static formatSyncSummary(summary: any): string {
    const output = ['# Sync Summary Report\n'];
    
    output.push(`*Completed: ${new Date().toISOString()}*\n`);
    
    if (summary.durationMs !== undefined && summary.durationMs !== null) {
      output.push(`**Duration:** ${summary.durationMs}ms\n`);
    }
    
    output.push('## Statistics\n');
    output.push(`- **Total Items:** ${summary.totalItems || 0}`);
    output.push(`- **Total Comments:** ${summary.totalComments || 0}`);
    output.push(`- **Success Rate:** ${summary.successRate || 100}%\n`);

    return output.join('\n');
  }
}