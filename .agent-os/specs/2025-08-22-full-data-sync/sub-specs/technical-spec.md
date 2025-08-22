# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-08-22-full-data-sync/spec.md

> Created: 2025-08-22
> Version: 1.0.0

## Technical Requirements

- Replace `az boards work-item list` with `az boards work-item show --expand all` for individual work item fetching
- Extend Prisma schema to include missing critical fields (iteration path, effort, board column, all date fields)
- Add rawJson TEXT field to store complete Azure DevOps response
- Implement parallel processing with configurable concurrency limit (default 5 concurrent requests)
- Add retry logic for individual work item fetch failures
- Maintain backward compatibility with existing MCP tools during transition

## Approach Options

**Option A: Sequential Individual Fetches**

- Pros: Simple implementation, easy error handling per item
- Cons: Very slow for large datasets, high Azure CLI overhead

**Option B: Parallel Individual Fetches with Concurrency Control** (Selected)

- Pros: Significant performance improvement, controllable load, detailed error handling
- Cons: More complex implementation, need to manage concurrent Azure CLI processes

**Option C: Batch API with Custom WIQL**

- Pros: Fastest possible approach, single API call
- Cons: Complex WIQL construction, limited to specific fields, doesn't provide --expand all benefits

**Rationale:** Option B provides the best balance of performance improvement while maintaining the comprehensive field coverage that --expand all provides. Concurrency control prevents overwhelming Azure DevOps rate limits.

## External Dependencies

- **@orchestr8/resilience** - Production-ready resilience patterns for retry, circuit breaker, and timeout
  - Linked via npm global link from `/Users/nathanvale/code/@orchestr8/packages/resilience`
  - Provides exponential backoff retry with jitter for transient Azure CLI failures
  - Circuit breaker protection during Azure DevOps outages
  - Configurable timeouts for hanging CLI commands
- **Azure CLI version compatibility** - Requires az boards work-item show --expand support (available in recent versions)

## Resilience Configuration

### Azure CLI Operation Policies

**Work Item List Operations** (discovery phase)

```typescript
const listPolicy: ResiliencePolicy = {
  retry: {
    maxAttempts: 3,
    initialDelay: 500,
    maxDelay: 2000,
    backoffStrategy: 'exponential',
    jitterStrategy: 'full',
  },
  timeout: {
    duration: 10000, // 10 seconds
    operationName: 'work-item-list',
  },
  circuitBreaker: {
    key: 'azure-devops-list',
    failureThreshold: 3,
    recoveryTime: 30000,
    sampleSize: 5,
  },
}
```

**Individual Work Item Fetches** (detailed data)

```typescript
const detailPolicy: ResiliencePolicy = {
  retry: {
    maxAttempts: 5,
    initialDelay: 200,
    maxDelay: 5000,
    backoffStrategy: 'exponential',
    jitterStrategy: 'full',
    retryOn: (error) => {
      // Don't retry on authentication or not found errors
      return (
        !error.message.includes('unauthorized') &&
        !error.message.includes('not found')
      )
    },
  },
  timeout: {
    duration: 15000, // 15 seconds for expanded data
    operationName: 'work-item-detail',
  },
  circuitBreaker: {
    key: 'azure-devops-detail',
    failureThreshold: 5,
    recoveryTime: 45000,
    sampleSize: 10,
  },
}
```
