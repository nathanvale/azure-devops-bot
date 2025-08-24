#!/usr/bin/env tsx

import { execSync } from 'child_process'
import { existsSync } from 'fs'
import * as path from 'path'

import { AzureDevOpsClient } from '../src/services/azure-devops.js'

async function validateAzureDevOpsConfiguration(): Promise<void> {
  console.log('🔐 Validating Azure DevOps configuration...')

  // Check if PAT is configured
  const pat = process.env.AZURE_DEVOPS_PAT
  if (!pat || pat.trim().length === 0) {
    console.log('⚠️  AZURE_DEVOPS_PAT environment variable is not set')
    console.log('📝 To set up Azure DevOps authentication:')
    console.log(
      '   1. Go to https://dev.azure.com/fwcdev/_usersSettings/tokens',
    )
    console.log(
      '   2. Create a new Personal Access Token with "Work items (read & write)" permission',
    )
    console.log(
      '   3. Set the environment variable: export AZURE_DEVOPS_PAT="your-token-here"',
    )
    console.log('   4. Run this script again')
    console.log('')
    console.log(
      '⏭️  Skipping Azure DevOps validation (optional for database setup)',
    )
    return
  }

  console.log(`✅ AZURE_DEVOPS_PAT is configured (${pat.length} characters)`)

  try {
    // Test REST client authentication
    const client = new AzureDevOpsClient()
    console.log('🔗 Testing Azure DevOps REST client connection...')

    // This will throw if authentication fails
    const workItems = await client.fetchWorkItems()
    console.log(
      `✅ Azure DevOps connection successful! Found ${workItems.length} work items`,
    )
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('AZURE_DEVOPS_PAT')) {
        console.log(
          '🔐 Authentication Error: Your PAT may be invalid or expired',
        )
        console.log('💡 Please check:')
        console.log('   1. Your PAT is valid and not expired')
        console.log('   2. Your PAT has "Work items (read & write)" permission')
        console.log(
          '   3. Update your environment variable: export AZURE_DEVOPS_PAT="new-token"',
        )
      } else if (
        error.message.includes('403') ||
        error.message.includes('Forbidden')
      ) {
        console.log(
          '🚫 Permission Error: Your PAT may not have sufficient permissions',
        )
        console.log(
          '📝 Ensure your PAT has "Work items (read & write)" permission',
        )
      } else {
        console.log('⚠️  Azure DevOps connection test failed:', error.message)
        console.log(
          '🌐 This may be due to network connectivity or service availability',
        )
      }
    } else {
      console.log('⚠️  Azure DevOps connection test failed:', error)
    }

    console.log(
      '⏭️  Continuing with database setup (Azure DevOps will be validated when service starts)',
    )
  }
}

async function initializeDatabase() {
  console.log('🔧 Initializing Azure DevOps Bot database...')

  const dbPath = path.join(process.cwd(), 'prisma', 'dev.db')
  const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma')

  // Check if schema exists
  if (!existsSync(schemaPath)) {
    console.error('❌ Prisma schema not found at:', schemaPath)
    process.exit(1)
  }

  try {
    // Check if database exists
    const dbExists = existsSync(dbPath)

    if (!dbExists) {
      console.log('📦 Database not found, creating new database...')
    } else {
      console.log('📦 Database found, checking migration status...')
    }

    // Run migrations
    console.log('🚀 Running database migrations...')
    execSync('pnpm prisma migrate deploy', {
      stdio: 'inherit',
      cwd: process.cwd(),
    })

    // Generate Prisma client
    console.log('🔨 Generating Prisma client...')
    execSync('pnpm prisma generate', {
      stdio: 'inherit',
      cwd: process.cwd(),
    })

    console.log('✅ Database initialization complete!')

    // Validate Azure DevOps configuration
    await validateAzureDevOpsConfiguration()

    console.log('')
    console.log('Next steps:')
    console.log(
      '1. Ensure AZURE_DEVOPS_PAT environment variable is set with a valid Personal Access Token',
    )
    console.log(
      '2. Set AZURE_DEVOPS_USER_EMAILS environment variable for user filtering',
    )
    console.log('3. Run: pnpm dev to start CLI mode')
    console.log('4. Or run: pnpm mcp --emails=your@email.com for MCP mode')
  } catch (error) {
    console.error('❌ Database initialization failed:', error)
    process.exit(1)
  }
}

// Run if called directly
if (process.argv[1] && process.argv[1].endsWith('init-database.ts')) {
  initializeDatabase().catch(console.error)
}

export { initializeDatabase }
