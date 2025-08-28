import path from 'path'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    name: 'mcp-integration',
    environment: 'node',
    globals: true,
    setupFiles: './tests/mcp-integration.setup.ts',
    include: ['tests/integration/**/*.test.ts'],
    testTimeout: 30000,
  },
})
