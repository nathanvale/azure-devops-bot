import { describe, it, expect, beforeEach } from 'vitest'
import { z } from 'zod'

import { createSuccessEnvelopeSchema } from '../schemas/index.js'
import { BaseDomain } from '../types/base.js'

// Test schemas
const TestInputSchema = z.object({
  id: z.number().positive(),
  name: z.string().optional(),
})

const TestOutputSchema = z.object({
  result: z.string(),
  count: z.number().min(0),
  data: z.object({
    id: z.number(),
    timestamp: z.string().datetime(),
  }),
})

// Wrapped version for validation
const TestOutputEnvelopeSchema = createSuccessEnvelopeSchema(TestOutputSchema)

// Mock domain with output validation
class OutputValidationTestDomain extends BaseDomain {
  constructor() {
    super()
    this.initializeTools()
  }

  getName(): string {
    return 'output-test'
  }

  private initializeTools(): void {
    this.tools = [
      {
        name: 'valid_output_tool',
        description: 'Tool that returns valid output',
        inputSchema: TestInputSchema,
        outputSchema: TestOutputEnvelopeSchema,
        handler: async (args) => {
          // Return wrapped output matching envelope schema
          return {
            data: {
              result: 'success',
              count: 5,
              data: {
                id: (args as any).id,
                timestamp: new Date().toISOString(),
              },
            },
            meta: {
              timestamp: new Date().toISOString(),
              version: '2.0.0',
            },
          }
        },
      },
      {
        name: 'invalid_output_tool',
        description: 'Tool that returns invalid output',
        inputSchema: TestInputSchema,
        outputSchema: TestOutputEnvelopeSchema,
        handler: async (args) => {
          // Return invalid wrapped output (missing required fields in data)
          return {
            data: {
              result: 'success',
              // Missing 'count' field
              data: {
                id: (args as any).id,
                timestamp: 'not-a-valid-datetime', // Invalid datetime format
              },
            },
            meta: {
              timestamp: new Date().toISOString(),
            },
          }
        },
      },
      {
        name: 'no_schema_tool',
        description: 'Tool without output schema',
        inputSchema: TestInputSchema,
        // No outputSchema defined
        handler: async (args) => {
          return {
            anything: 'goes',
            since: 'no validation',
            args,
          }
        },
      },
      {
        name: 'partial_invalid_tool',
        description: 'Tool with partially invalid output',
        inputSchema: TestInputSchema,
        outputSchema: TestOutputEnvelopeSchema,
        handler: async (args) => {
          return {
            data: {
              result: 'success',
              count: -5, // Violates min(0) constraint
              data: {
                id: (args as any).id,
                timestamp: new Date().toISOString(),
              },
            },
            meta: {
              timestamp: new Date().toISOString(),
            },
          }
        },
      },
    ]
  }
}

