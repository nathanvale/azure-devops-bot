# Spec Requirements Document

> Spec: MCP Tool Redesign to Microsoft Azure DevOps MCP Patterns
> Created: 2025-01-28
> Status: In Progress (Phase 1 Complete)
> Implementation: 14 tools across 3 domains (Cache, Sync, Admin)

## Overview

Migrate the Azure DevOps Bot from its current 8 simplified MCP tools to Microsoft's azure-devops-mcp patterns, implementing a granular, schema-first design with Zod validation, domain-based organization, and thin abstraction over REST APIs.

## User Stories

### Modern MCP Architecture Adoption

As a developer using the Azure DevOps Bot, I want the MCP tools to follow Microsoft's official azure-devops-mcp patterns, so that I have a consistent, predictable interface that aligns with industry standards and can easily integrate with other Microsoft MCP tools.

The current implementation has 8 monolithic tools that mix different concerns (cache operations with direct API calls, normalized data with raw data). Microsoft's approach uses granular, domain-organized tools with clear separation between data access patterns and comprehensive Zod schema validation for type safety.

### Schema-First Development with Zod Validation

As an AI agent consumer, I want all MCP tool inputs and outputs to have comprehensive Zod schema validation, so that I get clear type errors, reliable data contracts, and predictable tool behavior across all operations.

Current tools have basic JSON Schema validation but lack the runtime type safety and composable validation that Zod provides. Microsoft's implementation demonstrates sophisticated schema patterns for work items, projects, and repository operations.

## Spec Scope

1. **Domain-Based Tool Organization** - Replace current flat tool structure with Microsoft's domain approach (cache, sync, admin, wit, core)
2. **Zod Schema Implementation** - Add comprehensive input/output validation for all tools using Zod schemas
3. **Granular Tool Design** - Break down monolithic tools into focused, single-responsibility tools
4. **Schema-First Architecture** - Implement Microsoft's thin abstraction pattern over database/API operations
5. **Backward Compatibility Layer** - Maintain existing tool names during migration period

## Out of Scope

- Changes to underlying database schema or Azure DevOps REST API integration
- Performance optimization beyond schema validation overhead
- New feature development (focus on architecture migration only)
- UI/UX changes to CLI or output formatting

## Expected Deliverable

1. **Redesigned MCP tool architecture** that follows Microsoft's azure-devops-mcp patterns with domain organization ✅ PARTIAL (3 of 5 domains)
2. **Comprehensive Zod schemas** for all tool inputs and outputs with runtime validation ⚠️ PARTIAL (input validation only)
3. **Migration guide** documenting the transformation from old to new tool structure ❌ NOT COMPLETE

## Implementation Review (2025-01-28)

### What's Complete ✅

- **Domain Architecture**: Registry system with 3 core domains (Cache, Sync, Admin)
- **14 Granular Tools**: Successfully decomposed from 8 mixed tools
- **Input Validation**: Zod schemas for all tool inputs with runtime validation
- **Base Domain Pattern**: Clean abstraction with consistent error handling
- **Test Coverage**: 33 tests passing (registry + schema validation)

### Critical Gaps ❌

1. **Output Validation Missing**: Tools don't validate responses against output schemas
2. **Backward Compatibility**: No legacy tool mapping layer implemented
3. **Response Envelope Inconsistency**: Mixed success/error response formats
4. **Tool Collision Detection**: No checking for duplicate tool names across domains
5. **Missing Domains**: WIT and Core domains not implemented (11 tools pending)
6. **Migration Guide**: No documentation for transitioning from v1 to v2

### Technical Debt ⚠️

- Duplicated `zodSchemaToJsonSchema` logic in multiple files
- Naive schema conversion losing enums, defaults, descriptions
- In-memory filtering instead of database queries in CacheDomain
- Inconsistent error codes across domains
- Missing output schema validation infrastructure

## Spec Documentation

- Tasks: @.agent-os/specs/2025-01-28-mcp-tool-redesign/tasks.md
- Technical Specification: @.agent-os/specs/2025-01-28-mcp-tool-redesign/sub-specs/technical-spec.md
- API Specification: @.agent-os/specs/2025-01-28-mcp-tool-redesign/sub-specs/api-spec.md
- Tests Specification: @.agent-os/specs/2025-01-28-mcp-tool-redesign/sub-specs/tests.md
- Implementation Review: @.agent-os/specs/2025-01-28-mcp-tool-redesign/sub-specs/implementation-review.md
