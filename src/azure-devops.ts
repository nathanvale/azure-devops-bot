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
}

export class AzureDevOpsClient {
  private static readonly ORGANIZATION = 'fwcdev';
  private static readonly PROJECT = 'Customer Services Platform';
  private static readonly ASSIGNED_TO = 'Nathan.Vale@fwc.gov.au';
  
  private static readonly WIQL_QUERY = `
    SELECT [System.Id], [System.Title], [System.State], [System.WorkItemType], [System.AssignedTo], [System.ChangedDate]
    FROM WorkItems 
    WHERE [System.WorkItemType] IN ('User Story','Product Backlog Item') 
    AND [System.State] <> 'Closed' 
    AND [System.State] <> 'Removed' 
    AND [System.AssignedTo] = '${AzureDevOpsClient.ASSIGNED_TO}'
    ORDER BY [System.ChangedDate] DESC
  `;
  
  async fetchWorkItems(): Promise<WorkItemData[]> {
    const command = `az boards query --wiql "${AzureDevOpsClient.WIQL_QUERY}" --output json`;
    
    try {
      const { stdout } = await execAsync(command);
      const result = JSON.parse(stdout);
      
      return result.map((item: any) => ({
        id: item.id,
        title: item.fields['System.Title'],
        state: item.fields['System.State'],
        type: item.fields['System.WorkItemType'],
        assignedTo: item.fields['System.AssignedTo']?.displayName || 'Unassigned',
        lastUpdatedAt: new Date(item.fields['System.ChangedDate'])
      }));
    } catch (error) {
      console.error('Failed to fetch work items:', error);
      throw error;
    }
  }
  
  static buildWorkItemUrl(id: number): string {
    return `https://dev.azure.com/${AzureDevOpsClient.ORGANIZATION}/${encodeURIComponent(AzureDevOpsClient.PROJECT)}/_workitems/edit/${id}`;
  }
}