describe('Output Schema Validation', () => {
  let domain: OutputValidationTestDomain

  beforeEach(() => {
    domain = new OutputValidationTestDomain()
  })

  describe('Valid output scenarios', () => {
    it('should pass validation for valid output matching schema', async () => {
      const result = await domain.handleTool('valid_output_tool', {
        id: 123,
        name: 'test',
      })

      expect(result.content).toBeDefined()
      expect(result.content[0]?.type).toBe('text')

      const response = JSON.parse(result.content[0]?.text!)
      // Response should be wrapped with data and meta
      expect(response.data.result).toBe('success')
      expect(response.data.count).toBe(5)
      expect(response.data.data.id).toBe(123)
      expect(response.data.data.timestamp).toBeDefined()
      expect(response.meta).toBeDefined()
      expect(response.meta.timestamp).toBeDefined()
    })

    it('should skip validation when no output schema is defined', async () => {
      const result = await domain.handleTool('no_schema_tool', {
        id: 456,
      })

      expect(result.content).toBeDefined()
      expect(result.content[0]?.type).toBe('text')

      const response = JSON.parse(result.content[0]?.text!)
      expect(response.anything).toBe('goes')
      expect(response.since).toBe('no validation')
      expect(response.args.id).toBe(456)
    })
  })

  describe('Invalid output scenarios', () => {
    it('should return OUTPUT_VALIDATION_ERROR for missing required fields', async () => {
      const result = await domain.handleTool('invalid_output_tool', {
        id: 789,
      })

      expect(result.content).toBeDefined()
      expect(result.content[0]?.type).toBe('text')

      const errorResponse = JSON.parse(result.content[0]?.text!)
      expect(errorResponse.error).toBeDefined()
      expect(errorResponse.error.code).toBe('OUTPUT_VALIDATION_ERROR')
      expect(errorResponse.error.message).toContain('Output validation failed')
      expect(errorResponse.error.validation).toBeDefined()
      expect(Array.isArray(errorResponse.error.validation)).toBe(true)

      // Check for specific validation errors
      const validationErrors = errorResponse.error.validation

      // The validation errors should exist
      expect(validationErrors).toBeDefined()
      expect(validationErrors.length).toBeGreaterThan(0)

      // Check for count field error (nested in data path)
      const countError = validationErrors.find(
        (e: any) => e.field === 'data.count',
      )
      expect(countError).toBeDefined()
      // Zod gives different messages for missing required fields
      expect(countError?.message.toLowerCase()).toMatch(
        /required|expected|invalid/,
      )

      // Check for timestamp field error (nested deeper)
      const timestampError = validationErrors.find(
        (e: any) => e.field === 'data.data.timestamp',
      )
      expect(timestampError).toBeDefined()
    })

    it('should return OUTPUT_VALIDATION_ERROR for constraint violations', async () => {
      const result = await domain.handleTool('partial_invalid_tool', {
        id: 999,
      })

      expect(result.content).toBeDefined()
      expect(result.content[0]?.type).toBe('text')

      const errorResponse = JSON.parse(result.content[0]?.text!)
      expect(errorResponse.error).toBeDefined()
      expect(errorResponse.error.code).toBe('OUTPUT_VALIDATION_ERROR')
      expect(errorResponse.error.validation).toBeDefined()

      // Check for specific validation error on count field (nested in data)
      const countError = errorResponse.error.validation.find(
        (e: any) => e.field === 'data.count',
      )
      expect(countError).toBeDefined()
      expect(countError.message.toLowerCase()).toContain('too small')
    })
  })

  describe('Input validation still works', () => {
    it('should return VALIDATION_ERROR for invalid input', async () => {
      const result = await domain.handleTool('valid_output_tool', {
        id: -5, // Violates positive() constraint
        name: 'test',
      })

      expect(result.content).toBeDefined()
      expect(result.content[0]?.type).toBe('text')

      const errorResponse = JSON.parse(result.content[0]?.text!)
      expect(errorResponse.error).toBeDefined()
      expect(errorResponse.error.code).toBe('VALIDATION_ERROR')
      expect(errorResponse.error.message).toContain('Input validation failed')
    })

    it('should handle missing tool correctly', async () => {
      const result = await domain.handleTool('non_existent_tool', {
        id: 123,
      })

      expect(result.content).toBeDefined()
      expect(result.content[0]?.type).toBe('text')

      const errorResponse = JSON.parse(result.content[0]?.text!)
      expect(errorResponse.error).toBeDefined()
      expect(errorResponse.error.code).toBe('TOOL_NOT_FOUND')
    })
  })

  describe('Error response format validation', () => {
    it('should include timestamp in error responses', async () => {
      const result = await domain.handleTool('invalid_output_tool', {
        id: 123,
      })

      const errorResponse = JSON.parse(result.content[0]?.text!)
      expect(errorResponse.error.timestamp).toBeDefined()
      expect(errorResponse.error.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/,
      ) // ISO format
    })

    it('should include timestamp in input validation errors', async () => {
      const result = await domain.handleTool('valid_output_tool', {
        id: -5, // Invalid input
      })

      const errorResponse = JSON.parse(result.content[0]?.text!)
      expect(errorResponse.error.timestamp).toBeDefined()
      expect(errorResponse.error.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/,
      )
    })

    it('should use consistent error message for output validation', async () => {
      const result = await domain.handleTool('invalid_output_tool', {
        id: 123,
      })

      const errorResponse = JSON.parse(result.content[0]?.text!)
      expect(errorResponse.error.message).toBe('Output validation failed') // Not "internal error"
    })
  })

  describe('Error handling in handlers', () => {
    it('should handle exceptions in tool handlers', async () => {
      // Add a tool that throws an error
      const errorDomain = new (class extends BaseDomain {
        constructor() {
          super()
          this.tools = [
            {
              name: 'error_tool',
              description: 'Tool that throws an error',
              inputSchema: TestInputSchema,
              outputSchema: TestOutputEnvelopeSchema,
              handler: async () => {
                throw new Error('Handler execution failed')
              },
            },
          ]
        }
        getName() {
          return 'error-test'
        }
      })()

      const result = await errorDomain.handleTool('error_tool', { id: 1 })

      expect(result.content).toBeDefined()
      const errorResponse = JSON.parse(result.content[0]?.text!)
      expect(errorResponse.error.code).toBe('EXECUTION_ERROR')
      expect(errorResponse.error.message).toContain('Handler execution failed')
    })
  })
})
