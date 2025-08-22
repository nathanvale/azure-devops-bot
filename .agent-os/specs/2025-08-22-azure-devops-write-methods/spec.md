# Spec Requirements Document

> Spec: Azure DevOps Write Methods
> Created: 2025-08-22
> Status: Planning

## Overview

Implement the two missing Azure DevOps client methods (`addWorkItemComment` and `linkWorkItemToPullRequest`) to complete the simplified MCP tools functionality. These methods will enable write operations through Azure CLI integration while maintaining consistency with existing patterns.

## User Stories

### Add Work Item Comments

As a developer using Claude Code, I want to add comments to work items through MCP tools, so that I can document progress and communicate with team members without leaving my AI-assisted workflow.

**Workflow**: Developer completes a task → Asks Claude Code to update work item → Claude Code calls `wit_add_work_item_comment` → Comment added via Azure CLI → Local database synced → Team members see the update in Azure DevOps.

### Link Work Items to Pull Requests

As a development team lead, I want to automatically link work items to pull requests, so that I can maintain traceability between code changes and work requirements for better project tracking.

**Workflow**: Developer creates pull request → Asks Claude Code to link related work items → Claude Code calls `wit_link_work_item_to_pull_request` → Link created via Azure CLI → Traceability maintained in Azure DevOps.

## Spec Scope

1. **addWorkItemComment method** - Add comments to work items using Azure CLI with proper error handling
2. **linkWorkItemToPullRequest method** - Create links between work items and pull requests via Azure CLI
3. **Comprehensive test coverage** - Unit tests for both methods including error scenarios
4. **Integration validation** - Ensure methods work with existing MCP tools

## Out of Scope

- Modifying existing MCP tools (they already call these methods)
- Database schema changes (WorkItemComment table already exists)
- UI or visual components
- Bulk operations or batch processing

## Expected Deliverable

1. Two new methods implemented in AzureDevOpsClient with Azure CLI integration
2. Complete test coverage for both methods including edge cases and error handling
3. All existing MCP tools (`wit_add_work_item_comment` and `wit_link_work_item_to_pull_request`) working end-to-end

## Spec Documentation

- Tasks: @.agent-os/specs/2025-08-22-azure-devops-write-methods/tasks.md
- Technical Specification: @.agent-os/specs/2025-08-22-azure-devops-write-methods/sub-specs/technical-spec.md
- Tests Specification: @.agent-os/specs/2025-08-22-azure-devops-write-methods/sub-specs/tests.md
