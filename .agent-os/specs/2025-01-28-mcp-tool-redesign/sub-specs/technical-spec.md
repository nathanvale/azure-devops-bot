# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-01-28-mcp-tool-redesign/spec.md

> Created: 2025-01-28
> Version: 1.0.0

## Technical Requirements

### Microsoft Azure DevOps MCP Patterns Analysis

Based on analysis of Microsoft's azure-devops-mcp repository, the following patterns should be implemented:

**Domain Organization Structure:**

- Tools organized into logical domains with clear prefixes
- Each domain focuses on specific Azure DevOps capabilities
- Selective domain loading support for customization

**Schema-First Design Principles:**

- Comprehensive Zod validation for all inputs and outputs
- Thin abstraction layer over existing database/API operations
- Runtime type safety with compile-time TypeScript integration
- Composable validation patterns for complex data structures

**Tool Naming Convention:**

- Format: `{domain}_{action}_{target}` (e.g., `cache_get_work_item`, `sync_force_detailed`)
- Clear, predictable naming that indicates functionality
- Consistent verb usage across domains

### Current vs Target Architecture Comparison

**Current Implementation (8 Tools):**

```typescript
// Mixed concerns in single tools
cache_list_my_work_items // Cache + filtering
wit_force_sync_work_items // Sync operation
wit_my_work_items // Legacy API call
wit_get_work_item // Direct database
wit_add_work_item_comment // Write operation
// ... 3 more mixed-concern tools
```

**Target Microsoft Pattern (25+ Focused Tools):**

```typescript
// Cache Domain (Local database, read-only)
cache_get_work_item
cache_list_work_items
cache_get_work_item_relations
cache_get_sync_summary

// Sync Domain (Data synchronization)
sync_force_work_items
sync_force_comments
sync_get_status
sync_get_metrics

// Admin Domain (System management)
admin_health_check
admin_verify_tables
admin_get_statistics

// Work Items Domain (Direct API operations)
wit_create_work_item
wit_update_work_item
wit_add_comment
wit_link_to_pull_request

// Core Domain (Project-level operations)
core_get_project_info
core_list_teams
```

## Approach Options

**Option A: Incremental Migration**

- Pros: Maintains backward compatibility, gradual rollout, lower risk
- Cons: Temporary complexity with dual systems, longer migration period

**Option B: Complete Replacement (Selected)**

- Pros: Clean architecture, immediate benefits, simplified codebase
- Cons: Breaking changes require careful migration planning

**Option C: Parallel Implementation**

- Pros: A/B testing capability, fallback options
- Cons: Significant complexity, resource overhead

**Rationale:** Option B provides the cleanest migration path while the system is still in active development phase, allowing us to fully adopt Microsoft's patterns without legacy complexity.

## External Dependencies

### New Dependencies

- **zod** (^3.22.4) - Runtime schema validation and TypeScript integration
- **@types/node** (^20.10.0) - Enhanced TypeScript support for Node.js patterns

### Justification

- **Zod**: Essential for Microsoft's MCP pattern implementation, provides runtime type safety that JSON Schema cannot offer
- **Enhanced TypeScript types**: Required for proper Zod integration and improved developer experience

## Implementation Architecture

### 1. Domain Structure

```typescript
// src/mcp-tools/domains/
├── cache/           // Local database operations
├── sync/            // Data synchronization
├── admin/           // System management
├── wit/             // Work items API operations
└── core/            // Project-level operations
```

### 2. Zod Schema Patterns

```typescript
// Input validation with Zod
import { z } from 'zod'

const WorkItemIdSchema = z.object({
  id: z.number().int().positive().describe('Work item ID'),
})

const WorkItemFiltersSchema = z.object({
  states: z.array(z.string()).optional().describe('Filter by states'),
  assignee: z.string().email().optional().describe('Filter by assignee email'),
  top: z
    .number()
    .int()
    .min(1)
    .max(500)
    .default(50)
    .describe('Max items to return'),
})

// Output validation
const WorkItemResponseSchema = z.object({
  id: z.number(),
  title: z.string(),
  state: z.string(),
  assignedTo: z.string().nullable(),
  // ... comprehensive work item fields
})
```

### 3. Tool Registration Pattern

