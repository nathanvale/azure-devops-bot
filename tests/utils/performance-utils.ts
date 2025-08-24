/**
 * Performance Testing Utilities
 * 
 * Provides comprehensive performance monitoring and benchmarking tools
 * for validating Azure DevOps Bot production requirements.
 */

export interface MemoryUsage {
  rss: number
  heapTotal: number
  heapUsed: number
  external: number
  timestamp: number
}

export interface PerformanceMetrics {
  min: number
  max: number
  avg: number
  p95: number
  p99: number
  count: number
  total: number
}

export interface BenchmarkResult {
  name: string
  passed: boolean
  measured: number
  required: number
  unit: string
  details: string
}

/**
 * Memory usage monitoring for detecting leaks and tracking resource consumption
 */
export class MemoryMonitor {
  private samples: MemoryUsage[] = []
  private interval: NodeJS.Timeout | null = null

  /**
   * Start continuous memory monitoring
   */
  startMonitoring(intervalMs: number = 1000): void {
    this.samples = []
    this.interval = setInterval(() => {
      const usage = process.memoryUsage()
      this.samples.push({
        rss: usage.rss,
        heapTotal: usage.heapTotal,
        heapUsed: usage.heapUsed,
        external: usage.external,
        timestamp: Date.now()
      })
    }, intervalMs)
  }

  /**
   * Stop memory monitoring
   */
  stopMonitoring(): void {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
  }

  /**
   * Get current memory snapshot
   */
  getCurrentUsage(): MemoryUsage {
    const usage = process.memoryUsage()
    return {
      rss: usage.rss,
      heapTotal: usage.heapTotal,
      heapUsed: usage.heapUsed,
      external: usage.external,
      timestamp: Date.now()
    }
  }

  /**
   * Analyze memory samples for leaks and patterns
   */
  analyzeMemoryUsage(): {
    initialHeap: number
    finalHeap: number
    heapGrowth: number
    peakHeap: number
    avgHeap: number
    possibleLeak: boolean
    samples: MemoryUsage[]
  } {
    if (this.samples.length < 2) {
      throw new Error('Insufficient samples for analysis. Need at least 2 samples.')
    }

    const heapUsages = this.samples.map(s => s.heapUsed)
    const initialHeap = heapUsages[0]
    const finalHeap = heapUsages[heapUsages.length - 1]
    const peakHeap = Math.max(...heapUsages)
    const avgHeap = heapUsages.reduce((sum, heap) => sum + heap, 0) / heapUsages.length

    const heapGrowth = finalHeap - initialHeap
    const growthPercentage = (heapGrowth / initialHeap) * 100

    // Simple leak detection: significant growth over time
    const possibleLeak = growthPercentage > 20 && heapGrowth > 50 * 1024 * 1024 // 50MB growth + 20% increase

    return {
      initialHeap,
      finalHeap,
      heapGrowth,
      peakHeap,
      avgHeap,
      possibleLeak,
      samples: [...this.samples]
    }
  }

  /**
   * Clear all samples
   */
  clear(): void {
    this.samples = []
  }
}

/**
 * High-resolution performance timing with statistical analysis
 */
export class PerformanceTimer {
  private measurements: number[] = []
  private startTime: number = 0

  /**
   * Start timing measurement
   */
  start(): void {
    this.startTime = performance.now()
  }

  /**
   * End timing measurement and record result
   */
  end(): number {
    if (this.startTime === 0) {
      throw new Error('Timer not started. Call start() first.')
    }
    
    const duration = performance.now() - this.startTime
    this.measurements.push(duration)
    this.startTime = 0
    
    return duration
  }

  /**
   * Time a function execution
   */
  async time<T>(fn: () => Promise<T> | T): Promise<{ result: T; duration: number }> {
    this.start()
    const result = await fn()
    const duration = this.end()
    return { result, duration }
  }

