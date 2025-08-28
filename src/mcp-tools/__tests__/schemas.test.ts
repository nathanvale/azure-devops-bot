import { describe, it, expect } from 'vitest'
import { z } from 'zod'

import {
  WorkItemIdSchema,
  WorkItemFiltersSchema,
  // WorkItemResponseSchema,
  CreateWorkItemSchema,
  UpdateWorkItemStateSchema,
  validateInput,
  ValidationError,
  createSuccessResponse,
  createErrorResponse,
} from '../schemas/index.js'

describe('Zod Schema Validation', () => {
  describe('WorkItemIdSchema', () => {
    it('should validate correct work item ID', () => {
      const result = WorkItemIdSchema.parse({ id: 123 })
      expect(result.id).toBe(123)
    })

    it('should reject negative ID', () => {
      expect(() => WorkItemIdSchema.parse({ id: -1 })).toThrow()
    })

    it('should reject non-integer ID', () => {
      expect(() => WorkItemIdSchema.parse({ id: 123.45 })).toThrow()
    })

    it('should reject missing ID', () => {
      expect(() => WorkItemIdSchema.parse({})).toThrow()
    })
  })

  describe('WorkItemFiltersSchema', () => {
    it('should validate empty filters', () => {
      const result = WorkItemFiltersSchema.parse({})
      expect(result.top).toBe(50) // default value
      expect(result.skip).toBe(0) // default value
    })

    it('should validate complete filters', () => {
      const input = {
        states: ['Active', 'New'],
        assignee: 'test@example.com',
        type: 'Bug',
        top: 100,
        skip: 10,
      }
      const result = WorkItemFiltersSchema.parse(input)

      expect(result.states).toEqual(['Active', 'New'])
      expect(result.assignee).toBe('test@example.com')
      expect(result.type).toBe('Bug')
      expect(result.top).toBe(100)
      expect(result.skip).toBe(10)
    })

    it('should reject invalid email format', () => {
      expect(() =>
        WorkItemFiltersSchema.parse({
          assignee: 'invalid-email',
        }),
      ).toThrow()
    })

    it('should reject top value exceeding max', () => {
      expect(() =>
        WorkItemFiltersSchema.parse({
          top: 1000, // max is 500
        }),
      ).toThrow()
    })

    it('should reject negative skip value', () => {
      expect(() =>
        WorkItemFiltersSchema.parse({
          skip: -1,
        }),
      ).toThrow()
    })
  })

  describe('CreateWorkItemSchema', () => {
    it('should validate minimal work item creation', () => {
      const input = {
        type: 'Bug' as const,
        title: 'Test Bug',
      }
      const result = CreateWorkItemSchema.parse(input)

      expect(result.type).toBe('Bug')
      expect(result.title).toBe('Test Bug')
    })

    it('should validate complete work item creation', () => {
      const input = {
        type: 'Feature' as const,
        title: 'New Feature',
        description: 'Feature description',
        assignedTo: 'dev@example.com',
        areaPath: 'Project\\Area',
        iterationPath: 'Project\\Sprint 1',
        priority: 1,
        severity: 2,
        storyPoints: 5,
        tags: ['frontend', 'ui'],
      }
      const result = CreateWorkItemSchema.parse(input)

      expect(result.type).toBe('Feature')
      expect(result.title).toBe('New Feature')
      expect(result.assignedTo).toBe('dev@example.com')
      expect(result.storyPoints).toBe(5)
      expect(result.tags).toEqual(['frontend', 'ui'])
    })

    it('should reject empty title', () => {
      expect(() =>
        CreateWorkItemSchema.parse({
          type: 'Bug',
          title: '',
        }),
      ).toThrow()
    })

    it('should reject invalid work item type', () => {
      expect(() =>
        CreateWorkItemSchema.parse({
          type: 'InvalidType',
          title: 'Test',
        }),
      ).toThrow()
    })

    it('should reject invalid email format', () => {
      expect(() =>
        CreateWorkItemSchema.parse({
          type: 'Bug',
          title: 'Test',
          assignedTo: 'invalid-email',
        }),
      ).toThrow()
    })
  })

  describe('UpdateWorkItemStateSchema', () => {
    it('should validate state update', () => {
      const input = {
        id: 123,
        state: 'Active',
        reason: 'Starting work',
      }
      const result = UpdateWorkItemStateSchema.parse(input)

      expect(result.id).toBe(123)
      expect(result.state).toBe('Active')
      expect(result.reason).toBe('Starting work')
    })

    it('should validate state update without reason', () => {
      const input = {
        id: 123,
        state: 'Closed',
      }
      const result = UpdateWorkItemStateSchema.parse(input)

      expect(result.id).toBe(123)
      expect(result.state).toBe('Closed')
      expect(result.reason).toBeUndefined()
    })

    it('should reject empty state', () => {
      expect(() =>
        UpdateWorkItemStateSchema.parse({
          id: 123,
          state: '',
        }),
      ).toThrow()
    })
  })
})

describe('Schema Utilities', () => {
  describe('validateInput', () => {
    it('should validate correct input', () => {
      const schema = z.object({ name: z.string() })
      const result = validateInput(schema, { name: 'test' })

      expect(result.name).toBe('test')
    })

    it('should throw ValidationError for invalid input', () => {
      const schema = z.object({ name: z.string() })

      expect(() => validateInput(schema, { name: 123 })).toThrow(
        ValidationError,
      )
    })

    it('should include detailed error information', () => {
      const schema = z.object({
        name: z.string().min(3),
        email: z.string().email(),
      })

      try {
        validateInput(schema, { name: 'ab', email: 'invalid' })
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError)
        const validationError = error as ValidationError
        expect(validationError.errors).toHaveLength(2)
        expect(validationError.errors[0]?.field).toBe('name')
        expect(validationError.errors[1]?.field).toBe('email')
      }
    })
  })

  describe('createSuccessResponse', () => {
    it('should create success response with data only', () => {
      const response = createSuccessResponse({ result: 'success' })

      expect(response.data.result).toBe('success')
      expect(response.meta?.timestamp).toBeDefined()
      expect(response.meta?.version).toBe('2.0.0')
    })

    it('should create success response with metadata', () => {
      const response = createSuccessResponse(
        { items: ['a', 'b'] },
        { count: 2, total: 10 },
      )

      expect(response.data.items).toEqual(['a', 'b'])
      expect(response.meta?.count).toBe(2)
      expect(response.meta?.total).toBe(10)
      expect(response.meta?.timestamp).toBeDefined()
      expect(response.meta?.version).toBe('2.0.0')
    })
  })

  describe('createErrorResponse', () => {
    it('should create error response', () => {
      const response = createErrorResponse(
        'VALIDATION_ERROR',
        'Input validation failed',
        { field: 'name' },
        [{ field: 'name', message: 'Required' }],
      )

      expect(response.error.code).toBe('VALIDATION_ERROR')
      expect(response.error.message).toBe('Input validation failed')
      expect(response.error.details?.field).toBe('name')
      expect(response.error.validation).toHaveLength(1)
      expect(response.error.validation![0]?.field).toBe('name')
      expect(response.error.timestamp).toBeDefined()
    })

    it('should create error response with minimal data', () => {
      const response = createErrorResponse(
        'GENERIC_ERROR',
        'Something went wrong',
      )

      expect(response.error.code).toBe('GENERIC_ERROR')
      expect(response.error.message).toBe('Something went wrong')
      expect(response.error.details).toBeUndefined()
      expect(response.error.validation).toBeUndefined()
      expect(response.error.timestamp).toBeDefined()
    })
  })
})
