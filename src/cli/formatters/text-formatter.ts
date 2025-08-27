import chalk from 'chalk';

export class TextFormatter {
  static formatWorkItems(items: any[]): string {
    if (!items || items.length === 0) {
      return chalk.yellow('No work items found');
    }

    const output = [`\n${chalk.bold.blue('📋 Work Items')} (${items.length} found):\n`];
    
    items.forEach((item, index) => {
      const number = chalk.dim(`${index + 1}.`);
      const title = chalk.bold(item.title || `Work Item ${item.id}`);
      const state = this.formatState(item.state);
      const assignee = this.formatAssignee(item.assignedTo);
      
      output.push(`  ${number} ${title}`);
      output.push(`     ${state} • ${assignee}`);
      
      if (item.description && item.description.length > 0) {
        const shortDesc = item.description.slice(0, 80) + (item.description.length > 80 ? '...' : '');
        output.push(`     ${chalk.dim(shortDesc)}`);
      }
      
      output.push('');
    });

    return output.join('\n');
  }

  static formatSyncSummary(summary: any): string {
    const duration = summary.durationMs !== undefined && summary.durationMs !== null ? ` in ${summary.durationMs}ms` : '';
    const title = chalk.bold.green('✅ Sync Complete');
    
    const stats = [
      `${chalk.cyan(summary.totalItems || 0)} work items`,
      `${chalk.magenta(summary.totalComments || 0)} comments`,
      `${chalk.yellow(summary.successRate || 100)}% success rate`
    ].join(' • ');

    return `\n${title}${duration}\n${stats}\n`;
  }

  private static formatState(state: string): string {
    const stateColors: Record<string, (str: string) => string> = {
      'New': chalk.blue,
      'Active': chalk.yellow,
      'Resolved': chalk.green,
      'Closed': chalk.gray,
      'Removed': chalk.red
    };

    const formatter = stateColors[state] || chalk.white;
    return formatter(`[${state || 'Unknown'}]`);
  }

  private static formatAssignee(assignedTo: any): string {
    if (!assignedTo || assignedTo === '') {
      return chalk.dim('unassigned');
    }
    return chalk.dim(`@${assignedTo}`);
  }
}