import type { WorkItemComment } from './comments.js'
import type { WorkItem, WorkItemQueryResult } from './work-items.js'

// Raw Azure DevOps API response types
export interface AzureDevOpsApiResponse<T = unknown> {
  count: number
  value: T[]
}

export interface WorkItemBatchResponse
  extends AzureDevOpsApiResponse<WorkItem> {}

export interface WorkItemQueryResponse extends WorkItemQueryResult {}

export interface WorkItemCommentsApiResponse {
  comments: WorkItemComment[]
  count: number
  fromRevisionCount: number
  totalCount: number
}

// Error responses
export interface AzureDevOpsApiError {
  message: string
  typeKey: string
  errorCode: number
  eventId: number
}

export interface AzureDevOpsApiErrorResponse {
  $id: string
  innerException?: unknown
  message: string
  typeName: string
  typeKey: string
  errorCode: number
  eventId: number
}
