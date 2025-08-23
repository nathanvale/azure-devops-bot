# Tests Specification

This is the tests coverage details for the spec detailed in @.agent-os/specs/2025-08-23-fix-mcp-server-sync-blocking/spec.md

> Created: 2025-08-23
> Version: 1.0.0

## Test Coverage

### Unit Tests

**SyncService**
- Test `shouldPerformInitialSync()` logic with various data ages
- Test background sync starts without blocking
- Test graceful handling of sync failures

**AzureDevOpsMCPServer**
- Test server startup time under 5 seconds
- Test MCP tool responses work immediately after startup
- Test server continues responding during background sync

### Integration Tests

**MCP Server Startup Flow**
- Server starts and responds to `tools/list` within 5 seconds
- Server returns work items data from cache immediately
- Background sync runs independently without affecting MCP responses

**Data Freshness Logic**
- Fresh data (< 1 hour): Skip initial detailed sync
- Stale data (> 1 hour): Perform initial sync but don't block MCP
- Empty database: Perform initial sync but don't block MCP

### Mocking Requirements

- **Azure CLI responses**: Mock `az boards` commands to simulate sync failures
- **Time-based testing**: Mock `Date.now()` to test data freshness logic
- **MCP protocol**: Mock stdio communication for testing non-blocking behavior