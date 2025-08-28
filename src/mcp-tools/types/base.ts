import type { Tool } from '@modelcontextprotocol/sdk/types.js'

import { z } from 'zod'

import type { StandardSuccessResponse } from '../schemas/index.js'

import {
  ERROR_CODES,
  createErrorResponse,
  createSuccessResponse,
  zodSchemaToJsonSchema,
} from '../schemas/index.js'

/**
 * Base interface for all domain implementations
 */
export interface Domain {
  /**
   * Get the name identifier for this domain
   */
  getName(): string

  /**
   * Get all tools provided by this domain
   */
  getTools(): Tool[]

  /**
   * Handle a tool call for this domain
   */
  handleTool(name: string, args: unknown): Promise<ToolResponse>

  /**
   * Check if this domain can handle the given tool name
   */
  canHandle(toolName: string): boolean
}

/**
 * Standard MCP tool response format
 */
export interface ToolResponse {
  content: Array<{
    type: 'text'
    text: string
  }>
}

/**
 * Tool definition with Zod schema support
 */
export interface DomainTool<TInput = unknown, TOutput = unknown> {
  name: string
  description: string
  inputSchema: z.ZodSchema<TInput>
  outputSchema?: z.ZodSchema<TOutput>
  handler: (args: unknown) => Promise<unknown>
}

/**
 * Strongly-typed domain tool definition helper
 * Infers types from Zod schemas to eliminate any types
 */
export type DomainToolDef<
  TInputSchema extends z.ZodSchema,
  TOutputSchema extends z.ZodSchema,
> = DomainTool<z.infer<TInputSchema>, z.infer<TOutputSchema>>

// Note: ErrorResponse and SuccessResponse types now imported from schemas/index.ts as StandardErrorResponse and StandardSuccessResponse

/**
 * Base domain class providing common functionality
 */
export abstract class BaseDomain implements Domain {
  protected tools: DomainTool[] = []

  abstract getName(): string

  getTools(): Tool[] {
    return this.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: this.convertZodToJsonSchema(tool.inputSchema) as Tool['inputSchema'],
    }))
  }

  canHandle(toolName: string): boolean {
    return this.tools.some((tool) => tool.name === toolName)
  }

  async handleTool(name: string, args: unknown): Promise<ToolResponse> {
    const tool = this.tools.find((t) => t.name === name)
    if (!tool) {
      return this.errorResponse(
        ERROR_CODES.TOOL_NOT_FOUND,
        `Tool ${name} not found in domain ${this.getName()}`,
      )
    }

    // Validate input first
    let validatedArgs: unknown
    try {
      validatedArgs = tool.inputSchema.parse(args)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return this.validationErrorResponse(error)
      }
      return this.errorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        error instanceof Error ? error.message : String(error),
      )
    }

    // Execute tool handler
    let result: unknown
    try {
      result = await tool.handler(validatedArgs)
    } catch (error) {
      return this.errorResponse(
        ERROR_CODES.EXECUTION_ERROR,
        error instanceof Error ? error.message : String(error),
      )
    }

    // Validate output if schema provided
    let validatedOutput = result
    if (tool.outputSchema) {
      try {
        validatedOutput = tool.outputSchema.parse(result)
      } catch (outputError) {
        if (outputError instanceof z.ZodError) {
          return this.outputValidationErrorResponse(outputError)
        }
        return this.errorResponse(
          ERROR_CODES.OUTPUT_VALIDATION_ERROR,
          outputError instanceof Error
            ? outputError.message
            : String(outputError),
        )
      }
    }

    // Return formatted response
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(validatedOutput, null, 2),
        },
      ],
    }
  }

  protected errorResponse(
    code: string,
    message: string,
    details?: Record<string, unknown>,
  ): ToolResponse {
    const errorResponse = createErrorResponse(code, message, details)

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(errorResponse, null, 2),
        },
      ],
    }
  }

  protected validationErrorResponse(zodError: z.ZodError): ToolResponse {
    const validation = zodError.issues.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
    }))

    const errorResponse = createErrorResponse(
      ERROR_CODES.VALIDATION_ERROR,
      'Input validation failed',
      undefined,
      validation,
    )

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(errorResponse, null, 2),
        },
      ],
    }
  }

  protected outputValidationErrorResponse(zodError: z.ZodError): ToolResponse {
    const validation = zodError.issues.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
    }))

    const errorResponse = createErrorResponse(
      ERROR_CODES.OUTPUT_VALIDATION_ERROR,
      'Output validation failed',
      undefined,
      validation,
    )

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(errorResponse, null, 2),
        },
      ],
    }
  }

  protected successResponse<T>(
    data: T,
    meta?: StandardSuccessResponse<T>['meta'],
  ): StandardSuccessResponse<T> {
    return createSuccessResponse(data, meta)
  }

  /**
   * Convert Zod schema to JSON Schema for MCP compatibility
   * Delegates to centralized utility function
   */
  private convertZodToJsonSchema(
    schema: z.ZodSchema<unknown>,
  ): Record<string, unknown> {
    return zodSchemaToJsonSchema(schema) as Record<string, unknown>
  }
}
