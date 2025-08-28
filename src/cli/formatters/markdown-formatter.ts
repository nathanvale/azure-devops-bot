export class MarkdownFormatter {
  static formatWorkItems(
    items: unknown[],
    metadata?: Record<string, unknown>,
  ): string {
    const workItems = items || []
    const output = ['# Azure DevOps Work Items Report\n']

    if (metadata) {
      if (metadata.executionTime) {
        output.push(`*Generated: ${metadata.executionTime}*\n`)
      }
      if (metadata.query) {
        output.push(`*Query: ${metadata.query}*\n`)
      }
    }

    output.push('## Summary\n')
    output.push(`Found **${workItems.length}** work items.\n`)

    if (workItems.length > 0) {
      output.push('## Work Items\n')

      workItems.forEach((item, index) => {
        const workItem = item as Record<string, unknown>
        output.push(
          `### ${index + 1}. ${workItem.title || `Work Item ${workItem.id}`}\n`,
        )
        output.push(`- **ID:** ${workItem.id}`)
        output.push(`- **State:** ${workItem.state || 'Unknown'}`)
        output.push(`- **Assigned To:** ${workItem.assignedTo || 'Unassigned'}`)
        output.push(`- **Type:** ${workItem.workItemType || 'Unknown'}\n`)

        if (
          workItem.description &&
          (workItem.description as string).length > 0
        ) {
          output.push(`**Description:**\n${workItem.description}\n`)
        }
      })
    }

    return output.join('\n')
  }

  static formatSyncSummary(summary: Record<string, unknown>): string {
    const output = ['# Sync Summary Report\n']

    output.push(`*Completed: ${new Date().toISOString()}*\n`)

    if (summary.durationMs !== undefined && summary.durationMs !== null) {
      output.push(`**Duration:** ${summary.durationMs}ms\n`)
    }

    output.push('## Statistics\n')
    output.push(`- **Total Items:** ${summary.totalItems || 0}`)
    output.push(`- **Total Comments:** ${summary.totalComments || 0}`)
    output.push(`- **Success Rate:** ${summary.successRate || 100}%\n`)

    return output.join('\n')
  }
}
