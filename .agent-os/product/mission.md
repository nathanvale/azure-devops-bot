# Product Mission

> Last Updated: 2025-08-28  
> Version: 2.0.0 (Schema-First Pivot)  
> Change Type: Architectural redesign focusing on thin, validated abstraction over Azure DevOps data

## 1. Executive Summary

Azure DevOps Bot is a tightly-scoped, schema-first Model Context Protocol (MCP) service that provides a validated, thin abstraction over Azure DevOps Work Item data. By leveraging Zod for rigorous type validation and implementing granular, domain-specific tools, we transform Azure DevOps from a complex web interface into a precise, programmatically accessible data source for AI agents and engineering workflows.

## 2. Core Mission (Original Statement – Unchanged)

> "Continuously sync ALL Azure DevOps work item data to local SQLite and serve it instantly to other AI agents—transforming Azure DevOps from a slow web interface into an always-available, lightning-fast data source for report generation and analysis."

## 3. Strategic Vision (6–12 Months)

Build the definitive "Schema-First AI Operational Substrate" for engineering work tracking by:

1. Implementing a rigorous Zod-validated schema for all Azure DevOps data representations.
2. Providing granular, statically-typed tool surfaces that eliminate runtime type uncertainty.
3. Designing an abstraction layer so thin it becomes nearly transparent, preserving the raw data's semantic integrity.
4. Creating a type-safe contract for autonomous agents that makes REST choreography unnecessary by design.

## 4. Primary Value Pillars

| Pillar                   | Description                               | Proof Mechanisms                                    |
| ------------------------ | ----------------------------------------- | --------------------------------------------------- |
| Type Safety              | Zero-runtime type uncertainty             | Zod schemas + TypeScript strict mode                |
| Performance              | Sub-100ms per query on commodity hardware | Indexed schema + local compute                      |
| Reliability              | Always-on with predictable behavior       | PM2 + validated schema integrity                    |
| Abstraction Transparency | Minimal interference with raw data        | Thin schema layer, preserved semantics              |
| Evolutionary Design      | Self-documenting, extensible architecture | Incremental schema migrations + semantic versioning |

## 5. Target Users

### Primary

1. Software Developers – rapid self-context retrieval.
2. Team Leads / Iteration Managers – sprint health & blockage analysis.
3. Product Managers – backlog shape, throughput & narrative reporting.
4. AI Agent Runtimes – continuous planning, summarization, risk surfacing.

### Secondary

- DevOps / Platform engineers (pipeline incident correlation).
- QA leads (defect aging & coverage traceability – future).

## 6. Expanded Pain Points & How We Solve Them

| Pain                       | Current Friction                 | Bot Resolution                          |
| -------------------------- | -------------------------------- | --------------------------------------- |
| Slow navigation            | Multi-click page loads           | Local indexed DB                        |
| Fragmented context         | Work, people, comments scattered | Unified denormalized + relational views |
| Reporting lag              | Manual export / Excel glue       | Programmatic agent queries              |
| Identity inconsistency     | DisplayName vs email ambiguity   | Normalized `Person` table               |
| Relationship blindness     | Parent/child & PR links hidden   | Stored relations + links                |
| API rate / batching limits | REST choreography complexity     | Centralized batch sync layer            |

## 7. Current Capability Snapshot (Post Phase 1 + Early Phase 3)

Status categories: ✅ Delivered · 🧪 Emerging · 🔜 Planned

| Capability                                       | Status | Notes                                            |
| ------------------------------------------------ | ------ | ------------------------------------------------ |
| Work Item Core Fields                            | ✅     | Schema aligned with broad ADO fields             |
| Comments Sync (Selective)                        | ✅     | Needs retry/backoff hardening                    |
| Raw JSON Preservation                            | ✅     | `rawJson` column                                 |
| Person Normalization                             | ✅     | Foreign keys + indexed lookups                   |
| Relationships (WI ↔ WI)                         | ✅     | `WorkItemRelation` extraction                    |
| External Links (PR / commits / attachments refs) | ✅     | `WorkItemLink` table (attachments metadata only) |
| Sync Metrics                                     | 🧪     | Basic attempts / success / duration              |
| Incremental (delta) sync                         | 🔜     | Watermark on `changedDate` not implemented       |
| State transition history                         | 🔜     | No dedicated history table                       |
| Health / status surface                          | 🔜     | No MCP tool yet                                  |
| Retry & resilience policies                      | 🔜     | Logging only; no structured retry tiers          |
| Attachments content ingest                       | 🔜     | Deferred (link metadata only)                    |

## 8. Success Metrics (SMART Baselines & Targets)

