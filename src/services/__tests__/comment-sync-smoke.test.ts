import { describe, it, expect, beforeAll } from 'vitest'
import { AzureDevOpsClient } from '../azure-devops'
import { DatabaseService } from '../database'
import { PrismaClient } from '@prisma/client'

describe('Comment Sync Smoke Test', () => {
  let client: AzureDevOpsClient
  let database: DatabaseService
  let prisma: PrismaClient

  beforeAll(() => {
    client = new AzureDevOpsClient()
    database = new DatabaseService()
    prisma = new PrismaClient()
  })

  it('should identify why comments are not syncing', async () => {
    console.log('🔍 Starting comment sync debugging...')
    
    // Step 1: Find a work item with comments
    const workItemsWithComments = await prisma.workItem.findMany({
      where: {
        commentCount: {
          gt: 0
        }
      },
      take: 5,
      orderBy: {
        commentCount: 'desc'
      }
    })
    
    console.log(`📊 Found ${workItemsWithComments.length} work items with comment counts > 0`)
    
    if (workItemsWithComments.length === 0) {
      console.log('❌ No work items have comment counts > 0')
      return
    }
    
    const testWorkItem = workItemsWithComments[0]
    console.log(`🎯 Testing with work item ${testWorkItem.id} (comment count: ${testWorkItem.commentCount})`)
    
    // Step 2: Try to fetch comments from Azure DevOps
    console.log('📡 Fetching comments from Azure DevOps REST API...')
    let fetchedComments: any[] = []
    
    try {
      fetchedComments = await client.fetchWorkItemComments(testWorkItem.id)
      console.log(`✅ Successfully fetched ${fetchedComments.length} comments from API`)
      
      if (fetchedComments.length > 0) {
        console.log('📝 First comment structure:')
        console.log(JSON.stringify(fetchedComments[0], null, 2))
      }
    } catch (error) {
      console.error('❌ Failed to fetch comments:', error)
      throw error
    }
    
    // Step 3: Check current database state
    const existingComments = await prisma.workItemComment.findMany({
      where: {
        workItemId: testWorkItem.id
      }
    })
    
    console.log(`🗄️ Currently ${existingComments.length} comments in database for work item ${testWorkItem.id}`)
    
    // Step 4: Try to store comments
    if (fetchedComments.length > 0) {
      console.log('💾 Attempting to store comments...')
      
      try {
        // Log the exact data being stored
        console.log('📦 Comment data to store:')
        fetchedComments.forEach((comment, index) => {
          console.log(`  Comment ${index + 1}:`)
          console.log(`    - id: ${comment.id} (type: ${typeof comment.id})`)
          console.log(`    - workItemId: ${comment.workItemId} (type: ${typeof comment.workItemId})`)
          console.log(`    - text length: ${comment.text?.length || 0}`)
          console.log(`    - createdBy: ${comment.createdBy}`)
          console.log(`    - createdDate: ${comment.createdDate}`)
        })
        
        await database.storeWorkItemComments(fetchedComments)
        console.log('✅ Store operation completed')
        
        // Verify storage
        const storedComments = await prisma.workItemComment.findMany({
          where: {
            workItemId: testWorkItem.id
          }
        })
        
        console.log(`🎉 Successfully stored ${storedComments.length} comments`)
        
        if (storedComments.length !== fetchedComments.length) {
          console.error(`⚠️ Mismatch: Fetched ${fetchedComments.length} but stored ${storedComments.length}`)
        }
        
      } catch (error) {
        console.error('❌ Failed to store comments:', error)
        
        // Log detailed error information
        if (error instanceof Error) {
          console.error('Error details:')
          console.error('  - Name:', error.name)
          console.error('  - Message:', error.message)
          console.error('  - Stack:', error.stack)
        }
        
        throw error
      }
    }
    
    // Final verification
    expect(fetchedComments.length).toBeGreaterThan(0)
    
    const finalComments = await prisma.workItemComment.findMany({
      where: {
        workItemId: testWorkItem.id
      }
    })
    
    expect(finalComments.length).toBe(fetchedComments.length)
  })
  
  it('should check comment ID type consistency', async () => {
    console.log('🔍 Checking comment ID type issues...')
    
    // Test with a known work item ID
    const testWorkItemId = 7836 // From test.json
    
    try {
      const comments = await client.fetchWorkItemComments(testWorkItemId)
      
      if (comments.length > 0) {
        const firstComment = comments[0]
        console.log('📝 Comment ID type analysis:')
        console.log(`  - Raw ID: ${firstComment.id}`)
        console.log(`  - Type: ${typeof firstComment.id}`)
        console.log(`  - Is number: ${typeof firstComment.id === 'number'}`)
        console.log(`  - Is string: ${typeof firstComment.id === 'string'}`)
        
        if (typeof firstComment.id === 'string') {
          console.log(`  - Parsed as int: ${parseInt(firstComment.id, 10)}`)
          console.log(`  - Is valid number: ${!isNaN(parseInt(firstComment.id, 10))}`)
        }
      }
    } catch (error) {
      console.error('Failed to fetch comments for analysis:', error)
    }
  })
})