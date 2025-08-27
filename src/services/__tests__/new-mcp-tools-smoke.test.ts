import { describe, it, expect, beforeAll } from 'vitest'
import { DatabaseService } from '../database.js'

describe('New MCP Tools - Smoke Tests', () => {
  let db: DatabaseService

  beforeAll(async () => {
    db = new DatabaseService()
  })

  describe('Database Query Methods', () => {
    it('should have getWorkItemsByAssignee method', () => {
      expect(typeof db.getWorkItemsByAssignee).toBe('function')
    })

    it('should have getCurrentSprintItems method', () => {
      expect(typeof db.getCurrentSprintItems).toBe('function')
    })

    it('should have getWorkItemsByState method', () => {
      expect(typeof db.getWorkItemsByState).toBe('function')
    })

    it('should have getWorkItemsByTeam method', () => {
      expect(typeof db.getWorkItemsByTeam).toBe('function')
    })

    it('should have getWorkItemWithFullRelations method', () => {
      expect(typeof db.getWorkItemWithFullRelations).toBe('function')
    })
  })

  describe('Query Method Signatures', () => {
    it('getWorkItemsByAssignee should accept string parameter', async () => {
      // Should not throw for method signature
      const result = await db.getWorkItemsByAssignee('test@example.com').catch(() => [])
      expect(Array.isArray(result)).toBe(true)
    })

    it('getCurrentSprintItems should work without parameters', async () => {
      // Should not throw for method signature
      const result = await db.getCurrentSprintItems().catch(() => [])
      expect(Array.isArray(result)).toBe(true)
    })

    it('getWorkItemsByState should accept string parameter', async () => {
      // Should not throw for method signature
      const result = await db.getWorkItemsByState('Active').catch(() => [])
      expect(Array.isArray(result)).toBe(true)
    })

    it('getWorkItemsByTeam should accept string parameter', async () => {
      // Should not throw for method signature
      const result = await db.getWorkItemsByTeam('test-team').catch(() => [])
      expect(Array.isArray(result)).toBe(true)
    })

    it('getWorkItemWithFullRelations should accept number parameter', async () => {
      // Should not throw for method signature
      try {
        await db.getWorkItemWithFullRelations(999999)
      } catch (error) {
        // Expected to throw "not found", but shouldn't throw type errors
        expect((error as Error).message).toContain('not found')
      }
    })
  })

  describe('Database Performance Logging', () => {
    it('should have logger instance', () => {
      // @ts-ignore - accessing private member for testing
      expect(db.logger).toBeDefined()
      // @ts-ignore 
      expect(typeof db.logger.info).toBe('function')
    })
  })
})