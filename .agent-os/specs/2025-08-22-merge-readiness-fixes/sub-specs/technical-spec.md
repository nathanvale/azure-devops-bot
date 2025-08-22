# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-08-22-merge-readiness-fixes/spec.md

> Created: 2025-08-22
> Version: 1.0.0

## Technical Requirements

### Test Suite Fixes

- Fix resilience policy test assertions to match actual implementation structure
- Align mock implementations with production code behavior
- Update test expectations for new database fields
- Ensure all async operations are properly awaited in tests
- Fix mock Prisma client to match actual database operations

### Dependency Management

- Generate pnpm-lock.yaml from current package.json
- Ensure all peer dependencies are satisfied
- Lock @orchestr8/resilience to specific version
- Add .npmrc with pnpm configuration

### Database Initialization

- Create database file if not exists on startup
- Run migrations automatically on first launch
- Add migration status check before app start
- Implement rollback mechanism for failed migrations

### Architecture Cleanup

- Remove all NLP-related code files and tests
- Simplify QueryEngine to basic filtering only
- Update MCP tools to return raw JSON without processing
- Remove semantic search dependencies from package.json

### Performance Optimization

- Implement batch database operations using Prisma transactions
- Add parallel processing for comment sync with concurrency control
- Optimize WIQL queries to reduce Azure CLI calls
- Implement connection pooling for database operations

### Error Handling

- Add try-catch blocks to all async operations
- Implement exponential backoff for Azure CLI failures
- Add circuit breaker pattern for external service calls
- Create error recovery mechanisms for partial sync failures

## Approach Options

**Option A: Incremental Fixes**

- Pros: Lower risk, can be tested incrementally
- Cons: Takes longer, may introduce temporary inconsistencies

**Option B: Complete Refactor** (Selected)

- Pros: Clean slate, ensures consistency, faster to implement
- Cons: Higher risk, requires comprehensive testing

**Rationale:** Complete refactor ensures all issues are addressed systematically and prevents partial fixes that could introduce new bugs.

## External Dependencies

### Required Updates

- **@orchestr8/resilience** (^1.0.0) - Already in use, needs version lock
- **pnpm** (^8.0.0) - Package manager for lock file generation

### To Be Removed

- All NLP-related dependencies (if any remain)
- Unused utility libraries

## Implementation Details

### Test Fix Strategy

```typescript
// Fix resilience policy test structure
expect(mockApplyPolicy).toHaveBeenCalledWith(expect.any(Function), {
  retry: {
    maxAttempts: 3,
    initialDelay: 300,
    maxDelay: 3000,
    backoffStrategy: 'exponential',
    jitterStrategy: 'full-jitter',
  },
  timeout: 10000,
  circuitBreaker: {
    key: 'azure-devops-comments',
    failureThreshold: 3,
    recoveryTime: 30000,
    sampleSize: 5,
    halfOpenPolicy: 'single-probe',
  },
})
```

### Batch Operations Implementation

```typescript
// Replace sequential operations
async syncWorkItems(workItems: WorkItemData[]): Promise<void> {
  const BATCH_SIZE = 100;

  for (let i = 0; i < workItems.length; i += BATCH_SIZE) {
    const batch = workItems.slice(i, i + BATCH_SIZE);

    await this.prisma.$transaction(
      batch.map(item =>
        this.prisma.workItem.upsert({
          where: { id: item.id },
          update: this.mapWorkItemData(item),
          create: {
            id: item.id,
            ...this.mapWorkItemData(item)
          }
        })
      )
    );
  }
}
```

### Parallel Comment Sync

```typescript
// Implement concurrent comment fetching
async syncCommentsForWorkItems(workItems: any[]): Promise<void> {
  const CONCURRENCY = 5;
  const queue = [...workItems];
  const inProgress = new Set<Promise<void>>();

  while (queue.length > 0 || inProgress.size > 0) {
    while (inProgress.size < CONCURRENCY && queue.length > 0) {
      const workItem = queue.shift()!;
      const promise = this.syncSingleComment(workItem)
        .finally(() => inProgress.delete(promise));
      inProgress.add(promise);
    }

    if (inProgress.size > 0) {
      await Promise.race(inProgress);
    }
  }
}
```

### Error Recovery Pattern

```typescript
// Implement comprehensive error handling
async performSyncWithRecovery(): Promise<void> {
  const MAX_RETRIES = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await this.performSync();
      return; // Success
    } catch (error) {
      lastError = error as Error;
      console.error(`Sync attempt ${attempt} failed:`, error);

      if (attempt < MAX_RETRIES) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(`Sync failed after ${MAX_RETRIES} attempts: ${lastError?.message}`);
}
```

### Database Initialization

```typescript
// Auto-initialize database on startup (opt-in)
async initializeDatabase(): Promise<void> {
  if (process.env.DB_AUTO_INIT !== 'true') {
    console.log('DB auto-init disabled. Set DB_AUTO_INIT=true to enable.');
    return;
  }

  const url = process.env.DATABASE_URL ?? '';
  const isFileProvider = url.startsWith('file:');
  if (!isFileProvider) {
    console.warn('DB auto-init skipped: non-file provider detected.');
    return;
  }

  const dbPath = url.replace('file:', '') || './prisma/dev.db';

  try {
    if (!fs.existsSync(dbPath)) {
      console.log('Database not found, initializing...');

      // Create database directory
      const dbDir = path.dirname(dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      // Use local Prisma binary instead of npx
      const prismaBin = path.join(process.cwd(), 'node_modules', '.bin', 'prisma');
      execSync(`${prismaBin} migrate deploy`, { stdio: 'inherit' });
      console.log('Database initialized successfully');
    }
  } catch (err) {
    console.error('Database initialization failed:', err);
    throw err;
  }
}
```

## Migration Path

1. **Phase 1: Test Fixes** - Fix all failing tests first
2. **Phase 2: Dependency Lock** - Add pnpm-lock.yaml
3. **Phase 3: Database Init** - Implement auto-initialization
4. **Phase 4: Remove NLP** - Clean up architecture
5. **Phase 5: Performance** - Implement optimizations
6. **Phase 6: Error Handling** - Add recovery mechanisms

## Risk Mitigation

- **Test Coverage**: Ensure 100% test pass rate before any refactoring
- **Backup Strategy**: Create database backup before schema migration
- **Rollback Plan**: Tag current commit for easy rollback if needed
- **Gradual Rollout**: Test each phase independently before proceeding
