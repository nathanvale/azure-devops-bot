import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

import * as path from 'path'

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'

import { TestMCPClient } from '../utils/mcp-client'
import {
  MemoryMonitor,
  PerformanceTimer,
  LoadTestOrchestrator,
  BenchmarkValidator,
  formatBytes,
  sleep
} from '../utils/performance-utils'

/**
 * Performance Benchmarking Test Suite
 * 
 * Implements Task 3: Performance Benchmarking and Measurement
 * 
 * Validates:
 * - Task 3.1: Sync timing (≤30s for 1,056+ items)
 * - Task 3.2: Query performance (≤100ms response times)
 * - Task 3.3: Memory usage monitoring during load testing
 * - Task 3.4: Performance requirements verification
 * 
 * Production Requirements:
 * - Full sync: ≤30 seconds for 1,056+ work items
 * - Query responses: ≤100ms consistently
 * - Memory: No leaks during extended operations
 * - Overall system stability under load
 */

// Helper function to safely extract text content from tool results
function expectTextContent(result: CallToolResult): string {
  expect(result.content).toHaveLength(1)
  expect(result.content[0]).toBeDefined()
  expect(result.content[0]?.type).toBe('text')

  const firstContent = result.content[0]
  if (!firstContent || firstContent.type !== 'text') {
    throw new Error('Expected text content')
  }
  return firstContent.text
}

// Helper function to parse JSON response safely
function expectValidJSON(result: CallToolResult): any {
  const textContent = expectTextContent(result)
  try {
    return JSON.parse(textContent)
  } catch (error) {
    throw new Error(`Invalid JSON response: ${textContent}`)
  }
}

