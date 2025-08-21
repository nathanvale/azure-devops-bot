import { exec } from 'child_process';
import { promisify } from 'util';
import { ProductionResilienceAdapter, type ResiliencePolicy } from '@orchestr8/resilience';

const execAsync = promisify(exec);

// Resilience policies for Azure CLI operations
const listPolicy: ResiliencePolicy = {
  retry: {
    maxAttempts: 3,
    initialDelay: 500,
    maxDelay: 2000,
    backoffStrategy: 'exponential',
    jitterStrategy: 'full-jitter',
  },
  timeout: 10000, // 10 seconds
  circuitBreaker: {
    key: 'azure-devops-list',
    failureThreshold: 3,
    recoveryTime: 30000,
    sampleSize: 5,
    halfOpenPolicy: 'single-probe',
  },
};

const detailPolicy: ResiliencePolicy = {
  retry: {
    maxAttempts: 5,
    initialDelay: 200,
    maxDelay: 5000,
    backoffStrategy: 'exponential',
    jitterStrategy: 'full-jitter',
  },
  timeout: 15000, // 15 seconds for expanded data
  circuitBreaker: {
    key: 'azure-devops-detail',
    failureThreshold: 5,
    recoveryTime: 45000,
    sampleSize: 10,
    halfOpenPolicy: 'single-probe',
  },
};

const commentPolicy: ResiliencePolicy = {
  retry: {
    maxAttempts: 3,
    initialDelay: 300,
    maxDelay: 3000,
    backoffStrategy: 'exponential',
    jitterStrategy: 'full-jitter',
  },
  timeout: 10000, // 10 seconds for comment fetching
  circuitBreaker: {
    key: 'azure-devops-comments',
    failureThreshold: 3,
    recoveryTime: 30000,
    sampleSize: 5,
    halfOpenPolicy: 'single-probe',
  },
};

// Create resilience adapter with logging
const resilience = new ProductionResilienceAdapter();

// Add circuit breaker monitoring
const logCircuitBreakerEvent = (event: string, key: string, details?: any) => {
  const timestamp = new Date().toISOString();
  console.log(`🔥 Circuit Breaker [${timestamp}] - ${event} for key '${key}'`, details ? JSON.stringify(details) : '');
};

// Log when circuit breaker state changes occur
const logRetryAttempt = (attempt: number, maxAttempts: number, delay: number, error: any) => {
  console.warn(`🔄 Retry attempt ${attempt}/${maxAttempts} after ${delay}ms delay. Error:`, error.message);
};

