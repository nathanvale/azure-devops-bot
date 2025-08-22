# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Commands

- `pnpm dev` - Run CLI version (requires `AZURE_DEVOPS_USER_EMAILS` env var)
- `pnpm mcp --emails=user@domain.com` - Run MCP server mode
- `pnpm build` - TypeScript compilation
- `pnpm start` - Run compiled version

### Testing

- `pnpm test` - Run all unit tests (vitest)
- `pnpm test:watch` - Run tests in watch mode
- `pnpm test:coverage` - Run tests with coverage report
- `pnpm test:unit` - Run unit tests only (excludes integration tests)
- `pnpm test:integration` - Run integration tests only
- `pnpm test:ci` - Run tests in CI mode (single run with coverage)

### Database

- `pnpm db:reset` - Reset database (deletes data and re-runs migrations)
- `pnpm prisma migrate deploy` - Run database migrations

## Project Architecture

### Core Components

This is an **Azure DevOps MCP (Model Context Protocol) server** that provides natural language querying of work items. It operates in two modes:

1. **MCP Server Mode** (primary): Provides tools to Claude Code via MCP protocol
2. **CLI Mode**: Direct command-line queries

### Key Services (`src/services/`)

- **`mcp-server.ts`**: MCP protocol server with 4 tools (`get_work_items`, `query_work`, `sync_data`, `get_work_item_url`)
- **`azure-devops.ts`**: Azure DevOps API client using Azure CLI authentication
- **`database.ts`**: Prisma-based SQLite database operations
- **`query-engine.ts`**: Legacy query processing
- **`enhanced-query-engine.ts`**: Advanced natural language query processing
- **`semantic-search.ts`**: Concept-based work item matching
- **`sync-service.ts`**: Background sync service (default: 5 minutes)
- **`auth.ts`**: Azure CLI authentication management

### Data Flow

1. **Authentication**: Uses Azure CLI (`az login`) for SSO
2. **Sync**: Background service pulls work items from Azure DevOps
3. **Storage**: SQLite database with Prisma ORM
4. **Querying**: Natural language processing with semantic search
5. **Response**: Formatted results via MCP tools or CLI

### Database Schema

Single `WorkItem` model with indexes on:

- `type` (Bug, User Story, Task, etc.)
- `state` (Active, Closed, etc.)
- `assignedTo` (email addresses)
- `createdDate` (for time-based queries)

## Configuration

### Environment Variables

- `AZURE_DEVOPS_USER_EMAILS` - Required for CLI mode (comma-separated emails)
- `DATABASE_URL` - SQLite database path (default: `file:./dev.db`)
- `AZURE_DEVOPS_SYNC_INTERVAL_MINUTES` - Sync interval (default: 5)

### Azure DevOps Configuration

- **Organization**: `fwcdev` (hardcoded)
- **Project**: `Customer Services Platform` (hardcoded)
- **Authentication**: Azure CLI (`az login`)

## Testing Strategy

- **Unit Tests**: All services have comprehensive test coverage
- **Integration Tests**: MCP server integration testing
- **Mocking**: MSW for Azure DevOps API mocking
- **Database**: In-memory SQLite for testing

## Development Notes

### Key Patterns

- Services use dependency injection
- All async operations use proper error handling
- Database operations use Prisma with proper transactions
- MCP tools return structured JSON responses

### Email Configuration

- **MCP Mode**: `--emails=user1@domain.com,user2@domain.com`
- **CLI Mode**: `AZURE_DEVOPS_USER_EMAILS=user1@domain.com,user2@domain.com`

### Error Handling

- Authentication errors guide users to run `az login`
- Email validation occurs on startup
- Database migrations run automatically

### File Structure

- `src/index.ts` - CLI entry point
- `src/mcp-server.ts` - MCP server entry point
- `src/services/` - Core business logic
- `src/mocks/` - Test mocking infrastructure
- `tests/` - Integration tests
- `prisma/` - Database schema and migrations

## Agent OS Documentation

### Product Context

- **Mission & Vision:** @.agent-os/product/mission.md
- **Technical Architecture:** @.agent-os/product/tech-stack.md
- **Development Roadmap:** @.agent-os/product/roadmap.md
- **Decision History:** @.agent-os/product/decisions.md

### Development Standards

- **Code Style:** @~/.agent-os/standards/code-style.md
- **Best Practices:** @~/.agent-os/standards/best-practices.md

### Current Development Phase

**Phase 1: Always-On Data Mirror** - Transform into comprehensive, always-available data mirror

- Comprehensive metadata schema ✅ (completed)
- Full data sync with `--expand all` (in progress)
- PM2 always-on service (pending)
- Simplified MCP tools (pending)

### Workflow Instructions

When working on this codebase:

1. **First**, check @.agent-os/product/roadmap.md for current phase priorities
2. **Follow** the technical decisions in @.agent-os/product/decisions.md
3. **Maintain** light test coverage focused on critical paths
4. **Prioritize** simplicity and reliability over complex features

### Key Decisions

- **Local-Only**: No network dependencies, SQLite storage only
- **Always-On**: PM2 process management for 24/7 availability
- **Complete Data**: Store ALL Azure DevOps fields + raw JSON backup
- **AI-Optimized**: Structured JSON output for agent consumption
- **No NLP**: Remove semantic search, let other agents handle natural language

## Important Notes

- Product-specific files in `.agent-os/product/` override any global standards
- This is a personal tool optimized for single-user, always-on operation
- Focus on data completeness and availability over sophisticated querying
- Always adhere to established patterns, code style, and best practices documented above
