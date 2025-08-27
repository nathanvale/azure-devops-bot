import { createPinoLogger } from '@orchestr8/logger'
import type { Logger } from '@orchestr8/logger'
import { mkdir } from 'fs/promises'
import * as path from 'path'

let globalLogger: Logger | null = null

// Create a silent logger that does absolutely nothing
const SILENT_LOGGER: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  trace: () => {},
  fatal: () => {},
  child: () => SILENT_LOGGER,
  level: 'silent',
  silent: () => {},
} as any

/**
 * Initialize the global logger with Pino adapter for structured logging
 * Supports both console and file output with rotation
 */
export async function initializeLogger(name = 'azure-devops-bot'): Promise<Logger> {
  // If quiet mode is enabled, return the silent logger immediately
  if (process.env.LOG_SILENT === 'true') {
    globalLogger = SILENT_LOGGER
    return globalLogger
  }
  
  if (globalLogger) {
    return globalLogger
  }

  // Ensure logs directory exists
  const logsDir = path.join(process.cwd(), 'logs')
  try {
    await mkdir(logsDir, { recursive: true })
  } catch (error) {
    console.warn('Failed to create logs directory:', error)
  }

  // Configure file transports only - no console output
  const fileTransports = process.env.NODE_ENV !== 'test' ? [
    {
      target: 'pino/file',
      options: { 
        destination: path.join(logsDir, 'azure-devops-bot.log'),
      },
      level: 'info'
    },
    {
      target: 'pino/file', 
      options: { 
        destination: path.join(logsDir, 'azure-devops-bot-errors.log'),
      },
      level: 'error'
    },
    {
      target: 'pino/file',
      options: { 
        destination: path.join(logsDir, 'azure-devops-bot-debug.log'),
      },
      level: 'debug'
    }
  ] : []

  const pinoLogger = await createPinoLogger({
    name,
    // If LOG_SILENT is true, use 'silent' level, otherwise use LOG_LEVEL or 'info'
    level: process.env.LOG_SILENT === 'true' ? 'silent' : (process.env.LOG_LEVEL || 'info'),
    pretty: false,
    defaultFields: {
      service: 'azure-devops-bot',
      version: '1.0.0',
    },
    redactKeys: [
      'pat',
      'token',
      'authorization',
      'AZURE_DEVOPS_PAT',
      'password',
      'secret',
    ],
    ...(fileTransports.length > 0 && { transports: fileTransports }),
  } as any)

  // Wrap the logger to ensure all methods always exist
  globalLogger = safeWrapLogger(pinoLogger)
  return globalLogger
}

/**
 * Wraps a logger to ensure all methods exist and are callable
 */
function safeWrapLogger(logger: Logger): Logger {
  return new Proxy(logger, {
    get(target, prop) {
      const originalMethod = target[prop as keyof Logger];
      
      // Ensure standard logger methods always exist and are functions
      if (prop === 'debug' || prop === 'info' || prop === 'warn' || prop === 'error' || prop === 'trace') {
        if (typeof originalMethod === 'function') {
          return originalMethod.bind(target);
        }
        // Return a no-op function if the method doesn't exist
        return () => {};
      }
      
      // Handle child method specially
      if (prop === 'child') {
        if (typeof originalMethod === 'function') {
          return (context: Record<string, any>) => {
            const childLogger = originalMethod.call(target, context);
            return safeWrapLogger(childLogger); // Recursively wrap child loggers
          };
        }
        return (context: Record<string, any>) => safeWrapLogger(target); // Return wrapped parent if child doesn't exist
      }
      
      return originalMethod;
    }
  }) as Logger;
}

/**
 * Get the global logger instance (synchronous)
 * Must be called after initializeLogger()
 */
