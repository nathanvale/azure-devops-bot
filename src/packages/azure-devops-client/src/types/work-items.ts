export interface WorkItem {
  id: number
  rev: number
  url: string
  fields: WorkItemFields
  relations?: WorkItemRelation[]
  _links?: WorkItemLinks
}

export interface WorkItemFields {
  'System.Id': number
  'System.Title': string
  'System.State': string
  'System.WorkItemType': string
  'System.AssignedTo'?: AzureDevOpsPerson
  'System.CreatedDate': string
  'System.ChangedDate': string
  'System.CreatedBy'?: AzureDevOpsPerson
  'System.Description'?: string
  'System.AreaPath'?: string
  'System.IterationPath'?: string
  'System.Reason'?: string
  'System.Tags'?: string
  'Microsoft.VSTS.Common.Priority'?: number
  'Microsoft.VSTS.Common.Severity'?: string
  'Microsoft.VSTS.Common.ValueArea'?: string
  'Microsoft.VSTS.Scheduling.StoryPoints'?: number
  'Microsoft.VSTS.Scheduling.OriginalEstimate'?: number
  'Microsoft.VSTS.Scheduling.RemainingWork'?: number
  'Microsoft.VSTS.Scheduling.CompletedWork'?: number
  'System.CommentCount'?: number
  'System.BoardColumn'?: string
  'System.BoardColumnDone'?: boolean
  // Allow for any other Azure DevOps fields
  [key: string]: unknown
}

export interface AzureDevOpsPerson {
  displayName: string
  url: string
  id: string
  uniqueName: string
  imageUrl: string
  descriptor: string
}

export interface WorkItemRelation {
  rel: string
  url: string
  attributes?: Record<string, unknown>
}

export interface WorkItemLinks {
  self: { href: string }
  workItemUpdates: { href: string }
  workItemRevisions: { href: string }
  workItemComments: { href: string }
  html: { href: string }
  workItemType: { href: string }
  fields: { href: string }
}

export interface WorkItemReference {
  id: number
  url: string
}

export interface WorkItemFieldReference {
  referenceName: string
  name: string
  url: string
}

export interface WorkItemQuerySortColumn {
  field: WorkItemFieldReference
  descending: boolean
}

export interface WorkItemQueryResult {
  queryType: 'flat' | 'tree' | 'oneHop'
  queryResultType: 'workItem' | 'workItemLink'
  asOf: string
  columns: WorkItemFieldReference[]
  sortColumns: WorkItemQuerySortColumn[]
  workItems: WorkItemReference[]
}

// Generic work item data format for provider abstraction
export interface WorkItemData {
  id: string | number
  title: string
  state: string
  type: string
  assignedTo?: string
  createdDate: string
  changedDate: string
  description?: string
  tags?: string[]
  // Raw data for future-proofing
  raw: Record<string, unknown>
}

export interface WorkItemQuery {
  filters?: {
    state?: string[]
    type?: string[]
    assignedTo?: string[]
    area?: string[]
    iteration?: string[]
  }
  limit?: number
  orderBy?: string
  orderDirection?: 'asc' | 'desc'
}
