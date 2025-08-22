#!/usr/bin/env tsx

import { execSync } from 'child_process'
import { existsSync } from 'fs'
import path from 'path'

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
    console.log('')
    console.log('Next steps:')
    console.log('1. Set AZURE_DEVOPS_USER_EMAILS environment variable')
    console.log('2. Run: pnpm dev to start CLI mode')
    console.log('3. Or run: pnpm mcp --emails=your@email.com for MCP mode')
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
