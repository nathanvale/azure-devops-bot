# Product Mission

> Last Updated: 2025-08-21
> Version: 1.0.0

## Pitch

Azure DevOps Bot is a local MCP server that continuously syncs ALL Azure DevOps work item data to SQLite and serves it instantly to other AI agents. It transforms Azure DevOps from a slow web interface into an always-available, lightning-fast data source for report generation and analysis.

## Users

### Primary Customers

- **Software Developers**: Who need instant access to work item data without waiting for Azure DevOps web UI
- **Team Leads**: Who want to generate detailed sprint reports and track team progress
- **Product Managers**: Who need quick insights into work item status and trends

### User Personas

**Kenny (Development Team Lead)** (30-45 years old)
- **Role:** Senior Developer / Team Lead
- **Context:** Manages sprint planning and team coordination for Customer Services Platform project
- **Pain Points:** Azure DevOps web UI is slow, difficult to get comprehensive views, no way to quickly generate detailed reports
- **Goals:** Always have instant access to complete work item data, generate beautiful reports for stakeholders, never wait for web pages to load

## The Problem

### Slow Access to Azure DevOps Data

Azure DevOps web interface is notoriously slow and requires multiple page loads to get comprehensive work item information. This creates friction in daily development workflows and makes it impossible to get instant insights.

**Our Solution:** Local SQLite mirror with 2-minute sync intervals provides sub-100ms query response times.

### Limited Reporting Capabilities

Azure DevOps built-in reports are basic and don't provide the detailed, formatted output needed for stakeholder communication.

**Our Solution:** Structured JSON data that AI agents can transform into beautiful markdown reports with all the details you need.

### No Always-On Availability

Developers need to manually access Azure DevOps, remember URLs, navigate through interfaces, and deal with authentication timeouts.

**Our Solution:** Always-running MCP server that other agents can query instantly without any manual intervention.

## Differentiators

### Complete Data Mirror

Unlike Azure DevOps REST API wrappers, we store EVERYTHING locally - every field, every comment, every piece of metadata - with full JSON backup to ensure nothing is ever lost.

### AI Agent Optimized

Unlike traditional Azure DevOps integrations that focus on human interfaces, we're designed specifically for AI agent consumption with structured JSON output and semantic field mapping.

### True Always-On Architecture

Unlike web-based tools that require active sessions, our PM2-managed process ensures 24/7 availability with automatic crash recovery and boot persistence.

## Key Features

### Core Features

- **Complete Data Sync**: Every Azure DevOps field synced locally with 2-minute refresh intervals
- **Instant Queries**: Sub-100ms response times from local SQLite database
- **AI-Ready Output**: Structured JSON perfect for AI agent report generation
- **Always-On Service**: PM2 process management ensures 24/7 availability

### Data Features

- **Sprint Information**: Iteration paths, board columns, sprint assignments
- **Work Tracking**: Story points, effort, remaining work, all date fields
- **Comments**: All work item comments with full history
- **Relationships**: Parent/child work item relationships
- **People**: Created by, assigned to, closed by, resolved by tracking
- **Content**: Acceptance criteria, descriptions, reproduction steps

### Integration Features

- **MCP Protocol**: Native integration with Claude Code and other MCP clients
- **Batch Processing**: Efficient parallel fetching from Azure DevOps
- **Error Recovery**: Robust error handling with automatic retries
- **Raw JSON Backup**: Complete Azure DevOps response stored for any missing fields