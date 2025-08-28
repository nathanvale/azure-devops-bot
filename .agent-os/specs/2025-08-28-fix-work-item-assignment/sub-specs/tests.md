# Tests Specification

This is the tests coverage details for the spec detailed in @.agent-os/specs/2025-08-28-fix-work-item-assignment/spec.md

> Created: 2025-08-28
> Version: 1.0.0
> Testing Strategy: Critical path coverage with Person table validation

## Test Coverage

### Unit Tests

**DatabaseService Person Methods**

- `upsertPerson()` - Creates new Person records from Azure DevOps data
- `getPersonByEmail()` - Retrieves Person by uniqueName (email) field
- `getPersonByDisplayName()` - Retrieves Person by displayName field
- `syncWorkItems()` - Enhanced to handle Person data extraction and foreign key assignment

**AzureDevOpsProvider Extraction**

- `extractPersonData()` - Extracts complete person objects from Azure DevOps responses
- `mapWorkItemToData()` - Maps work items with person objects instead of strings

**Query Performance Validation**

- `getWorkItemsForUsers()` - Validates email-based queries return correct results in <100ms
- `getWorkItemsByStateForUsers()` - Validates state + email queries with Person joins

### Integration Tests

**Email-Based Work Item Queries**

- Test `wit_my_work_items` MCP tool returns correct results for authenticated user
- Validate query performance meets sub-100ms target
- Test query accuracy: email search finds work items that display name search would miss

**Person Data Migration**

- Test migration script extracts Person records from rawJson without data loss
- Validate foreign key population in WorkItem table
- Test backward compatibility during migration period

**Azure DevOps API Integration**

- Test person data extraction from real Azure DevOps work item responses
- Validate all person fields (assignedTo, createdBy, changedBy, etc.) are captured
- Test handling of missing or malformed person data

### Performance Tests

**Query Performance Benchmarks**

```typescript
describe('Query Performance Tests', () => {
  test('Person join query completes in <100ms', async () => {
    const startTime = performance.now()

    const results = await dbService.getWorkItemsForUsers([
      'Nathan.Vale@fwc.gov.au',
    ])

    const duration = performance.now() - startTime
    expect(duration).toBeLessThan(100) // Sub-100ms requirement
    expect(results.length).toBeGreaterThan(0) // Must find work items
  })

  test('Performance improvement vs string-based queries', async () => {
    const userEmail = 'Nathan.Vale@fwc.gov.au'

    // New Person join query (target: ~2ms)
    const personJoinStart = performance.now()
    const personResults = await dbService.getWorkItemsForUsers([userEmail])
    const personJoinTime = performance.now() - personJoinStart

    // Legacy string LIKE query (baseline: ~50ms)
    const stringQueryStart = performance.now()
    const stringResults = await dbService.getWorkItemsByStringMatch(userEmail)
    const stringQueryTime = performance.now() - stringQueryStart

    expect(personJoinTime).toBeLessThan(stringQueryTime / 10) // At least 10x improvement
    expect(personResults.length).toBe(stringResults.length) // Same accuracy
  })
})
```

### Data Integrity Tests

**Person Table Validation**

```typescript
describe('Person Data Integrity', () => {
  test('Person records have required fields', async () => {
    const persons = await prisma.person.findMany()

    for (const person of persons) {
      expect(person.id).toBeTruthy()
      expect(person.displayName).toBeTruthy()
      expect(person.uniqueName).toBeTruthy()
      expect(person.uniqueName).toMatch(/@/) // Should be email format
    }
  })

  test('WorkItem person references are valid', async () => {
    const workItems = await prisma.workItem.findMany({
      include: { assignedTo: true, createdBy: true },
    })

    for (const item of workItems) {
      if (item.assignedToId) {
        expect(item.assignedTo).toBeTruthy() // Foreign key should resolve
        expect(item.assignedTo?.uniqueName).toMatch(/@/) // Should be valid email
      }
    }
  })

  test('No orphaned person references', async () => {
    // Ensure all WorkItem person IDs reference valid Person records
    const orphanedWorkItems = await prisma.workItem.findMany({
      where: {
        OR: [
          { assignedToId: { not: null }, assignedTo: null },
          { createdById: { not: null }, createdBy: null },
          { changedById: { not: null }, changedBy: null },
        ],
      },
    })

    expect(orphanedWorkItems).toHaveLength(0)
  })
})
```

### Migration Tests

**Data Migration Validation**

