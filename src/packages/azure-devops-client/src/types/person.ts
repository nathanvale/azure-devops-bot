/**
 * Person data structure representing Azure DevOps identity information
 * This interface captures ALL person fields from Azure DevOps per DEC-003
 */
export interface PersonData {
  // Primary identifier
  id: string // Azure DevOps unique person ID
  
  // Core identity fields
  displayName: string // "Nathan Vale"
  uniqueName: string // "Nathan.Vale@fwc.gov.au" (email)
  
  // Additional Azure DevOps fields
  url?: string // API URL for this person
  imageUrl?: string // Avatar/profile image URL
  descriptor?: string // Security descriptor
  inactive?: boolean // Account status
}

/**
 * Extended WorkItemData with Person objects instead of strings
 * Supports gradual migration from string-based to Person-based fields
 */
export interface WorkItemDataWithPersons {
  id: string | number
  title: string
  state: string
  type: string
  
  // Legacy string fields (for backward compatibility)
  assignedTo?: string
  createdBy?: string
  changedBy?: string
  closedBy?: string
  resolvedBy?: string
  activatedBy?: string
  authorizedAs?: string
  
  // New Person object fields
  assignedToPerson?: PersonData | null
  createdByPerson?: PersonData | null
  changedByPerson?: PersonData | null
  closedByPerson?: PersonData | null
  resolvedByPerson?: PersonData | null
  activatedByPerson?: PersonData | null
  authorizedAsPerson?: PersonData | null
  
  // Date fields
  createdDate: string
  changedDate: string
  closedDate?: string
  resolvedDate?: string
  activatedDate?: string
  authorizedDate?: string
  
  // Other fields
  description?: string
  tags?: string[]
  
  // Raw data for future-proofing (per DEC-003)
  raw: Record<string, unknown>
}