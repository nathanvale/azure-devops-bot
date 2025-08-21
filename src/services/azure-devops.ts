import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface WorkItemData {
  id: number;
  title: string;
  state: string;
  type: string;
  assignedTo: string;
  lastUpdatedAt: Date;
  description?: string;
  
  // Sprint/Board Info
  iterationPath?: string;
  areaPath?: string;
  boardColumn?: string;
  boardColumnDone?: boolean;
  
  // Priority/Tags
  priority?: number;
  severity?: string;
  tags?: string;
  
  // All the dates
  createdDate?: Date;
  changedDate?: Date;
  closedDate?: Date;
  resolvedDate?: Date;
  activatedDate?: Date;
  stateChangeDate?: Date;
  
  // People
  createdBy?: string;
  changedBy?: string;
  closedBy?: string;
  resolvedBy?: string;
  
  // Work tracking
  storyPoints?: number;
  effort?: number;
  remainingWork?: number;
  completedWork?: number;
  originalEstimate?: number;
  
  // Content
  acceptanceCriteria?: string;
  reproSteps?: string;
  systemInfo?: string;
  
  // Related items
  parentId?: number;
  
  // Additional Azure DevOps fields found in real data
  rev?: number;
  reason?: string;
  watermark?: number;
  url?: string;
  commentCount?: number;
  hasAttachments?: boolean;
  teamProject?: string;
  areaId?: number;
  nodeId?: number;
  stackRank?: number;
  valueArea?: string;
  
  // Complete raw JSON from Azure DevOps
  rawJson: string;
}

export class AzureDevOpsClient {
  private static readonly ORGANIZATION = 'fwcdev';
  private static readonly PROJECT = 'Customer Services Platform';
  private static userEmails: string[] = [];
  
  static setUserEmails(emails: string[]): void {
    this.userEmails = emails;
  }
  
  static getUserEmails(): string[] {
    return this.userEmails;
  }
  
  private static buildEmailFilter(emails: string[]): string {
    if (!emails || emails.length === 0) return '';
    return emails.map(email => `[System.AssignedTo] = '${email}'`).join(' OR ');
  }

  private static buildCompletedWorkFilter(emails: string[]): string {
    if (!emails || emails.length === 0) return '';
    return emails.map(email => 
      `([System.AssignedTo] = '${email}' AND [System.State] IN ('Closed', 'Resolved', 'Done', 'Completed'))`
    ).join(' OR ');
  }
  
  private static buildComprehensiveWiqlQuery(): string {
    return `
      SELECT [System.Id], [System.Title], [System.State], [System.WorkItemType], [System.AssignedTo], [System.ChangedDate], [System.CreatedDate], [System.Description],
             [System.IterationPath], [System.AreaPath], [System.BoardColumn], [System.BoardColumnDone], [Microsoft.VSTS.Common.Priority], 
             [Microsoft.VSTS.Common.Severity], [System.Tags], [Microsoft.VSTS.Common.ClosedDate], [Microsoft.VSTS.Common.ResolvedDate],
             [Microsoft.VSTS.Common.ActivatedDate], [Microsoft.VSTS.Common.StateChangeDate], [System.CreatedBy], [System.ChangedBy],
             [Microsoft.VSTS.Common.ClosedBy], [Microsoft.VSTS.Common.ResolvedBy], [Microsoft.VSTS.Scheduling.StoryPoints],
             [Microsoft.VSTS.Scheduling.Effort], [Microsoft.VSTS.Scheduling.RemainingWork], [Microsoft.VSTS.Scheduling.CompletedWork],
             [Microsoft.VSTS.Scheduling.OriginalEstimate], [Microsoft.VSTS.Common.AcceptanceCriteria], [System.Parent],
             [System.Rev], [System.Reason], [System.Watermark], [System.CommentCount], [System.TeamProject], [System.AreaId],
             [System.IterationId], [Microsoft.VSTS.Common.StackRank], [Microsoft.VSTS.Common.ValueArea]
      FROM WorkItems 
      WHERE [System.WorkItemType] IN ('User Story','Product Backlog Item','Bug','Task') 
      AND [System.State] <> 'Removed'
      ORDER BY [System.ChangedDate] DESC
    `;
  }
  
