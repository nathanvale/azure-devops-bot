import { describe, it, expect, beforeEach, vi } from 'vitest'

// Use vi.hoisted to ensure the mock function is available during module loading
const mockExecAsync = vi.hoisted(() => vi.fn())

vi.mock('util', () => ({
  promisify: () => mockExecAsync,
}))

vi.mock('child_process', () => ({
  exec: vi.fn(),
}))

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
}))

import { SchemaMigrationService } from '../schema-migration'

describe('SchemaMigrationService', () => {
  let service: SchemaMigrationService

  beforeEach(() => {
    vi.resetAllMocks()
    service = new SchemaMigrationService()
  })

  describe('validateCurrentSchema', () => {
    it('should validate that current schema exists', async () => {
      const mockSchemaContent = `
        model WorkItem {
          id                Int      @id
          title             String
          state             String
          type              String
          assignedTo        String
          azureUrl          String
          description       String?
          rawJson           String
          lastUpdatedAt     DateTime
          lastSyncedAt      DateTime @default(now())
          
          @@map("work_items")
        }
      `

      const result = await service.validateCurrentSchema(mockSchemaContent)

      expect(result.hasWorkItemModel).toBe(true)
      expect(result.existingFields).toContain('id')
      expect(result.existingFields).toContain('lastUpdatedAt')
      expect(result.existingFields).toContain('rawJson')
      // Will have missing fields because we only provided minimal schema
      expect(result.missingFields.length).toBeGreaterThan(0)
    })

    it('should detect missing comprehensive fields in current schema', async () => {
      const mockMinimalSchema = `
        model WorkItem {
          id        Int    @id
          title     String
          state     String
          rawJson   String
          
          @@map("work_items")
        }
      `

      const result = await service.validateCurrentSchema(mockMinimalSchema)

      expect(result.isValid).toBe(false)
      expect(result.hasWorkItemModel).toBe(true)
      expect(result.missingFields).toContain('rev')
      expect(result.missingFields).toContain('reason')
      expect(result.missingFields).toContain('watermark')
      expect(result.missingFields).toContain('commentCount')
      expect(result.missingFields).toContain('hasAttachments')
      expect(result.missingFields.length).toBeGreaterThan(5)
    })

    it('should handle schema without WorkItem model', async () => {
      const mockEmptySchema = `
        model SomeOtherModel {
          id Int @id
        }
      `

      const result = await service.validateCurrentSchema(mockEmptySchema)

      expect(result.isValid).toBe(false)
      expect(result.hasWorkItemModel).toBe(false)
      expect(result.existingFields).toHaveLength(0)
    })
  })

  describe('generateComprehensiveSchema', () => {
    it('should generate comprehensive schema with all discovered fields', () => {
      const discoveredFields = {
        'System.Rev': 'number',
        'System.Reason': 'string',
        'System.Watermark': 'number',
        'System.CommentCount': 'number',
        'Microsoft.VSTS.Common.HasAttachments': 'boolean',
        'System.TeamProject': 'string',
        'System.AreaId': 'number',
        'System.IterationId': 'number',
        'Microsoft.VSTS.Common.StackRank': 'number',
        'Microsoft.VSTS.Common.ValueArea': 'string',
        'Custom.BusinessValue': 'string',
      }

      const schema = service.generateComprehensiveSchema(discoveredFields)

      expect(schema).toContain('model WorkItem {')
      expect(schema).toContain('rev               Int?')
      expect(schema).toContain('reason            String?')
      expect(schema).toContain('watermark         Int?')
      expect(schema).toContain('commentCount      Int?     @default(0)')
      expect(schema).toContain('hasAttachments    Boolean  @default(false)')
      expect(schema).toContain('teamProject       String?')
      expect(schema).toContain('areaId            Int?')
      expect(schema).toContain('nodeId            Int?')
      expect(schema).toContain('stackRank         Float?')
      expect(schema).toContain('valueArea         String?')

      // Should include custom fields in JSON storage
      expect(schema).toContain(
        'customFields      String?  // JSON storage for custom fields',
      )

      // Should preserve existing core fields
      expect(schema).toContain('id                Int      @id')
      expect(schema).toContain('title             String')
      expect(schema).toContain('rawJson           String')

      // Should have proper indexes
      expect(schema).toContain('@@index([type])')
      expect(schema).toContain('@@index([state])')
      expect(schema).toContain('@@index([assignedTo])')
    })

    it('should handle empty discovered fields', () => {
      const schema = service.generateComprehensiveSchema({})

      expect(schema).toContain('model WorkItem {')
      expect(schema).toContain('id                Int      @id')
      expect(schema).toContain('rawJson           String')
      expect(schema).toContain('@@map("work_items")')
    })

    it('should generate proper Prisma field types', () => {
      const fieldTypes = {
        'System.StringField': 'string',
        'System.NumberField': 'number',
        'System.BooleanField': 'boolean',
        'System.ObjectField': 'object',
        'System.NullField': 'null',
        'System.ArrayField': 'array',
      }

      const schema = service.generateComprehensiveSchema(fieldTypes)

      // The schema generation doesn't directly convert field names like this
      // Instead it uses hasField() logic to map known Azure DevOps fields
      expect(schema).toContain('model WorkItem {')
      // Objects, arrays, and nulls should trigger customFields storage
      expect(schema).toContain(
        'customFields      String?  // JSON storage for custom fields',
      )
    })
  })

  describe('createMigrationFile', () => {
    it('should create migration SQL for new comprehensive fields', () => {
      const newFields = [
        { name: 'rev', type: 'Int?', sqlType: 'INTEGER' },
        { name: 'reason', type: 'String?', sqlType: 'TEXT' },
        {
          name: 'commentCount',
          type: 'Int?',
          sqlType: 'INTEGER',
          defaultValue: '0',
        },
        {
          name: 'hasAttachments',
          type: 'Boolean',
          sqlType: 'BOOLEAN',
          defaultValue: 'FALSE',
        },
        { name: 'stackRank', type: 'Float?', sqlType: 'REAL' },
        { name: 'customFields', type: 'String?', sqlType: 'TEXT' },
      ]

      const migrationSql = service.createMigrationFile(newFields)

      expect(migrationSql).toContain('-- Add comprehensive Azure DevOps fields')
      expect(migrationSql).toContain(
        'ALTER TABLE work_items ADD COLUMN rev INTEGER;',
      )
      expect(migrationSql).toContain(
        'ALTER TABLE work_items ADD COLUMN reason TEXT;',
      )
      expect(migrationSql).toContain(
        'ALTER TABLE work_items ADD COLUMN commentCount INTEGER DEFAULT 0;',
      )
      expect(migrationSql).toContain(
        'ALTER TABLE work_items ADD COLUMN hasAttachments BOOLEAN DEFAULT FALSE;',
      )
      expect(migrationSql).toContain(
        'ALTER TABLE work_items ADD COLUMN stackRank REAL;',
      )
      expect(migrationSql).toContain(
        'ALTER TABLE work_items ADD COLUMN customFields TEXT;',
      )

      // Should include performance indexes
      expect(migrationSql).toContain(
        'CREATE INDEX idx_work_items_rev ON work_items(rev);',
      )
      expect(migrationSql).toContain(
        'CREATE INDEX idx_work_items_commentCount ON work_items(commentCount);',
      )
      expect(migrationSql).toContain(
        'CREATE INDEX idx_work_items_hasAttachments ON work_items(hasAttachments);',
      )
    })

    it('should handle empty fields list', () => {
      const migrationSql = service.createMigrationFile([])

      expect(migrationSql).toContain('-- Add comprehensive Azure DevOps fields')
      expect(migrationSql).toContain('-- No new fields to add')
    })
  })

  describe('testMigration', () => {
    it('should test migration with sample data', async () => {
      // Mock successful Prisma migration
      mockExecAsync.mockResolvedValueOnce({
        stdout: 'Migration applied successfully',
      })
      // Mock successful rollback
      mockExecAsync.mockResolvedValueOnce({
        stdout: 'Migration rolled back successfully',
      })

      const migrationSql = `
        ALTER TABLE work_items ADD COLUMN rev INTEGER;
        ALTER TABLE work_items ADD COLUMN reason TEXT;
      `

      const result = await service.testMigration(migrationSql)

      expect(result.success).toBe(true)
      expect(result.migrationApplied).toBe(true)
      expect(result.rollbackSuccessful).toBe(true)
      expect(mockExecAsync).toHaveBeenCalledTimes(2)

      // Should call prisma migrate dev
      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining('pnpm prisma migrate dev'),
        expect.any(Object),
      )
    })

    it('should handle migration failure', async () => {
      mockExecAsync.mockRejectedValueOnce(new Error('Migration failed'))

      const migrationSql = `ALTER TABLE work_items ADD COLUMN invalid_syntax;`

      const result = await service.testMigration(migrationSql)

      expect(result.success).toBe(false)
      expect(result.migrationApplied).toBe(false)
      expect(result.rollbackSuccessful).toBe(false)
      expect(result.error).toContain('Migration failed')
    })

    it('should handle migration success but rollback failure', async () => {
      mockExecAsync.mockResolvedValueOnce({
        stdout: 'Migration applied successfully',
      })
      mockExecAsync.mockRejectedValueOnce(new Error('Rollback failed'))

      const migrationSql = `ALTER TABLE work_items ADD COLUMN test_field TEXT;`

      const result = await service.testMigration(migrationSql)

      // Since the second call fails, the method should return false for success
      expect(result.success).toBe(false)
      expect(result.migrationApplied).toBe(true)
      expect(result.rollbackSuccessful).toBe(false)
      expect(result.error).toContain('Rollback failed')
    })
  })

  describe('validateDataIntegrity', () => {
    it('should validate that existing data is preserved after migration', async () => {
      const preMigrationData = [
        { id: 1234, title: 'Test Item 1', rawJson: '{"id": 1234}' },
        { id: 5678, title: 'Test Item 2', rawJson: '{"id": 5678}' },
      ]

      const postMigrationData = [
        {
          id: 1234,
          title: 'Test Item 1',
          rawJson: '{"id": 1234}',
          rev: null,
          reason: null,
        },
        {
          id: 5678,
          title: 'Test Item 2',
          rawJson: '{"id": 5678}',
          rev: null,
          reason: null,
        },
      ]

      const result = service.validateDataIntegrity(
        preMigrationData,
        postMigrationData,
      )

      expect(result.isValid).toBe(true)
      expect(result.recordCount).toBe(2)
      expect(result.missingRecords).toHaveLength(0)
      expect(result.corruptedRecords).toHaveLength(0)
    })

    it('should detect missing records after migration', () => {
      const preMigrationData = [
        { id: 1234, title: 'Test Item 1' },
        { id: 5678, title: 'Test Item 2' },
      ]

      const postMigrationData = [{ id: 1234, title: 'Test Item 1', rev: null }]

      const result = service.validateDataIntegrity(
        preMigrationData,
        postMigrationData,
      )

      expect(result.isValid).toBe(false)
      expect(result.recordCount).toBe(1)
      expect(result.missingRecords).toContain(5678)
    })

    it('should detect corrupted records after migration', () => {
      const preMigrationData = [
        { id: 1234, title: 'Test Item 1', rawJson: '{"id": 1234}' },
      ]

      const postMigrationData = [
        { id: 1234, title: 'CORRUPTED', rawJson: null, rev: null },
      ]

      const result = service.validateDataIntegrity(
        preMigrationData,
        postMigrationData,
      )

      expect(result.isValid).toBe(false)
      expect(result.corruptedRecords).toContain(1234)
    })
  })

  describe('fullMigrationWorkflow', () => {
    it('should execute complete migration workflow successfully', async () => {
      const sampleWorkItemIds = [1234, 5678]

      // Mock field discovery
      const mockWorkItem = {
        id: 1234,
        fields: {
          'System.Rev': 15,
          'System.Reason': 'New',
          'System.CommentCount': 3,
        },
      }

      vi.spyOn(
        service['fieldDiscoveryService'],
        'fetchWorkItemWithAllFields',
      ).mockResolvedValue(mockWorkItem)

      vi.spyOn(
        service['fieldDiscoveryService'],
        'analyzeFields',
      ).mockReturnValue({
        totalFields: 3,
        systemFields: ['System.Rev', 'System.Reason', 'System.CommentCount'],
        vstsFields: [],
        customFields: [],
        metadataFields: ['id'],
        fieldTypes: {
          'System.Rev': 'number',
          'System.Reason': 'string',
          'System.CommentCount': 'number',
          id: 'number',
        },
      })

      // Mock all the steps
      mockExecAsync
        .mockResolvedValueOnce({ stdout: 'Schema generated successfully' }) // generateSchema
        .mockResolvedValueOnce({ stdout: 'Migration created successfully' }) // createMigration
        .mockResolvedValueOnce({ stdout: 'Migration applied successfully' }) // applyMigration
        .mockResolvedValueOnce({ stdout: 'Migration rolled back successfully' }) // testRollback

      const result = await service.fullMigrationWorkflow(sampleWorkItemIds)

      expect(result.success).toBe(true)
      expect(result.schemaGenerated).toBe(true)
      expect(result.migrationCreated).toBe(true)
      expect(result.migrationTested).toBe(true)
      expect(result.dataIntegrityValid).toBe(true)
    })

    it('should handle workflow failure at schema generation', async () => {
      // Mock writeFile to fail (schema generation step)
      const { writeFile } = await import('fs/promises')
      vi.mocked(writeFile).mockRejectedValueOnce(
        new Error('Schema generation failed'),
      )

      const result = await service.fullMigrationWorkflow([])

      expect(result.success).toBe(false)
      expect(result.schemaGenerated).toBe(false)
      expect(result.error).toContain('Schema generation failed')
    })

    it('should handle workflow failure at migration creation', async () => {
      // Mock field discovery to fail during field fetching, causing the migration to continue with empty fields
      vi.spyOn(
        service['fieldDiscoveryService'],
        'fetchWorkItemWithAllFields',
      ).mockRejectedValue(new Error('Work item not found'))

      // Mock exec to fail on the migration creation step
      mockExecAsync.mockRejectedValueOnce(
        new Error('Migration creation failed'),
      )

      const result = await service.fullMigrationWorkflow([1234])

      expect(result.success).toBe(false)
      expect(result.schemaGenerated).toBe(true) // Schema generation happens before exec call
      expect(result.migrationCreated).toBe(false)
      expect(result.error).toContain('Migration creation failed')
    })
  })
})
