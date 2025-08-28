// Common type definitions for the Azure DevOps Bot

/**
 * Generic error type for handling unknown errors
 */
export interface ErrorWithMessage {
  message: string
  name?: string
  cause?: unknown
}

/**
 * Azure DevOps raw data structure (parsed from JSON)
 */
export interface AzureDevOpsRawData {
  id?: number
  rev?: number
  fields?: Record<string, unknown>
  relations?: Array<{
    rel: string
    url: string
    attributes?: Record<string, unknown>
  }>
  url?: string
  _links?: Record<string, { href: string }>
  [key: string]: unknown
}

/**
 * Resilience telemetry context
 */
export interface ResilienceTelemetryContext {
  operation?: string
  attempt?: number
  duration?: number
  [key: string]: unknown
}

/**
 * Logger context for structured logging
 */
export interface LoggerContext {
  operation?: string
  component?: string
  [key: string]: unknown
}

/**
 * Database where clause builder for type-safe queries
 */
export type DatabaseWhereClause = Record<string, unknown>

/**
 * Generic function that can handle any arguments and return any value
 * Use this sparingly and prefer specific type definitions
 */
export type GenericFunction = (...args: unknown[]) => unknown

/**
 * Type for handling dynamic object access safely
 */
export type SafeObject = Record<string | number | symbol, unknown>

/**
 * Type guard to check if a value is an Error
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error
}

/**
 * Type guard to check if a value has a message property
 */
export function hasMessage(value: unknown): value is ErrorWithMessage {
  return typeof value === 'object' && value !== null && 'message' in value
}

/**
 * Safely extract error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (isError(error)) return error.message
  if (hasMessage(error)) return error.message
  return String(error)
}
