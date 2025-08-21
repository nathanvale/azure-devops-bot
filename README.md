# Azure DevOps Bot

A sophisticated **Model Context Protocol (MCP) server** that provides natural language querying and interaction with Azure DevOps work items. Built specifically for the FWC development team, it integrates directly with Claude Code and other MCP-compatible tools.

## 🚀 Key Features

### 🔐 **Secure Authentication**
- Azure CLI SSO integration (`az login`)
- No API keys or tokens required
- Leverages existing Azure DevOps permissions

### 🧠 **Intelligent Query Processing**
- **Natural Language Understanding**: Ask questions like "What bugs did I work on last month?"
- **Semantic Search**: Finds related work items by concepts and technical domains
- **Multi-layered Query Engine**: Enhanced processing with fallback to legacy queries
- **Current & Recent Work**: Search through active and recently completed work items

### 🗄️ **Local Database & Sync**
- **SQLite Database**: Fast local storage with Prisma ORM
- **Background Sync**: Automatic updates every 5 minutes (configurable)
- **Smart Caching**: Stores work items locally for fast querying
- **Completion Tracking**: Tracks work items you've closed or resolved

### 🔍 **Comprehensive Search Capabilities**
- **Work Item Types**: User Stories, Product Backlog Items, Bugs, Tasks
- **State Filtering**: Active, Open, Closed, Resolved work items
- **Time-based Queries**: "Show me work from last quarter"
- **Concept Matching**: Find work by technical domain (security, API, database, etc.)

### 🤖 **MCP Server Integration**
- Direct integration with Claude Code
- JSON-RPC protocol for tool communication
- Real-time work item queries
- URL generation for direct Azure DevOps links

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Claude Code   │───▶│   MCP Server    │───▶│  Azure DevOps   │
│   (Client)      │    │   (This Bot)    │    │   (via az CLI)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │ SQLite Database │
                       │  (Local Cache)  │
                       └─────────────────┘
```

### Core Components

#### 1. **MCP Server** (`src/mcp-server.ts`)
- **Protocol**: Model Context Protocol over stdio
- **Tools**: 4 primary tools for work item interaction
- **Error Handling**: Comprehensive error responses
- **Configuration**: Email-based user filtering

#### 2. **Azure DevOps Integration** (`src/services/azure-devops.ts`)
- **WIQL Queries**: Complex Work Item Query Language queries
- **Multi-user Support**: Filter by multiple email addresses
- **Comprehensive Queries**: Fetches current and recently completed work items
- **Real-time Sync**: Fetches latest work item states

#### 3. **Database Layer** (`src/services/database.ts`)
- **Schema**: Comprehensive work item model with indexes
- **Sync Logic**: Upsert operations for data consistency
- **Query Methods**: Type-safe database operations
- **Completion Tracking**: Tracks who closed/resolved work items

#### 4. **Query Engine** (`src/services/query-engine.ts` & `src/services/enhanced-query-engine.ts`)
- **Two-tier Processing**: Enhanced queries with legacy fallback
- **Natural Language**: Parses intent from human language
- **Semantic Search**: Concept-based matching across technical domains
- **Result Formatting**: Human-readable responses with context

#### 5. **Authentication** (`src/services/auth.ts`)
- **Azure CLI Integration**: Leverages existing authentication
- **Token Management**: Handles authentication state
- **Error Recovery**: Guides users through authentication process

## 🛠️ Setup

### Prerequisites
- Node.js 18+ and pnpm
- Azure CLI (`az`) installed and authenticated
- Access to FWC Azure DevOps organization

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Database Setup
```bash
# Database migrations are run automatically on first start
# Or run manually:
pnpm prisma migrate deploy
```

### 3. Environment Configuration (CLI Mode)
```bash
# Create .env file with your email addresses
echo "AZURE_DEVOPS_USER_EMAILS=your.email@fwc.gov.au" >> .env

# For multiple users (team queries)
echo "AZURE_DEVOPS_USER_EMAILS=user1@fwc.gov.au,user2@fwc.gov.au" >> .env