| Metric                                             | Current (Est.) | Target (Phase 2)                  | Stretch (Phase 3)                 |
| -------------------------------------------------- | -------------- | --------------------------------- | --------------------------------- |
| Full detailed sync duration (N=~300 items)         | TBD            | ≤ 30s                             | ≤ 15s                             |
| Median query latency (top 5 queries)               | TBD            | < 80ms                            | < 50ms                            |
| Delta sync efficiency (changed vs total fetched)   | N/A            | > 85% reduction                   | > 92% reduction                   |
| Comment sync freshness lag                         | Opportunistic  | < 3 min                           | < 90s                             |
| Successful sync streak (rolling 7 days)            | TBD            | 99%                               | 99.5%                             |
| Data completeness (fields preserved)               | Raw fallback   | 100% raw + ≥ 40 structured fields | 100% raw + ≥ 60 structured fields |
| Tool contract stability (breaking changes / month) | Unknown        | 0                                 | 0                                 |

Measurement Plan: add instrumentation for timings, counts, retry taxonomy, and delta yield before claiming baselines.

## 9. Guiding Principles

1. Local-first, offline-resilient.
2. Deterministic over “clever” (agents compose intelligence).
3. Structure opportunistically; never lose unstructured payloads.
4. Ship minimal vertical slices; harden iteratively.
5. Make performance observable early.
6. Provide stable contracts; deprecate with explicit version tags.
7. Fail soft: partial sync > no sync.

## 10. Non-Goals (Explicit Exclusions)

| Item                                         | Rationale                                           |
| -------------------------------------------- | --------------------------------------------------- |
| Rich web dashboard                           | Duplicates existing tools; focus on agent substrate |
| Natural language query parser                | Agents can transform structured data                |
| Multi-tenant cloud hosting (near-term)       | Complexity & ops overhead                           |
| Real-time push streaming before delta sync   | Premature; polling adequate                         |
| Heavy test coverage across low-risk branches | Time ROI low (DEC-005)                              |

## 11. Risk & Mitigation Snapshot

| Risk                     | Impact                     | Prob.  | Mitigation                                      |
| ------------------------ | -------------------------- | ------ | ----------------------------------------------- |
| Azure API schema drift   | Partial field loss         | Medium | Raw JSON + periodic diff checks                 |
| Rate limiting / spikes   | Sync delays                | Medium | Planned retry + adaptive backoff                |
| Data corruption (SQLite) | Full mirror loss           | Low    | Integrity check + future optional export backup |
| Growing full sync cost   | Latency regression         | Medium | Implement delta sync + selective expansions     |
| Silent partial failures  | Incomplete data narratives | Medium | Health/status tool + metrics thresholds         |

## 12. Roadmap Alignment Reference

Phases retained (0–4) with reclassified “delivered early” items annotated in the roadmap file; this mission doc mirrors status at time of last update.

## 13. Glossary (Short Form)

| Term             | Definition                                                       |
| ---------------- | ---------------------------------------------------------------- |
| MCP              | Model Context Protocol – standardized agent I/O interface        |
| Delta Sync       | Only fetch items changed since last watermark                    |
| Raw Preservation | Storing full unmodified ADO payload per item                     |
| Structured Field | Individually modeled column for fast filtering/indexing          |
| Relation         | Work item ↔ work item linkage (parent/child, related, etc.)     |
| Link             | External artifact association (PR, commit, attachment, artifact) |

---

## 14. (Legacy) Original Pitch (Retained for Traceability)

Azure DevOps Bot is a local MCP server that continuously syncs ALL Azure DevOps work item data to SQLite and serves it instantly to other AI agents. It transforms Azure DevOps from a slow web interface into an always-available, lightning-fast data source for report generation and analysis.

## 15. Users (Condensed – see Sections 5 & 6 for expanded framing)

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

## 16. The Problem (Historical Section – superseded by Sections 6 & 8)

### Slow Access to Azure DevOps Data

Azure DevOps web interface is notoriously slow and requires multiple page loads to get comprehensive work item information. This creates friction in daily development workflows and makes it impossible to get instant insights.

**Our Solution:** Local SQLite mirror with 2-minute sync intervals provides sub-100ms query response times.

### Limited Reporting Capabilities

Azure DevOps built-in reports are basic and don't provide the detailed, formatted output needed for stakeholder communication.

**Our Solution:** Structured JSON data that AI agents can transform into beautiful markdown reports with all the details you need.

### No Always-On Availability

Developers need to manually access Azure DevOps, remember URLs, navigate through interfaces, and deal with authentication timeouts.

**Our Solution:** Always-running MCP server that other agents can query instantly without any manual intervention.

## 17. Differentiators (Reframed – kept for compatibility; see Value Pillars)

### Complete Data Mirror

Unlike Azure DevOps REST API wrappers, we store EVERYTHING locally - every field, every comment, every piece of metadata - with full JSON backup to ensure nothing is ever lost.

### AI Agent Optimized

Unlike traditional Azure DevOps integrations that focus on human interfaces, we're designed specifically for AI agent consumption with structured JSON output and semantic field mapping.

### True Always-On Architecture

Unlike web-based tools that require active sessions, our PM2-managed process ensures 24/7 availability with automatic crash recovery and boot persistence.

## 18. Key Features (Snapshot – superseded by Capability Matrix)

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
