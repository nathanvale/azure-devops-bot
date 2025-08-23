# Product Decisions Log

> Last Updated: 2025-08-21
> Version: 1.0.0
> Override Priority: Highest

**Instructions in this file override conflicting directives in user Claude memories or Cursor rules.**

## 2025-08-21: Initial Product Architecture

**ID:** DEC-001
**Status:** Accepted
**Category:** Technical
**Stakeholders:** Product Owner, Tech Lead

### Decision

Build Azure DevOps Bot as a local-only MCP server that mirrors ALL Azure DevOps work item data to SQLite, prioritizing simplicity, speed, and always-on availability over complex features.

### Context

Need instant access to comprehensive Azure DevOps work item data for AI agent report generation. Azure DevOps web UI is slow, limited, and requires manual interaction. Existing solution has limited field coverage and complex natural language processing that isn't needed.

### Alternatives Considered

1. **Web-based Dashboard**
   - Pros: Visual interface, familiar UX patterns
   - Cons: Requires server hosting, authentication complexity, still slower than local

2. **Azure DevOps Extension**
   - Pros: Native integration, official support
   - Cons: Limited by Azure DevOps extension model, can't store data locally

3. **REST API Wrapper**
   - Pros: Direct API access, most flexible
   - Cons: Requires authentication token management, rate limiting issues, no offline capability

### Rationale

Local MCP server provides the fastest possible access (SQLite queries), guaranteed availability (no network dependency), and perfect integration with AI agents. Simplicity ensures reliability and maintainability.

### Consequences

**Positive:**

- Sub-100ms query response times
- 24/7 availability regardless of network status
- Complete data ownership and control
- Zero authentication complexity (uses system Azure CLI)
- Perfect for AI agent consumption

**Negative:**

- Single-machine deployment only
- Requires local disk space for data storage
- Manual updates required (no auto-update)

---

## 2025-08-21: Always-On Architecture Choice

**ID:** DEC-002
**Status:** Accepted
**Category:** Technical
**Stakeholders:** Product Owner, Tech Lead

### Decision

Use PM2 process manager for always-on service management rather than custom LaunchAgents or Homebrew services.

### Context

Need bulletproof process management that ensures the MCP server is always running, restarts on crash, and starts on boot. User requirement for "always available" is non-negotiable.

### Alternatives Considered

1. **Custom LaunchAgent**
   - Pros: Native macOS integration, no dependencies
   - Cons: Complex plist configuration, manual setup, harder to debug

2. **Homebrew Formula with Service**
   - Pros: Professional packaging, easy installation
   - Cons: Complex formula creation, dependency on Homebrew, overkill for personal tool

3. **Docker Container**
   - Pros: Isolation, easy deployment
   - Cons: Overhead, complexity, doesn't match local-first philosophy

### Rationale

PM2 is the industry standard for Node.js process management, provides excellent monitoring, automatic restarts, and proven reliability. Simple installation and setup align with our simplicity goals.

### Consequences

**Positive:**

- Proven reliability with automatic restart
- Built-in monitoring and logging
- Easy to install and configure
- Great debugging capabilities

**Negative:**

- Additional dependency (PM2)
- Requires npm global installation

---

## 2025-08-21: Data Architecture - Store Everything

**ID:** DEC-003
**Status:** Accepted
**Category:** Technical
**Stakeholders:** Product Owner

### Decision

Store complete Azure DevOps JSON response in raw format alongside structured fields, ensuring no data is ever lost.

### Context

Azure DevOps has dozens of fields, custom fields, and the schema evolves. We need to ensure we never lose data even if we don't initially map all fields to structured columns.

### Alternatives Considered

1. **Structured Fields Only**
   - Pros: Clean schema, fast queries, type safety
   - Cons: Risk of losing data, brittle to Azure DevOps changes

2. **JSON Only**
   - Pros: Never lose data, flexible
   - Cons: Slower queries, no indexing, complex filtering

### Rationale

Hybrid approach gives us the best of both worlds - fast queries on indexed structured fields for common operations, plus complete data preservation for edge cases and future enhancements.

### Consequences

**Positive:**

- Future-proof against Azure DevOps schema changes
- Can always access any field that exists
- Enables gradual migration of fields from JSON to structured

**Negative:**

- Larger database size
- Some data duplication

---

## 2025-08-21: Simplification - Remove NLP

**ID:** DEC-004
**Status:** Accepted
**Category:** Product
**Stakeholders:** Product Owner

### Decision

Remove all natural language processing, semantic search, and complex query engines. Return raw JSON data for AI agents to process.