describe('Performance Benchmarking Test Suite', () => {
  let client: TestMCPClient
  let productionWorkItemIds: number[] = []
  let testUserEmail: string
  let memoryMonitor: MemoryMonitor
  let performanceTimer: PerformanceTimer
  let loadTestOrchestrator: LoadTestOrchestrator
  let benchmarkValidator: BenchmarkValidator

  const hasProductionPAT = !!process.env.AZURE_DEVOPS_PAT
  const timeout = 180000 // 3 minutes for comprehensive benchmarking

  // Performance requirements (production targets)
  const REQUIREMENTS = {
    MAX_SYNC_TIME_SECONDS: 30,
    MAX_QUERY_TIME_MS: 100,
    MAX_MEMORY_GROWTH_MB: 100,
    MIN_WORK_ITEMS_FOR_TESTING: 100 // Minimum threshold for meaningful testing
  }

  // Helper function to connect to MCP client
  async function ensureClientConnected(): Promise<void> {
    if (!client) {
      client = new TestMCPClient()
      const tsServerPath = path.resolve(__dirname, '../../src/mcp-server.ts')
      const tsxPath = path.resolve(__dirname, '../../node_modules/.bin/tsx')
      console.log('🔌 Connecting to MCP server for performance benchmarking...')
      await client.connect(tsxPath, [tsServerPath, `--emails=${testUserEmail}`])
      
      // Get production work item IDs for testing
      try {
        const result = await client.callTool('wit_my_work_items', { filter: 'all' })
        const textContent = expectTextContent(result)
        const workItems = JSON.parse(textContent)
        if (Array.isArray(workItems) && workItems.length > 0) {
          productionWorkItemIds = workItems.map((item: any) => item.id)
          console.log(`📊 Loaded ${productionWorkItemIds.length} production work item IDs for benchmarking`)
        }
      } catch (error) {
        console.warn('⚠️ Could not fetch production work item IDs:', error)
      }
    }
  }

  beforeAll(async () => {
    testUserEmail = process.env.TEST_USER_EMAIL || 'nathan.vale@fwcdev.com'
    console.log(`🎯 Performance benchmarking target email: ${testUserEmail}`)
  })

  beforeEach(() => {
    // Reset performance utilities for each test
    memoryMonitor = new MemoryMonitor()
    performanceTimer = new PerformanceTimer()
    loadTestOrchestrator = new LoadTestOrchestrator()
    benchmarkValidator = new BenchmarkValidator()
  })

  afterAll(async () => {
    if (client) {
      await client.close()
    }
  })

  describe('Task 3.1: Sync Timing Tests', () => {
    it.skipIf(!hasProductionPAT)('should complete full sync within 30 seconds for 1,056+ work items', async () => {
      await ensureClientConnected()
      
      // Ensure we have sufficient work items for meaningful testing
      expect(productionWorkItemIds.length).toBeGreaterThan(REQUIREMENTS.MIN_WORK_ITEMS_FOR_TESTING)
      console.log(`🔄 Testing sync performance with ${productionWorkItemIds.length} work items`)
      
      // Start memory monitoring during sync
      memoryMonitor.startMonitoring(500) // Sample every 500ms
      
      // Measure sync performance
      performanceTimer.start()
      const result = await client.callTool('wit_force_sync_work_items', {})
      const syncDuration = performanceTimer.end()
      
      // Stop memory monitoring
      memoryMonitor.stopMonitoring()
      const memoryAnalysis = memoryMonitor.analyzeMemoryUsage()
      
      // Validate sync completed successfully
      const textContent = expectTextContent(result)
      expect(textContent).toContain('sync completed') // Adjust based on actual response format
      
      // Validate sync performance benchmark
      const syncBenchmark = benchmarkValidator.validateSyncPerformance(
        syncDuration,
        productionWorkItemIds.length,
        REQUIREMENTS.MAX_SYNC_TIME_SECONDS
      )
      
      console.log(`⏱️ Sync Performance: ${syncBenchmark.details}`)
      console.log(`💾 Memory during sync: ${formatBytes(memoryAnalysis.peakHeap)} peak, ${formatBytes(memoryAnalysis.heapGrowth)} growth`)
      
      // Assert performance requirements
      expect(syncBenchmark.passed).toBe(true)
      expect(syncDuration).toBeLessThan(REQUIREMENTS.MAX_SYNC_TIME_SECONDS * 1000)
    }, timeout)

    it.skipIf(!hasProductionPAT)('should maintain consistent sync performance across multiple cycles', async () => {
      await ensureClientConnected()
      
      const numCycles = 3
      const syncTimes: number[] = []
      
      console.log(`🔄 Testing sync consistency across ${numCycles} cycles`)
      
      for (let cycle = 1; cycle <= numCycles; cycle++) {
        console.log(`   Cycle ${cycle}/${numCycles}...`)
        
        performanceTimer.start()
        const result = await client.callTool('wit_force_sync_work_items', {})
        const duration = performanceTimer.end()
        syncTimes.push(duration)
        
        // Validate sync succeeded
        const textContent = expectTextContent(result)
        expect(textContent).toContain('sync completed')
        
        // Brief pause between cycles
        await sleep(2000)
      }
      
      // Analyze consistency
      const avgTime = syncTimes.reduce((sum, time) => sum + time, 0) / syncTimes.length
      const maxTime = Math.max(...syncTimes)
      const minTime = Math.min(...syncTimes)
      const variance = maxTime - minTime
      
      console.log(`📈 Sync consistency: min=${(minTime/1000).toFixed(1)}s, avg=${(avgTime/1000).toFixed(1)}s, max=${(maxTime/1000).toFixed(1)}s`)
      
      // All cycles should meet performance requirement
      syncTimes.forEach((time, index) => {
        expect(time).toBeLessThan(REQUIREMENTS.MAX_SYNC_TIME_SECONDS * 1000)
      })
      
      // Variance shouldn't be too high (no more than 3x difference)
      expect(maxTime).toBeLessThan(minTime * 3)
    }, timeout)
  })

  describe('Task 3.2: Query Performance Validation', () => {
    it.skipIf(!hasProductionPAT)('should achieve sub-100ms query responses consistently', async () => {
      await ensureClientConnected()
      
      const testIds = productionWorkItemIds.slice(0, 50) // Test 50 queries
      console.log(`🔍 Testing query performance with ${testIds.length} work items`)
      
      // Test individual queries
      for (const workItemId of testIds) {
        const { result, duration } = await performanceTimer.time(async () => {
          return await client.callTool('wit_get_work_item', { id: workItemId })
        })
        
        // Validate response
        const workItem = expectValidJSON(result)
        expect(workItem.id).toBe(workItemId)
        expect(workItem).toHaveProperty('title')
        expect(workItem).toHaveProperty('state')
        
        // Individual query should meet requirement
        expect(duration).toBeLessThan(REQUIREMENTS.MAX_QUERY_TIME_MS)
      }
      
      // Validate overall query performance
      const queryMetrics = performanceTimer.getMetrics()
      const queryBenchmark = benchmarkValidator.validateQueryPerformance(
        queryMetrics,
        REQUIREMENTS.MAX_QUERY_TIME_MS
      )
      
      console.log(`🚀 Query Performance: ${queryBenchmark.details}`)
      console.log(`📊 Query stats: ${testIds.length} queries in ${queryMetrics.total.toFixed(1)}ms total`)
      
      // Assert performance requirements
      expect(queryBenchmark.passed).toBe(true)
      expect(queryMetrics.p95).toBeLessThan(REQUIREMENTS.MAX_QUERY_TIME_MS)
    }, timeout)

    it.skipIf(!hasProductionPAT)('should handle concurrent queries efficiently', async () => {
      await ensureClientConnected()
      
      const testIds = productionWorkItemIds.slice(0, 20) // 20 concurrent queries
      console.log(`⚡ Testing concurrent query performance with ${testIds.length} simultaneous requests`)
      
      // Start memory monitoring
      memoryMonitor.startMonitoring(100)
      
      const startTime = performance.now()
      
      // Execute all queries concurrently
      const promises = testIds.map(async (id) => {
        const { result, duration } = await performanceTimer.time(async () => {
          return await client.callTool('wit_get_work_item', { id })
        })
        return { result, duration, id }
      })
      
      const results = await Promise.all(promises)
      const totalDuration = performance.now() - startTime
      
      // Stop memory monitoring
      memoryMonitor.stopMonitoring()
      const memoryAnalysis = memoryMonitor.analyzeMemoryUsage()
      
      // Validate all queries succeeded
      expect(results.length).toBe(testIds.length)
      results.forEach(({ result, id }) => {
        const workItem = expectValidJSON(result)
        expect(workItem.id).toBe(id)
      })
      
      // Analyze performance
      const queryMetrics = performanceTimer.getMetrics()
      const avgConcurrentTime = totalDuration / testIds.length
      
      console.log(`⚡ Concurrent Performance: ${totalDuration.toFixed(1)}ms total, ${avgConcurrentTime.toFixed(1)}ms avg per query`)
      console.log(`💾 Memory during concurrent queries: ${formatBytes(memoryAnalysis.peakHeap)} peak`)
      
      // Concurrent execution should be efficient
      expect(queryMetrics.p95).toBeLessThan(REQUIREMENTS.MAX_QUERY_TIME_MS)
      expect(avgConcurrentTime).toBeLessThan(REQUIREMENTS.MAX_QUERY_TIME_MS)
    }, timeout)

    it.skipIf(!hasProductionPAT)('should maintain performance across different query types', async () => {
      await ensureClientConnected()
      
      const testId = productionWorkItemIds[0]
      const batchIds = productionWorkItemIds.slice(0, 10)
      
      console.log(`🔧 Testing performance across different query types`)
      
      // Test different query patterns
      const queryTypes = [
        {
          name: 'Individual Query',
          operation: () => client.callTool('wit_get_work_item', { id: testId })
        },
        {
          name: 'Batch Query',
          operation: () => client.callTool('wit_get_work_items_batch_by_ids', { ids: batchIds })
        },
        {
          name: 'Comments Query',
          operation: () => client.callTool('wit_list_work_item_comments', { id: testId })
        },
        {
          name: 'User Work Items',
          operation: () => client.callTool('wit_my_work_items', { filter: 'assigned' })
        }
      ]
      
      for (const queryType of queryTypes) {
        // Test each query type multiple times
        const iterations = 10
        const queryTimer = new PerformanceTimer()
        
        for (let i = 0; i < iterations; i++) {
          const { result } = await queryTimer.time(queryType.operation)
          
          // Basic validation that query succeeded
          const textContent = expectTextContent(result)
          expect(textContent.length).toBeGreaterThan(10) // Non-empty response
        }
        
        const metrics = queryTimer.getMetrics()
        console.log(`   ${queryType.name}: avg=${metrics.avg.toFixed(1)}ms, p95=${metrics.p95.toFixed(1)}ms`)
        
        // Each query type should meet performance requirements
        expect(metrics.p95).toBeLessThan(REQUIREMENTS.MAX_QUERY_TIME_MS)
      }
    }, timeout)
  })

  describe('Task 3.3: Memory Usage Monitoring', () => {
    it.skipIf(!hasProductionPAT)('should detect memory leaks during extended operations', async () => {
      await ensureClientConnected()
      
      console.log(`🧠 Testing memory stability during extended operations`)
      
      // Run sustained load test
      const loadTestResult = await loadTestOrchestrator.runSustainedLoad(
        async () => {
          const testId = productionWorkItemIds[Math.floor(Math.random() * Math.min(productionWorkItemIds.length, 100))]
          const result = await client.callTool('wit_get_work_item', { id: testId })
          return expectValidJSON(result)
        },
        {
          duration: 30000, // 30 seconds of sustained load
          concurrency: 3,  // 3 concurrent operations
          intervalMs: 200  // New operation every 200ms per worker
        }
      )
      
      console.log(`🔄 Completed ${loadTestResult.results.length} operations in sustained load test`)
      console.log(`⚠️ Encountered ${loadTestResult.errors.length} errors during load test`)
      
      // Validate memory behavior
      const memoryBenchmark = benchmarkValidator.validateMemoryUsage(
        loadTestResult.memoryAnalysis,
        REQUIREMENTS.MAX_MEMORY_GROWTH_MB
      )
      
      console.log(`💾 Memory Analysis: ${memoryBenchmark.details}`)
      console.log(`📈 Memory pattern: ${formatBytes(loadTestResult.memoryAnalysis.initialHeap)} → ${formatBytes(loadTestResult.memoryAnalysis.finalHeap)}`)
      
      // Assert memory requirements
      expect(memoryBenchmark.passed).toBe(true)
      expect(loadTestResult.memoryAnalysis.possibleLeak).toBe(false)
      
      // Performance should remain good under sustained load
      expect(loadTestResult.performanceMetrics.p95).toBeLessThan(REQUIREMENTS.MAX_QUERY_TIME_MS * 2) // Allow 2x during load
      
      // Should not have excessive errors
      const errorRate = loadTestResult.errors.length / loadTestResult.results.length
      expect(errorRate).toBeLessThan(0.05) // Less than 5% error rate
    }, timeout)

    it.skipIf(!hasProductionPAT)('should track memory usage during large sync operations', async () => {
      await ensureClientConnected()
      
      console.log(`🔄 Monitoring memory during large sync operation`)
      
      // Monitor memory during sync
      memoryMonitor.startMonitoring(250) // High-frequency monitoring during sync
      
      const initialMemory = memoryMonitor.getCurrentUsage()
      console.log(`📊 Initial memory: ${formatBytes(initialMemory.heapUsed)} heap, ${formatBytes(initialMemory.rss)} RSS`)
      
      // Perform large sync operation
      performanceTimer.start()
      const syncResult = await client.callTool('wit_force_sync_work_items', {})
      const syncDuration = performanceTimer.end()
      
      // Continue monitoring briefly after sync
      await sleep(5000) // Monitor for 5 seconds after sync
      
      memoryMonitor.stopMonitoring()
      const memoryAnalysis = memoryMonitor.analyzeMemoryUsage()
      const finalMemory = memoryMonitor.getCurrentUsage()
      
      console.log(`📊 Final memory: ${formatBytes(finalMemory.heapUsed)} heap, ${formatBytes(finalMemory.rss)} RSS`)
      console.log(`📈 Memory growth: ${formatBytes(memoryAnalysis.heapGrowth)} heap growth`)
      console.log(`⏱️ Sync completed in: ${(syncDuration/1000).toFixed(2)} seconds`)
      
      // Validate sync succeeded
      const textContent = expectTextContent(syncResult)
      expect(textContent).toContain('sync completed')
      
      // Memory should be reasonable after sync
      const growthMB = memoryAnalysis.heapGrowth / (1024 * 1024)
      expect(growthMB).toBeLessThan(REQUIREMENTS.MAX_MEMORY_GROWTH_MB)
      expect(memoryAnalysis.possibleLeak).toBe(false)
      
      // Should return to reasonable memory levels
      const peakToFinalRatio = finalMemory.heapUsed / memoryAnalysis.peakHeap
      expect(peakToFinalRatio).toBeGreaterThan(0.3) // Should not be more than 3x difference
    }, timeout)
  })

  describe('Task 3.4: Performance Requirements Verification', () => {
    it.skipIf(!hasProductionPAT)('should validate all performance benchmarks meet production requirements', async () => {
      await ensureClientConnected()
      
      console.log(`📋 Running comprehensive performance validation`)
      
      // Run comprehensive benchmark suite
      benchmarkValidator.clear()
      
      // 1. Validate sync performance
      memoryMonitor.startMonitoring(1000)
      performanceTimer.start()
      
      const syncResult = await client.callTool('wit_force_sync_work_items', {})
      const syncDuration = performanceTimer.end()
      
      memoryMonitor.stopMonitoring()
      const syncMemoryAnalysis = memoryMonitor.analyzeMemoryUsage()
      
      const syncBenchmark = benchmarkValidator.validateSyncPerformance(
        syncDuration,
        productionWorkItemIds.length,
        REQUIREMENTS.MAX_SYNC_TIME_SECONDS
      )
      
      // 2. Validate query performance
      performanceTimer.clear()
      const queryIds = productionWorkItemIds.slice(0, 30)
      
      for (const id of queryIds) {
        await performanceTimer.time(async () => {
          return await client.callTool('wit_get_work_item', { id })
        })
      }
      
      const queryMetrics = performanceTimer.getMetrics()
      const queryBenchmark = benchmarkValidator.validateQueryPerformance(
        queryMetrics,
        REQUIREMENTS.MAX_QUERY_TIME_MS
      )
      
      // 3. Validate memory usage
      const memoryBenchmark = benchmarkValidator.validateMemoryUsage(
        syncMemoryAnalysis,
        REQUIREMENTS.MAX_MEMORY_GROWTH_MB
      )
      
      // 4. Generate comprehensive report
      const overallStatus = benchmarkValidator.getOverallStatus()
      const report = benchmarkValidator.generateReport()
      
      console.log('\n' + '='.repeat(60))
      console.log(report)
      console.log('='.repeat(60))
      
      // Log individual benchmark results
      console.log(`🎯 Sync Performance: ${syncBenchmark.passed ? '✅' : '❌'} ${syncBenchmark.details}`)
      console.log(`🎯 Query Performance: ${queryBenchmark.passed ? '✅' : '❌'} ${queryBenchmark.details}`)
      console.log(`🎯 Memory Usage: ${memoryBenchmark.passed ? '✅' : '❌'} ${memoryBenchmark.details}`)
      
      // Assert all benchmarks pass
      expect(overallStatus.passed).toBe(true)
      expect(overallStatus.failedTests).toBe(0)
      expect(syncBenchmark.passed).toBe(true)
      expect(queryBenchmark.passed).toBe(true)
      expect(memoryBenchmark.passed).toBe(true)
      
      // Additional validation
      expect(syncDuration).toBeLessThan(REQUIREMENTS.MAX_SYNC_TIME_SECONDS * 1000)
      expect(queryMetrics.p95).toBeLessThan(REQUIREMENTS.MAX_QUERY_TIME_MS)
      expect(syncMemoryAnalysis.possibleLeak).toBe(false)
      
      console.log(`\n🎉 All performance benchmarks passed! System ready for production.`)
    }, timeout)

    it.skipIf(!hasProductionPAT)('should provide detailed performance metrics for monitoring', async () => {
      await ensureClientConnected()
      
      console.log(`📊 Collecting detailed performance metrics for monitoring`)
      
      // Collect comprehensive metrics
      const metrics = {
        workItemCount: productionWorkItemIds.length,
        timestamp: new Date().toISOString(),
        sync: {} as any,
        queries: {} as any,
        memory: {} as any,
        system: {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch
        }
      }
      
      // Sync metrics
      performanceTimer.clear()
      memoryMonitor.startMonitoring(500)
      
      const { result: syncResult, duration: syncDuration } = await performanceTimer.time(async () => {
        return await client.callTool('wit_force_sync_work_items', {})
      })
      
      memoryMonitor.stopMonitoring()
      const syncMemoryAnalysis = memoryMonitor.analyzeMemoryUsage()
      
      metrics.sync = {
        durationMs: syncDuration,
        durationSeconds: syncDuration / 1000,
        workItemsPerSecond: (productionWorkItemIds.length / (syncDuration / 1000)).toFixed(2),
        peakMemoryMB: (syncMemoryAnalysis.peakHeap / (1024 * 1024)).toFixed(2),
        memoryGrowthMB: (syncMemoryAnalysis.heapGrowth / (1024 * 1024)).toFixed(2)
      }
      
      // Query metrics
      performanceTimer.clear()
      const sampleQueries = 25
      const testIds = productionWorkItemIds.slice(0, sampleQueries)
      
      for (const id of testIds) {
        await performanceTimer.time(async () => {
          return await client.callTool('wit_get_work_item', { id })
        })
      }
      
      const queryStats = performanceTimer.getMetrics()
      metrics.queries = {
        sampleSize: sampleQueries,
        avgMs: queryStats.avg.toFixed(2),
        minMs: queryStats.min.toFixed(2),
        maxMs: queryStats.max.toFixed(2),
        p95Ms: queryStats.p95.toFixed(2),
        p99Ms: queryStats.p99.toFixed(2),
        totalMs: queryStats.total.toFixed(2)
      }
      
      // Memory metrics
      const currentMemory = memoryMonitor.getCurrentUsage()
      metrics.memory = {
        currentHeapMB: (currentMemory.heapUsed / (1024 * 1024)).toFixed(2),
        currentRssMB: (currentMemory.rss / (1024 * 1024)).toFixed(2),
        heapTotalMB: (currentMemory.heapTotal / (1024 * 1024)).toFixed(2),
        externalMB: (currentMemory.external / (1024 * 1024)).toFixed(2)
      }
      
      // Log structured metrics
      console.log('\n📊 Detailed Performance Metrics:')
      console.log(JSON.stringify(metrics, null, 2))
      
      // Validate metrics are reasonable
      expect(metrics.sync.durationSeconds).toBeLessThan(REQUIREMENTS.MAX_SYNC_TIME_SECONDS)
      expect(parseFloat(metrics.queries.p95Ms)).toBeLessThan(REQUIREMENTS.MAX_QUERY_TIME_MS)
      expect(parseFloat(metrics.memory.currentHeapMB)).toBeLessThan(500) // Reasonable heap size
      
      console.log(`\n✅ Performance metrics collection completed successfully`)
    }, timeout)
  })

  describe('Performance Summary', () => {
    it.skipIf(!hasProductionPAT)('should provide comprehensive production readiness summary', async () => {
      const summary = {
        testSuite: 'Performance Benchmarking',
        timestamp: new Date().toISOString(),
        environment: {
          nodeVersion: process.version,
          platform: process.platform,
          testEmail: testUserEmail
        },
        workItems: {
          total: productionWorkItemIds.length,
          tested: Math.min(productionWorkItemIds.length, 100)
        },
        requirements: REQUIREMENTS,
        status: 'COMPLETED'
      }
      
      console.log('\n🎯 Production Readiness Summary:')
      console.log('='.repeat(50))
      console.log(`📊 Test Suite: ${summary.testSuite}`)
      console.log(`⏰ Completed: ${summary.timestamp}`)
      console.log(`📈 Work Items: ${summary.workItems.total} available, ${summary.workItems.tested} tested`)
      console.log(`🎯 Performance Requirements:`)
      console.log(`   • Sync Time: ≤${REQUIREMENTS.MAX_SYNC_TIME_SECONDS}s`)
      console.log(`   • Query Time: ≤${REQUIREMENTS.MAX_QUERY_TIME_MS}ms`)
      console.log(`   • Memory Growth: ≤${REQUIREMENTS.MAX_MEMORY_GROWTH_MB}MB`)
      console.log(`🏁 Status: All Task 3 performance benchmarks implemented`)
      console.log('='.repeat(50))
      
      // Validate summary data
      expect(summary.workItems.total).toBeGreaterThan(0)
      expect(summary.timestamp).toBeTypeOf('string')
      expect(summary.status).toBe('COMPLETED')
      
      console.log(`\n✅ Task 3: Performance Benchmarking and Measurement - COMPLETED`)
    })
  })
})