  async fetchWorkItems(): Promise<WorkItemData[]> {
    const command = `az boards query --wiql "${AzureDevOpsClient.buildComprehensiveWiqlQuery()}" --output json`;
    
    try {
      const { stdout } = await execAsync(command, { maxBuffer: 10 * 1024 * 1024 });
      const result = JSON.parse(stdout);
      
      return result.map((item: any) => ({
        id: item.id,
        title: item.fields['System.Title'] || '',
        state: item.fields['System.State'] || '',
        type: item.fields['System.WorkItemType'] || '',
        assignedTo: this.extractPersonName(item.fields['System.AssignedTo']),
        lastUpdatedAt: new Date(item.fields['System.ChangedDate'] || item.fields['System.CreatedDate']),
        description: item.fields['System.Description'] || '',
        
        // Sprint/Board Info
        iterationPath: item.fields['System.IterationPath'],
        areaPath: item.fields['System.AreaPath'],
        boardColumn: item.fields['System.BoardColumn'],
        boardColumnDone: item.fields['System.BoardColumnDone'] === true,
        
        // Priority/Tags
        priority: item.fields['Microsoft.VSTS.Common.Priority'],
        severity: item.fields['Microsoft.VSTS.Common.Severity'],
        tags: item.fields['System.Tags'],
        
        // All the dates
        createdDate: this.parseDate(item.fields['System.CreatedDate']),
        changedDate: this.parseDate(item.fields['System.ChangedDate']),
        closedDate: this.parseDate(item.fields['Microsoft.VSTS.Common.ClosedDate']),
        resolvedDate: this.parseDate(item.fields['Microsoft.VSTS.Common.ResolvedDate']),
        activatedDate: this.parseDate(item.fields['Microsoft.VSTS.Common.ActivatedDate']),
        stateChangeDate: this.parseDate(item.fields['Microsoft.VSTS.Common.StateChangeDate']),
        
        // People
        createdBy: this.extractPersonName(item.fields['System.CreatedBy']),
        changedBy: this.extractPersonName(item.fields['System.ChangedBy']),
        closedBy: this.extractPersonName(item.fields['Microsoft.VSTS.Common.ClosedBy']),
        resolvedBy: this.extractPersonName(item.fields['Microsoft.VSTS.Common.ResolvedBy']),
        
        // Work tracking
        storyPoints: this.parseFloat(item.fields['Microsoft.VSTS.Scheduling.StoryPoints']),
        effort: this.parseFloat(item.fields['Microsoft.VSTS.Scheduling.Effort']),
        remainingWork: this.parseFloat(item.fields['Microsoft.VSTS.Scheduling.RemainingWork']),
        completedWork: this.parseFloat(item.fields['Microsoft.VSTS.Scheduling.CompletedWork']),
        originalEstimate: this.parseFloat(item.fields['Microsoft.VSTS.Scheduling.OriginalEstimate']),
        
        // Content
        acceptanceCriteria: item.fields['Microsoft.VSTS.Common.AcceptanceCriteria'],
        reproSteps: item.fields['Microsoft.VSTS.TCM.ReproSteps'],
        systemInfo: item.fields['Microsoft.VSTS.TCM.SystemInfo'],
        
        // Related items
        parentId: item.fields['System.Parent'],
        
        // Additional Azure DevOps fields from query
        rev: item.rev,
        reason: item.fields['System.Reason'],
        watermark: item.fields['System.Watermark'],
        url: item.url,
        commentCount: item.fields['System.CommentCount'] || 0,
        hasAttachments: false, // We'll determine this later if needed
        teamProject: item.fields['System.TeamProject'],
        areaId: item.fields['System.AreaId'],
        nodeId: item.fields['System.IterationId'],
        stackRank: this.parseFloat(item.fields['Microsoft.VSTS.Common.StackRank']),
        valueArea: item.fields['Microsoft.VSTS.Common.ValueArea'],
        
        // Store complete raw JSON for backup
        rawJson: JSON.stringify(item)
      }));
    } catch (error) {
      console.error('Failed to fetch work items:', error);
      throw error;
    }
  }
  
  static buildWorkItemUrl(id: number): string {
    return `https://dev.azure.com/${AzureDevOpsClient.ORGANIZATION}/${encodeURIComponent(AzureDevOpsClient.PROJECT)}/_workitems/edit/${id}`;
  }
  
  private extractPersonName(person: any): string {
    if (!person) return 'Unassigned';
    if (typeof person === 'string') return person;
    return person.uniqueName || person.displayName || 'Unassigned';
  }
  
  private parseDate(dateString: string | undefined): Date | undefined {
    if (!dateString) return undefined;
    return new Date(dateString);
  }
  
  private parseFloat(value: any): number | undefined {
    if (value === null || value === undefined) return undefined;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? undefined : parsed;
  }
  
  private extractParentId(relations: any[]): number | undefined {
    if (!relations || !Array.isArray(relations)) return undefined;
    
    const parentRelation = relations.find(rel => 
      rel.rel === 'System.LinkTypes.Hierarchy-Reverse'
    );
    
    if (parentRelation && parentRelation.url) {
      const match = parentRelation.url.match(/\/(\d+)$/);
      return match ? parseInt(match[1], 10) : undefined;
    }
    
    return undefined;
  }
  
  private hasAttachments(relations: any[]): boolean {
    if (!relations || !Array.isArray(relations)) return false;
    
    return relations.some(rel => rel.rel === 'AttachedFile');
  }
  
  async validateUserEmails(emails: string[]): Promise<{ valid: string[]; invalid: string[] }> {
    const valid: string[] = [];
    const invalid: string[] = [];
    
    for (const email of emails) {
      try {
        const command = `az boards query --wiql "SELECT [System.Id] FROM WorkItems WHERE [System.AssignedTo] = '${email}' OR [System.CreatedBy] = '${email}' OR [System.ChangedBy] = '${email}'" --output json`;
        const { stdout } = await execAsync(command, { maxBuffer: 1024 * 1024 });
        const result = JSON.parse(stdout);
        
        if (result && result.length > 0) {
          valid.push(email);
        } else {
          // Try to find the user in the organization
          const userCommand = `az devops user show --user "${email}" --output json 2>/dev/null || echo "[]"`;
          const { stdout: userStdout } = await execAsync(userCommand, { maxBuffer: 1024 * 1024 });
          const userResult = JSON.parse(userStdout);
          
          if (userResult && userResult.principalName) {
            valid.push(email);
          } else {
            invalid.push(email);
          }
        }
      } catch (error) {
        invalid.push(email);
      }
    }
    
    return { valid, invalid };
  }
}