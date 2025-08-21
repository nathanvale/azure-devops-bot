# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-08-22-full-data-sync/spec.md

> Created: 2025-08-22
> Version: 1.0.0

## Azure CLI Integration Changes

### Current Implementation

**Command**: `az boards work-item list --organization https://dev.azure.com/fwcdev --project "Customer Services Platform"`
**Output**: Basic work item fields in JSON array format
**Limitations**: Missing comprehensive metadata, iteration paths, effort data, board columns

### New Implementation

**Primary Command**: `az boards work-item show --id {id} --expand all --organization https://dev.azure.com/fwcdev --project "Customer Services Platform"`
**Output**: Complete work item with all fields, relationships, and metadata
**Benefits**: 100% field coverage, access to custom fields, board state, iteration details

## Service Layer Changes

### Modified Methods in `azure-devops.ts`

#### `fetchWorkItemsDetailed(workItemIds: number[]): Promise<WorkItem[]>`

**Purpose**: Replace current basic fetching with comprehensive individual work item fetches
**Parameters**: Array of work item IDs to fetch with full details
**Response**: Array of complete WorkItem objects with all fields populated
**Concurrency**: Configurable parallel processing (default 5 concurrent)
**Resilience**: Wrapped with resilience adapter using detail policy (5 retries, 15s timeout, circuit breaker)
**Error Handling**: Individual item failure doesn't block others, resilience patterns handle transient failures

#### `fetchSingleWorkItem(id: number): Promise<WorkItem | null>`

**Purpose**: Fetch single work item with complete metadata
**Parameters**: Work item ID
**Response**: Complete WorkItem object or null if not found/error
**Resilience**: Wrapped with resilience adapter using detail policy
**Errors**: Returns null on RetryExhaustedError, CircuitBreakerOpenError, or permanent failures

## Data Processing Pipeline

### Step 1: Work Item ID Collection
- Continue using current `az boards work-item list` for ID discovery
- Wrapped with resilience adapter using list policy (3 retries, 10s timeout)
- Extract IDs for detailed fetching

### Step 2: Parallel Detailed Fetching  
- Process IDs in batches with configurable concurrency
- Each `az boards work-item show --expand all` wrapped with resilience adapter
- Resilience patterns handle Azure CLI failures, timeouts, and Azure DevOps outages
- Circuit breaker prevents cascading failures during service degradation
- Individual failures logged but don't block other fetches

### Step 3: Data Transformation
- Parse complete JSON response from Azure CLI
- Map all available fields to database schema
- Store raw JSON response in `rawJson` field
- Populate all structured fields with parsed data

### Step 4: Database Storage
- Update existing records or insert new ones
- Maintain referential integrity
- Update sync timestamps

## Error Handling with Resilience

### Circuit Breaker States
- **Closed**: Normal operation, requests pass through
- **Open**: Fast failure during Azure DevOps outages, requests fail immediately
- **Half-Open**: Single probe request to test service recovery

### Error Classification
- **Retryable**: Network timeouts, temporary CLI failures, rate limiting
- **Non-Retryable**: Authentication errors, work item not found, malformed responses
- **Circuit Breaking**: Sustained failure patterns that indicate service degradation