  /**
   * Get comprehensive timing statistics
   */
  getMetrics(): PerformanceMetrics {
    if (this.measurements.length === 0) {
      throw new Error('No measurements recorded')
    }

    const sorted = [...this.measurements].sort((a, b) => a - b)
    const total = sorted.reduce((sum, time) => sum + time, 0)
    
    return {
      min: Math.min(...sorted),
      max: Math.max(...sorted),
      avg: total / sorted.length,
      p95: this.percentile(sorted, 95),
      p99: this.percentile(sorted, 99),
      count: sorted.length,
      total
    }
  }

  /**
   * Calculate percentile from sorted array
   */
  private percentile(sortedArray: number[], percentile: number): number {
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1
    return sortedArray[Math.max(0, index)]
  }

  /**
   * Clear all measurements
   */
  clear(): void {
    this.measurements = []
  }

  /**
   * Get all raw measurements
   */
  getMeasurements(): number[] {
    return [...this.measurements]
  }
}

/**
 * Orchestrates load testing scenarios with concurrent operations
 */
export class LoadTestOrchestrator {
  private memoryMonitor: MemoryMonitor
  private performanceTimer: PerformanceTimer

  constructor() {
    this.memoryMonitor = new MemoryMonitor()
    this.performanceTimer = new PerformanceTimer()
  }

  /**
   * Run sustained load test with memory monitoring
   */
  async runSustainedLoad<T>(
    operation: () => Promise<T>,
    options: {
      duration: number // milliseconds
      concurrency: number
      intervalMs: number
    }
  ): Promise<{
    results: T[]
    performanceMetrics: PerformanceMetrics
    memoryAnalysis: ReturnType<MemoryMonitor['analyzeMemoryUsage']>
    errors: Error[]
  }> {
    const { duration, concurrency, intervalMs } = options
    const results: T[] = []
    const errors: Error[] = []
    
    // Start memory monitoring
    this.memoryMonitor.startMonitoring(1000)
    
    const endTime = Date.now() + duration
    const workers: Promise<void>[] = []

    // Create concurrent workers
    for (let i = 0; i < concurrency; i++) {
      workers.push(this.createWorker(operation, endTime, intervalMs, results, errors))
    }

    // Wait for all workers to complete
    await Promise.all(workers)
    
    // Stop monitoring and analyze
    this.memoryMonitor.stopMonitoring()
    const memoryAnalysis = this.memoryMonitor.analyzeMemoryUsage()
    const performanceMetrics = this.performanceTimer.getMetrics()

    return {
      results,
      performanceMetrics,
      memoryAnalysis,
      errors
    }
  }

  /**
   * Run concurrent batch operations
   */
  async runConcurrentBatch<T>(
    operations: Array<() => Promise<T>>,
    options: {
      batchSize: number
      delayBetweenBatches?: number
    }
  ): Promise<{
    results: T[]
    performanceMetrics: PerformanceMetrics
    errors: Error[]
  }> {
    const { batchSize, delayBetweenBatches = 0 } = options
    const results: T[] = []
    const errors: Error[] = []

    // Process operations in batches
    for (let i = 0; i < operations.length; i += batchSize) {
      const batch = operations.slice(i, i + batchSize)
      
      const batchPromises = batch.map(async (operation) => {
        try {
          const { result, duration } = await this.performanceTimer.time(operation)
          results.push(result)
          return { result, duration }
        } catch (error) {
          errors.push(error instanceof Error ? error : new Error(String(error)))
          return null
        }
      })

      await Promise.all(batchPromises)
      
      // Delay between batches if specified
      if (delayBetweenBatches > 0 && i + batchSize < operations.length) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches))
      }
    }

    return {
      results,
      performanceMetrics: this.performanceTimer.getMetrics(),
      errors
    }
  }

  /**
   * Create a worker for sustained load testing
   */
  private async createWorker<T>(
    operation: () => Promise<T>,
    endTime: number,
    intervalMs: number,
    results: T[],
    errors: Error[]
  ): Promise<void> {
    while (Date.now() < endTime) {
      try {
        const { result } = await this.performanceTimer.time(operation)
        results.push(result)
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)))
      }
      
      // Wait before next operation
      await new Promise(resolve => setTimeout(resolve, intervalMs))
    }
  }
}

