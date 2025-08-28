import type { PersonData } from '../packages/azure-devops-client/src/types/person.js'

/**
 * Comprehensive work item data interface that includes all fields
 * expected by the database service. This extends the basic WorkItemData
 * with all Azure DevOps fields stored in our Prisma schema.
 */
export interface ComprehensiveWorkItemData {
  // Core fields (from WorkItemData)
  id: string | number
  title: string
  state: string
  type: string
  assignedTo?: string
  createdDate: string
  changedDate: string
  description?: string
  tags?: string[] | string

  // Sprint/Board Info
  iterationPath?: string
  areaPath?: string
  boardColumn?: string
  boardColumnDone?: boolean
  boardLane?: string

  // Priority/Tags
  priority?: number
  severity?: string

  // All the dates
  closedDate?: string
  resolvedDate?: string
  activatedDate?: string
  stateChangeDate?: string
  authorizedDate?: string
  revisedDate?: string

  // People (legacy string fields)
  createdBy?: string
  changedBy?: string
  closedBy?: string
  resolvedBy?: string
  activatedBy?: string
  authorizedAs?: string

  // Work tracking
  storyPoints?: number
  effort?: number
  remainingWork?: number
  completedWork?: number
  originalEstimate?: number

  // Content
  acceptanceCriteria?: string
  reproSteps?: string
  systemInfo?: string
  resolution?: string

  // Related items
  parentId?: number

  // Additional Azure DevOps fields
  rev?: number
  reason?: string
  watermark?: number
  url?: string
  commentCount?: number
  hasAttachments?: boolean
  teamProject?: string
  areaId?: number
  nodeId?: number
  stackRank?: number
  valueArea?: string
  risk?: string
  businessValue?: number
  timeCriticality?: number

  // Relationships (for future use)
  relationships?: Array<{
    rel: string
    url: string
    attributes?: Record<string, unknown>
  }>

  // Custom fields as JSON
  customFields?: string

  // Raw data for future-proofing
  raw?: Record<string, unknown>
  rawJson?: string
}

/**
 * Extended work item data with Person objects
 * Combines all comprehensive fields with Person relationships
 */
export interface ComprehensiveWorkItemDataWithPersons extends ComprehensiveWorkItemData {
  // Person object fields
  assignedToPerson?: PersonData | null
  createdByPerson?: PersonData | null
  changedByPerson?: PersonData | null
  closedByPerson?: PersonData | null
  resolvedByPerson?: PersonData | null
  activatedByPerson?: PersonData | null
  authorizedAsPerson?: PersonData | null
}

/**
 * Type guard to check if data has Person fields
 */
export function hasPersonData(
  item: ComprehensiveWorkItemData | ComprehensiveWorkItemDataWithPersons
): item is ComprehensiveWorkItemDataWithPersons {
  return 'assignedToPerson' in item
}