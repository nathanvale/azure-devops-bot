/**
 * PM2 Ecosystem Configuration for Azure DevOps Bot
 *
 * This configuration sets up the MCP server for 24/7 operation with:
 * - Automatic restart on crashes
 * - Log management and rotation
 * - Environment variable configuration
 * - stdio transport compatibility for MCP protocol
 */

export default {
  apps: [
    {
      name: 'azure-devops-bot',
      script: './src/mcp-server.ts',
      interpreter: 'tsx',

      // Email configuration - MUST be set before starting
      args: '--emails=YOUR_EMAIL@domain.com',

      // Process management
      instances: 1, // Single instance for stdio transport compatibility
      exec_mode: 'fork', // Fork mode required for stdio transport

      // Restart policy
      watch: false, // Disable watch in production
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '500M',

      // Environment
      env: {
        NODE_ENV: 'production',
        // Azure DevOps PAT authentication - set via .env file or system env
        // AZURE_DEVOPS_PAT: 'your-personal-access-token',
        // AZURE_DEVOPS_USER_EMAILS: 'user1@domain.com,user2@domain.com'
      },

      // Logging
      log_file: './logs/azure-devops-bot.log',
      out_file: './logs/azure-devops-bot-out.log',
      error_file: './logs/azure-devops-bot-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // Performance
      node_args: '--max-old-space-size=512',

      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 3000,

      // Health monitoring
      health_check_grace_period: 3000,

      // Development mode (separate config)
      env_development: {
        NODE_ENV: 'development',
        watch: true,
        ignore_watch: ['node_modules', 'logs', 'prisma/dev.db', '.git'],
      },
    },
  ],

  deploy: {
    // Optional: deployment configuration for remote servers
    production: {
      user: 'node',
      host: 'localhost',
      ref: 'origin/main',
      repo: 'git@github.com:your-org/azure-devops-bot.git',
      path: '/var/www/azure-devops-bot',
      'post-deploy':
        'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
    },
  },
}