/**
 * Validates performance benchmarks against requirements
 */
export class BenchmarkValidator {
  private results: BenchmarkResult[] = []

  /**
   * Validate sync performance benchmark
   */
  validateSyncPerformance(
    measuredTimeMs: number,
    workItemCount: number,
    requiredMaxSeconds: number = 30
  ): BenchmarkResult {
    const measuredSeconds = measuredTimeMs / 1000
    const passed = measuredSeconds <= requiredMaxSeconds
    
    const result: BenchmarkResult = {
      name: 'Sync Performance',
      passed,
      measured: measuredSeconds,
      required: requiredMaxSeconds,
      unit: 'seconds',
      details: `Synced ${workItemCount} work items in ${measuredSeconds.toFixed(2)}s (required: ≤${requiredMaxSeconds}s)`
    }
    
    this.results.push(result)
    return result
  }

  /**
   * Validate query performance benchmark
   */
  validateQueryPerformance(
    metrics: PerformanceMetrics,
    requiredMaxMs: number = 100
  ): BenchmarkResult {
    const passed = metrics.p95 <= requiredMaxMs
    
    const result: BenchmarkResult = {
      name: 'Query Performance',
      passed,
      measured: metrics.p95,
      required: requiredMaxMs,
      unit: 'ms',
      details: `P95: ${metrics.p95.toFixed(1)}ms, Avg: ${metrics.avg.toFixed(1)}ms, Max: ${metrics.max.toFixed(1)}ms (required: ≤${requiredMaxMs}ms)`
    }
    
    this.results.push(result)
    return result
  }

  /**
   * Validate memory usage benchmark
   */
  validateMemoryUsage(
    memoryAnalysis: ReturnType<MemoryMonitor['analyzeMemoryUsage']>,
    maxGrowthMB: number = 100
  ): BenchmarkResult {
    const growthMB = memoryAnalysis.heapGrowth / (1024 * 1024)
    const passed = !memoryAnalysis.possibleLeak && growthMB <= maxGrowthMB
    
    const result: BenchmarkResult = {
      name: 'Memory Usage',
      passed,
      measured: growthMB,
      required: maxGrowthMB,
      unit: 'MB',
      details: `Heap growth: ${growthMB.toFixed(1)}MB, Leak detected: ${memoryAnalysis.possibleLeak} (required: ≤${maxGrowthMB}MB, no leaks)`
    }
    
    this.results.push(result)
    return result
  }

  /**
   * Get all validation results
   */
  getAllResults(): BenchmarkResult[] {
    return [...this.results]
  }

  /**
   * Get overall validation status
   */
  getOverallStatus(): {
    passed: boolean
    totalTests: number
    passedTests: number
    failedTests: number
    results: BenchmarkResult[]
  } {
    const passedTests = this.results.filter(r => r.passed).length
    const failedTests = this.results.length - passedTests
    
    return {
      passed: failedTests === 0,
      totalTests: this.results.length,
      passedTests,
      failedTests,
      results: [...this.results]
    }
  }

  /**
   * Generate performance report
   */
  generateReport(): string {
    const status = this.getOverallStatus()
    
    let report = '📊 Performance Benchmark Report\n'
    report += '='.repeat(50) + '\n'
    report += `Overall Status: ${status.passed ? '✅ PASSED' : '❌ FAILED'}\n`
    report += `Tests: ${status.passedTests}/${status.totalTests} passed\n\n`
    
    status.results.forEach(result => {
      const icon = result.passed ? '✅' : '❌'
      report += `${icon} ${result.name}: ${result.measured.toFixed(2)}${result.unit}\n`
      report += `   ${result.details}\n\n`
    })
    
    return report
  }

  /**
   * Clear all results
   */
  clear(): void {
    this.results = []
  }
}

/**
 * Format bytes to human readable format
 */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`
}

/**
 * Sleep utility for delays in tests
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}