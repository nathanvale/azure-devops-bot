# Azure DevOps Bot - Always-On PM2 Configuration

This document explains how to set up and manage the Azure DevOps Bot as an always-on service using PM2 process management.

## 🎯 Overview

The PM2 configuration transforms the Azure DevOps Bot MCP server into a 24/7 always-available service with:

- ✅ **Automatic crash recovery** - Process restarts if it fails
- ✅ **Boot persistence** - Automatically starts on system reboot
- ✅ **Log management** - Structured logging with rotation
- ✅ **Process monitoring** - Real-time health and performance metrics
- ✅ **stdio Transport compatibility** - Maintains MCP protocol functionality
- ✅ **Zero-downtime reloads** - Update without stopping the service

## 🚀 Quick Start

### 1. Initial Setup

```bash
# Configure your email addresses in ecosystem.config.js first!
# Edit the 'args' field: --emails=your.email@domain.com

# Run the automated setup script
pnpm run pm2:setup

# Or manually install PM2 globally
npm install -g pm2
```

### 2. Start the Service

```bash
# Start the Azure DevOps Bot service
pnpm run pm2:start

# Verify it's running
pnpm run pm2:status
```

### 3. Enable Boot Persistence

```bash
# Generate startup command (run once)
pm2 startup

# Run the command shown (usually starts with sudo)
# This enables the service to start automatically on boot

# Save current process list
pm2 save
```

## ⚙️ Configuration

### Ecosystem Configuration (`ecosystem.config.js`)

The PM2 configuration is designed specifically for MCP server requirements:

```javascript
{
  name: 'azure-devops-bot',
  script: './src/mcp-server.ts',
  interpreter: 'tsx',                    // TypeScript execution
  args: '--emails=your@email.com',       // ⚠️ MUST CONFIGURE
  instances: 1,                          // Single instance for stdio
  exec_mode: 'fork',                     // Fork mode for stdio transport
  autorestart: true,                     // Auto-restart on crash
  max_restarts: 10,                      // Limit restart attempts
  max_memory_restart: '500M',            // Restart if memory exceeds 500MB
}
```

**🚨 Important**: You MUST update the `args` field with your actual email address(es) before starting.

### Email Configuration

The MCP server requires email configuration to filter work items. Update `ecosystem.config.js`:

```javascript
// Single email
args: '--emails=john.doe@company.com'

// Multiple emails
args: '--emails=john.doe@company.com,j.doe@company.com'
```

## 📋 Available Commands

### Process Management
```bash
pnpm run pm2:start      # Start the service
pnpm run pm2:stop       # Stop the service
pnpm run pm2:restart    # Restart the service
pnpm run pm2:reload     # Zero-downtime reload
pnpm run pm2:status     # Check process status
```

### Monitoring & Debugging
```bash
pnpm run pm2:logs       # View live logs
pnpm run pm2:monitor    # Launch monitoring dashboard
pnpm run pm2:validate   # Validate PM2 setup
```

### Manual PM2 Commands
```bash
pm2 logs azure-devops-bot --lines 100  # Last 100 log lines
pm2 describe azure-devops-bot           # Detailed process info
pm2 reset azure-devops-bot              # Reset restart counter
```

## 📊 Monitoring & Logs

### Log Files

PM2 automatically creates and manages log files:

```
./logs/azure-devops-bot.log         # Combined logs (stdout + stderr)
./logs/azure-devops-bot-out.log     # Standard output logs
./logs/azure-devops-bot-error.log   # Error logs
```

### Health Monitoring

```bash
# Real-time monitoring dashboard
pnpm run pm2:monitor

# Quick status check
pnpm run pm2:status

# Validate entire setup
pnpm run pm2:validate
```

### Key Metrics to Watch

- **Status**: Should be 'online'
- **CPU Usage**: Typically <5% when idle, spikes during sync
- **Memory**: Should stay under 200MB normally
- **Restarts**: Should be 0 for a healthy process
- **Uptime**: Should increase steadily

## 🔧 Troubleshooting

### Common Issues

