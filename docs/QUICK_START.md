# Quick Start - 5 Minutes to Azure DevOps Bot MCP Server

Get the Azure DevOps Bot MCP server running with Claude Desktop or VS Code in under 5 minutes.

## Prerequisites ✅

- Node.js 18+ and pnpm installed
- Azure DevOps access to fwcdev organization
- Claude Desktop OR VS Code with Copilot

## Step 1: Clone & Install (60 seconds)

```bash
git clone https://github.com/nathanvale/azure-devops-bot.git
cd azure-devops-bot
pnpm install
```

## Step 2: Get PAT Token (2 minutes)

1. Go to [Azure DevOps Personal Access Tokens](https://dev.azure.com/fwcdev/_usersSettings/tokens)
2. Click **"+ New Token"**
3. Name: `"MCP Bot Token"`
4. Scopes: **"Work Items (read & write)"**
5. Click **"Create"** and copy the token

## Step 3: Set Environment Variable (10 seconds)

```bash
export AZURE_DEVOPS_PAT="your-copied-token-here"
```

## Step 4: Test Server (30 seconds)

```bash
pnpm mcp --emails=your.email@fwc.gov.au
```

**Expected output:**
```
✅ Email validation passed for: your.email@fwc.gov.au  
🔄 Starting background sync (2 minute intervals)
✅ MCP server started successfully
```

## Step 5: Connect to Client (90 seconds)

### Option A: Claude Desktop (Recommended)

1. **Find config file:**
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`

2. **Add this configuration:**
   ```json
   {
     "mcpServers": {
       "azure-devops-bot": {
         "command": "pnpm",
         "args": ["mcp", "--emails=your.email@fwc.gov.au"],
         "cwd": "/absolute/path/to/azure-devops-bot",
         "env": {
           "AZURE_DEVOPS_PAT": "your-token-here"
         }
       }
     }
   }
   ```

3. **Restart Claude Desktop**

4. **Test:** Look for MCP indicator 🔌 and try: *"Show my active work items"*

### Option B: VS Code

1. **Create** `.vscode/mcp.json` in your workspace:
   ```json
   {
     "servers": {
       "azure-devops-bot": {
         "type": "stdio",
         "command": "pnpm",
         "args": ["mcp", "--emails=your.email@fwc.gov.au"],
         "cwd": "/absolute/path/to/azure-devops-bot",
         "env": {
           "AZURE_DEVOPS_PAT": "your-token-here"
         }
       }
     }
   }
   ```

2. **Open Chat** (`Ctrl+Alt+I`) → Select **"Agent"** mode

3. **Click Tools** → Select azure-devops-bot tools

4. **Test:** Ask *"Show my active work items"*

## ✅ Success!

You should now see:
- MCP server indicator in your client
- 8 Azure DevOps tools available
- Instant work item responses (<100ms)

## 🚀 Next Steps

- [Complete README](../README.md) - Full documentation
- [MCP Integration Guide](MCP_INTEGRATION.md) - Advanced configuration
- [Production Setup](PM2_PRODUCTION.md) - 24/7 operation

## 🔧 Quick Troubleshooting

### PAT Token Issues
- **Error**: "Authentication failed"
- **Fix**: Verify token has "Work Items (read & write)" scope

### Server Not Found
- **Error**: No MCP tools appearing
- **Fix**: Check absolute path in configuration and restart client

### Performance Issues  
- **Error**: Slow responses
- **Fix**: Wait for initial sync to complete (~30 seconds)

## 💡 Pro Tips

1. **Multiple Users**: Add comma-separated emails: `--emails=user1@fwc.gov.au,user2@fwc.gov.au`
2. **Production Mode**: Use PM2 for 24/7 operation: `pm2 start ecosystem.config.js`
3. **Debug Mode**: Add `DEBUG=*` prefix to see detailed logs
4. **Force Sync**: Use `wit_force_sync_work_items` tool for immediate data refresh

---

*Total setup time: ~5 minutes | Ready for production use*