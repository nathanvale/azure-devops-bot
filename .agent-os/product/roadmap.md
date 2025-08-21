# Product Roadmap

> Last Updated: 2025-08-21
> Version: 1.0.0
> Status: Active Development

## Phase 0: Already Completed ✅

The following foundational features have been implemented:

- [x] **Basic MCP Server** - Model Context Protocol server with stdio transport
- [x] **Azure DevOps Integration** - Basic work item fetching via Azure CLI
- [x] **SQLite Database** - Local storage with Prisma ORM
- [x] **Work Item Storage** - Core work item fields (title, state, type, assignedTo)
- [x] **Background Sync** - Configurable sync interval (default 5 minutes)
- [x] **Authentication** - Azure CLI SSO integration
- [x] **Basic Query Tools** - get_work_items, query_work, sync_data, get_work_item_url
- [x] **Email Validation** - User email validation against Azure DevOps
- [x] **Test Infrastructure** - Vitest setup with MSW mocking

## Phase 1: Always-On Data Mirror (Current Sprint) 🚧

**Goal**: Transform into a comprehensive, always-available data mirror
**Success Criteria**: Complete work item metadata sync with guaranteed uptime
**Duration**: 2-3 days

### Must-Have Features

- [ ] **Comprehensive Schema** - Expanded database to capture ALL Azure DevOps fields ``IN PROGRESS``
- [ ] **Full Data Sync** - Use `az boards work-item show --expand all` for complete metadata `IN PROGRESS`
- [ ] **Comment Storage** - Sync all work item comments to separate table `MEDIUM`
- [ ] **Always-On Service** - PM2 process management for 24/7 availability `HIGH`
- [ ] **Simplified MCP Tools** - Reduce to 2 essential tools (get_work_items, force_sync) `MEDIUM`

### Should-Have Features

- [ ] **Raw JSON Backup** - Store complete Azure DevOps response for data completeness `LOW`
- [ ] **Batch Processing** - Parallel work item fetching for faster sync `MEDIUM`
- [ ] **Error Recovery** - Robust handling of Azure CLI failures `MEDIUM`

### Dependencies

- Azure CLI must be installed and authenticated
- PM2 must be installed globally for process management

## Phase 2: Production Hardening (Next Sprint)

**Goal**: Bulletproof reliability and performance optimization
**Success Criteria**: Zero downtime, sub-100ms queries, comprehensive error handling

### Must-Have Features

- [ ] **Performance Optimization** - Database indexing for instant queries
- [ ] **Crash Recovery** - Automatic restart and data integrity checks
- [ ] **Monitoring** - Health checks and sync status reporting
- [ ] **Resource Management** - Memory usage optimization and cleanup

### Should-Have Features

- [ ] **Incremental Sync** - Delta sync based on ChangedDate for efficiency
- [ ] **Data Validation** - Ensure data integrity across sync cycles
- [ ] **Logging** - Structured logging for troubleshooting
- [ ] **Metrics** - Sync timing and success rate tracking

## Phase 3: Enhanced Integration (Future)

**Goal**: Advanced features for power users and team collaboration

### Advanced Features

- [ ] **Work Item Relations** - Parent/child work item relationships
- [ ] **State History** - Track work item state transitions over time
- [ ] **Attachment Support** - Sync and serve work item attachments
- [ ] **Custom Fields** - Support for organization-specific custom fields

### Team Features

- [ ] **Multi-Project Support** - Handle multiple Azure DevOps projects
- [ ] **Team Filtering** - Filter work items by team area paths
- [ ] **Bulk Operations** - Mass updates via MCP tools
- [ ] **Webhook Integration** - Real-time sync via Azure DevOps webhooks

## Phase 4: Enterprise Features (Someday)

### Scalability

- [ ] **Multi-Organization** - Support multiple Azure DevOps organizations
- [ ] **Distributed Sync** - Scale across multiple machines
- [ ] **API Gateway** - REST API for non-MCP clients
- [ ] **Cloud Backup** - Optional cloud storage for data redundancy

### Security

- [ ] **Fine-grained Permissions** - Respect Azure DevOps security model
- [ ] **Audit Logging** - Track all data access and modifications
- [ ] **Data Encryption** - Encrypt local database storage

## Implementation Strategy

### Current Focus (Phase 1)

1. **Comprehensive Data Fetching**: Replace current limited field sync with full metadata
2. **Always-On Architecture**: Setup PM2 for guaranteed availability
3. **Simplified Interface**: Reduce MCP tools to essential data access only

### Quality Gates

- All new features must have basic test coverage
- Database migrations must be reversible
- MCP tools must return valid JSON
- Process must restart cleanly after crash

### Success Metrics

- **Sync Speed**: Complete project sync in under 5 minutes
- **Query Speed**: Work item queries under 100ms
- **Uptime**: 99.9% availability with automatic restart
- **Data Completeness**: 100% of Azure DevOps fields captured

## Risk Assessment

### High Risk

- **Azure CLI Changes**: Microsoft could change CLI output format
- **Rate Limiting**: Aggressive syncing could hit Azure DevOps limits

### Medium Risk

- **Data Corruption**: SQLite corruption during crash scenarios
- **Memory Leaks**: Long-running process accumulating memory

### Low Risk

- **Disk Space**: SQLite growth over time
- **macOS Updates**: LaunchAgent compatibility