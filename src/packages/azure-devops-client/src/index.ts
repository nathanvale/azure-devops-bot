// Authentication
export { PATAuth } from './auth/pat-auth.js'
// Main client
export { AzureDevOpsRestClient } from './client.js'

// Interfaces
export type { IAzureDevOpsClient } from './interfaces/client.js'

export type { IWorkItemProvider, ProviderInfo } from './interfaces/provider.js'
export { AzureDevOpsProvider } from './provider.js'
export type * from './types/api-responses.js'
export type * from './types/comments.js'

export type * from './types/config.js'
// Types
export type * from './types/work-items.js'

// Utilities
export {
  createBatchProcessor,
  BatchProcessor,
} from './utils/batch-processor.js'
// Re-export utility types
export type { BatchStats } from './utils/batch-processor.js'
export {
  ErrorHandler,
  AzureDevOpsError,
  AuthenticationError,
  RateLimitError,
  ValidationError,
} from './utils/error-handler.js'

export { RateLimiter } from './utils/rate-limiter.js'
export type { RateLimitStatus } from './utils/rate-limiter.js'
