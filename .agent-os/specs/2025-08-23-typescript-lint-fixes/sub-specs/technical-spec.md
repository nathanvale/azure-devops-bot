# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-08-23-typescript-lint-fixes/spec.md

> Created: 2025-08-23
> Version: 1.0.0

## Technical Requirements

- All TypeScript code must compile without errors in strict mode
- All ESLint rules must pass without violations
- Maintain backward compatibility with existing functionality
- Preserve existing test coverage and behavior
- Use proper Prisma-generated types for database operations
- Add comprehensive type definitions for all previously untyped code

## Approach Options

**Option A:** Fix errors file by file in alphabetical order

- Pros: Systematic approach, easy to track progress
- Cons: May create conflicts, doesn't prioritize by impact

**Option B:** Fix by error category and impact priority (Selected)

- Pros: Addresses blocking issues first, logical dependency order
- Cons: More complex planning required

**Rationale:** Option B ensures compilation blockers are fixed first, allowing incremental progress and testing at each phase.

## Error Categories and Solutions

### 1. Missing Database Methods (High Priority)

**Files affected:** `src/mcp-server.ts`
**Issue:** MCP server calls methods that don't exist in DatabaseService
**Solution:** Add three missing methods to DatabaseService:

```typescript
async getWorkItemById(id: number): Promise<WorkItem | null>
async getWorkItemsByIds(ids: number[]): Promise<WorkItem[]>
async getWorkItemsByIteration(iterationPath: string): Promise<WorkItem[]>
```

### 2. Import Path Resolution (High Priority)

**Files affected:** `tests/mcp-integration.setup.ts`, `tests/vitest.setup.ts`
**Issue:** `@/` alias not properly configured for TypeScript compilation
**Solution:** Either:

- Add proper path mapping to tsconfig.json
- Replace @/ imports with relative imports

### 3. Type Safety - Replace `any` Types (Medium Priority)

**Files affected:** Multiple (100+ instances)
**Issue:** Using `any` type instead of proper TypeScript types
**Solutions by context:**

**Mock Parameters:**

```typescript
// Before: { where }
// After: { where }: { where: Prisma.WorkItemWhereUniqueInput }

// Before: { data }
// After: { data }: { data: Prisma.WorkItemCreateInput }
```

**Exec Function Results:**

```typescript
// Before: any
// After: { stdout: string; stderr?: string }
```

**Azure DevOps API Responses:**

```typescript
// Before: any
// After: AzureWorkItemResponse | AzureWorkItemListResponse
```

### 4. Global Type Definitions (Medium Priority)

**Files affected:** `src/services/sync-service.ts`, `src/mocks/handlers/azure-devops.handlers.ts`
**Issue:** Global types (NodeJS, URL) not defined
**Solution:** Add to global.d.ts:

```typescript
declare global {
  namespace NodeJS {
    interface Timer {
      hasRef(): boolean
      ref(): this
      refresh(): this
      unref(): this
    }
  }

  const URL: typeof import('url').URL
}
```

### 5. Test Global Assignments (Low Priority)

**Files affected:** Test setup files
**Issue:** Assigning to global object without proper typing
**Solution:** Extend global interface or use proper type assertions

### 6. Unused Variables (Low Priority)

**Files affected:** Multiple
**Issue:** Variables defined but not used
**Solution:**

- Remove if truly unused
- Prefix with underscore if needed for API compatibility
- Use destructuring with rest operator where appropriate

## Implementation Order

### Phase 1: Compilation Blockers

1. Add missing database methods
2. Fix import path resolution
3. Add global type definitions

### Phase 2: Type Safety Core

1. Fix Prisma mock parameter types
2. Replace Azure DevOps API response types
3. Fix exec function return types

### Phase 3: Type Safety Extended

1. Replace remaining `any` types in services
2. Fix test utility types
3. Add proper handler types

### Phase 4: ESLint Compliance

1. Remove/rename unused variables
2. Fix no-undef violations
3. Clean up final linting issues

## External Dependencies

No new dependencies required - will use existing:

- **Prisma**: Use generated types from @prisma/client
- **TypeScript**: Current 5.8+ configuration maintained
- **ESLint**: Current rules and configuration maintained
- **Vitest**: Current testing framework and type utilities
