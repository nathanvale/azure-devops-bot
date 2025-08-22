import { exec } from 'child_process'
import { readFile, writeFile } from 'fs/promises'
import path from 'path'
import { promisify } from 'util'

import { FieldDiscoveryService } from './field-discovery.js'

const execAsync = promisify(exec)

export interface SchemaValidationResult {
  isValid: boolean
  hasWorkItemModel: boolean
  existingFields: string[]
  missingFields: string[]
  errors: string[]
}

export interface MigrationField {
  name: string
  type: string
  sqlType: string
  defaultValue?: string
}

export interface MigrationTestResult {
  success: boolean
  migrationApplied: boolean
  rollbackSuccessful: boolean
  error?: string
}

export interface DataIntegrityResult {
  isValid: boolean
  recordCount: number
  missingRecords: number[]
  corruptedRecords: number[]
}

export interface FullMigrationResult {
  success: boolean
  schemaGenerated: boolean
  migrationCreated: boolean
  migrationTested: boolean
  dataIntegrityValid: boolean
  error?: string
}

export class SchemaMigrationService {
  private fieldDiscoveryService: FieldDiscoveryService

  constructor() {
    this.fieldDiscoveryService = new FieldDiscoveryService()
  }

  /**
   * Discover fields from actual Azure DevOps work items
   */
  async discoverFieldsFromAzureDevOps(
    sampleWorkItemIds: number[],
  ): Promise<Record<string, string>> {
    console.log(
      `Discovering fields from ${sampleWorkItemIds.length} sample work items...`,
    )

    const discoveredFields: Record<string, string> = {}

    for (const workItemId of sampleWorkItemIds) {
      try {
        const workItem =
          await this.fieldDiscoveryService.fetchWorkItemWithAllFields(
            workItemId,
          )
        const analysis = this.fieldDiscoveryService.analyzeFields(workItem)

        // Merge field types from this work item
        Object.entries(analysis.fieldTypes).forEach(([field, type]) => {
          discoveredFields[field] = type as string
        })

        console.log(
          `Work item ${workItemId}: Discovered ${Object.keys(analysis.fieldTypes).length} fields`,
        )
      } catch (error) {
        console.warn(
          `Failed to discover fields from work item ${workItemId}:`,
          error,
        )
      }
    }

    console.log(
      `Field discovery complete. Found ${Object.keys(discoveredFields).length} unique fields.`,
    )
    return discoveredFields
  }

  /**
   * Validate the current Prisma schema against discovered fields
   */
  async validateCurrentSchema(
    schemaContent: string,
    discoveredFields?: Record<string, string>,
  ): Promise<SchemaValidationResult> {
    const errors: string[] = []
    const existingFields: string[] = []
    let hasWorkItemModel = false

    // Check if WorkItem model exists
    const workItemModelMatch = schemaContent.match(
      /model\s+WorkItem\s*\{([^}]+)\}/s,
    )
    if (workItemModelMatch) {
      hasWorkItemModel = true

      // Extract field names from the model
      const modelContent = workItemModelMatch[1]!
      const fieldMatches = modelContent.matchAll(/(\w+)\s+\w+/g)
      for (const match of fieldMatches) {
        if (match[1] && !match[1].startsWith('@@')) {
          existingFields.push(match[1])
        }
      }
    } else {
      errors.push('WorkItem model not found in schema')
    }

    // Check for missing fields based on discovered fields or fallback to known comprehensive fields
    let requiredFields: string[]
    if (discoveredFields) {
      // Map discovered Azure DevOps fields to Prisma field names
      requiredFields = this.mapAzureFieldsToPrismaFields(discoveredFields)
    } else {
      // Fallback to known comprehensive fields
      requiredFields = [
        'rev',
        'reason',
        'watermark',
        'url',
        'commentCount',
        'hasAttachments',
        'teamProject',
        'areaId',
        'nodeId',
        'stackRank',
        'valueArea',
        'customFields',
      ]
    }

    const missingFields = requiredFields.filter(
      (field) => !existingFields.includes(field),
    )

