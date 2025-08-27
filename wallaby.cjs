module.exports = function (wallaby) {
  return {
    // Let WallabyJS handle ES modules automatically
    autoDetect: ['vitest'],

    // Use existing vitest config which has all exclusions
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
  }
}
