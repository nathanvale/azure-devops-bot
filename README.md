# Azure DevOps Bot

A local MCP (Model Context Protocol) server for querying and interacting with Azure DevOps work items via natural language.

## Features

- 🔐 Azure SSO authentication via `az login`
- 📊 Query work items using natural language
- 🗄️ Local SQLite database with Prisma
- 🔄 Background sync every 30 minutes
- 🔗 Direct Azure DevOps work item URLs
- 🤖 **MCP Server Integration** - Works directly with Claude Code

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Ensure you're authenticated with Azure CLI:
   ```bash
   az login
   ```

3. **Option A: Run as CLI**
   ```bash
   npm run dev
   ```

4. **Option B: Run as MCP Server** (Recommended)
   ```bash
   npm run mcp
   ```

## MCP Server Integration

### Claude Code Configuration

Add to your Claude Code MCP configuration:

```json
{
  "mcpServers": {
    "azure-devops-bot": {
      "command": "npm",
      "args": ["run", "mcp"],
      "cwd": "/Users/nathanvale/code/azure-devops-bot"
    }
  }
}
```

### Available MCP Tools

- **`get_work_items`** - Get work items with optional filters
- **`query_work`** - Natural language queries about work items
- **`sync_data`** - Manually sync from Azure DevOps
- **`get_work_item_url`** - Get direct URL for a work item

### Example MCP Usage

Once configured, Claude Code can:
- "What am I working on today?" → Uses `query_work` tool
- "Get my active work items" → Uses `get_work_items` with filter
- "Sync my latest work" → Uses `sync_data` tool

## CLI Usage (Legacy)

### Basic Queries

```bash
# Get today's work
npm run dev "What am I working on today?"

# Get all open work items
npm run dev "Any open user stories?"

# Get backlog summary
npm run dev "Summarize my backlog"
```

## Commands

- `npm run mcp` - **Run as MCP server (Recommended)**
- `npm run dev` - Run CLI version
- `npm run build` - Build TypeScript
- `npm start` - Run built version

## Architecture

- **Authentication**: Azure CLI SSO integration
- **Database**: SQLite with Prisma ORM
- **Sync**: Background sync every 30 minutes
- **Query Engine**: Simple keyword matching
- **MCP Protocol**: Direct integration with Claude Code
- **Output**: Natural language with work item IDs and URLs

## Configuration

The bot is configured for:
- Organization: `fwcdev`
- Project: `Customer Services Platform`
- Assigned to: `Nathan.Vale@fwc.gov.au`

## Authentication Error

If you see an authentication error, please:
1. Visit https://dev.azure.com/fwcdev
2. Sign in with SSO
3. Run `az login` in your terminal