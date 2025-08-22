#!/usr/bin/env tsx

/**
 * Field Discovery and Schema Migration CLI Script
 *
 * This script demonstrates the complete workflow:
 * 1. Discover fields from actual Azure DevOps work items using --expand all
 * 2. Generate comprehensive Prisma schema based on discovered fields
 * 3. Create database migration with new fields
 * 4. Test the migration for data integrity
 *
 * Usage:
 *   pnpm tsx scripts/discover-and-migrate-schema.ts [work-item-ids...]
 *
 * Examples:
 *   pnpm tsx scripts/discover-and-migrate-schema.ts 12345 67890 11111
 *   pnpm tsx scripts/discover-and-migrate-schema.ts --sample=3
 */

import { AzureDevOpsClient } from '../src/services/azure-devops'
import { FieldDiscoveryService } from '../src/services/field-discovery'
import { SchemaMigrationService } from '../src/services/schema-migration'

async function main() {
  const args = process.argv.slice(2)

  console.log('🔍 Azure DevOps Field Discovery and Schema Migration')
  console.log('==================================================\n')

  // Parse arguments
  let sampleWorkItemIds: number[] = []

  if (args.length === 0) {
    console.log('❌ No work item IDs provided. Usage:')
    console.log(
      '   pnpm tsx scripts/discover-and-migrate-schema.ts [work-item-ids...]',
    )
    console.log('   pnpm tsx scripts/discover-and-migrate-schema.ts --sample=3')
    process.exit(1)
  }

  if (args[0].startsWith('--sample=')) {
    const sampleCount = parseInt(args[0].split('=')[1])
    console.log(
      `📋 Using ${sampleCount} random work items from your project...\n`,
    )

    // Fetch some work items to get their IDs
    const client = new AzureDevOpsClient()
    const workItems = await client.fetchWorkItems()
    sampleWorkItemIds = workItems.slice(0, sampleCount).map((item) => item.id)

    console.log(`🎯 Selected work items: ${sampleWorkItemIds.join(', ')}\n`)
  } else {
    sampleWorkItemIds = args
      .map((arg) => parseInt(arg))
      .filter((id) => !isNaN(id))
    console.log(`🎯 Analyzing work items: ${sampleWorkItemIds.join(', ')}\n`)
  }

  try {
    // Step 1: Field Discovery
    console.log('🔎 Step 1: Discovering fields from Azure DevOps work items...')
    const fieldDiscoveryService = new FieldDiscoveryService()

    console.log(
      `   Fetching ${sampleWorkItemIds.length} work items with --expand all...`,
    )
    const documentation =
      await fieldDiscoveryService.discoverAllFields(sampleWorkItemIds)

    console.log('   ✅ Field discovery complete!')
    console.log('   📊 Field Discovery Report:')
    console.log(
      documentation
        .split('\n')
        .slice(0, 10)
        .map((line) => `      ${line}`)
        .join('\n'),
    )
    console.log('   ...\n')

    // Step 2: Schema Migration
    console.log('🏗️  Step 2: Generating comprehensive database schema...')
    const migrationService = new SchemaMigrationService()

    const result =
      await migrationService.fullMigrationWorkflow(sampleWorkItemIds)

    if (result.success) {
      console.log('   ✅ Migration workflow completed successfully!')
      console.log(`   📋 Schema generated: ${result.schemaGenerated}`)
      console.log(`   📦 Migration created: ${result.migrationCreated}`)
      console.log(`   🧪 Migration tested: ${result.migrationTested}`)
      console.log(
        `   🔒 Data integrity validated: ${result.dataIntegrityValid}`,
      )

      console.log(
        '\n🎉 Complete! Your database schema now includes all discovered Azure DevOps fields.',
      )
      console.log('   Next steps:')
      console.log('   1. Review the updated prisma/schema.prisma file')
      console.log('   2. Run: pnpm prisma migrate deploy')
      console.log('   3. Update your sync service to populate the new fields')
    } else {
      console.log('   ❌ Migration workflow failed:')
      console.log(`   Error: ${result.error}`)
      console.log(`   Schema generated: ${result.schemaGenerated}`)
      console.log(`   Migration created: ${result.migrationCreated}`)
      process.exit(1)
    }
  } catch (error) {
    console.error('💥 Script failed:', error)
    process.exit(1)
  }
}

if (require.main === module) {
  main().catch(console.error)
}