export interface WorkItemCommentData {
  id: string;
  workItemId: number;
  text: string;
  createdBy: string;
  createdDate: Date;
  modifiedBy: string | null;
  modifiedDate: Date | null;
}

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
    // First get work item IDs with comprehensive query using resilience
    const wiqlCommand = `az boards query --wiql "${AzureDevOpsClient.buildComprehensiveWiqlQuery()}" --output json`;
    
    try {
      const { stdout: wiqlStdout } = await resilience.applyPolicy(
        async () => {
          try {
            return await execAsync(wiqlCommand, { maxBuffer: 10 * 1024 * 1024 });
          } catch (error) {
            logCircuitBreakerEvent('FAILURE', 'azure-devops-list', { error: error instanceof Error ? error.message : error });
            throw error;
          }
        },
        listPolicy
      );
      const wiqlResult = JSON.parse(wiqlStdout);
      
      if (!wiqlResult || wiqlResult.length === 0) {
        return [];
      }
      
      // Extract work item IDs
      const workItemIds = wiqlResult.map((item: any) => item.id).join(',');
      
      // Fetch detailed work items with --expand all flag using resilience
      const expandCommand = `az boards work-item show --id "${workItemIds}" --expand all --output json`;
      
      const { stdout: expandStdout } = await resilience.applyPolicy(
        async () => {
          try {
            return await execAsync(expandCommand, { maxBuffer: 50 * 1024 * 1024 });
          } catch (error) {
            logCircuitBreakerEvent('FAILURE', 'azure-devops-detail', { error: error instanceof Error ? error.message : error });
            throw error;
          }
        },
        detailPolicy
      );
      const expandedResult = JSON.parse(expandStdout);
      
      // Handle both single work item (object) and multiple work items (array)
      const workItems = Array.isArray(expandedResult) ? expandedResult : [expandedResult];
      
      return workItems.map((item: any) => this.mapWorkItemData(item));
    } catch (error) {
      console.error('Failed to fetch work items:', error);
      
      // Provide actionable error messages based on error type
      if (error instanceof Error) {
        if (error.message.includes('az: command not found')) {
          throw new Error('Azure CLI is not installed. Please install Azure CLI and run "az login" to authenticate.');
        } else if (error.message.includes('Please run \'az login\'')) {
          throw new Error('Azure CLI authentication required. Please run "az login" and authenticate with your Azure DevOps account.');
        } else if (error.message.includes('rate limit') || error.message.includes('429')) {
          throw new Error('Azure DevOps API rate limit exceeded. Please wait a few minutes before trying again.');
        } else if (error.message.includes('timeout') || error.message.includes('TIMEOUT')) {
          throw new Error('Azure DevOps API timeout. The request took too long to complete, please try again.');
        } else if (error.message.includes('ENOTFOUND') || error.message.includes('network')) {
          throw new Error('Network connection failed. Please check your internet connection and try again.');
        }
      }
      
      throw new Error(`Azure DevOps work item fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async fetchWorkItemComments(workItemId: number): Promise<WorkItemCommentData[]> {
    const command = `az rest --method GET --uri "https://dev.azure.com/${AzureDevOpsClient.ORGANIZATION}/${AzureDevOpsClient.PROJECT}/_apis/wit/workItems/${workItemId}/comments?api-version=7.0" --output json`;
    
    try {
      const { stdout } = await resilience.applyPolicy(
        async () => {
          try {
            return await execAsync(command, { maxBuffer: 10 * 1024 * 1024 });
          } catch (error) {
            logCircuitBreakerEvent('FAILURE', 'azure-devops-comments', { error: error instanceof Error ? error.message : error, workItemId });
            throw error;
          }
        },
        commentPolicy
      );
      const commentsResponse = JSON.parse(stdout);
      
      if (!commentsResponse || !commentsResponse.value) {
        return [];
      }
      
      return commentsResponse.value.map((comment: any) => this.mapCommentData(comment, workItemId));
    } catch (error) {
      console.error(`Failed to fetch comments for work item ${workItemId}:`, error);
      
      // Provide actionable error messages based on error type
      if (error instanceof Error) {
        if (error.message.includes('az: command not found')) {
          throw new Error('Azure CLI is not installed. Please install Azure CLI and run "az login" to authenticate.');
        } else if (error.message.includes('Please run \'az login\'')) {
          throw new Error('Azure CLI authentication required. Please run "az login" and authenticate with your Azure DevOps account.');
        } else if (error.message.includes('rate limit') || error.message.includes('429')) {
          throw new Error('Azure DevOps API rate limit exceeded. Please wait a few minutes before trying again.');
        } else if (error.message.includes('timeout') || error.message.includes('TIMEOUT')) {
          throw new Error('Azure DevOps API timeout. The request took too long to complete, please try again.');
        } else if (error.message.includes('ENOTFOUND') || error.message.includes('network')) {
          throw new Error('Network connection failed. Please check your internet connection and try again.');
        }
      }
      
      throw new Error(`Azure DevOps comment fetch failed for work item ${workItemId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async fetchSingleWorkItem(id: number): Promise<WorkItemData> {
    const command = `az boards work-item show --id ${id} --expand all --output json`;
    
    try {
      const { stdout } = await resilience.applyPolicy(
        async () => {
          try {
            return await execAsync(command, { maxBuffer: 50 * 1024 * 1024 });
          } catch (error) {
            logCircuitBreakerEvent('FAILURE', 'azure-devops-detail', { error: error instanceof Error ? error.message : error, workItemId: id });
            throw error;
          }
        },
        detailPolicy
      );
      const workItem = JSON.parse(stdout);
      
      if (!workItem || workItem === null) {
        throw new Error(`Work item ${id} not found or returned null`);
      }
      
      return this.mapWorkItemData(workItem);
    } catch (error) {
      console.error(`Failed to fetch work item ${id}:`, error);
      
      // Provide actionable error messages based on error type
      if (error instanceof Error) {
        if (error.message.includes('az: command not found')) {
          throw new Error('Azure CLI is not installed. Please install Azure CLI and run "az login" to authenticate.');
        } else if (error.message.includes('Please run \'az login\'')) {
          throw new Error('Azure CLI authentication required. Please run "az login" and authenticate with your Azure DevOps account.');
        } else if (error.message.includes('rate limit') || error.message.includes('429')) {
          throw new Error('Azure DevOps API rate limit exceeded. Please wait a few minutes before trying again.');
        } else if (error.message.includes('timeout') || error.message.includes('TIMEOUT')) {
          throw new Error('Azure DevOps API timeout. The request took too long to complete, please try again.');
        } else if (error.message.includes('ENOTFOUND') || error.message.includes('network')) {
          throw new Error('Network connection failed. Please check your internet connection and try again.');
        }
      }
      
      throw new Error(`Azure DevOps single work item fetch failed for ID ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async fetchWorkItemsDetailed(workItemIds: number[], concurrencyLimit: number = 5): Promise<WorkItemData[]> {
    if (!workItemIds || workItemIds.length === 0) {
      return [];
    }

    // Create concurrency-controlled promises using a simple queue approach
    const results: WorkItemData[] = [];
    const semaphore = new Array(concurrencyLimit).fill(null);
    let currentIndex = 0;

    // Process items in batches respecting concurrency limit
    const processBatch = async (): Promise<void> => {
      const promises = semaphore.map(async () => {
        while (currentIndex < workItemIds.length) {
          const index = currentIndex++;
          const workItemId = workItemIds[index];
          
          try {
            const workItem = await this.fetchSingleWorkItem(workItemId);
            results[index] = workItem;
          } catch (error) {
            // Individual failures are handled gracefully - just log and continue
            console.warn(`Failed to fetch work item ${workItemId}:`, error);
          }
        }
      });

      await Promise.allSettled(promises);
    };

    await processBatch();

    // Filter out undefined values (failed fetches) and preserve order
    return results.filter((item) => item !== undefined);
  }

  private mapCommentData(comment: any, workItemId: number): WorkItemCommentData {
    return {
      id: comment.id || '',
      workItemId: workItemId,
      text: comment.text || '',
      createdBy: this.extractPersonName(comment.createdBy),
      createdDate: this.parseDate(comment.createdDate) || new Date(),
      modifiedBy: comment.modifiedBy ? this.extractPersonName(comment.modifiedBy) : null,
      modifiedDate: comment.modifiedDate ? this.parseDate(comment.modifiedDate) || null : null,
    };
  }

  private mapWorkItemData(item: any): WorkItemData {
    return {
      id: item.id,
      title: item.fields?.['System.Title'] || '',
      state: item.fields?.['System.State'] || '',
      type: item.fields?.['System.WorkItemType'] || '',
      assignedTo: this.extractPersonName(item.fields?.['System.AssignedTo']),
      lastUpdatedAt: new Date(item.fields?.['System.ChangedDate'] || item.fields?.['System.CreatedDate'] || new Date()),
      description: item.fields?.['System.Description'] || '',
      
      // Sprint/Board Info
      iterationPath: item.fields?.['System.IterationPath'],
      areaPath: item.fields?.['System.AreaPath'],
      boardColumn: item.fields?.['System.BoardColumn'],
      boardColumnDone: item.fields?.['System.BoardColumnDone'] === true,
      
      // Priority/Tags
      priority: item.fields?.['Microsoft.VSTS.Common.Priority'],
      severity: item.fields?.['Microsoft.VSTS.Common.Severity'],
      tags: item.fields?.['System.Tags'],
      
      // All the dates
      createdDate: this.parseDate(item.fields?.['System.CreatedDate']),
      changedDate: this.parseDate(item.fields?.['System.ChangedDate']),
      closedDate: this.parseDate(item.fields?.['Microsoft.VSTS.Common.ClosedDate']),
      resolvedDate: this.parseDate(item.fields?.['Microsoft.VSTS.Common.ResolvedDate']),
      activatedDate: this.parseDate(item.fields?.['Microsoft.VSTS.Common.ActivatedDate']),
      stateChangeDate: this.parseDate(item.fields?.['Microsoft.VSTS.Common.StateChangeDate']),
      
      // People
      createdBy: this.extractPersonName(item.fields?.['System.CreatedBy']),
      changedBy: this.extractPersonName(item.fields?.['System.ChangedBy']),
      closedBy: this.extractPersonName(item.fields?.['Microsoft.VSTS.Common.ClosedBy']),
      resolvedBy: this.extractPersonName(item.fields?.['Microsoft.VSTS.Common.ResolvedBy']),
      
      // Work tracking
      storyPoints: this.parseFloat(item.fields?.['Microsoft.VSTS.Scheduling.StoryPoints']),
      effort: this.parseFloat(item.fields?.['Microsoft.VSTS.Scheduling.Effort']),
      remainingWork: this.parseFloat(item.fields?.['Microsoft.VSTS.Scheduling.RemainingWork']),
      completedWork: this.parseFloat(item.fields?.['Microsoft.VSTS.Scheduling.CompletedWork']),
      originalEstimate: this.parseFloat(item.fields?.['Microsoft.VSTS.Scheduling.OriginalEstimate']),
      
      // Content
      acceptanceCriteria: item.fields?.['Microsoft.VSTS.Common.AcceptanceCriteria'],
      reproSteps: item.fields?.['Microsoft.VSTS.TCM.ReproSteps'],
      systemInfo: item.fields?.['Microsoft.VSTS.TCM.SystemInfo'],
      
      // Related items (extracted from relations)
      parentId: this.extractParentId(item.relations || []),
      
      // Additional Azure DevOps fields from expanded response
      rev: item.rev,
      reason: item.fields?.['System.Reason'],
      watermark: item.fields?.['System.Watermark'],
      url: item.url,
      commentCount: item.fields?.['System.CommentCount'] || 0,
      hasAttachments: this.hasAttachments(item.relations || []),
      teamProject: item.fields?.['System.TeamProject'],
      areaId: item.fields?.['System.AreaId'],
      nodeId: item.fields?.['System.IterationId'],
      stackRank: this.parseFloat(item.fields?.['Microsoft.VSTS.Common.StackRank']),
      valueArea: item.fields?.['Microsoft.VSTS.Common.ValueArea'],
      
      // Store complete raw JSON for backup
      rawJson: JSON.stringify(item)
    };
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
        const { stdout } = await resilience.applyPolicy(
          () => execAsync(command, { maxBuffer: 1024 * 1024 }),
          listPolicy
        );
        const result = JSON.parse(stdout);
        
        if (result && result.length > 0) {
          valid.push(email);
        } else {
          // Try to find the user in the organization
          const userCommand = `az devops user show --user "${email}" --output json 2>/dev/null || echo "[]"`;
          const { stdout: userStdout } = await resilience.applyPolicy(
            () => execAsync(userCommand, { maxBuffer: 1024 * 1024 }),
            listPolicy
          );
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