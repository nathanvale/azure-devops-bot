# Azure DevOps Bot CLI Usage Guide

> Professional Command-Line Interface for Azure DevOps Work Item Management
> Version: 1.0.0

## Table of Contents

- [Overview](#overview)
- [Installation & Setup](#installation--setup)
- [CLI Options Reference](#cli-options-reference)
- [Verbosity Levels](#verbosity-levels)
- [Output Formats](#output-formats)
- [Usage Examples](#usage-examples)
- [Progress Indicators](#progress-indicators)
- [Error Handling](#error-handling)
- [Configuration](#configuration)
- [AI Agent Integration](#ai-agent-integration)
- [Migration Guide](#migration-guide)
- [Troubleshooting](#troubleshooting)
- [API Reference](#api-reference)

## Overview

The Azure DevOps Bot CLI provides a professional, flexible command-line interface for managing Azure DevOps work items with configurable verbosity levels, multiple output formats, and visual progress indicators. Designed for both human developers and AI agents, it maintains sub-100ms query response times through local SQLite storage.

### Key Features

✅ **Professional CLI Interface** - Full Commander.js integration with comprehensive help  
✅ **Configurable Verbosity** - Four levels from quiet to debug output  
✅ **Multiple Output Formats** - Text, JSON, and Markdown formats  
✅ **Visual Progress Indicators** - Spinners and progress bars for long operations  
✅ **Enhanced Error Messages** - Contextual guidance and troubleshooting tips  
✅ **Backward Compatible** - Existing scripts and PM2 configurations work unchanged  

## Installation & Setup

### Installation

```bash
# Install globally
npm install -g azure-devops-bot

# Or use with npx
npx azure-devops-bot --help

# Or from source
git clone https://github.com/your-org/azure-devops-bot
cd azure-devops-bot
pnpm install
pnpm build
```

### Initial Setup

1. **Set up environment variables**:

```bash
# Required: Your Azure DevOps email addresses (comma-separated)
export AZURE_DEVOPS_USER_EMAILS="jane.doe@company.com,JD@company.com"

# Required: Personal Access Token with Work Items read/write permissions
export AZURE_DEVOPS_PAT="your-personal-access-token"

# Optional: Organization and project (defaults in code)
export AZURE_DEVOPS_ORG="your-organization"
export AZURE_DEVOPS_PROJECT="your-project"
```

2. **Or use a .env file**:

```env
AZURE_DEVOPS_USER_EMAILS=jane.doe@company.com,JD@company.com
AZURE_DEVOPS_PAT=your-personal-access-token
AZURE_DEVOPS_ORG=your-organization
AZURE_DEVOPS_PROJECT=your-project
```

## CLI Options Reference

### Basic Usage

```bash
azure-devops-bot [options] [query]
```

### Global Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--version` | `-V` | Display version number | - |
| `--help` | `-h` | Display help information | - |
| `--verbose` | `-v` | Detailed output with comprehensive logging | false |
| `--quiet` | `-q` | Minimal output showing only essential information | false |
| `--debug` | `-d` | Maximum verbosity including debug logs and API traces | false |
| `--format <type>` | `-f` | Output format: text, json, or markdown | text |

### Query Parameter

The `[query]` parameter accepts natural language queries or commands:
- `"my work items"` - Your assigned work items
- `"sprint status"` - Current sprint overview
- `"summary"` - Default summary view
- `"sync"` - Force data synchronization

## Verbosity Levels

### Level 0: QUIET (`--quiet`)

Minimal output showing only errors and final results. Perfect for CI/CD pipelines and automated scripts.

```bash
azure-devops-bot --quiet "my work items"
# Output: Only essential data, no progress indicators
```

### Level 1: NORMAL (default)

Key milestones and summaries. Balanced output for everyday use.

```bash
azure-devops-bot "sprint status"
# Output: Progress milestones, summaries, key information
```

### Level 2: VERBOSE (`--verbose`)

Detailed logging and progress information. Useful for monitoring operations.

```bash
azure-devops-bot --verbose "sync"
# Output: Detailed progress, operation details, timing information
```

### Level 3: DEBUG (`--debug`)

Complete traces, API calls, and diagnostic information. Essential for troubleshooting.

```bash
azure-devops-bot --debug "sync issues"
# Output: Full API traces, request/response details, internal state
```

## Output Formats

### Text Format (Default)

Human-readable output with colors and formatting. Best for interactive terminal use.

```bash
azure-devops-bot "my work items"

# Output:
# 📋 Work Items (5 found):
# 
#   1. Implement user authentication
#      [Active] • @jane.doe
#      Implement OAuth2 authentication flow...
# 
#   2. Fix database migration issue
#      [Resolved] • @john.smith
#      Migration script failing on production...
```

### JSON Format

Structured data perfect for programmatic processing and AI agents.

```bash
azure-devops-bot --format json "my work items"

# Output:
# {
#   "timestamp": "2025-08-27T10:00:00.000Z",
#   "count": 5,
#   "items": [
#     {
#       "id": 12345,
#       "title": "Implement user authentication",
#       "state": "Active",
#       "assignedTo": "jane.doe@company.com",
#       "workItemType": "User Story",
#       "createdDate": "2025-08-25T09:00:00Z"
#     }
#   ],
#   "metadata": null
# }
```

### Markdown Format

Documentation-ready format for reports and wikis.

```bash
azure-devops-bot --format markdown "sprint report"

# Output:
# # Azure DevOps Work Items Report
# 
# *Generated: 2025-08-27T10:00:00Z*
# *Query: sprint report*
# 
# ## Summary
# 
# Found **15** work items.
# 
# ## Work Items
# 
# ### 1. Implement user authentication
# - **ID:** 12345
# - **State:** Active
# - **Assigned To:** jane.doe@company.com
# - **Type:** User Story
```

## Usage Examples

### Common Scenarios

#### Quick Status Check

```bash
# Minimal output for quick status
azure-devops-bot --quiet "my work items"
```

#### Detailed Sprint Report

```bash
# Verbose markdown report for documentation
azure-devops-bot --verbose --format markdown "current sprint"
```

#### AI Agent Integration

```bash
# JSON output for AI processing
azure-devops-bot --format json "work items needing attention"
```

#### Debugging Sync Issues

```bash
# Full debug output for troubleshooting
azure-devops-bot --debug "sync"
```

#### CI/CD Pipeline Integration

```bash
# Silent operation with exit codes
azure-devops-bot --quiet --format json "critical bugs" || exit 1
```

### Combined Options

```bash
# Verbose JSON output for detailed programmatic analysis
azure-devops-bot --verbose --format json "all work items"

# Debug mode with markdown for detailed documentation
azure-devops-bot --debug --format markdown "sync status"

# Quiet mode with specific query
azure-devops-bot --quiet "work item 12345"
```

## Progress Indicators

### Spinner Indicators

For indeterminate operations (unknown duration):

```
🔄 Validating email addresses...
✅ Email validation successful

🔄 Syncing work items...
✅ Sync completed
```

### Progress Bars

For determinate operations (known item count):

```
📊 Syncing comments |████████░░| 80% || 400/500 Items || ETA: 5s
```

### Verbosity-Aware Display

- **QUIET mode**: No progress indicators
- **NORMAL mode**: Spinners only
- **VERBOSE mode**: Spinners + periodic status updates
- **DEBUG mode**: Full progress details with timing

## Error Handling

### Enhanced Error Messages

The CLI provides contextual error messages with actionable guidance:

```bash
❌ Error: Email validation failed
   Details: {
     invalidEmails: ['john.doe@company.com'],
     validEmails: []
   }

┌ Email Validation Failed ────────────────────────┐
│                                                 │
│   Please ensure these email addresses:          │
│     1. Are correctly spelled                    │
│     2. Exist in the Azure DevOps organization   │
│     3. Have access to the project               │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Setup Guidance

Missing configuration triggers helpful setup instructions:

```bash
❌ Error: AZURE_DEVOPS_USER_EMAILS environment variable is required

┌ Setup Required ──────────────────────────────────┐
│                                                  │
│   Set your email address(es) for Azure DevOps:  │
│                                                  │
│   Example: AZURE_DEVOPS_USER_EMAILS=jane@co.com │
│                                                  │
│   Methods:                                       │
│   1. Create .env file                            │
│   2. Export in shell                             │
│   3. Add to shell profile                        │
│                                                  │
└──────────────────────────────────────────────────┘
```

## Configuration

### Environment Variables

```bash
# Required
AZURE_DEVOPS_USER_EMAILS    # Comma-separated email addresses
AZURE_DEVOPS_PAT            # Personal Access Token

# Optional
AZURE_DEVOPS_ORG            # Organization name
AZURE_DEVOPS_PROJECT        # Project name
SYNC_INTERVAL               # Sync interval in ms (default: 120000)
LOG_LEVEL                   # Logging level (debug, info, warn, error)
```

### .env File

Create a `.env` file in the project root:

```env
# Azure DevOps Configuration
AZURE_DEVOPS_USER_EMAILS=jane.doe@company.com,JD@company.com
AZURE_DEVOPS_PAT=vsts_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AZURE_DEVOPS_ORG=myorganization
AZURE_DEVOPS_PROJECT=MyProject

# Optional Settings
SYNC_INTERVAL=300000  # 5 minutes
LOG_LEVEL=info
```

## AI Agent Integration

### Design Principles

The CLI is optimized for AI agent consumption:

1. **Structured Output**: Consistent JSON schema for all responses
2. **Predictable Behavior**: No interactive prompts in quiet/json modes
3. **Fast Response**: Sub-100ms queries from local SQLite cache
4. **Clear Errors**: Machine-readable error codes and messages

### Integration Example

```javascript
// AI agent integration example
const { exec } = require('child_process');

async function getWorkItems() {
  return new Promise((resolve, reject) => {
    exec('azure-devops-bot --quiet --format json "my work items"', 
      (error, stdout, stderr) => {
        if (error) {
          reject(JSON.parse(stderr));
        } else {
          resolve(JSON.parse(stdout));
        }
      }
    );
  });
}

// Usage in AI agent
const workItems = await getWorkItems();
console.log(`Found ${workItems.count} work items to process`);
```

### MCP Protocol Integration

The bot includes a Model Context Protocol server for direct AI integration:

```bash
# Start MCP server
pnpm mcp

# Connect via stdio transport
# Tools available: wit_my_work_items, wit_get_work_item, etc.
```

## Migration Guide

### From Console.log to OutputManager

If you're extending the codebase, migrate from direct console output to the CLI system:

#### Before (Direct console.log)

```javascript
console.log('🔍 Validating email addresses...');
console.log(`✅ Validated ${emails.length} emails`);
console.error('❌ Error:', error.message);
```

#### After (Using OutputManager)

```javascript
outputManager.startSpinner('Validating email addresses...');
outputManager.stopSpinner(`Validated ${emails.length} emails`);
outputManager.error('Validation failed', error);
```

### Migration Benefits

- ✅ Automatic verbosity filtering
- ✅ Format-aware output (text/json/markdown)
- ✅ Consistent error handling
- ✅ Progress indication support
- ✅ Testing-friendly (mockable)

## Troubleshooting

### Common Issues

#### 1. Authentication Failures

**Problem**: "Azure DevOps authentication validation failed"

**Solutions**:
- Verify PAT token is valid and not expired
- Ensure token has "Work Items (read & write)" permissions
- Check organization and project names are correct
- Test network connectivity to dev.azure.com

#### 2. Email Validation Issues

**Problem**: "Email validation failed"

**Solutions**:
- Verify email addresses match Azure DevOps account exactly
- Check for typos and case sensitivity
- Ensure user has access to the specified project
- Try both primary and alternate email addresses

#### 3. Slow Performance

**Problem**: Queries taking longer than expected

**Solutions**:
- Check if initial sync has completed
- Verify SQLite database isn't corrupted
- Increase sync interval for large projects
- Use `--debug` to identify bottlenecks

#### 4. Output Format Issues

**Problem**: Output not in expected format

**Solutions**:
- Verify `--format` value is: text, json, or markdown
- Check for typos in format specification
- Ensure terminal supports colors (for text format)
- Validate JSON parsing in consuming applications

### Debug Commands

```bash
# Check configuration
azure-devops-bot --debug "config"

# Test authentication
azure-devops-bot --debug "auth test"

# Force fresh sync
azure-devops-bot --debug "force sync"

# View sync metrics
azure-devops-bot --verbose "sync status"
```

## API Reference

### CLIConfiguration Interface

```typescript
interface CLIConfiguration {
  verbosity: VerbosityLevel;  // 0-3 (QUIET to DEBUG)
  format: OutputFormat;        // 'text' | 'json' | 'markdown'
  debug: boolean;              // Debug mode flag
  quiet: boolean;              // Quiet mode flag
}
```

### OutputManager Methods

```typescript
class OutputManager {
  // Logging methods
  info(message: string, details?: any, level?: VerbosityLevel): void
  success(message: string, details?: any, level?: VerbosityLevel): void
  error(message: string, details?: any): void
  warn(message: string, details?: any): void
  debug(message: string, details?: any): void
  
  // Progress methods
  startSpinner(text: string): void
  updateSpinner(text: string): void
  stopSpinner(successMessage?: string): void
  
  // Formatting methods
  formatResult(data: any): void
  box(message: string, title?: string): void
}
```

### ProgressManager Methods

```typescript
class ProgressManager {
  // Determinate progress
  startProgress(label: string, total: number): void
  updateProgress(current: number, statusText?: string): void
  completeProgress(message?: string): void
  
  // Indeterminate progress
  startIndeterminate(label: string): void
  stopIndeterminate(message?: string): void
  
  // Reporting
  reportProgress(current: number, total: number, operation: string): void
}
```

## Performance Characteristics

- **Startup Time**: <5ms CLI parsing overhead
- **Query Response**: <100ms from local SQLite
- **Sync Performance**: ~30 seconds for 1000 work items
- **Memory Usage**: ~50MB baseline, scales with data
- **Output Formatting**: <10ms for 1000 items

## Security Considerations

- **PAT Storage**: Use environment variables or secure credential managers
- **No External Transmission**: All data stays local
- **Audit Logging**: Available in DEBUG mode
- **Permission Scoping**: Use minimal PAT permissions

## Best Practices

1. **Use appropriate verbosity**: Default for normal use, quiet for automation
2. **Choose right format**: Text for humans, JSON for machines, Markdown for docs
3. **Handle errors gracefully**: Check exit codes in scripts
4. **Cache efficiently**: Let background sync handle updates
5. **Secure credentials**: Never commit PAT tokens to version control

## Support & Contributing

- **Issues**: Report bugs on GitHub Issues
- **Documentation**: This guide and inline `--help`
- **Source Code**: Available on GitHub
- **License**: ISC

---

*Built for speed, designed for simplicity, optimized for AI agents.*