# MCP Integration Guide - Azure DevOps Bot

Comprehensive guide for integrating the Azure DevOps Bot MCP server with various clients, advanced configurations, and troubleshooting.

## Table of Contents

- [MCP Protocol Overview](#mcp-protocol-overview)
- [Claude Desktop Integration](#claude-desktop-integration)
- [VS Code Integration](#vs-code-integration)
- [Generic MCP Client Integration](#generic-mcp-client-integration)
- [Advanced Configuration](#advanced-configuration)
- [Security Best Practices](#security-best-practices)
- [Multi-Workspace Setup](#multi-workspace-setup)
- [Troubleshooting](#troubleshooting)

## MCP Protocol Overview

The Model Context Protocol (MCP) is an open standard that enables AI assistants to securely connect to data sources and tools. The Azure DevOps Bot implements MCP 1.15+ with:

### Transport Methods
- **stdio** (Standard Input/Output) - Most common, used by Claude Desktop
- **HTTP** - For remote servers (not used in this implementation)
- **SSE** (Server-Sent Events) - Legacy support (not used)

### Protocol Features
- **Tools**: 8 work item management functions
- **Resources**: Work item data and comments
- **Authentication**: PAT-based with Azure DevOps
- **Error Handling**: Comprehensive error responses

## Claude Desktop Integration

### Supported Platforms
- macOS (tested)
- Windows (tested)  
- Linux (supported)

### Configuration File Locations

| Platform | Path |
|----------|------|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| Linux | `~/.config/claude/claude_desktop_config.json` |

### Basic Configuration

```json
{
  "mcpServers": {
    "azure-devops-bot": {
      "command": "pnpm",
      "args": ["mcp", "--emails=your.email@fwc.gov.au"],
      "cwd": "/absolute/path/to/azure-devops-bot",
      "env": {
        "AZURE_DEVOPS_PAT": "your-personal-access-token"
      }
    }
  }
}
```

### Advanced Claude Desktop Configuration

#### Multiple Email Support
```json
{
  "mcpServers": {
    "azure-devops-bot": {
      "command": "pnpm",
      "args": ["mcp", "--emails=user1@fwc.gov.au,user2@fwc.gov.au,team@fwc.gov.au"],
      "cwd": "/Users/username/azure-devops-bot",
      "env": {
        "AZURE_DEVOPS_PAT": "your-pat-token",
        "NODE_ENV": "production"
      }
    }
  }
}
```

#### Environment File Support
```json
{
  "mcpServers": {
    "azure-devops-bot": {
      "command": "pnpm",
      "args": ["mcp", "--emails=user@fwc.gov.au"],
      "cwd": "/path/to/azure-devops-bot",
      "envFile": "/path/to/azure-devops-bot/.env"
    }
  }
}
```

#### Debug Configuration
```json
{
  "mcpServers": {
    "azure-devops-bot": {
      "command": "pnpm",
      "args": ["mcp", "--emails=user@fwc.gov.au"],
      "cwd": "/path/to/azure-devops-bot",
      "env": {
        "AZURE_DEVOPS_PAT": "your-token",
        "DEBUG": "azure-devops-bot:*"
      }
    }
  }
}
```

## VS Code Integration

### Supported VS Code Versions
- VS Code Stable 1.102+
- VS Code Insiders (latest)

### Configuration Methods

#### Method 1: Workspace Configuration (Recommended for Teams)

Create `.vscode/mcp.json` in your workspace:

```json
{
  "servers": {
    "azure-devops-bot": {
      "type": "stdio",
      "command": "pnpm",
      "args": ["mcp", "--emails=${input:user-emails}"],
      "cwd": "${workspaceFolder}/../azure-devops-bot",
      "env": {
        "AZURE_DEVOPS_PAT": "${input:azure-pat}",
        "NODE_ENV": "development"
      }
    }
  },
  "inputs": [
    {
      "type": "promptString",
      "id": "user-emails",
      "description": "Enter comma-separated FWC email addresses",
      "default": "your.email@fwc.gov.au"
    },
    {
      "type": "promptString", 
      "id": "azure-pat",
      "description": "Azure DevOps Personal Access Token",
      "password": true
    }
  ]
}
```

#### Method 2: Global User Configuration

Run `MCP: Open User Configuration` and add:

```json
{
  "servers": {
    "azure-devops-bot": {
      "type": "stdio",
      "command": "pnpm",
      "args": ["mcp", "--emails=your.email@fwc.gov.au"],
      "cwd": "/absolute/path/to/azure-devops-bot",
      "env": {
        "AZURE_DEVOPS_PAT": "your-pat-token"
      }
    }
  }
}
```

#### Method 3: Dev Container Integration

Add to `.devcontainer/devcontainer.json`:

```json
{
  "image": "mcr.microsoft.com/devcontainers/typescript-node:latest",
  "customizations": {
    "vscode": {
      "mcp": {
        "servers": {
          "azure-devops-bot": {
            "type": "stdio",
            "command": "pnpm",
            "args": ["mcp", "--emails=${localEnv:USER_EMAIL}"],
            "cwd": "/workspaces/azure-devops-bot",
            "env": {
              "AZURE_DEVOPS_PAT": "${localEnv:AZURE_DEVOPS_PAT}"
            }
          }
        }
      }
    }
  }
}
```

### VS Code Commands

| Command | Purpose |
|---------|---------|
| `MCP: Add Server` | Add new MCP server |
| `MCP: List Servers` | View all configured servers |
| `MCP: Show Installed Servers` | Open MCP servers view |
| `MCP: Reset Cached Tools` | Clear tool cache |
| `MCP: Browse Resources` | View available resources |

### Using MCP Tools in VS Code

1. **Open Chat View**: `Ctrl+Alt+I` (Windows/Linux) or `Cmd+Alt+I` (macOS)
2. **Select Agent Mode**: Click dropdown and select "Agent"
3. **Choose Tools**: Click "Tools" button and select Azure DevOps tools
4. **Start Querying**: Ask questions like "Show my active work items"

## Generic MCP Client Integration

For other MCP clients, use these connection details:

### Server Configuration
```json
{
  "name": "azure-devops-bot",
  "transport": {
    "type": "stdio",
    "command": "pnpm",
    "args": ["mcp", "--emails=user@fwc.gov.au"],
    "cwd": "/path/to/azure-devops-bot"
  },
  "capabilities": ["tools", "resources"],
  "version": "1.0.0"
}
```

### Command Line Test
```bash
# Test MCP server directly
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | pnpm mcp --emails=user@fwc.gov.au
```

## Advanced Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AZURE_DEVOPS_PAT` | Required | Personal Access Token |
| `AZURE_DEVOPS_USER_EMAILS` | None | Comma-separated email list (alternative to --emails) |
| `AZURE_DEVOPS_SYNC_INTERVAL_MINUTES` | 2 | Background sync interval |
| `NODE_ENV` | development | Runtime environment |
| `DEBUG` | None | Debug output pattern |

### Configuration File (.env)

Create `.env` in project root:

```bash
# Azure DevOps Configuration
AZURE_DEVOPS_PAT=your-personal-access-token-here
AZURE_DEVOPS_USER_EMAILS=user1@fwc.gov.au,user2@fwc.gov.au

# Performance Tuning
AZURE_DEVOPS_SYNC_INTERVAL_MINUTES=5
NODE_OPTIONS=--max-old-space-size=512

# Debug Settings
DEBUG=azure-devops-bot:*
```

### Performance Tuning

#### Sync Interval Optimization
```bash
# Fast updates (1 minute) - Higher API usage
pnpm mcp --emails=user@fwc.gov.au --sync-interval=1

# Conservative updates (10 minutes) - Lower API usage  
pnpm mcp --emails=user@fwc.gov.au --sync-interval=10
```

#### Memory Optimization
```json
{
  "command": "pnpm",
  "args": ["mcp", "--emails=user@fwc.gov.au"],
  "env": {
    "NODE_OPTIONS": "--max-old-space-size=256"
  }
}
```

## Security Best Practices

### PAT Token Security

1. **Minimal Scopes**: Only "Work Items (read & write)"
2. **Token Rotation**: Rotate tokens every 90 days
3. **Environment Variables**: Never hardcode tokens in config files
4. **Secure Storage**: Use OS credential managers when possible

### Network Security

```json
{
  "env": {
    "HTTPS_PROXY": "http://corporate-proxy:8080",
    "NODE_TLS_REJECT_UNAUTHORIZED": "1"
  }
}
```

### Input Variable Security (VS Code)

```json
{
  "inputs": [
    {
      "type": "promptString",
      "id": "secure-pat",
      "description": "Azure DevOps PAT (will be encrypted)",
      "password": true
    }
  ]
}
```

## Multi-Workspace Setup

### Shared Global Server

```json
{
  "servers": {
    "azure-devops-bot": {
      "type": "stdio", 
      "command": "pnpm",
      "args": ["mcp", "--emails=team@fwc.gov.au"],
      "cwd": "/shared/azure-devops-bot"
    }
  }
}
```

### Workspace-Specific Servers

**Project A** (`.vscode/mcp.json`):
```json
{
  "servers": {
    "azure-devops-bot": {
      "args": ["mcp", "--emails=projecta@fwc.gov.au"]
    }
  }
}
```

**Project B** (`.vscode/mcp.json`):
```json
{
  "servers": {
    "azure-devops-bot": {
      "args": ["mcp", "--emails=projectb@fwc.gov.au"]
    }
  }
}
```

### Profile-Based Configuration (VS Code)

Use VS Code profiles for different team configurations:

1. **Create Profile**: `File → Preferences → Profiles → Create Profile`
2. **Configure MCP**: Different `mcp.json` per profile
3. **Switch Context**: Change profiles to switch team contexts

## Troubleshooting

### Common Connection Issues

#### Server Not Starting
```bash
# Check server manually
pnpm mcp --emails=test@fwc.gov.au

# Expected output:
# ✅ MCP server started successfully
```

#### Tools Not Appearing

**Claude Desktop:**
1. Check config file path is correct
2. Verify JSON syntax (use [JSONLint](https://jsonlint.com))
3. Restart Claude Desktop completely
4. Check for MCP indicator (🔌) in chat

**VS Code:**
1. Run `MCP: List Servers` command
2. Check server status in Extensions view
3. Review MCP output: `View → Output → Select "MCP"`
4. Verify Agent mode is selected in Chat

#### Authentication Errors

```bash
# Test PAT manually
curl -u ":YOUR_PAT_TOKEN" \
  https://dev.azure.com/fwcdev/_apis/projects

# Should return project list JSON
```

### Debug Logging

#### Enable Full Debug Logging

**Claude Desktop:**
```json
{
  "env": {
    "DEBUG": "*",
    "NODE_ENV": "development"
  }
}
```

**VS Code:**
```json
{
  "dev": {
    "debug": { "type": "node" }
  }
}
```

#### Log File Locations

```bash
# MCP Server Logs
tail -f logs/azure-devops-bot.log

# PM2 Logs (if using production mode)
pm2 logs azure-devops-bot

# VS Code MCP Logs
# View → Output → Select "MCP" from dropdown
```

### Performance Debugging

#### Check Database Size
```bash
ls -lh prisma/dev.db
# Should be < 50MB for good performance
```

#### Monitor Memory Usage
```bash
# During development
ps aux | grep "azure-devops-bot"

# In production with PM2
pm2 monit
```

#### Force Refresh Data
```bash
# Delete database and restart
rm prisma/dev.db
pnpm mcp --emails=user@fwc.gov.au
```

### Network Issues

#### Corporate Firewall
```json
{
  "env": {
    "HTTPS_PROXY": "http://proxy.company.com:8080",
    "HTTP_PROXY": "http://proxy.company.com:8080"
  }
}
```

#### SSL Certificate Issues
```json
{
  "env": {
    "NODE_TLS_REJECT_UNAUTHORIZED": "0"
  }
}
```

## Support

For additional support:

1. Check [GitHub Issues](https://github.com/nathanvale/azure-devops-bot/issues)
2. Review [Production Validation Results](../badges/production-environment-validation.md)
3. Enable debug logging and share logs
4. Test with minimal configuration first

---

*This guide covers advanced MCP integration scenarios. For basic setup, see [Quick Start Guide](QUICK_START.md).*