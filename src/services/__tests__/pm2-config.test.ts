import { describe, it, expect } from 'vitest'
import { readFile } from 'fs/promises'
import path from 'path'

/**
 * PM2 Configuration Validation Tests
 * 
 * These tests validate the PM2 ecosystem configuration for production deployment.
 * They ensure proper configuration for always-on service management.
 */

describe('PM2 Configuration', () => {
  let ecosystemConfig: any

  beforeEach(async () => {
    // Dynamically import the ecosystem config
    const configPath = path.resolve(process.cwd(), 'ecosystem.config.js')
    const configModule = await import(configPath + '?t=' + Date.now())
    ecosystemConfig = configModule.default
  })

  describe('Application Configuration', () => {
    it('should have valid app configuration', () => {
      expect(ecosystemConfig).toBeDefined()
      expect(ecosystemConfig.apps).toBeDefined()
      expect(Array.isArray(ecosystemConfig.apps)).toBe(true)
      expect(ecosystemConfig.apps.length).toBe(1)

      const app = ecosystemConfig.apps[0]
      expect(app.name).toBe('azure-devops-bot')
      expect(app.script).toBe('./src/mcp-server.ts')
      expect(app.interpreter).toBe('tsx')
    })

    it('should configure production email arguments', () => {
      const app = ecosystemConfig.apps[0]
      expect(app.args).toContain('nathan.vale@fwc.gov.au')
      expect(app.args).toContain('ITEX-NV@fwc.gov.au')
    })

    it('should have proper process management settings', () => {
      const app = ecosystemConfig.apps[0]
      
      // MCP protocol requires single instance with stdio transport
      expect(app.instances).toBe(1)
      expect(app.exec_mode).toBe('fork')
      
      // Auto-restart configuration
      expect(app.autorestart).toBe(true)
      expect(app.max_restarts).toBe(10)
      expect(app.min_uptime).toBe('10s')
      expect(app.max_memory_restart).toBe('500M')
      
      // Watch should be disabled in production
      expect(app.watch).toBe(false)
    })

    it('should have production environment configuration', () => {
      const app = ecosystemConfig.apps[0]
      expect(app.env).toBeDefined()
      expect(app.env.NODE_ENV).toBe('production')
      expect(app.env.AZURE_DEVOPS_USER_EMAILS).toBe('nathan.vale@fwc.gov.au,ITEX-NV@fwc.gov.au')
    })

    it('should have proper logging configuration', () => {
      const app = ecosystemConfig.apps[0]
      expect(app.log_file).toBe('./logs/azure-devops-bot.log')
      expect(app.out_file).toBe('./logs/azure-devops-bot-out.log')
      expect(app.error_file).toBe('./logs/azure-devops-bot-error.log')
      expect(app.log_date_format).toBe('YYYY-MM-DD HH:mm:ss Z')
      expect(app.merge_logs).toBe(true)
    })

    it('should have performance configuration', () => {
      const app = ecosystemConfig.apps[0]
      expect(app.node_args).toBe('--max-old-space-size=512')
      expect(app.kill_timeout).toBe(5000)
      expect(app.listen_timeout).toBe(3000)
      expect(app.health_check_grace_period).toBe(3000)
    })

    it('should have development environment override', () => {
      const app = ecosystemConfig.apps[0]
      expect(app.env_development).toBeDefined()
      expect(app.env_development.NODE_ENV).toBe('development')
      expect(app.env_development.watch).toBe(true)
      expect(Array.isArray(app.env_development.ignore_watch)).toBe(true)
    })
  })

  describe('Deployment Configuration', () => {
    it('should have production deployment configuration', () => {
      expect(ecosystemConfig.deploy).toBeDefined()
      expect(ecosystemConfig.deploy.production).toBeDefined()
      
      const prodDeploy = ecosystemConfig.deploy.production
      expect(prodDeploy.host).toBe('localhost')
      expect(prodDeploy.ref).toBe('origin/main')
      expect(prodDeploy['post-deploy']).toContain('pnpm install')
      expect(prodDeploy['post-deploy']).toContain('pm2 reload ecosystem.config.js --env production')
    })

    it('should use correct repository URL', () => {
      const prodDeploy = ecosystemConfig.deploy.production
      expect(prodDeploy.repo).toBe('git@github.com:nathanvale/azure-devops-bot.git')
    })
  })

  describe('Service Management Requirements', () => {
    it('should be compatible with MCP protocol requirements', () => {
      const app = ecosystemConfig.apps[0]
      
      // MCP requires stdio transport which needs fork mode and single instance
      expect(app.exec_mode).toBe('fork')
      expect(app.instances).toBe(1)
      
      // Should use TSX interpreter for TypeScript execution
      expect(app.interpreter).toBe('tsx')
      expect(app.script).toBe('./src/mcp-server.ts')
    })

    it('should provide always-on availability features', () => {
      const app = ecosystemConfig.apps[0]
      
      // Auto-restart on crash
      expect(app.autorestart).toBe(true)
      expect(app.max_restarts).toBeGreaterThan(5)
      
      // Memory management
      expect(app.max_memory_restart).toBeDefined()
      
      // Graceful shutdown
      expect(app.kill_timeout).toBeGreaterThan(1000)
    })
  })

  describe('Environment Variable Handling', () => {
    it('should allow PAT configuration via environment', () => {
      const app = ecosystemConfig.apps[0]
      
      // PAT should be configurable via environment (not hardcoded)
      expect(app.env.AZURE_DEVOPS_PAT).toBeUndefined()
      
      // User emails should be configured
      expect(app.env.AZURE_DEVOPS_USER_EMAILS).toBeDefined()
    })

    it('should have proper production vs development distinction', () => {
      const app = ecosystemConfig.apps[0]
      
      // Production environment
      expect(app.env.NODE_ENV).toBe('production')
      
      // Development override
      expect(app.env_development.NODE_ENV).toBe('development')
      expect(app.env_development.watch).toBe(true)
    })
  })
})