```typescript
export class MCPToolRegistry {
  private domains: Map<string, Domain> = new Map()

  registerDomain(name: string, domain: Domain) {
    this.domains.set(name, domain)
  }

  getTools(enabledDomains: string[] = ['cache', 'sync', 'admin']): Tool[] {
    return Array.from(this.domains.entries())
      .filter(([name]) => enabledDomains.includes(name))
      .flatMap(([_, domain]) => domain.getTools())
  }
}
```

### 4. Domain Implementation Example

```typescript
// src/mcp-tools/domains/cache/index.ts
export class CacheDomain implements Domain {
  constructor(private db: DatabaseService) {}

  getTools(): Tool[] {
    return [
      {
        name: 'cache_get_work_item',
        description: 'Get a single work item from local cache by ID',
        inputSchema: zodToJsonSchema(WorkItemIdSchema),
      },
      {
        name: 'cache_list_work_items',
        description: 'List work items from local cache with optional filters',
        inputSchema: zodToJsonSchema(WorkItemFiltersSchema),
      },
      // ... more cache tools
    ]
  }

  async handleTool(name: string, args: unknown): Promise<unknown> {
    switch (name) {
      case 'cache_get_work_item': {
        const { id } = WorkItemIdSchema.parse(args)
        const workItem = await this.db.getWorkItemById(id)
        return WorkItemResponseSchema.parse(workItem)
      }
      // ... more handlers
    }
  }
}
```

### 5. Backward Compatibility Layer

```typescript
// Legacy tool name mapping during migration
const LEGACY_TOOL_MAPPING = {
  wit_my_work_items: 'cache_list_my_work_items',
  wit_get_work_item: 'cache_get_work_item',
  wit_force_sync_work_items: 'sync_force_work_items',
  // ... complete mapping
} as const

export function createBackwardCompatibilityTools(): Tool[] {
  return Object.entries(LEGACY_TOOL_MAPPING).map(([oldName, newName]) => ({
    name: oldName,
    description: `[DEPRECATED] Use ${newName} instead. ${getToolDescription(newName)}`,
    inputSchema: getToolSchema(newName),
    deprecated: true,
  }))
}
```

## Migration Strategy

### Phase 1: Foundation (Days 1-2)

1. Install Zod dependency
2. Create domain structure and base classes
3. Implement schema utilities and validation helpers
4. Set up tool registry system

### Phase 2: Core Domains (Days 3-5)

1. Implement Cache domain (most used tools)
2. Implement Sync domain (critical for data freshness)
3. Implement Admin domain (system health)
4. Add comprehensive Zod schemas for all data types

### Phase 3: Advanced Domains (Days 6-7)

1. Implement WIT domain (write operations)
2. Implement Core domain (project-level operations)
3. Add domain-specific validation patterns
4. Performance testing and optimization

### Phase 4: Migration & Cleanup (Day 8)

1. Create backward compatibility layer
2. Update documentation and examples
3. Integration testing with all domains
4. Remove deprecated tool implementations

## Performance Considerations

- **Zod Validation Overhead**: ~1-2ms per validation call (acceptable for sub-100ms target)
- **Schema Compilation**: Pre-compile schemas at startup to avoid runtime compilation
- **Memory Usage**: Domain structure adds ~5-10MB memory overhead (negligible)
- **Tool Discovery**: Lazy-load domain handlers to reduce startup time

## Risk Mitigation

- **Schema Evolution**: Use Zod's `.extend()` for backward-compatible schema changes
- **Validation Errors**: Comprehensive error messages with field-level details
- **Domain Isolation**: Each domain can fail independently without affecting others
- **Rollback Strategy**: Backward compatibility tools allow instant rollback to old interface

## Implementation Fixes Required

### 1. Output Schema Validation

```typescript
// Updated DomainTool interface
export interface DomainTool<TInput = any, TOutput = any> {
  name: string
  description: string
  inputSchema: z.ZodSchema<TInput>
  outputSchema?: z.ZodSchema<TOutput>  // ADD THIS
  handler: (args: TInput) => Promise<TOutput>
}

// Updated handleTool with output validation
async handleTool(name: string, args: unknown): Promise<ToolResponse> {
  const tool = this.tools.find((t) => t.name === name)
  if (!tool) {
    return this.errorResponse('TOOL_NOT_FOUND', `Tool ${name} not found`)
  }

  try {
    const validatedInput = tool.inputSchema.parse(args)
    const result = await tool.handler(validatedInput)

    // Validate output if schema provided
    const validatedOutput = tool.outputSchema
      ? tool.outputSchema.parse(result)
      : result

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(
          createSuccessResponse(validatedOutput),
          null,
          2
        ),
      }],
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return this.validationErrorResponse(error)
    }
    return this.errorResponse('EXECUTION_ERROR', error.message)
  }
}
```