**Process Won't Start**
```bash
# Check configuration
pnpm run pm2:validate

# View error logs
pm2 logs azure-devops-bot --err

# Common fix: Update email configuration
nano ecosystem.config.js
```

**stdio Transport Not Working**
- Ensure `exec_mode: 'fork'` (not cluster mode)
- Ensure `instances: 1` (not multiple instances)
- Check that logs show MCP server startup messages

**High Restart Count**
```bash
# Check what's causing crashes
pm2 logs azure-devops-bot --err --lines 50

# Common causes:
# - Email configuration missing/invalid
# - Azure CLI authentication expired
# - Database corruption
```

**Service Not Starting on Boot**
```bash
# Reconfigure startup
pm2 unstartup
pm2 startup
# Run the command shown
pm2 save
```

### Validation Script

Run comprehensive health checks:

```bash
pnpm run pm2:validate
```

This checks:
- ✅ PM2 installation
- ✅ Process status
- ✅ Log file creation
- ✅ Configuration validity
- ✅ Startup service configuration

## 🔄 Development Workflow

### Development Mode

For development, continue using the regular command:

```bash
# Development with hot reload
pnpm run mcp --emails=your@email.com
```

### Production Deployment

```bash
# 1. Stop development processes
# 2. Update configuration
nano ecosystem.config.js

# 3. Start production service
pnpm run pm2:start

# 4. Verify running
pnpm run pm2:status

# 5. Save configuration
pm2 save
```

### Updates & Maintenance

```bash
# Zero-downtime code updates
git pull
pnpm run pm2:reload

# Or restart if needed
pnpm run pm2:restart

# Always validate after changes
pnpm run pm2:validate
```

## 🏗️ Architecture Compatibility

### MCP Protocol Requirements

The PM2 configuration is specifically designed for MCP server requirements:

- **stdio Transport**: Fork mode preserves stdin/stdout for MCP communication
- **Single Instance**: MCP servers typically run as single processes
- **Process Isolation**: Clean process boundaries for restart safety
- **Signal Handling**: Proper SIGINT/SIGTERM handling for graceful shutdown

### Service Layer Architecture

```
MCP Client (Claude Code)
    ↓ stdio transport
PM2 Process Manager
    ↓ manages
Azure DevOps MCP Server
    ↓ uses
Database Service → Sync Service → Azure CLI
```

### Background Sync Preservation

The existing background sync functionality continues to work:
- 2-5 minute sync intervals are preserved
- Detailed metadata sync on startup
- All 8 MCP tools remain functional
- Sub-100ms query performance maintained

## 📈 Performance Considerations

### Resource Usage

- **Memory**: ~100-200MB typical, <500MB maximum (auto-restart trigger)
- **CPU**: <5% idle, brief spikes during Azure DevOps sync
- **Disk**: SQLite database grows with work item history
- **Network**: Only outbound to Azure DevOps (via Azure CLI)

### Scaling Considerations

- Single process design (required for stdio MCP transport)
- Local SQLite database (no external dependencies)
- Memory-efficient with automatic restart on high usage
- Designed for single-user development workflow

## 🛡️ Security & Best Practices

### Security Features

- No network exposure (stdio transport only)
- Inherits Azure CLI authentication (SSO)
- Local-only data storage
- Process isolation via PM2

### Best Practices

1. **Regular Validation**: Run `pnpm run pm2:validate` weekly
2. **Log Monitoring**: Check logs for authentication issues
3. **Resource Monitoring**: Watch memory usage trends
4. **Backup Strategy**: SQLite database can be backed up while running
5. **Update Process**: Use `pm2:reload` for zero-downtime updates

---

## ✅ Phase 1 Completion

With PM2 configuration complete, the Azure DevOps Bot achieves:

- **Always-On Availability**: 24/7 service with automatic restart ✅
- **Boot Persistence**: Survives system reboots ✅
- **Crash Recovery**: Automatic restart with data integrity ✅
- **Process Monitoring**: Health checks and performance metrics ✅
- **stdio Transport**: Full MCP protocol compatibility ✅

**Phase 1 Always-On Data Mirror: 100% Complete** 🎉