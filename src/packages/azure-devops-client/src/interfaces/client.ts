import type { WorkItemComment } from '../types/comments.js'
import type { BatchOptions, WorkItemExpand } from '../types/config.js'
import type { WorkItem, WorkItemQueryResult } from '../types/work-items.js'

export interface IAzureDevOpsClient {
  // Work Item Operations
  getWorkItemsBatch(ids?: number[], options?: BatchOptions): Promise<WorkItem[]>
  getWorkItem(id: number, expand?: WorkItemExpand): Promise<WorkItem>
  queryWorkItems(wiql: string): Promise<WorkItemQueryResult>

  // Comment Operations
  getWorkItemComments(workItemId: number): Promise<WorkItemComment[]>
  addWorkItemComment(workItemId: number, text: string): Promise<WorkItemComment>

  // Work Item Updates
  linkWorkItemToPullRequest(
    workItemId: number,
    pullRequestUrl: string,
  ): Promise<void>

  // Batch Operations
  batchGetWorkItems(ids: number[]): Promise<WorkItem[]>
  batchGetComments(
    workItemIds: number[],
  ): Promise<Map<number, WorkItemComment[]>>
}
