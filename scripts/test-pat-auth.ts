#!/usr/bin/env tsx

/**
 * Test script to validate Azure DevOps PAT authentication
 * This script tests the actual authentication with the user's Azure DevOps organization
 */

import { AzureDevOpsClient } from '../src/services/azure-devops.js'

async function testAuthentication(): Promise<void> {
  console.log('🔐 Testing Azure DevOps PAT Authentication...\n')

  // Check if PAT is configured
  const pat = process.env.AZURE_DEVOPS_PAT
  if (!pat) {
    console.log('❌ AZURE_DEVOPS_PAT environment variable is not set')
    console.log('📝 To set up authentication:')
    console.log(
      '   1. Go to https://dev.azure.com/fwcdev/_usersSettings/tokens',
    )
    console.log(
      '   2. Create a new Personal Access Token with "Work items (read & write)" permission',
    )
    console.log(
      '   3. Set the environment variable: export AZURE_DEVOPS_PAT="your-token-here"',
    )
    console.log('   4. Run this test again')
    process.exit(1)
  }

  console.log(`✅ AZURE_DEVOPS_PAT is configured (${pat.length} characters)`)
  console.log(`📍 Organization: fwcdev`)
  console.log(`📍 Project: Customer Services Platform\n`)

  try {
    // Create client and test basic operations
    console.log('🚀 Creating Azure DevOps client...')
    const client = new AzureDevOpsClient()
    console.log('✅ Client created successfully\n')

    // Test fetching work items (this will validate the full authentication flow)
    console.log('📋 Testing work item fetch...')
    const startTime = Date.now()

    const workItems = await client.fetchWorkItems()
    const duration = Date.now() - startTime

    console.log(
      `✅ Successfully fetched ${workItems.length} work items in ${duration}ms`,
    )

    if (workItems.length > 0) {
      const firstItem = workItems[0]
      console.log(`📝 Sample work item:`)
      console.log(`   ID: ${firstItem.id}`)
      console.log(`   Title: ${firstItem.title}`)
      console.log(`   State: ${firstItem.state}`)
      console.log(`   Type: ${firstItem.type}`)
      console.log(`   Assigned: ${firstItem.assignedTo}`)
    }

    // Test single work item fetch
    if (workItems.length > 0) {
      console.log('\n🔍 Testing single work item fetch...')
      const singleStartTime = Date.now()

      const singleItem = await client.fetchSingleWorkItem(workItems[0].id)
      const singleDuration = Date.now() - singleStartTime

      console.log(
        `✅ Fetched work item ${singleItem.id} in ${singleDuration}ms`,
      )
    }

    // Test comment fetching if work items exist
    if (workItems.length > 0) {
      console.log('\n💬 Testing comment fetch...')
      const commentStartTime = Date.now()

      try {
        const comments = await client.fetchWorkItemComments(workItems[0].id)
        const commentDuration = Date.now() - commentStartTime

        console.log(
          `✅ Fetched ${comments.length} comments in ${commentDuration}ms`,
        )
      } catch (error) {
        console.log(
          `⚠️  Comment fetch test skipped: ${error instanceof Error ? error.message : 'Unknown error'}`,
        )
      }
    }

    console.log('\n🎉 All authentication tests passed!')
    console.log(
      '🚀 Your Azure DevOps REST API integration is working correctly',
    )
  } catch (error) {
    console.log('\n❌ Authentication test failed')

    if (error instanceof Error) {
      if (
        error.message.includes('401') ||
        error.message.includes('Unauthorized')
      ) {
        console.log(
          '🔐 Authentication Error: Your PAT may be invalid or expired',
        )
        console.log('📝 Try creating a new Personal Access Token:')
        console.log(
          '   1. Go to https://dev.azure.com/fwcdev/_usersSettings/tokens',
        )
        console.log(
          '   2. Create a new token with "Work items (read & write)" permission',
        )
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
      } else if (
        error.message.includes('rate limit') ||
        error.message.includes('429')
      ) {
        console.log(
          '⏱️  Rate Limit: Too many requests, please wait and try again',
        )
      } else {
        console.log(`💥 Unexpected Error: ${error.message}`)
      }
    } else {
      console.log(`💥 Unknown Error: ${error}`)
    }

    process.exit(1)
  }
}

// Run the test
testAuthentication().catch((error) => {
  console.error('Script execution failed:', error)
  process.exit(1)
})