### 2. Proper Schema Conversion

```typescript
// Install: pnpm add zod-to-json-schema
import { zodToJsonSchema } from 'zod-to-json-schema'

// Centralized conversion utility
export function convertZodToMcpSchema(schema: z.ZodSchema): any {
  return zodToJsonSchema(schema, {
    target: 'openApi3',
    $refStrategy: 'none',
    definitionPath: '',
  })
}

// Usage in BaseDomain
getTools(): Tool[] {
  return this.tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: convertZodToMcpSchema(tool.inputSchema),
  }))
}
```

### 3. Consistent Response Envelopes

```typescript
// Standard response types with proper typing
export const SuccessResponseSchema = <T extends z.ZodSchema>(dataSchema: T) =>
  z.object({
    data: dataSchema,
    meta: z
      .object({
        timestamp: z.string().datetime(),
        version: z.string(),
        count: z.number().optional(),
        total: z.number().optional(),
      })
      .partial(),
  })

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.enum([
      'TOOL_NOT_FOUND',
      'VALIDATION_ERROR',
      'EXECUTION_ERROR',
      'OUTPUT_VALIDATION_ERROR',
    ]),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
    validation: z
      .array(
        z.object({
          field: z.string(),
          message: z.string(),
        }),
      )
      .optional(),
    timestamp: z.string().datetime(),
  }),
})

// Always use these wrappers
export function wrapSuccess<T>(data: T, meta?: Record<string, any>): unknown {
  return {
    data,
    meta: {
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      ...meta,
    },
  }
}

export function wrapError(
  code: string,
  message: string,
  details?: Record<string, any>,
): unknown {
  return {
    error: {
      code,
      message,
      details,
      timestamp: new Date().toISOString(),
    },
  }
}
```

### 4. Tool Collision Detection

```typescript
export class MCPToolRegistry {
  private validateNoDuplicates(): void {
    const allTools = new Map<string, string>()

    for (const domain of this.domains.values()) {
      for (const tool of domain.getTools()) {
        if (allTools.has(tool.name)) {
          throw new Error(
            `Tool collision: '${tool.name}' exists in both ` +
              `'${allTools.get(tool.name)}' and '${domain.getName()}' domains`,
          )
        }
        allTools.set(tool.name, domain.getName())
      }
    }
  }

  registerDomain(domain: Domain): void {
    this.domains.set(domain.getName(), domain)
    this.validateNoDuplicates() // Check after each registration
  }
}
```

### 5. Database Query Optimization

```typescript
// CacheDomain optimized queries
class CacheDomain extends BaseDomain {
  private async handleListWorkItems(
    args: z.infer<typeof WorkItemFiltersSchema>,
  ): Promise<any> {
    // Build Prisma where clause
    const where: Prisma.WorkItemWhereInput = {}

    if (args.states?.length) {
      where.state = { in: args.states }
    }

    if (args.assignee) {
      where.assignedToPerson = {
        uniqueName: args.assignee,
      }
    }

    if (args.type) {
      where.type = args.type
    }

    if (args.areaPath) {
      where.areaPath = args.areaPath
    }

    if (args.iterationPath) {
      where.iterationPath = args.iterationPath
    }

    // Execute optimized query
    const [items, totalCount] = await Promise.all([
      this.db.client.workItem.findMany({
        where,
        include: {
          assignedToPerson: true,
          createdByPerson: true,
        },
        skip: args.skip,
        take: args.top,
        orderBy: { updatedAt: 'desc' },
      }),
      this.db.client.workItem.count({ where }),
    ])

    // Validate and return
    const normalized = items.map(this.normalizeWorkItem)
    return WorkItemListResponseSchema.parse({
      items: normalized,
      count: normalized.length,
      totalMatched: totalCount,
      pagination: {
        skip: args.skip || 0,
        top: args.top || 50,
        hasMore: (args.skip || 0) + items.length < totalCount,
      },
    })
  }
}
```
