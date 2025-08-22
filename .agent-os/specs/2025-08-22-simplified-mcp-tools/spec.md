# Spec Requirements Document

> Spec: Simplified MCP Tools
> Created: 2025-08-22
> Status: Planning

## Overview

Replace the current complex MCP tools with 8 essential tools that provide direct access to work item data and operations. This simplification removes unnecessary complexity while maintaining full functionality for AI agent consumption.

## User Stories

### Direct Data Access

As a Claude Code user, I want to retrieve work items using simple, predictable MCP tools, so that I can generate reports and analyze data without dealing with complex query interfaces or semantic search limitations.

**Workflow**: User asks Claude Code for work item information → Claude Code calls appropriate MCP tool → Local SQLite database returns structured JSON → User receives formatted response with complete data.

### Batch Operations

As a development team lead, I want to fetch multiple work items efficiently, so that I can generate comprehensive sprint reports without making dozens of individual API calls.

**Workflow**: User requests report on multiple work items → Claude Code uses batch tools to fetch data in parallel → Complete work item data returned in single response → Report generated with all necessary details.

### Work Item Management

As a developer, I want to add comments and link work items to pull requests, so that I can maintain traceability between code changes and work items without leaving my AI-assisted workflow.

**Workflow**: User completes development work → Claude Code helps document completion → Comments added to work items → Work items linked to pull requests → Full audit trail maintained.

## Spec Scope

1. **wit_force_sync_work_items** - Force immediate sync of all work items from Azure DevOps to local database
2. **wit_my_work_items** - Retrieve work items assigned to or relevant to the authenticated user
3. **wit_get_work_item** - Fetch complete details for a single work item by ID
4. **wit_get_work_items_batch_by_ids** - Efficiently fetch multiple work items by providing array of IDs
5. **wit_list_work_item_comments** - Get all comments for a specific work item with full history
6. **wit_get_work_items_for_iteration** - Fetch all work items assigned to a specific iteration/sprint
7. **wit_add_work_item_comment** - Add new comment to existing work item
8. **wit_link_work_item_to_pull_request** - Create linkage between work item and pull request for traceability

## Out of Scope

- Natural language query processing
- Semantic search functionality
- Complex query engines
- Custom filtering beyond standard parameters
- Work item creation or deletion
- Field modification beyond comments

## Expected Deliverable

1. All 8 MCP tools implemented with proper TypeScript interfaces and error handling
2. Complete removal of legacy tools (get_work_items, query_work, sync_data, get_work_item_url)
3. Database queries optimized for sub-100ms response times with proper indexing