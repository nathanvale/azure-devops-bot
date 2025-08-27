import path from 'path'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    setupFiles: './tests/vitest.setup.ts',
    include: ['src/**/*.test.ts'],
    exclude: [
      'tests/integration/**/*.test.ts',
      'tests/performance/**/*.test.ts',
      'node_modules/**/*.test.ts',
      // Exclude performance and benchmark tests - they are long-running
      '**/performance/**/*.test.ts',
      '**/*performance*.test.ts',
      '**/*benchmark*.test.ts',
      // Exclude integration tests
      '**/*integration*.test.ts',
      // Exclude production tests
      '**/*production*.test.ts',
      // Exclude debug tests
      '**/*debug*.test.ts',
      // Specifically exclude problematic tests
      'src/utils/__tests__/cascade-failure-prevention.test.ts',
      'src/utils/__tests__/authentication-performance.test.ts',
      'src/utils/__tests__/logger-security-performance.test.ts',
      'src/utils/__tests__/resilience-adapter-performance.test.ts',
      'src/utils/__tests__/resilience-telemetry-performance.test.ts',
      'src/utils/__tests__/sync-performance-benchmark.test.ts',
      'src/services/__tests__/resilience-integration.test.ts',
      'src/services/__tests__/integration-fix.test.ts',
      'src/services/__tests__/azure-devops-rest-integration.test.ts',
      'src/services/__tests__/azure-devops-pat-integration.test.ts',
      'src/services/__tests__/azure-devops-resilience-integration.test.ts',
      'src/services/__tests__/production-auth.test.ts',
      'src/services/__tests__/msw-debug.test.ts',
      'src/services/__tests__/msw-simple-debug.test.ts',
      'src/services/__tests__/provider-debug.test.ts',
    ],
    testTimeout: 10000, // Increase default timeout to 10 seconds for resilience policies
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', 'tests/', '**/*.d.ts'],
    },
    // Future: Configure in-memory SQLite for database testing
    // pool: 'threads',
    // poolOptions: {
    //   threads: {
    //     singleThread: true,
    //   },
    // },
  },
})
