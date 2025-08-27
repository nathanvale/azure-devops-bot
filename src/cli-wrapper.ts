#!/usr/bin/env node

// This wrapper handles quiet mode by suppressing console output BEFORE any modules load
const isQuietMode = process.argv.includes('--quiet') || process.argv.includes('-q');


if (isQuietMode) {
  // Set environment variables FIRST to suppress library output during import
  process.env.LOG_SILENT = 'true';
  process.env.LOG_LEVEL = 'error';  // Only log errors
  process.env.DOTENV_SILENT = 'true';
  process.env.SUPPRESS_NO_CONFIG_WARNING = 'true';
  process.env.NODE_ENV = 'production'; // Many libraries are quieter in production
  process.env.DISABLE_DOTENV_LOGGING = 'true';
  
  // Store original console methods before overriding
  const originalConsole = {
    log: console.log.bind(console),
    error: console.error.bind(console),
    warn: console.warn.bind(console),
    debug: console.debug.bind(console),
    info: console.info.bind(console),
  };

  // Make them available globally for OutputManager to use
  (global as any).originalConsole = originalConsole;

  // Override all console methods to suppress output
  console.log = () => {};
  console.debug = () => {};
  console.info = () => {};
  console.warn = () => {};
  console.error = () => {};  // Suppress console.error too in quiet mode
}

// Now import and run the main module
import('./index.js');