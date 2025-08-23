# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-08-23-migrate-to-azure-devops-rest-api/spec.md

> Created: 2025-08-23
> Version: 1.0.0

## Technical Requirements

### Abstracted Package Structure
- **Self-contained package**: Complete implementation in `src/packages/azure-devops-client/`
- **Own package.json**: Independent dependency management for future extraction
- **Zero coupling**: No imports from parent project, only external dependencies
- **Repository-ready**: Structured for easy extraction into separate npm package

### Performance Requirements  
- **Batch operations**: Fetch 200 work items per REST call (vs 1 per CLI call)
- **Target sync time**: 10-30 seconds for 1,056 work items (vs current 3-5 minutes)
- **Rate limit compliance**: Intelligent throttling using `X-RateLimit-Remaining` headers
- **Connection reuse**: HTTP/2 multiplexing and connection pooling

### Interface Design
- **Clean abstractions**: Provider-agnostic interfaces for work item operations
- **Pluggable architecture**: Easy swapping between different implementations
- **Type safety**: Comprehensive TypeScript definitions for all operations
- **Error handling**: Structured error responses instead of CLI text parsing

## Package Architecture

### Directory Structure
```
src/packages/azure-devops-client/
├── package.json                 # Independent package definition
├── tsconfig.json               # Package-specific TypeScript config
├── README.md                   # Package documentation
├── src/
│   ├── index.ts                # Main exports
│   ├── client.ts               # Core REST client
│   ├── types/
│   │   ├── work-items.ts       # Work item type definitions
│   │   ├── comments.ts         # Comment type definitions
│   │   └── api-responses.ts    # Raw API response types
│   ├── operations/
│   │   ├── work-items.ts       # Work item operations
│   │   ├── comments.ts         # Comment operations
│   │   └── queries.ts          # WIQL query operations
│   ├── auth/
│   │   └── pat-auth.ts         # Personal Access Token authentication
│   └── utils/
│       ├── rate-limiter.ts     # Rate limiting logic
│       ├── batch-processor.ts  # Batch operation utilities
│       └── error-handler.ts    # Error handling utilities
└── tests/                      # Package-specific tests
    ├── client.test.ts
    ├── operations/
    └── __mocks__/
```

### Core Implementation Approach

**Option A: Pure REST Client** (Selected)
- Direct fetch/axios calls with proper typing
- Batch operations using Azure DevOps batch APIs
- Built-in rate limiting and retry mechanisms
- Pros: Simple, fast, full control over requests
- Cons: Need to implement retry logic

**Option B: Azure DevOps Node.js SDK**
- Use `azure-devops-node-api` official package
- Pros: Official support, built-in features
- Cons: Heavy dependencies, slower, limited batch operations

**Rationale**: Option A provides better performance for batch operations and gives us full control over rate limiting, which is critical for this use case.

## External Dependencies

### Required Dependencies
- **axios**: HTTP client with retry and interceptor support
- **p-limit**: Concurrency control for batch operations  
- **axios-retry**: Intelligent retry with exponential backoff
- **@types/node**: Node.js type definitions

### Package.json for Abstracted Client
```json
{
  "name": "@azure-devops-client/core",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "dependencies": {
    "axios": "^1.7.0",
    "p-limit": "^6.0.0", 
    "axios-retry": "^4.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.8.3"
  }
}
```

## Integration Strategy

### Interface Adapter Pattern
```typescript
// src/services/azure-devops.ts (updated)
import { AzureDevOpsRestClient } from '../packages/azure-devops-client'

export class AzureDevOpsClient {
  private restClient: AzureDevOpsRestClient
  
  constructor() {
    this.restClient = new AzureDevOpsRestClient({
      organization: process.env.AZURE_DEVOPS_ORG,
      project: process.env.AZURE_DEVOPS_PROJECT,
      pat: process.env.AZURE_DEVOPS_PAT
    })
  }
  
  // Keep existing interface, delegate to REST client
  async fetchWorkItems(): Promise<WorkItemData[]> {
    return this.restClient.getWorkItemsBatch()
  }
}
```

### Migration Benefits
- **Performance**: 30x faster through batch operations
- **Reliability**: Eliminate subprocess overhead and circuit breaker issues  
- **Maintainability**: Clean separation of concerns
- **Reusability**: Package ready for extraction and reuse
- **Future-proofing**: Easy to swap implementations or extend functionality