#!/usr/bin/env tsx

import { DatabaseService } from '../src/services/database.js'
import { AzureDevOpsClient } from '../src/services/azure-devops.js'

async function testRelationshipSync() {
  console.log('Testing relationship and comment sync...')
  
  const db = new DatabaseService()
  const client = new AzureDevOpsClient()
  
  try {
    // Get work items with relationships
    const workItemsWithRelations = await db.client.workItem.findMany({
      where: {
        rawJson: {
          contains: '"relations":'
        }
      },
      take: 5
    })
    
    console.log(`\nFound ${workItemsWithRelations.length} work items with relations`)
    
    for (const item of workItemsWithRelations) {
      console.log(`\nProcessing work item ${item.id}...`)
      
      // Parse raw JSON to get relations
      const rawData = JSON.parse(item.rawJson)
      const relations = rawData.relations || []
      
      console.log(`  Found ${relations.length} relations`)
      
      if (relations.length > 0) {
        // Store relationships
        await db.storeWorkItemRelations(item.id, relations)
        
        // Extract counts
        const { relationships, links } = db.extractWorkItemRelationships(item.id, relations)
        console.log(`  ✅ Stored ${relationships.length} relationships and ${links.length} links`)
      }
    }
    
    // Test comment sync for items with comments
    const workItemsWithComments = await db.client.workItem.findMany({
      where: {
        commentCount: {
          gt: 0
        }
      },
      take: 5
    })
    
    console.log(`\nFound ${workItemsWithComments.length} work items with comments`)
    
    for (const item of workItemsWithComments) {
      const needsSync = await db.needsCommentSync(
        item.id,
        item.commentCount,
        item.changedDate,
        item.lastSyncedAt
      )
      
      console.log(`\nWork item ${item.id}: ${item.commentCount} comments, needs sync: ${needsSync}`)
      
      if (needsSync) {
        try {
          const comments = await client.fetchWorkItemComments(item.id)
          await db.storeWorkItemComments(comments)
          console.log(`  ✅ Synced ${comments.length} comments`)
        } catch (error) {
          console.log(`  ⚠️ Failed to sync comments: ${error}`)
        }
      }
    }
    
    // Check final counts
    console.log('\n📊 Final Database Counts:')
    const [relations, links, comments] = await Promise.all([
      db.client.workItemRelation.count(),
      db.client.workItemLink.count(),
      db.client.workItemComment.count()
    ])
    
    console.log(`  Relations: ${relations}`)
    console.log(`  Links: ${links}`)
    console.log(`  Comments: ${comments}`)
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await db.close()
  }
}

testRelationshipSync().catch(console.error)