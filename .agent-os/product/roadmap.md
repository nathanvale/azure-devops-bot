# Product Roadmap

> Last Updated: 2025-08-28
> Version: 2.0.0
> Status: Operational Excellence Phase
> Current Phase: Phase 2 (0% Complete)

## Phase 0: Already Completed ✅

The following foundational features have been implemented:

- [x] **Basic MCP Server** - Model Context Protocol server with stdio transport
- [x] **Azure DevOps Integration** - Basic work item fetching via REST API
- [x] **SQLite Database** - Local storage with Prisma ORM
- [x] **Work Item Storage** - Core work item fields (title, state, type, assignedTo)
- [x] **Background Sync** - Configurable sync interval (default 5 minutes)
- [x] **Authentication** - PAT (Personal Access Token) integration
- [x] **Basic Query Tools** - get_work_items, query_work, sync_data, get_work_item_url
- [x] **Email Validation** - User email validation against Azure DevOps
- [x] **Test Infrastructure** - Vitest setup with MSW mocking

## Phase 1: Always-On Data Mirror ✅ **COMPLETED**

**Goal**: Transform into a comprehensive, always-available data mirror
**Success Criteria**: Complete work item metadata sync with guaranteed uptime
**Duration**: 2-3 days
**Completion**: 100% - All must-have features + early deliveries from Phase 3

### Must-Have Features

- [x] **Comprehensive Schema** - Expanded database to capture ALL Azure DevOps fields
- [x] **Full Data Sync** - Use REST API with comprehensive field expansion for complete metadata
- [x] **Comment Storage** - Sync all work item comments to separate table `MEDIUM`
- [x] **Always-On Service** - PM2 process management for 24/7 availability `HIGH` ✅ **COMPLETED**
- [x] **Simplified MCP Tools** - Reduce to essential tools `MEDIUM` ✅ **COMPLETED**
  - [x] **wit_force_sync_work_items**: Retrieve a list of work items relevant to the authenticated user.
  - [x] **wit_my_work_items**: Retrieve a list of work items relevant to the authenticated user.
  - [x] **wit_get_work_item**: Get a single work item by ID.
  - [x] **wit_get_work_items_batch_by_ids**: Retrieve a list of work items by IDs in batch.
  - [x] **wit_list_work_item_comments**: Retrieve a list of comments for a work item by ID.
  - [x] **wit_get_work_items_for_iteration**: Retrieve a list of work items for a specified iteration.
  - [x] **wit_add_work_item_comment**: Add a comment to a work item by ID. ✅ **NEWLY COMPLETED**
  - [x] **wit_link_work_item_to_pull_request**: Link a single work item to an existing pull request. ✅ **NEWLY COMPLETED**

### Should-Have Features

- [x] **Raw JSON Backup** - Store complete Azure DevOps response for data completeness `LOW` ✅ **COMPLETED**
- [x] **Batch Processing** - Parallel work item fetching for faster sync `MEDIUM` ✅ **COMPLETED**
- [ ] **Error Recovery** - Robust handling of REST API failures `MEDIUM` ⚠️ **PARTIAL**

### Early Deliveries from Phase 3

- [x] **Person Normalization** - Complete identity management with foreign keys (DEC-009)
- [x] **Work Item Relations** - Parent/child and related item relationships
- [x] **External Links** - Pull request, commit, and artifact references

### Dependencies

- Azure DevOps Personal Access Token (PAT) must be configured
- PM2 must be installed globally for process management

## Phase 2: MCP Server Implementation - Microsoft Patterns (PRIORITY) 🚀

**Goal**: Implement MCP server using Microsoft's namespace patterns with domain-organized, schema-validated tools
**Success Criteria**:

- Implement 25+ granular, namespaced tools following Microsoft patterns
- Full Zod schema validation across all domains
- Microsoft pattern compliance with sub-100ms performance
- Clean, production-ready implementation
  **Duration**: 5 days of focused implementation
  **Current Completion**: 0% (IMMEDIATE PRIORITY - Direct implementation)

### Must-Have Features (Clean Implementation)

- [ ] **Domain-Based Tool Organization** - Microsoft's namespace pattern `HIGH`
  - Cache domain (cache\_\*): Local SQLite queries
  - Sync domain (sync\_\*): Data synchronization control
  - Admin domain (admin\_\*): Health and system management

- [ ] **Granular Tool Design** - Focused, single-purpose tools `HIGH`
  - 25+ focused tools with clear responsibilities
  - Verb-object naming (cache_get_work_item, sync_trigger_delta)
  - Thin abstraction over data/API operations

- [ ] **Zod Schema Validation** - Runtime type safety `HIGH`
  - Input validation for all tool parameters
  - Output schemas for consistent responses
  - Custom validators for Azure DevOps types
  - Error schemas with isError pattern

### Service Level Indicators (SLIs)

