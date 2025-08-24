import type { RateLimiter } from './rate-limiter.js'

export interface BatchProcessorOptions {
  batchSize: number
  maxConcurrency: number
  rateLimiter?: RateLimiter
}

export class BatchProcessor<TInput, TOutput> {
  private readonly batchSize: number
  private readonly maxConcurrency: number
  private readonly rateLimiter?: RateLimiter

  constructor(options: BatchProcessorOptions) {
    this.batchSize = options.batchSize
    this.maxConcurrency = options.maxConcurrency
    this.rateLimiter = options.rateLimiter
  }

  /**
   * Processes items in batches with rate limiting and concurrency control
   */
  async processBatches<T extends TInput, U extends TOutput>(
    items: T[],
    processor: (batch: T[]) => Promise<U[]>,
  ): Promise<U[]> {
    if (items.length === 0) {
      return []
    }

    const batches = this.createBatches(items)
    const results: U[] = []

    // Process batches with concurrency control
    for (let i = 0; i < batches.length; i += this.maxConcurrency) {
      const concurrentBatches = batches.slice(i, i + this.maxConcurrency)

      const batchPromises = concurrentBatches.map((batch) =>
        this.processSingleBatch(batch, processor),
      )

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults.flat())
    }

    return results
  }

  /**
   * Processes a single batch with rate limiting
   */
  private async processSingleBatch<T extends TInput, U extends TOutput>(
    batch: T[],
    processor: (batch: T[]) => Promise<U[]>,
  ): Promise<U[]> {
    if (this.rateLimiter) {
      return this.rateLimiter.execute(() => processor(batch))
    }

    return processor(batch)
  }

  /**
   * Splits items into batches of specified size
   */
  private createBatches<T extends TInput>(items: T[]): T[][] {
    const batches: T[][] = []

    for (let i = 0; i < items.length; i += this.batchSize) {
      batches.push(items.slice(i, i + this.batchSize))
    }

    return batches
  }

  /**
   * Calculates batch processing statistics
   */
  getBatchStats(totalItems: number): BatchStats {
    const totalBatches = Math.ceil(totalItems / this.batchSize)
    const concurrentRounds = Math.ceil(totalBatches / this.maxConcurrency)

    return {
      totalItems,
      totalBatches,
      batchSize: this.batchSize,
      maxConcurrency: this.maxConcurrency,
      concurrentRounds,
      estimatedRequestCount: totalBatches,
    }
  }
}

export interface BatchStats {
  totalItems: number
  totalBatches: number
  batchSize: number
  maxConcurrency: number
  concurrentRounds: number
  estimatedRequestCount: number
}

/**
 * Creates a batch processor with Azure DevOps optimized defaults
 */
export function createBatchProcessor<TInput, TOutput>(
  options: Partial<BatchProcessorOptions> = {},
  rateLimiter?: RateLimiter,
): BatchProcessor<TInput, TOutput> {
  const defaultOptions: BatchProcessorOptions = {
    batchSize: 200, // Azure DevOps batch API limit
    maxConcurrency: 3, // Conservative concurrency to avoid rate limits
    rateLimiter,
  }

  return new BatchProcessor({
    ...defaultOptions,
    ...options,
  })
}

/**
 * Utility function for chunking arrays
 */
export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = []

  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize))
  }

  return chunks
}

/**
 * Utility function for removing duplicates from array
 */
export function removeDuplicates<T>(
  array: T[],
  keyFn: (item: T) => string | number = (item) => String(item),
): T[] {
  const seen = new Set<string | number>()
  return array.filter((item) => {
    const key = keyFn(item)
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

/**
 * Utility function for validating batch input
 */
export function validateBatchInput<T>(
  items: T[],
  validator: (item: T) => boolean,
  errorMessage: string,
): void {
  const invalidItems = items.filter((item) => !validator(item))

  if (invalidItems.length > 0) {
    throw new Error(
      `${errorMessage}. Found ${invalidItems.length} invalid items.`,
    )
  }
}
