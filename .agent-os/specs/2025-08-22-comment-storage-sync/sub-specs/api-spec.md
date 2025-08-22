# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-08-22-comment-storage-sync/spec.md

> Created: 2025-08-22
> Version: 1.0.0

## Azure DevOps CLI Integration

### Comment Fetching Command

**Command:** `az boards work-item relation list-url --id {workItemId} --output json`
**Purpose:** Retrieve all comments for a specific work item
**Parameters:** Work item ID (number)
**Response:** JSON array of comment objects
**Errors:** Authentication failures, work item not found, rate limiting

### Alternative REST API Approach

**Command:** `az rest --method GET --uri "https://dev.azure.com/{org}/{project}/_apis/wit/workItems/{id}/comments?api-version=7.0"`
**Purpose:** Direct REST API access for comment fetching if CLI relation command is insufficient
**Parameters:** Organization, project, work item ID
**Response:** Azure DevOps comments API response format
**Errors:** Authentication, authorization, rate limiting, malformed requests

## Database Operations

### Comment Upsert Logic

**Operation:** Insert or update comments in WorkItemComment table
**Input:** Array of comment data from Azure DevOps
**Process:**

1. Check if comment ID already exists
2. Compare modification dates for existing comments
3. Insert new comments or update modified ones
4. Maintain referential integrity with WorkItem parent

### Comment Retrieval

**Operation:** Fetch comments for work items through database queries
**Queries:**

- All comments for specific work item: `WHERE workItemId = ?`
- Recent comments across all work items: `ORDER BY createdDate DESC LIMIT ?`
- Comments by author: `WHERE createdBy = ?`

## MCP Tool Enhancements

### Enhanced wit_get_work_item Tool

**Purpose:** Include comment data when retrieving single work item
**Response Enhancement:** Add `comments` array to work item JSON response
**Format:**

```json
{
  "id": 12345,
  "title": "Work item title",
  "comments": [
    {
      "id": "comment-uuid",
      "text": "Comment content",
      "createdBy": "user@domain.com",
      "createdDate": "2025-08-22T10:30:00Z",
      "modifiedDate": null
    }
  ]
}
```

### New wit_list_work_item_comments Tool

**Purpose:** Retrieve comments for specific work item
**Parameters:**

- `workItemId` (required): Work item ID
- `limit` (optional): Maximum number of comments to return
- `since` (optional): Only return comments after this date

**Response:** Array of comment objects with full metadata
**Error Handling:** Work item not found, invalid parameters

## Performance Considerations

### Batch Comment Processing

- Process comments for multiple work items in parallel where possible
- Limit concurrent Azure CLI commands to respect rate limiting
- Use database transactions for atomic comment updates

### Query Optimization

- Index WorkItemComment table on workItemId for fast retrieval
- Consider adding indexes on createdDate for chronological queries
- Limit comment text length in database to prevent excessive memory usage
