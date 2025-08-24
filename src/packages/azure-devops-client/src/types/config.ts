export interface AzureDevOpsClientConfig {
  organization: string
  project: string
  pat: string
  apiVersion?: string
  baseUrl?: string
  rateLimit?: RateLimitConfig
  retry?: RetryConfig
}

export interface RateLimitConfig {
  maxConcurrent: number
  requestsPerSecond: number
  respectHeaders: boolean
}

export interface RetryConfig {
  maxAttempts: number
  baseDelay: number
  maxDelay: number
  backoffFactor: number
}

export interface BatchOptions {
  expand?: WorkItemExpand
  asOf?: string
  fields?: string[]
  errorPolicy?: 'omit' | 'fail'
}

export type WorkItemExpand = 'all' | 'fields' | 'links' | 'relations'

// Rate limiting response headers
export interface RateLimitHeaders {
  'x-ratelimit-resource': string
  'x-ratelimit-delay': string
  'x-ratelimit-limit': string
  'x-ratelimit-remaining': string
  'x-ratelimit-reset': string
}
