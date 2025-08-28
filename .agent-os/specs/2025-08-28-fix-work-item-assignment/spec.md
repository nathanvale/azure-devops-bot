# Spec Requirements Document

> Spec: Fix Work Item Assignment Query Issues
> Created: 2025-08-28
> Status: Planning

## Overview

Fix the critical data mismatch issue where work item queries by email return zero results because the database stores display names while the system searches by email addresses. Implement a normalized Person table to store complete Azure DevOps identity data and achieve 25x performance improvement for person-based queries.

## User Stories

### Fix Email-Based Work Item Queries

As a developer using the MCP server, I want to query "my work items" and get results, so that I can see what I'm currently assigned to work on.

Currently, when I run the `wit_my_work_items` MCP tool, it returns zero results even though I have active work items assigned to me in Azure DevOps. This happens because:

- The system searches the database for my email `Nathan.Vale@fwc.gov.au`
- The database contains my display name `Nathan Vale` instead
- The query finds no matches and returns empty results

### Complete Person Data Capture

As a system administrator, I want all Azure DevOps identity information stored properly, so that the system can handle various person-based queries and maintain data integrity.

Azure DevOps provides rich person objects with multiple identifiers (id, uniqueName, displayName, imageUrl, descriptor), but currently we only extract the display name. This causes data loss and prevents reliable person matching across different query types.

### Performance Optimization

As a user of the always-on service, I want person-based queries to respond in under 100ms, so that the local MCP server provides the promised sub-100ms performance.

Current string-based person queries require LIKE pattern matching which takes ~50ms. With a normalized Person table and proper indexes, we can achieve ~2ms response times (25x improvement) while maintaining data accuracy.

## Spec Scope

1. **Create Person Table** - Normalized table for all Azure DevOps identity data with proper indexes
2. **Update WorkItem Schema** - Replace String person fields with foreign key relationships
3. **Fix Data Extraction** - Capture `uniqueName` (email) from Azure DevOps person objects
4. **Migrate Existing Data** - Zero-downtime migration from current display names to Person records
5. **Update Query Logic** - Modify database methods to use Person table joins for email searches

## Out of Scope

- Changes to rawJson handling (already working correctly per DEC-003)
- Authentication mechanism changes (PAT authentication remains)
- Real-time sync modifications (polling interval unchanged)
- UI or frontend changes (MCP protocol interface only)
- Multi-organization support

## Expected Deliverable

1. **Working Email Queries**: `wit_my_work_items` returns correct results when queried by email
2. **Person Table Implementation**: Complete normalized Person table with all Azure DevOps identity fields
3. **25x Performance Improvement**: Person-based queries respond in ~2ms instead of ~50ms
4. **Zero Data Loss**: Complete migration of existing person data without losing information
5. **Backward Compatibility**: Existing MCP tools continue to work during migration

## Spec Documentation

- Tasks: @.agent-os/specs/2025-08-28-fix-work-item-assignment/tasks.md
- Technical Specification: @.agent-os/specs/2025-08-28-fix-work-item-assignment/sub-specs/technical-spec.md
- Database Schema: @.agent-os/specs/2025-08-28-fix-work-item-assignment/sub-specs/database-schema.md
- API Specification: @.agent-os/specs/2025-08-28-fix-work-item-assignment/sub-specs/api-spec.md
- Tests Specification: @.agent-os/specs/2025-08-28-fix-work-item-assignment/sub-specs/tests.md
- Architectural Decision: @.agent-os/product/decisions.md (DEC-009)
