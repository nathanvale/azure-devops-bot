import path from 'path'
import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  // Unit tests
  {
    test: {
      name: 'unit',
      environment: 'node',
      globals: true,
      setupFiles: './tests/vitest.setup.ts',
      include: ['src/**/*.test.ts'],
      exclude: ['tests/integration/**/*.test.ts', 'node_modules/**/*.test.ts'],
      coverage: {
        reporter: ['text', 'json', 'html'],
        exclude: ['node_modules/', 'dist/', 'tests/', '**/*.d.ts'],
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
  },
  // Integration tests
  {
    test: {
      name: 'mcp-integration',
      environment: 'node',
      globals: true,
      setupFiles: './tests/mcp-integration.setup.ts',
      include: ['tests/integration/**/*.test.ts'],
      testTimeout: 30000,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
  },
])
