# Package Interfaces Specification

This defines the clean interfaces for the abstracted Azure DevOps REST API package detailed in @.agent-os/specs/2025-08-23-migrate-to-azure-devops-rest-api/spec.md

> Created: 2025-08-23
> Version: 1.0.0

## Core Interface Design

### Main Client Interface

```typescript
export interface IAzureDevOpsClient {
  // Work Item Operations
  getWorkItemsBatch(ids?: number[], options?: BatchOptions): Promise<WorkItem[]>
  getWorkItem(id: number, expand?: WorkItemExpand): Promise<WorkItem>
  queryWorkItems(wiql: string): Promise<WorkItemQueryResult>

  // Comment Operations
  getWorkItemComments(workItemId: number): Promise<WorkItemComment[]>
  addWorkItemComment(workItemId: number, text: string): Promise<WorkItemComment>

  // Batch Operations
  batchGetWorkItems(ids: number[]): Promise<WorkItem[]>
  batchGetComments(
    workItemIds: number[],
  ): Promise<Map<number, WorkItemComment[]>>
}
```

### Configuration Interface

```typescript
export interface AzureDevOpsClientConfig {
  organization: string
  project: string
  pat: string
  apiVersion?: string
  baseUrl?: string
  rateLimit?: RateLimitConfig
  retry?: RetryConfig
}

export interface RateLimitConfig {
  maxConcurrent: number
  requestsPerSecond: number
  respectHeaders: boolean
}

export interface RetryConfig {
  maxAttempts: number
  baseDelay: number
  maxDelay: number
  backoffFactor: number
}
```

### Work Item Type Definitions

```typescript
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
  'System.Description'?: string
  // ... all other Azure DevOps fields
}

export interface WorkItemComment {
  id: string
  workItemId: number
  text: string
  createdBy: AzureDevOpsPerson
  createdDate: string
  modifiedBy?: AzureDevOpsPerson
  modifiedDate?: string
}
```

### Operation Result Types

```typescript
export interface WorkItemQueryResult {
  queryType: 'flat' | 'tree' | 'oneHop'
  queryResultType: 'workItem' | 'workItemLink'
  asOf: string
  columns: WorkItemFieldReference[]
  sortColumns: WorkItemQuerySortColumn[]
  workItems: WorkItemReference[]
}

export interface BatchOptions {
  expand?: WorkItemExpand
  asOf?: string
  fields?: string[]
  errorPolicy?: 'omit' | 'fail'
}

export type WorkItemExpand = 'all' | 'fields' | 'links' | 'relations'
```

## Provider Abstraction Layer

### Generic Work Item Provider Interface

```typescript
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
```

### Azure DevOps Provider Implementation

```typescript
export class AzureDevOpsProvider implements IWorkItemProvider {
  private client: IAzureDevOpsClient

  constructor(config: AzureDevOpsClientConfig) {
    this.client = new AzureDevOpsRestClient(config)
  }

  async fetchWorkItems(query?: WorkItemQuery): Promise<WorkItemData[]> {
    // Convert generic query to WIQL
    // Use batch operations for performance
    // Transform Azure DevOps format to generic format
  }

  getProviderInfo(): ProviderInfo {
    return {
      name: 'Azure DevOps',
      version: '1.0.0',
      supports: {
        batchOperations: true,
        realTimeUpdates: false,
        customFields: true,
      },
    }
  }
}
```

## Package Export Structure

### Main Package Exports

```typescript
// src/packages/azure-devops-client/src/index.ts
export { AzureDevOpsRestClient } from './client'
export { AzureDevOpsProvider } from './provider'

// Types
export type * from './types/work-items'
export type * from './types/comments'
export type * from './types/api-responses'

// Interfaces
export type { IAzureDevOpsClient } from './interfaces/client'
export type { IWorkItemProvider } from './interfaces/provider'

// Configuration
export type {
  AzureDevOpsClientConfig,
  RateLimitConfig,
  RetryConfig,
} from './types/config'

// Utilities (if needed externally)
export { createBatchProcessor } from './utils/batch-processor'
export { RateLimiter } from './utils/rate-limiter'
```

### Clean Integration Pattern

```typescript
// In main project: src/services/azure-devops.ts
import {
  AzureDevOpsProvider,
  type IWorkItemProvider,
  type AzureDevOpsClientConfig,
} from '../packages/azure-devops-client'

export class AzureDevOpsClient {
  private provider: IWorkItemProvider

  constructor() {
    const config: AzureDevOpsClientConfig = {
      organization: process.env.AZURE_DEVOPS_ORG!,
      project: process.env.AZURE_DEVOPS_PROJECT!,
      pat: process.env.AZURE_DEVOPS_PAT!,
    }

    this.provider = new AzureDevOpsProvider(config)
  }

  // Existing interface remains unchanged
  async fetchWorkItems(): Promise<WorkItemData[]> {
    return this.provider.fetchWorkItems()
  }
}
```

## Future Extensibility

### Pluggable Architecture Benefits

1. **Easy Provider Swapping**: Replace Azure DevOps with Jira, GitHub Issues, etc.
2. **A/B Testing**: Compare different implementations
3. **Multi-Provider Support**: Aggregate data from multiple sources
4. **Mock Implementations**: Easy testing with fake providers

### Package Extraction Readiness

1. **Zero Dependencies**: No imports from parent project
2. **Complete Documentation**: README, API docs, examples
3. **Independent Testing**: Full test suite within package
4. **Semantic Versioning**: Ready for independent releases