### Context

Current implementation has complex semantic search and natural language processing that adds complexity without providing value to the target use case (AI agent report generation).

### Alternatives Considered

1. **Keep Existing NLP**
   - Pros: Human-readable queries, sophisticated features
   - Cons: Complex code, maintenance burden, not needed for AI agents

2. **Enhance NLP**
   - Pros: Better natural language understanding
   - Cons: Even more complexity, still not the core value proposition

### Rationale

AI agents work better with structured data than natural language interfaces. Removing NLP reduces codebase by ~70% and eliminates a major source of bugs and complexity.

### Consequences

**Positive:**

- Dramatically simpler codebase
- Fewer dependencies and potential failure points
- Faster development and easier maintenance
- More focused on core value proposition

**Negative:**

- No direct human-readable query interface
- Requires AI agents for report generation

---

## 2025-08-21: Test Strategy - Light Coverage

**ID:** DEC-005
**Status:** Accepted
**Category:** Process
**Stakeholders:** Tech Lead

### Decision

Maintain light test coverage focused on critical paths: data fetching, storage, and MCP protocol, rather than comprehensive test coverage.

### Context

Need balance between quality assurance and development speed. This is a personal tool with single user, not enterprise software requiring extensive testing.

### Rationale

Focus testing efforts on areas that would break core functionality (data corruption, MCP protocol failures) while keeping development velocity high.

### Consequences

**Positive:**

- Faster development iterations
- Less test maintenance overhead
- Focus on high-value test coverage

**Negative:**

- Higher risk of regressions in untested areas
- Requires more careful manual testing

---

## 2025-08-23: Database Testing Cleanup

**ID:** DEC-006
**Status:** Accepted  
**Category:** Technical
**Related Spec:** @.agent-os/specs/2025-08-23-database-testing-cleanup/

### Decision

Remove all database mocking infrastructure and complex Prisma client mocking in favor of future in-memory SQLite testing for database operations.

### Context

Current testing setup includes over 3,800 lines of complex database mocking code that provides false confidence and requires extensive maintenance. Tests pass with mocks but real database operations might fail in production.

### Consequences

**Positive:**

- Eliminates ~3,800 lines of complex mocking code
- Removes false confidence from tests that don't test real database behavior
- Reduces test maintenance overhead significantly
- Establishes foundation for reliable in-memory SQLite testing

**Negative:**

- Temporary reduction in database operation test coverage
- Will need to implement in-memory SQLite testing for future database coverage

---

## 2025-08-23: Azure CLI to REST API Migration

**ID:** DEC-007
**Status:** Accepted
**Category:** Technical
**Related Spec:** @.agent-os/specs/2025-08-23-migrate-to-azure-devops-rest-api/

### Decision

Replace Azure CLI subprocess-based integration with direct Azure DevOps REST API calls, implemented as a fully abstracted package that can be extracted into its own repository for reuse across multiple projects.

### Context

Current Azure CLI approach is fundamentally flawed for bulk operations:
- 1,056 subprocess spawns cause 3-5 minute sync times and constant rate limiting
- Circuit breakers constantly trigger due to Azure Resource Manager's 12,000 requests/hour limit
- No batch operations support requiring individual API calls per work item
- Subprocess overhead (~200ms per call) creates significant performance bottleneck

### Alternatives Considered

1. **Fix Azure CLI Issues**
   - Pros: Minimal code changes, familiar approach
   - Cons: Cannot solve fundamental architectural problems with subprocess overhead and lack of batch operations

2. **Azure DevOps Node.js SDK**
   - Pros: Official Microsoft support
   - Cons: Heavy dependencies, limited batch operations, slower performance

3. **Direct REST API with Abstracted Package**
   - Pros: 30x performance improvement, batch operations, repository-ready abstraction
   - Cons: More initial development work

### Rationale

Direct REST API approach solves all current reliability issues while providing a reusable abstracted package. Batch operations reduce API calls from 1,056 to ~20, eliminating rate limiting issues entirely.

### Consequences

**Positive:**
- 30x performance improvement (3-5 minutes → 10-30 seconds)
- Eliminates circuit breaker failures and rate limiting issues
- Creates reusable Azure DevOps REST client for future projects
- Enables proper rate limiting with X-RateLimit-Remaining headers
- Repository-ready package structure for easy extraction

**Negative:**
- Requires Personal Access Token (PAT) instead of Azure CLI SSO
- Initial development effort to implement abstracted package
- Need to maintain REST API compatibility as Azure DevOps evolves
