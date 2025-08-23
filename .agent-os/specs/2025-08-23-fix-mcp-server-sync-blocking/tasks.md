# Spec Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/2025-08-23-fix-mcp-server-sync-blocking/spec.md

> Created: 2025-08-23
> Status: Ready for Implementation

## Tasks

- [ ] 1. Add conditional initial sync logic to SyncService
  - [ ] 1.1 Write tests for shouldPerformInitialSync method
  - [ ] 1.2 Add shouldPerformInitialSync method with 1-hour freshness check
  - [ ] 1.3 Add data age calculation based on lastSyncedAt timestamps
  - [ ] 1.4 Verify all tests pass

- [ ] 2. Modify MCP server startup flow to use conditional sync
  - [ ] 2.1 Write tests for non-blocking startup behavior
  - [ ] 2.2 Replace shouldSync() check with shouldPerformInitialSync() in mcp-server.ts
  - [ ] 2.3 Ensure MCP server starts immediately regardless of sync decision
  - [ ] 2.4 Verify server responds to MCP tools within 5 seconds

- [ ] 3. Add background sync error handling
  - [ ] 3.1 Write tests for graceful sync failure handling
  - [ ] 3.2 Wrap performSyncDetailed in try-catch to prevent server crashes
  - [ ] 3.3 Add logging for sync failures without blocking MCP responses
  - [ ] 3.4 Verify server continues serving cached data during sync failures

- [ ] 4. Test complete integration and performance
  - [ ] 4.1 Test server startup time with existing database
  - [ ] 4.2 Test MCP tool response times remain under 100ms
  - [ ] 4.3 Test background sync continues working independently
  - [ ] 4.4 Verify all existing MCP tools work correctly with cached data