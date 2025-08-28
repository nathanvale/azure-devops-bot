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
    include: [
      // Include only performance and benchmark tests
      'tests/performance/**/*.test.ts',
      '**/performance/**/*.test.ts',
      '**/*performance*.test.ts',
      '**/*benchmark*.test.ts',
      // Include the specific tests that were excluded from main config
      'src/utils/__tests__/cascade-failure-prevention.test.ts',
      '**/*integration*.test.ts',
      '**/*production*.test.ts',
      '**/*debug*.test.ts',
    ],
    exclude: ['node_modules/**/*.test.ts'],
    testTimeout: 300000, // 5 minutes timeout for performance tests
    // Performance tests should not run in parallel to ensure accurate timing
    maxConcurrency: 1,
    // Disable coverage for performance tests
    coverage: {
      enabled: false,
    },
  },
})