export function getLogger(): Logger {
  // In quiet mode, always return silent logger
  if (process.env.LOG_SILENT === 'true') {
    return SILENT_LOGGER
  }
  
  if (!globalLogger) {
    throw new Error('Logger not initialized. Call initializeLogger() first.')
  }
  
  // Create a proxy that preserves all original methods but adds console output for errors
  // and ensures all logger methods exist even in silent mode
  const loggerProxy = new Proxy(globalLogger, {
    get(target, prop) {
      if (prop === 'error') {
        return (msg: string, obj?: any) => {
          // Log to files via the original logger
          target.error(msg, obj)
          
          // Also log to console for errors only
          if (obj) {
            console.error(`❌ ${msg}`, obj)
          } else {
            console.error(`❌ ${msg}`)
          }
        }
      }
      
      // Ensure all standard logger methods exist, even if silent
      if (prop === 'debug' || prop === 'info' || prop === 'warn' || prop === 'trace') {
        const originalMethod = target[prop as keyof Logger];
        if (typeof originalMethod === 'function') {
          return originalMethod.bind(target);
        }
        // Return a no-op function if the method doesn't exist (silent mode)
        return () => {};
      }
      
      return target[prop as keyof Logger]
    }
  })
  
  return loggerProxy as Logger
}

/**
 * Get the global logger instance safely (does not throw if not initialized)
 * Falls back to console logging if logger is not ready
 */
export function getSafeLogger(): Logger | null {
  // In quiet mode, always return silent logger
  if (process.env.LOG_SILENT === 'true') {
    return SILENT_LOGGER
  }
  return globalLogger
}

/**
 * Create a child logger with additional context
 */
export function createChildLogger(context: Record<string, any>): Logger {
  // In quiet mode, always return silent logger
  if (process.env.LOG_SILENT === 'true') {
    return SILENT_LOGGER
  }
  
  const logger = getSafeLogger()
  if (!logger) {
    // Return a console-based logger if global logger not initialized
    // Use originalConsole if available (for quiet mode), otherwise regular console
    const originalConsole = (global as any).originalConsole;
    const safeConsole = originalConsole || console;
    
    return {
      debug: (msg: string, obj?: any) => {
        if (safeConsole.debug && typeof safeConsole.debug === 'function') {
          safeConsole.debug(`🐛 [${context.component || 'unknown'}] ${msg}`, obj);
        }
      },
      info: (msg: string, obj?: any) => {
        if (safeConsole.info && typeof safeConsole.info === 'function') {
          safeConsole.info(`ℹ️ [${context.component || 'unknown'}] ${msg}`, obj);
        }
      },
      warn: (msg: string, obj?: any) => {
        if (safeConsole.warn && typeof safeConsole.warn === 'function') {
          safeConsole.warn(`⚠️ [${context.component || 'unknown'}] ${msg}`, obj);
        }
      },
      error: (msg: string, obj?: any) => {
        if (safeConsole.error && typeof safeConsole.error === 'function') {
          safeConsole.error(`❌ [${context.component || 'unknown'}] ${msg}`, obj);
        }
      },
      trace: (msg: string, obj?: any) => {
        if (safeConsole.trace && typeof safeConsole.trace === 'function') {
          safeConsole.trace(`🔍 [${context.component || 'unknown'}] ${msg}`, obj);
        }
      },
      child: (childContext: Record<string, any>) => createChildLogger({ ...context, ...childContext }),
    } as Logger
  }
  return logger.child(context)
}

/**
 * Logger factory for specific components
 */
export class LoggerFactory {
  static createForComponent(component: string, additionalContext = {}) {
    // In quiet mode, always return silent logger
    if (process.env.LOG_SILENT === 'true') {
      return SILENT_LOGGER
    }
    return createChildLogger({
      component,
      ...additionalContext,
    })
  }

  static createForRequest(correlationId: string, additionalContext = {}) {
    // In quiet mode, always return silent logger
    if (process.env.LOG_SILENT === 'true') {
      return SILENT_LOGGER
    }
    return createChildLogger({
      correlationId,
      ...additionalContext,
    })
  }

  static createForAzureAPI(operation: string, additionalContext = {}) {
    // In quiet mode, always return silent logger
    if (process.env.LOG_SILENT === 'true') {
      return SILENT_LOGGER
    }
    return createChildLogger({
      component: 'azure-api',
      operation,
      ...additionalContext,
    })
  }

  static createForMCP(tool: string, additionalContext = {}) {
    // In quiet mode, always return silent logger
    if (process.env.LOG_SILENT === 'true') {
      return SILENT_LOGGER
    }
    return createChildLogger({
      component: 'mcp-server',
      tool,
      ...additionalContext,
    })
  }
}