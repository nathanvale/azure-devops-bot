module.exports = function (_wallaby) {
  return {
    // Key success factor from @orchestr8 - let WallabyJS handle ES modules automatically
    autoDetect: ['vitest'],

    // Use existing vitest config - critical for proper ES modules handling
    testFramework: {
      configFile: './vitest.config.ts',
    },

    env: {
      type: 'node',
      runner: 'node',
    },

    workers: {
      initial: 1,
      regular: 1,
    },

    // Increase console message limits for detailed debugging
    maxConsoleMessagesPerTest: 1000,

    // Include all tests now that authentication is mocked properly
    tests: [
      'src/**/*.test.ts',
      '!**/node_modules/**', // Critical: exclude all node_modules
      '!tests/integration/**/*.test.ts', // Exclude integration tests
    ],

    // Include all necessary source files
    files: [
      'src/**/*.ts',
      '!src/**/*.test.ts',
      '!**/node_modules/**', // Critical: exclude all node_modules
      'package.json',
      'tsconfig.json',
      'vitest.config.ts',
      'vitest.workspace.ts',
      'tests/vitest.setup.ts',
      'tests/mcp-integration.setup.ts',
    ],
  }
}
