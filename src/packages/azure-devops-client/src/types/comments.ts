import type { AzureDevOpsPerson } from './work-items.js'

export interface WorkItemComment {
  id: string
  workItemId: number
  text: string
  createdBy: AzureDevOpsPerson
  createdDate: string
  modifiedBy?: AzureDevOpsPerson
  modifiedDate?: string
  version: number
}

export interface WorkItemCommentsResponse {
  comments: WorkItemComment[]
  count: number
  fromRevisionCount: number
  totalCount: number
}

// Generic comment data format for provider abstraction
export interface CommentData {
  id: string
  workItemId: string | number
  text: string
  author: string
  createdDate: string
  modifiedDate?: string
  // Raw data for future-proofing
  raw: Record<string, unknown>
}