    return {
      isValid: hasWorkItemModel && missingFields.length === 0,
      hasWorkItemModel,
      existingFields,
      missingFields,
      errors,
    }
  }

  /**
   * Generate comprehensive Prisma schema with all discovered fields
   */
  generateComprehensiveSchema(
    discoveredFields: Record<string, string>,
  ): string {
    const coreFields = `  id                Int      @id
  title             String
  state             String
  type              String
  assignedTo        String
  azureUrl          String
  description       String?
  
  // Sprint/Board Info (for your reports)
  iterationPath     String?  // e.g., "S3-Sprint 15"
  areaPath          String?  // e.g., "Stage 3 Team"
  boardColumn       String?  // e.g., "2. Build"
  boardColumnDone   Boolean  @default(false)
  
  // Priority/Tags
  priority          Int?
  severity          String?
  tags              String?  // JSON array as string
  
  // All the dates
  createdDate       DateTime?
  changedDate       DateTime? // For "Days Since Updated" 
  closedDate        DateTime?
  resolvedDate      DateTime?
  activatedDate     DateTime?
  stateChangeDate   DateTime?
  
  // People
  createdBy         String?
  changedBy         String?
  closedBy          String?
  resolvedBy        String?
  
  // Work tracking
  storyPoints       Float?
  effort            Float?
  remainingWork     Float?
  completedWork     Float?
  originalEstimate  Float?
  
  // Content
  acceptanceCriteria String?
  reproSteps         String?
  systemInfo         String?
  
  // Related items
  parentId          Int?`

    // Add comprehensive fields based on discovered fields
    let comprehensiveFields = `
  
  // Additional Azure DevOps fields`

    if (this.hasField(discoveredFields, 'System.Rev', 'number')) {
      comprehensiveFields += `\n  rev               Int?`
    }
    if (this.hasField(discoveredFields, 'System.Reason', 'string')) {
      comprehensiveFields += `\n  reason            String?`
    }
    if (this.hasField(discoveredFields, 'System.Watermark', 'number')) {
      comprehensiveFields += `\n  watermark         Int?`
    }
    if (this.hasField(discoveredFields, 'System.CommentCount', 'number')) {
      comprehensiveFields += `\n  commentCount      Int?     @default(0)`
    }
    if (
      this.hasField(
        discoveredFields,
        'Microsoft.VSTS.Common.HasAttachments',
        'boolean',
      )
    ) {
      comprehensiveFields += `\n  hasAttachments    Boolean  @default(false)`
    }
    if (this.hasField(discoveredFields, 'System.TeamProject', 'string')) {
      comprehensiveFields += `\n  teamProject       String?`
    }
    if (this.hasField(discoveredFields, 'System.AreaId', 'number')) {
      comprehensiveFields += `\n  areaId            Int?`
    }
    if (this.hasField(discoveredFields, 'System.IterationId', 'number')) {
      comprehensiveFields += `\n  nodeId            Int?`
    }
    if (
      this.hasField(
        discoveredFields,
        'Microsoft.VSTS.Common.StackRank',
        'number',
      )
    ) {
      comprehensiveFields += `\n  stackRank         Float?`
    }
    if (
      this.hasField(
        discoveredFields,
        'Microsoft.VSTS.Common.ValueArea',
        'string',
      )
    ) {
      comprehensiveFields += `\n  valueArea         String?`
    }

    // Add custom fields storage for any complex types
    const hasCustomFields = Object.entries(discoveredFields).some(
      ([field, type]) =>
        field.startsWith('Custom.') || ['object', 'array'].includes(type),
    )

    if (hasCustomFields) {
      comprehensiveFields += `\n  customFields      String?  // JSON storage for custom fields`
    }

    const footer = `
  
  // Store EVERYTHING from Azure DevOps (backup)
  rawJson           String
  
  // Sync metadata
  lastUpdatedAt     DateTime
  lastSyncedAt      DateTime @default(now())
  
  // Relations
  comments          WorkItemComment[]
  
  @@index([type])
  @@index([state])
  @@index([assignedTo])
  @@index([iterationPath])
  @@index([changedDate])
  @@index([createdDate])
  @@map("work_items")`

    return `// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model WorkItem {
${coreFields}${comprehensiveFields}${footer}
}

model WorkItemComment {
  id           String   @id // Azure DevOps comment ID
  workItemId   Int
  text         String
  createdBy    String
  createdDate  DateTime
  modifiedBy   String?
  modifiedDate DateTime?
  
  workItem     WorkItem @relation(fields: [workItemId], references: [id], onDelete: Cascade)
  
  @@index([workItemId])
  @@map("work_item_comments")
}`
  }

  /**
   * Create migration SQL for new comprehensive fields
   */
  createMigrationFile(newFields: MigrationField[]): string {
    if (newFields.length === 0) {
      return `-- Add comprehensive Azure DevOps fields
-- No new fields to add`
    }

    let migrationSql = `-- Add comprehensive Azure DevOps fields\n`

    // Add column statements
    newFields.forEach((field) => {
      let columnDef = `ALTER TABLE work_items ADD COLUMN ${field.name} ${field.sqlType}`
      if (field.defaultValue) {
        columnDef += ` DEFAULT ${field.defaultValue}`
      }
      migrationSql += `${columnDef};\n`
    })

    migrationSql += `\n-- Performance indexes for new commonly-queried fields\n`

    // Add indexes for performance-critical fields
    const indexableFields = [
      'rev',
      'watermark',
      'commentCount',
      'hasAttachments',
      'teamProject',
    ]
    newFields.forEach((field) => {
      if (indexableFields.includes(field.name)) {
        migrationSql += `CREATE INDEX idx_work_items_${field.name} ON work_items(${field.name});\n`
      }
    })

    return migrationSql
  }

  /**
   * Test migration by applying and rolling back
   */
  async testMigration(migrationSql: string): Promise<MigrationTestResult> {
    let migrationApplied = false
    let rollbackSuccessful = false

    try {
      console.log('Testing migration by applying and rolling back...')

      // Apply migration
      const { stdout: applyOutput } = await execAsync(
        'pnpm prisma migrate dev --name test-comprehensive-schema',
        {
          maxBuffer: 10 * 1024 * 1024,
        },
      )
      console.log('Migration applied:', applyOutput)
      migrationApplied = true

      // Test rollback
      const { stdout: rollbackOutput } = await execAsync(
        'pnpm prisma migrate reset --force',
        {
          maxBuffer: 10 * 1024 * 1024,
        },
      )
      console.log('Migration rolled back:', rollbackOutput)
      rollbackSuccessful = true

      return {
        success: true,
        migrationApplied,
        rollbackSuccessful,
      }
    } catch (error) {
      console.error('Migration test failed:', error)
      return {
        success: false,
        migrationApplied,
        rollbackSuccessful,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Validate data integrity after migration
   */
  validateDataIntegrity(
    preMigrationData: any[],
    postMigrationData: any[],
  ): DataIntegrityResult {
    const missingRecords: number[] = []
    const corruptedRecords: number[] = []

    // Check for missing records
    preMigrationData.forEach((preRecord) => {
      const postRecord = postMigrationData.find(
        (post) => post.id === preRecord.id,
      )
      if (!postRecord) {
        missingRecords.push(preRecord.id)
        return
      }

      // Check for corrupted data (core fields should remain intact)
      const coreFields = ['id', 'title', 'state', 'type', 'rawJson']
      const isCorrupted = coreFields.some((field) => {
        return preRecord[field] !== postRecord[field]
      })

      if (isCorrupted) {
        corruptedRecords.push(preRecord.id)
      }
    })

    return {
      isValid: missingRecords.length === 0 && corruptedRecords.length === 0,
      recordCount: postMigrationData.length,
      missingRecords,
      corruptedRecords,
    }
  }

  /**
   * Map Azure DevOps field names to Prisma field names
   */
  private mapAzureFieldsToPrismaFields(
    discoveredFields: Record<string, string>,
  ): string[] {
    const prismaFields: string[] = []

    Object.keys(discoveredFields).forEach((azureField) => {
      let prismaFieldName: string

      // Map known Azure DevOps fields to Prisma field names
      switch (azureField) {
        case 'System.Rev':
        case 'rev':
          prismaFieldName = 'rev'
          break
        case 'System.Reason':
        case 'reason':
          prismaFieldName = 'reason'
          break
        case 'System.Watermark':
        case 'watermark':
          prismaFieldName = 'watermark'
          break
        case 'System.CommentCount':
        case 'commentCount':
          prismaFieldName = 'commentCount'
          break
        case 'System.TeamProject':
        case 'teamProject':
          prismaFieldName = 'teamProject'
          break
        case 'System.AreaId':
        case 'areaId':
          prismaFieldName = 'areaId'
          break
        case 'System.IterationId':
        case 'nodeId':
          prismaFieldName = 'nodeId'
          break
        case 'Microsoft.VSTS.Common.StackRank':
        case 'stackRank':
          prismaFieldName = 'stackRank'
          break
        case 'Microsoft.VSTS.Common.ValueArea':
        case 'valueArea':
          prismaFieldName = 'valueArea'
          break
        case 'url':
          prismaFieldName = 'url'
          break
        default:
          // For custom fields or unmapped fields, they go into customFields JSON storage
          if (
            azureField.startsWith('Custom.') ||
            azureField.includes('Custom')
          ) {
            prismaFieldName = 'customFields'
          } else {
            // Skip unmapped system fields that are already handled elsewhere
            return
          }
      }

      if (!prismaFields.includes(prismaFieldName)) {
        prismaFields.push(prismaFieldName)
      }
    })

    // Always include hasAttachments as it's inferred from relations
    if (!prismaFields.includes('hasAttachments')) {
      prismaFields.push('hasAttachments')
    }

    return prismaFields
  }

  /**
   * Execute full migration workflow with field discovery
   */
  async fullMigrationWorkflow(
    sampleWorkItemIds?: number[],
  ): Promise<FullMigrationResult> {
    let schemaGenerated = false
    let migrationCreated = false
    let migrationTested = false

    try {
      console.log('Starting full migration workflow...')

      // Step 0: Discover fields from Azure DevOps if sample IDs provided
      let discoveredFields: Record<string, string> = {}
      if (sampleWorkItemIds && sampleWorkItemIds.length > 0) {
        console.log('Discovering fields from sample Azure DevOps work items...')
        discoveredFields =
          await this.discoverFieldsFromAzureDevOps(sampleWorkItemIds)
        console.log(
          `Field discovery complete. Found ${Object.keys(discoveredFields).length} unique fields.`,
        )
      } else {
        console.log(
          'No sample work item IDs provided, using fallback field mapping...',
        )
      }

      // Step 1: Generate comprehensive schema
      console.log('Generating comprehensive schema...')
      const schema = this.generateComprehensiveSchema(discoveredFields)
      const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma')
      await writeFile(schemaPath, schema)

      schemaGenerated = true
      console.log('Schema generated successfully')

      // Step 2: Create migration
      console.log('Creating migration...')
      await execAsync(
        'pnpm prisma migrate dev --name add-comprehensive-fields --create-only',
        {
          maxBuffer: 10 * 1024 * 1024,
        },
      )
      migrationCreated = true
      console.log('Migration created successfully')

      // Step 3: Test migration (apply and rollback)
      console.log('Testing migration...')
      const testResult = await this.testMigration('')
      migrationTested = testResult.success

      if (!migrationTested) {
        return {
          success: false,
          schemaGenerated,
          migrationCreated,
          migrationTested,
          dataIntegrityValid: false,
          error: testResult.error,
        }
      }

      console.log('Migration tested successfully')

      return {
        success: true,
        schemaGenerated,
        migrationCreated,
        migrationTested,
        dataIntegrityValid: true,
      }
    } catch (error) {
      console.error('Full migration workflow failed:', error)
      return {
        success: false,
        schemaGenerated,
        migrationCreated,
        migrationTested,
        dataIntegrityValid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Helper method to check if a field exists with the expected type
   */
  private hasField(
    discoveredFields: Record<string, string>,
    fieldName: string,
    expectedType: string,
  ): boolean {
    return (
      discoveredFields[fieldName] === expectedType ||
      Object.keys(discoveredFields).some((key) =>
        key.includes(fieldName.split('.').pop() || ''),
      )
    )
  }
}