```typescript
describe('Person Data Migration', () => {
  test('Migration extracts all Person records from rawJson', async () => {
    // Count unique persons in rawJson before migration
    const workItems = await prisma.workItem.findMany({
      select: { rawJson: true },
    })
    const uniquePersonIds = new Set()

    workItems.forEach((item) => {
      const rawData = JSON.parse(item.rawJson)
      const fields = rawData.fields

      const personFields = [
        fields['System.AssignedTo'],
        fields['System.CreatedBy'],
        fields['System.ChangedBy'],
        // ... other person fields
      ].filter((p) => p?.id)

      personFields.forEach((p) => uniquePersonIds.add(p.id))
    })

    // Run migration
    await migratePersonDataFromRawJson()

    // Verify all persons were created
    const personCount = await prisma.person.count()
    expect(personCount).toBe(uniquePersonIds.size)
  })

  test('Foreign keys populated correctly', async () => {
    await migratePersonDataFromRawJson()

    // Check that work items have person references
    const workItemsWithPersons = await prisma.workItem.count({
      where: { assignedToId: { not: null } },
    })

    expect(workItemsWithPersons).toBeGreaterThan(0)
  })

  test('No data loss during migration', async () => {
    // Capture before migration state
    const beforeWorkItems = await prisma.workItem.findMany({
      select: { id: true, rawJson: true },
    })

    await migratePersonDataFromRawJson()

    // Verify all work items still exist with same rawJson
    const afterWorkItems = await prisma.workItem.findMany({
      select: { id: true, rawJson: true },
    })

    expect(afterWorkItems).toHaveLength(beforeWorkItems.length)

    for (const before of beforeWorkItems) {
      const after = afterWorkItems.find((a) => a.id === before.id)
      expect(after).toBeTruthy()
      expect(after?.rawJson).toBe(before.rawJson) // rawJson preserved
    }
  })
})
```

### Functional Tests

**MCP Tool Validation**

```typescript
describe('MCP Tool Email Query Fix', () => {
  test('wit_my_work_items returns results for user email', async () => {
    // Set authenticated user email
    const userEmail = 'Nathan.Vale@fwc.gov.au'
    process.env.AZURE_DEVOPS_USER_EMAILS = userEmail

    // Create test work items assigned to user
    await createTestWorkItemsAssignedTo(userEmail)

    // Test MCP tool
    const response = await mcpServer.handleRequest({
      method: 'tools/call',
      params: {
        name: 'wit_my_work_items',
        arguments: {},
      },
    })

    expect(response.content[0].type).toBe('text')
    const result = JSON.parse(response.content[0].text)
    expect(result.workItems.length).toBeGreaterThan(0)
    expect(result.userEmail).toBe(userEmail)
  })

  test('Work items have complete person data in response', async () => {
    const userEmail = 'Nathan.Vale@fwc.gov.au'
    process.env.AZURE_DEVOPS_USER_EMAILS = userEmail

    const response = await mcpServer.handleRequest({
      method: 'tools/call',
      params: {
        name: 'wit_my_work_items',
        arguments: {},
      },
    })

    const result = JSON.parse(response.content[0].text)
    const firstItem = result.workItems[0]

    expect(firstItem.assignedTo).toBeTruthy()
    expect(firstItem.assignedTo.uniqueName).toBe(userEmail)
    expect(firstItem.assignedTo.displayName).toBeTruthy()
    expect(firstItem.assignedTo.id).toBeTruthy()
  })
})
```

### Error Handling Tests

**Graceful Degradation**

```typescript
describe('Error Handling', () => {
  test('Handles malformed person data in rawJson', async () => {
    // Create work item with invalid person data
    await prisma.workItem.create({
      data: {
        id: 99999,
        title: 'Test Item',
        state: 'Active',
        type: 'Task',
        rawJson: JSON.stringify({
          fields: {
            'System.AssignedTo': 'invalid-person-data',
          },
        }),
        lastUpdatedAt: new Date(),
        lastSyncedAt: new Date(),
      },
    })

    // Migration should handle gracefully
    await expect(migratePersonDataFromRawJson()).resolves.not.toThrow()
  })

  test('Query fallback when Person join fails', async () => {
    // Mock Person table to be unavailable
    jest
      .spyOn(prisma.person, 'findMany')
      .mockRejectedValueOnce(new Error('Table not found'))

    // Query should fall back gracefully
    const results = await dbService.getWorkItemsWithPersonFallback([
      'test@example.com',
    ])

    // Should still return results (even if via fallback)
    expect(Array.isArray(results)).toBe(true)
  })
})
```

## Testing Strategy

### Pre-Migration Testing

1. **Baseline Performance**: Measure current query times for comparison
2. **Data Inventory**: Count existing work items and person references
3. **Functionality Verification**: Confirm current broken behavior (0 results for email queries)

### Migration Testing

1. **Schema Validation**: Verify Person table created with correct indexes
2. **Data Extraction**: Test Person record creation from rawJson
3. **Foreign Key Population**: Validate WorkItem person references
4. **Performance Verification**: Confirm 25x query improvement achieved

### Post-Migration Testing

1. **Query Accuracy**: Email queries return correct work items
2. **MCP Tool Function**: All existing tools work with enhanced person data
3. **Performance Maintenance**: Sub-100ms queries sustained under load
4. **Data Integrity**: No data loss or corruption detected

### Mocking Requirements

**Azure DevOps API Responses**

- Mock work item responses with complete person objects
- Include all person fields: id, uniqueName, displayName, imageUrl, descriptor
- Test various person field combinations (some missing, some complete)

**Database State Simulation**

- Create test datasets with both old string-based person data and new Person records
- Simulate migration scenarios with partial data
- Test concurrent access during migration

**Performance Simulation**

- Mock database query timing to validate performance improvements
- Simulate high load scenarios to test index effectiveness
- Test query patterns that would benefit from Person table optimization

This comprehensive testing strategy ensures the migration delivers the promised functionality fixes and performance improvements while maintaining data integrity.