1. **Sync Reliability**
   - Target: 99.9% successful sync cycles
   - Measurement: Full sync success rate
   - Alert Threshold: >3 consecutive failures

2. **Data Freshness**
   - Target: <5 minute staleness window
   - Measurement: Maximum delta between Azure DevOps and local mirror
   - Alert Threshold: >10 minute drift

3. **Performance**
   - Target: Sub-100ms query response times
   - Measurement: P95 query latency
   - Alert Threshold: >150ms sustained

### Immediate Implementation Plan (5-Day Direct Implementation)

#### Day 1: Foundation & Schema Setup

- [ ] Install Zod and configure TypeScript integration
- [ ] Create domain registry system with namespace support
- [ ] Implement Zod schemas for WorkItem, Person, Comments, Sync types
- [ ] Set up MCP tool registration framework

#### Day 2-3: Cache Domain Implementation

- [ ] Implement cache_get_work_item with Zod validation
- [ ] Implement cache_list_work_items with filters
- [ ] Implement cache_get_work_item_relations
- [ ] Implement cache_list_iteration_work_items
- [ ] Add cache_get_sync_summary for status

#### Day 4: Sync Domain Implementation

- [ ] Implement sync_trigger_full for complete sync
- [ ] Implement sync_trigger_delta for incremental sync
- [ ] Implement sync_get_status for monitoring
- [ ] Add sync_cancel for operation control

#### Day 5: Admin Domain & Testing

- [ ] Implement admin_health_check for system status
- [ ] Implement admin_get_metrics for performance data
- [ ] Write integration tests for all domains
- [ ] Performance testing to ensure sub-100ms maintained
- [ ] Documentation for new tool structure

### Critical Success Metrics

| Metric                  | Current Baseline | Target              | Measurement Method    |
| ----------------------- | ---------------- | ------------------- | --------------------- |
| Tool Count              | 8 mixed tools    | 25+ granular tools  | Tool registry count   |
| Schema Coverage         | 0%               | 100% Zod validation | Schema implementation |
| P95 Query Latency       | <100ms           | <100ms (maintained) | Performance tests     |
| Tool Selection Accuracy | ~60% (est.)      | >90%                | AI agent success rate |
| Validation Overhead     | 0ms              | <5ms per call       | Performance profiling |
| Implementation Time     | N/A              | 5 days              | Project timeline      |

### Dependencies

- Existing comprehensive data model
- Current batch processing capabilities
- Existing error aggregation infrastructure

## Phase 3: Enhanced Integration (Partially Delivered)

**Goal**: Advanced features for power users and team collaboration
**Current Completion**: 40% (Relations and links delivered early)

### Advanced Features

- [x] **Work Item Relations** - Parent/child work item relationships ✅ **DELIVERED EARLY IN PHASE 1**
- [x] **External Links** - Pull request, commit, and artifact linkage ✅ **DELIVERED EARLY IN PHASE 1**
- [x] **Person Normalization** - Complete identity management ✅ **DELIVERED EARLY IN PHASE 1**
- [ ] **State History** - Track work item state transitions over time
- [ ] **Attachment Content** - Sync and serve work item attachment contents
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

### Current Focus (Phase 2 - MCP Server Architecture Uplift)

1. **Domain Organization**: Implement Microsoft's namespace pattern with 5 distinct domains
2. **Always-On Architecture**: Setup PM2 for guaranteed availability
3. **Simplified Interface**: Reduce MCP tools to essential data access only

### Quality Gates

- All new features must have basic test coverage
- Database migrations must be reversible
- MCP tools must return valid JSON
- Process must restart cleanly after crash

### Success Metrics

- **Sync Speed**: Complete project sync in under 30 seconds
- **Query Speed**: Work item queries under 100ms
- **Uptime**: 99.9% availability with automatic restart
- **Data Completeness**: 100% of Azure DevOps fields captured

## Risk Assessment & Mitigation

### Critical Risks (Immediate Action Required)

- **No Delta Sync**: Database will not scale beyond ~1000 items
  - Mitigation: Implement Day 2 (watermark-based sync)
  - Impact: Sync times grow linearly with item count
- **No Retry/Backoff**: Single failures break entire sync
  - Mitigation: Implement Day 3 (resilience policies)
  - Impact: Data staleness during transient failures
- **No Health Monitoring**: Silent failures go undetected
  - Mitigation: Implement Day 4 (health status tool)
  - Impact: Users discover issues only when data is stale

### Medium Risk

- **Data Integrity**: Potential partial sync failures
  - Mitigation: Comprehensive logging, health checks
- **Performance Degradation**: Sync times or query latency increases
  - Mitigation: Continuous performance monitoring

### Low Risk

- **Disk Space**: SQLite database growth
  - Mitigation: Implement periodic cleanup strategies
- **Attachment Storage**: Large binary content management
  - Mitigation: Selective sync, content size limits
