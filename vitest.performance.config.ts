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
    include: ['tests/performance/**/*.test.ts'],
    testTimeout: 120000, // 2 minutes for performance tests
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', 'tests/', '**/*.d.ts'],
    },
  },
})