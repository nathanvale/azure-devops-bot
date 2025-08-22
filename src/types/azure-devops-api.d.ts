// Azure DevOps API type definitions

export interface AzureDevOpsPerson {
  displayName?: string
  uniqueName?: string
  id?: string
  imageUrl?: string
}

export interface AzureDevOpsWorkItemFields {
  'System.Id': number
  'System.Title': string
  'System.State': string
  'System.WorkItemType': string
  'System.AssignedTo'?: AzureDevOpsPerson
  'System.CreatedDate': string
  'System.ChangedDate': string
  'System.Description'?: string

  // Sprint/Board Info
  'System.IterationPath'?: string
  'System.IterationId'?: number
  'System.AreaPath'?: string
  'System.BoardColumn'?: string
  'System.BoardColumnDone'?: boolean

  // Priority/Tags
  'Microsoft.VSTS.Common.Priority'?: number
  'Microsoft.VSTS.Common.Severity'?: string
  'System.Tags'?: string | null

  // Date fields
  'System.ClosedDate'?: string
  'Microsoft.VSTS.Common.ResolvedDate'?: string
  'Microsoft.VSTS.Common.ActivatedDate'?: string
  'Microsoft.VSTS.Common.StateChangeDate'?: string

  // People fields
  'System.CreatedBy'?: AzureDevOpsPerson
  'System.ChangedBy'?: AzureDevOpsPerson
  'Microsoft.VSTS.Common.ClosedBy'?: AzureDevOpsPerson
  'Microsoft.VSTS.Common.ResolvedBy'?: AzureDevOpsPerson

  // Work tracking
  'Microsoft.VSTS.Scheduling.StoryPoints'?: number
  'Microsoft.VSTS.Scheduling.Effort'?: number
  'Microsoft.VSTS.Scheduling.RemainingWork'?: number
  'Microsoft.VSTS.Scheduling.CompletedWork'?: number
  'Microsoft.VSTS.Scheduling.OriginalEstimate'?: number

  // Content fields
  'Microsoft.VSTS.Common.AcceptanceCriteria'?: string
  'Microsoft.VSTS.TCM.ReproSteps'?: string
  'Microsoft.VSTS.TCM.SystemInfo'?: string

  // Additional fields
  'System.Rev'?: number
  'System.Reason'?: string
  'System.Watermark'?: number
  'System.CommentCount'?: number
  'System.HasAttachments'?: boolean
  'System.TeamProject'?: string
  'System.AreaId'?: number
  'System.NodeName'?: string
  'Microsoft.VSTS.Common.StackRank'?: number
  'Microsoft.VSTS.Common.ValueArea'?: string
}

export interface AzureDevOpsWorkItemRelation {
  rel: string
  url: string
  attributes?: {
    name?: string
    comment?: string
    [key: string]: unknown
  }
}

export interface AzureDevOpsWorkItemLinks {
  self?: { href: string }
  workItemUpdates?: { href: string }
  workItemRevisions?: { href: string }
  workItemComments?: { href: string }
  workItemType?: { href: string }
  fields?: { href: string }
  html?: { href: string }
  workItemHistory?: { href: string }
  [key: string]: { href: string } | undefined
}

export interface AzureDevOpsWorkItem {
  id: number
  rev: number
  fields: AzureDevOpsWorkItemFields
  relations?: AzureDevOpsWorkItemRelation[]
  url: string
  _links: AzureDevOpsWorkItemLinks
}

export interface AzureDevOpsWorkItemComment {
  id: string
  version: number
  text: string
  createdBy: AzureDevOpsPerson
  createdDate: string
  modifiedBy?: AzureDevOpsPerson
  modifiedDate?: string
  url: string
}

export interface AzureDevOpsCommentsResponse {
  count: number
  value: AzureDevOpsWorkItemComment[]
}

export interface AzureDevOpsWiqlResult {
  queryType: string
  queryResultType: string
  asOf: string
  columns: Array<{
    referenceName: string
    name: string
    url: string
  }>
  workItems: Array<{
    id: number
    url: string
  }>
}

export interface AzureDevOpsWorkItemsResponse {
  count: number
  value: AzureDevOpsWorkItem[]
}

// Exec function return type
export interface ExecResult {
  stdout: string
  stderr: string
}

// Command line resilience monitoring
export interface CircuitBreakerEvent {
  event: string
  key: string
  details?: Record<string, unknown>
}

export interface RetryAttemptInfo {
  attempt: number
  maxAttempts: number
  delay: number
  error: Error
}
