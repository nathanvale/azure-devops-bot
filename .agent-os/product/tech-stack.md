# Technical Stack

> Last Updated: 2025-08-21
> Version: 1.0.0

## Application Framework

- **Runtime**: Node.js 18+
- **Language**: TypeScript 5.8+
- **Module System**: ESNext modules
- **Build Tool**: TypeScript compiler (tsc)

## Database System

- **Primary**: SQLite
- **ORM**: Prisma 6.11+
- **Migration Strategy**: Prisma migrate
- **Location**: Local file system (`./dev.db`)

## External Integrations

- **Azure DevOps**: REST API with PAT authentication for direct data access
- **Protocol**: Model Context Protocol (MCP) 1.15+
- **Transport**: stdio for MCP communication

## Development Tools

- **Package Manager**: pnpm
- **Testing Framework**: Vitest 3.2+
- **Test Mocking**: MSW (Mock Service Worker) 2.10+
- **Coverage**: @vitest/coverage-v8

## Process Management

- **Always-On Service**: PM2 process manager
- **Service Type**: Background daemon
- **Auto-restart**: Enabled with crash recovery
- **Boot Persistence**: macOS LaunchAgent via PM2

## Code Quality

- **Type Checking**: TypeScript strict mode
- **No Linting**: Deliberately minimal tooling for simplicity
- **No Code Formatting**: Raw TypeScript as written

## Infrastructure

- **Application Hosting**: Local development machine
- **Database Hosting**: Local SQLite file
- **Service Discovery**: MCP protocol via stdio
- **Monitoring**: PM2 built-in monitoring

## Security

- **Authentication**: PAT (Personal Access Token) for Azure DevOps API access
- **Network**: HTTPS communication with Azure DevOps REST API, local stdio only for MCP protocol
- **Permissions**: User-level file system access only
- **Data**: All data stored locally, HTTPS transmission only to Azure DevOps for sync operations

## Performance Strategy

- **Query Speed**: SQLite with proper indexing for sub-100ms queries
- **Sync Strategy**: Background polling every 2 minutes
- **Memory Usage**: Minimal - only active connections and recent data
- **Disk Usage**: SQLite database grows with work item history

## Development Dependencies

- **@types/node**: Node.js type definitions
- **tsx**: TypeScript execution for development
- **vitest**: Testing framework with TypeScript support
- **msw**: API mocking for Azure DevOps responses

## Deployment Strategy

- **Environment**: Development machine only
- **Installation**: npm/pnpm global or local project
- **Configuration**: Environment variables and PM2 ecosystem file
- **Updates**: Manual git pull and restart

## API Integration Details

- **Azure DevOps**: REST API via azure-devops-client package
- **Work Item Queries**: WIQL (Work Item Query Language) via POST /wit/wiql endpoint
- **Batch Processing**: Native batch operations with GET /wit/workitems/{ids} endpoint
- **Rate Limiting**: X-RateLimit-Remaining headers with exponential backoff

## Data Flow Architecture

1. **Input**: HTTPS REST API calls to Azure DevOps with JSON responses
2. **Processing**: TypeScript parsing and field extraction via azure-devops-client
3. **Storage**: Prisma ORM to SQLite database
4. **Output**: MCP protocol JSON responses
5. **Transport**: stdio pipes for MCP communication
