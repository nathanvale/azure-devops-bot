// Re-export domain schemas in deterministic (alphabetical) order to satisfy lint rules
export * from './admin.js'
export * from './sync.js'
export * from './work-item.js'

// Schema utilities
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

/**
 * Convert Zod schema to JSON Schema format for MCP compatibility
 * Uses zod-to-json-schema for proper conversion with enums, descriptions, etc.
 */
export function zodSchemaToJsonSchema<T extends z.ZodTypeAny>(
  schema: T,
): unknown {
  return zodToJsonSchema(schema, { name: 'schema', definitions: {} })
}

/**
 * Create a standardized ISO timestamp string
 * Centralized utility to ensure consistent timestamp format across all domains
 */
export function createTimestamp(): string {
  return new Date().toISOString()
}

/**
 * Validate and parse input using Zod schema with enhanced error handling
 */
export function validateInput<T>(schema: z.ZodSchema<T>, input: unknown): T {
  try {
    return schema.parse(input)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formattedErrors =
        error.issues?.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        })) || []

      throw new ValidationError('Input validation failed', formattedErrors)
    }
    throw error
  }
}

/**
 * Custom validation error class
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public errors: Array<{ field: string; message: string; code: string }>,
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}

/**
 * Standard error response format
 */
export interface StandardErrorResponse {
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
    validation?: Array<{
      field: string
      message: string
    }>
    timestamp: string
  }
}

/**
 * Standard success response format
 */
export interface StandardSuccessResponse<T = unknown> {
  data: T
  meta?: {
    count?: number
    total?: number
    filters?: Record<string, unknown>
    timestamp?: string
    version?: string
  }
}

/**
 * Create standardized error response
 */
export function createErrorResponse(
  code: string,
  message: string,
  details?: Record<string, unknown>,
  validation?: Array<{ field: string; message: string }>,
): StandardErrorResponse {
  return {
    error: {
      code,
      message,
      details,
      validation,
      timestamp: createTimestamp(),
    },
  }
}

/**
 * Create standardized success response
 */
export function createSuccessResponse<T>(
  data: T,
  meta?: StandardSuccessResponse<T>['meta'],
): StandardSuccessResponse<T> {
  return {
    data,
    meta: {
      timestamp: createTimestamp(),
      version: '2.0.0',
      ...meta,
    },
  }
}

/**
 * Error code constants to prevent typos
 */
export const ERROR_CODES = {
  TOOL_NOT_FOUND: 'TOOL_NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  EXECUTION_ERROR: 'EXECUTION_ERROR',
  OUTPUT_VALIDATION_ERROR: 'OUTPUT_VALIDATION_ERROR',
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]

/**
 * Generic success envelope schema wrapper
 * Wraps any data schema in the standard success response format
 */
export function createSuccessEnvelopeSchema<T extends z.ZodSchema>(
  dataSchema: T,
) {
  return z.object({
    data: dataSchema,
    meta: z
      .object({
        timestamp: z.string().datetime().optional(),
        version: z.string().optional(),
        count: z.number().int().min(0).optional(),
        total: z.number().int().min(0).optional(),
        // Keyed record of applied filter names to arbitrary values
        filters: z.record(z.string(), z.unknown()).optional(),
      })
      .optional(),
  })
}
