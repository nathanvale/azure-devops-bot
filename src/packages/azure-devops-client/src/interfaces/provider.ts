import type { CommentData } from '../types/comments.js'
import type { WorkItemData, WorkItemQuery } from '../types/work-items.js'

export interface IWorkItemProvider {
  // Core operations that any work item system should support
  fetchWorkItems(query?: WorkItemQuery): Promise<WorkItemData[]>
  getWorkItem(id: string | number): Promise<WorkItemData | null>
  getComments(workItemId: string | number): Promise<CommentData[]>

  // Provider metadata
  getProviderInfo(): ProviderInfo
}

export interface ProviderInfo {
  name: string
  version: string
  supports: {
    batchOperations: boolean
    realTimeUpdates: boolean
    customFields: boolean
  }
}
