# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-08-22-azure-devops-write-methods/spec.md

> Created: 2025-08-22
> Version: 1.0.0

## Technical Requirements

- Both methods must use Azure CLI REST API calls for maximum compatibility
- Error handling must include authentication, network, and API-specific errors
- Methods must follow existing resilience patterns (retry, circuit breaker, timeout)
- TypeScript strict mode compliance with proper type definitions
- Integration with existing sync mechanisms for data consistency
- Response validation to ensure operations completed successfully

## Method Specifications

### addWorkItemComment

**Purpose**: Add a comment to an existing work item using Azure CLI
**Signature**: `async addWorkItemComment(workItemId: number, comment: string): Promise<void>`

**Azure CLI Command**:

```bash
az rest --method POST \
  --uri "https://dev.azure.com/{organization}/{project}/_apis/wit/workItems/{id}/comments?api-version=7.0" \
  --body '{"text": "comment text"}' \
  --headers "Content-Type=application/json"
```

**Implementation Details**:

- Use existing resilience policy pattern from `fetchWorkItemComments`
- Validate comment text is not empty
- Handle Azure CLI authentication errors with helpful messages
- Log operation for debugging

### linkWorkItemToPullRequest

**Purpose**: Create a hyperlink between work item and pull request
**Signature**: `async linkWorkItemToPullRequest(workItemId: number, pullRequestUrl: string): Promise<void>`

**Azure CLI Command**:

```bash
az rest --method PATCH \
  --uri "https://dev.azure.com/{organization}/{project}/_apis/wit/workItems/{id}?api-version=7.0" \
  --body '[{
    "op": "add",
    "path": "/relations/-",
    "value": {
      "rel": "Hyperlink",
      "url": "pull_request_url",
      "attributes": {
        "comment": "Pull Request"
      }
    }
  }]' \
  --headers "Content-Type=application/json-patch+json"
```

**Implementation Details**:

- Validate pull request URL format
- Use JSON patch format for Azure DevOps API
- Handle relation conflicts gracefully
- Use same resilience patterns as other methods

## Error Handling Strategy

### Authentication Errors

- Detect "not authenticated" responses from Azure CLI
- Return structured error with guidance to run `az login`
- Log authentication failures for debugging

### Network/API Errors

- Apply existing resilience policy (retry, circuit breaker)
- Handle rate limiting with exponential backoff
- Capture and log Azure CLI stderr output

### Validation Errors

- Empty comment text: throw descriptive error
- Invalid pull request URL: validate format and throw error
- Work item not found: propagate Azure CLI error message

## External Dependencies

Uses existing infrastructure:

- **Azure CLI**: Already required and configured
- **Resilience Policy**: Reuse existing patterns from other methods
- **Logging**: Use existing console logging approach
- **TypeScript**: Current compilation setup

## Integration Points

### MCP Server Integration

- Both methods already called by existing MCP tools
- No changes needed to MCP server handlers
- Methods will be automatically available once implemented

### Sync Service Integration

- Comment additions trigger automatic sync in MCP tools
- No additional sync logic needed in these methods
- Rely on existing sync mechanisms for data consistency