# Optional: Configure sync interval (default is 5 minutes)
echo "AZURE_DEVOPS_SYNC_INTERVAL_MINUTES=10" >> .env
```

### 4. Azure Authentication
```bash
az login
# Follow prompts to authenticate with Azure DevOps
```

### 5. Configuration
The bot is pre-configured for:
- **Organization**: `fwcdev`
- **Project**: `Customer Services Platform`
- **Email Configuration**: 
  - **MCP Mode**: Required via `--emails` parameter
  - **CLI Mode**: Required via `AZURE_DEVOPS_USER_EMAILS` environment variable

## 🚀 Usage

### MCP Server Mode (Recommended)

#### With Claude Code
```bash
# Add to Claude Code MCP configuration
claude mcp add-json azure-devops-bot '{
  "type": "stdio",
  "command": "pnpm",
  "args": ["mcp", "--emails=your.email@fwc.gov.au,team.email@fwc.gov.au"],
  "cwd": "/path/to/azure-devops-bot"
}'
```

#### Manual Configuration
Add to your MCP configuration file:
```json
{
  "mcpServers": {
    "azure-devops-bot": {
      "command": "pnpm",
      "args": ["mcp", "--emails=user1@fwc.gov.au,user2@fwc.gov.au"],
      "cwd": "/path/to/azure-devops-bot"
    }
  }
}
```

#### Direct Server Start
```bash
pnpm mcp --emails=your.email@fwc.gov.au,colleague@fwc.gov.au
```

### CLI Mode
```bash
# First, configure your email addresses (required)
echo "AZURE_DEVOPS_USER_EMAILS=your.email@fwc.gov.au" >> .env

# Or set multiple emails
echo "AZURE_DEVOPS_USER_EMAILS=user1@fwc.gov.au,user2@fwc.gov.au" >> .env

# Or export directly
export AZURE_DEVOPS_USER_EMAILS=your.email@fwc.gov.au

# Then query work items
pnpm dev "What am I working on today?"
pnpm dev "Show me all bugs I completed last month"
pnpm dev "What user stories are in my backlog?"
```

## 🔧 Available MCP Tools

### 1. `get_work_items`
**Description**: Get work items with optional filtering
**Parameters**:
- `filter` (optional): `"active"`, `"open"`, `"user-stories"`, `"bugs"`, `"tasks"`, `"all"`

**Example**:
```javascript
// Get all active work items
{"name": "get_work_items", "arguments": {"filter": "active"}}

// Get all bugs
{"name": "get_work_items", "arguments": {"filter": "bugs"}}
```

### 2. `query_work`
**Description**: Natural language queries about work items
**Parameters**:
- `query` (required): Natural language query string

**Example**:
```javascript
// Natural language queries
{"name": "query_work", "arguments": {"query": "What authentication work did I complete?"}}
{"name": "query_work", "arguments": {"query": "Show me API-related tasks from last quarter"}}
```

### 3. `sync_data`
**Description**: Manually sync current work items from Azure DevOps
**Parameters**: None

**Example**:
```javascript
// Force sync with Azure DevOps
{"name": "sync_data", "arguments": {}}
```

### 4. `get_work_item_url`
**Description**: Get direct Azure DevOps URL for a work item
**Parameters**:
- `id` (required): Work item ID number

**Example**:
```javascript
// Get URL for work item 12345
{"name": "get_work_item_url", "arguments": {"id": 12345}}
```

## 🧠 Query Engine Capabilities

### Natural Language Processing
The query engine understands various query patterns:

#### Simple Queries
- `"bugs"` → All bugs assigned to you
- `"active"` → All active work items
- `"completed"` → All completed work items
- `"user stories"` → All user stories

#### Complex Queries
- `"What authentication work did I complete last month?"` → Semantic search for auth-related completed work
- `"Show me database bugs I worked on"` → Concept-based search for database-related bugs
- `"API work from last quarter"` → Time-based search for API-related work items

### Semantic Search Features
- **Technical Domains**: Security, API, Database, UI, DevOps, Testing
- **Concept Matching**: Finds related work by technical concepts
- **Intent Recognition**: Understands different query intentions
- **Work Context**: Searches through current and recently completed work items

### Query Types Supported
1. **Content Search**: Find work items by description/title content
2. **Concept Search**: Find work items by technical domain
3. **Time-based Search**: Filter by date ranges
4. **Completion Context**: Find work you've completed
5. **Type Filtering**: Filter by work item types

## 📊 Database Schema

### WorkItem Model
```typescript
interface WorkItem {
  id: number;                    // Azure DevOps work item ID
  title: string;                 // Work item title
  state: string;                 // Current state (Active, Closed, etc.)
  type: string;                  // Work item type (Bug, User Story, etc.)
  assignedTo: string;            // Current assignee
  azureUrl: string;              // Direct Azure DevOps URL
  description?: string;          // Work item description
  createdDate?: Date;            // When work item was created
  closedDate?: Date;             // When work item was closed
  resolvedDate?: Date;           // When work item was resolved
  closedBy?: string;             // Who closed the work item
  resolvedBy?: string;           // Who resolved the work item
  lastUpdatedAt: Date;           // Last update time
  lastSyncedAt: Date;            // Last sync time
  isHistoricalImport: boolean;   // Whether from historical import
}
```

### Database Indexes
- `type` - Fast filtering by work item type
- `state` - Fast filtering by work item state
- `assignedTo` - Fast filtering by assignee
- `createdDate` - Fast time-based queries
- `isHistoricalImport` - Distinguish historical vs current work
- `closedBy` - Fast filtering by who completed work
- `resolvedBy` - Fast filtering by who resolved work

## 🔄 Sync Process

### Background Sync
- **Frequency**: Every 5 minutes (configurable via `AZURE_DEVOPS_SYNC_INTERVAL_MINUTES`)
- **Scope**: Current work items (active assignments + recent completions)
- **Method**: Incremental updates using `lastUpdatedAt`

### Data Consistency
- **Upsert Operations**: Updates existing, creates new work items
- **Conflict Resolution**: Azure DevOps is source of truth
- **Sync Metadata**: Tracks sync timestamps for each work item

## 🧪 Testing

### Test Coverage
- **Unit Tests**: 212 tests covering all services
- **Integration Tests**: MCP server integration testing
- **Mock Services**: Comprehensive Azure DevOps API mocking
- **Database Tests**: SQLite and Prisma testing

### Running Tests
```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Run integration tests
pnpm test:integration

# Run in watch mode
pnpm test:watch
```

## 📝 Development Scripts

```bash
# Development
pnpm dev                 # Run CLI version
pnpm mcp                 # Run MCP server

# Building
pnpm build               # TypeScript compilation
pnpm start               # Run built version

# Database
pnpm db:reset            # Reset database (deletes data and re-runs migrations)

# Testing
pnpm test                # Run all tests
pnpm test:watch          # Watch mode
pnpm test:coverage       # With coverage
pnpm test:ci             # CI mode
```

## 🔧 Configuration

### Environment Variables
```bash
DATABASE_URL="file:./dev.db"                              # SQLite database path
AZURE_DEVOPS_USER_EMAILS="user1@fwc.gov.au,user2@fwc.gov.au"  # Required for CLI mode
AZURE_DEVOPS_SYNC_INTERVAL_MINUTES=5                      # Background sync interval (default: 5 minutes)
```

### Azure DevOps Configuration
- **Organization**: `fwcdev` (hardcoded)
- **Project**: `Customer Services Platform` (hardcoded)
- **User Filtering**: Via `--emails` parameter

### Email Configuration
```bash
# Single user
pnpm mcp --emails=user@fwc.gov.au

# Multiple users
pnpm mcp --emails=user1@fwc.gov.au,user2@fwc.gov.au,user3@fwc.gov.au
```

### Sync Interval Configuration
```bash
# Default: 5 minutes
# Set custom interval (in minutes)
export AZURE_DEVOPS_SYNC_INTERVAL_MINUTES=10

# Or in .env file
echo "AZURE_DEVOPS_SYNC_INTERVAL_MINUTES=15" >> .env

# Common values:
# 1 = Every minute (for development)
# 5 = Every 5 minutes (default)
# 30 = Every 30 minutes (less frequent)
```

## 🚨 Troubleshooting

### Authentication Issues
```bash
# Check Azure CLI authentication
az account show

# Re-authenticate
az login

# Check Azure DevOps extension
az extension add --name azure-devops
```

### Database Issues
```bash
# Reset database (removes all data and re-runs migrations)
pnpm db:reset

# Or manually
rm prisma/dev.db
pnpm prisma migrate deploy
```

### MCP Connection Issues
```bash
# Test MCP server directly
pnpm mcp --emails=your.email@fwc.gov.au

# Use MCP Inspector for debugging
mcp-inspector pnpm mcp --emails=your.email@fwc.gov.au
```

### CLI Mode Issues
```bash
# Missing environment variable error
❌ Error: AZURE_DEVOPS_USER_EMAILS environment variable is required

# Fix by setting environment variable
echo "AZURE_DEVOPS_USER_EMAILS=your.email@fwc.gov.au" >> .env

# Or export directly
export AZURE_DEVOPS_USER_EMAILS=your.email@fwc.gov.au

# Verify it's set
echo $AZURE_DEVOPS_USER_EMAILS
```

## 📋 Roadmap

See `docs/ROADMAP.md` for planned features and improvements.

## 🧪 Testing Strategy

See `docs/TESTING_PLAN.md` for comprehensive testing documentation.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## 📄 License

ISC License - Internal FWC Development Tool