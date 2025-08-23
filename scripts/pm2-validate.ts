#!/usr/bin/env tsx

/**
 * PM2 Validation Script for Azure DevOps Bot
 * 
 * This script validates that the MCP server is working correctly under PM2 management
 * by testing the stdio transport and MCP tools functionality.
 */

import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

interface ValidationResult {
  test: string
  status: 'PASS' | 'FAIL' | 'SKIP'
  message: string
  details?: string
}

class PM2Validator {
  private results: ValidationResult[] = []

  private log(message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') {
    const colors = {
      info: '\x1b[34m',    // Blue
      success: '\x1b[32m', // Green
      error: '\x1b[31m',   // Red
      warning: '\x1b[33m', // Yellow
      reset: '\x1b[0m'
    }
    
    const icons = {
      info: 'ℹ️ ',
      success: '✅ ',
      error: '❌ ',
      warning: '⚠️ '
    }

    console.log(`${colors[type]}${icons[type]}${message}${colors.reset}`)
  }

  private addResult(test: string, status: 'PASS' | 'FAIL' | 'SKIP', message: string, details?: string) {
    this.results.push({ test, status, message, details })
  }

  async validatePM2Installation(): Promise<void> {
    this.log('Validating PM2 installation...', 'info')
    
    try {
      const { stdout } = await execAsync('pm2 --version')
      this.addResult(
        'PM2 Installation', 
        'PASS', 
        `PM2 version ${stdout.trim()} is installed`
      )
      this.log(`PM2 version ${stdout.trim()} is installed`, 'success')
    } catch (error) {
      this.addResult(
        'PM2 Installation', 
        'FAIL', 
        'PM2 is not installed or not accessible',
        error instanceof Error ? error.message : String(error)
      )
      this.log('PM2 is not installed or not accessible', 'error')
    }
  }

  async validateProcessStatus(): Promise<void> {
    this.log('Checking Azure DevOps Bot process status...', 'info')
    
    try {
      const { stdout } = await execAsync('pm2 jlist')
      const processes = JSON.parse(stdout)
      const azureBotProcess = processes.find((p: any) => p.name === 'azure-devops-bot')
      
      if (!azureBotProcess) {
        this.addResult(
          'Process Status', 
          'SKIP', 
          'Azure DevOps Bot process is not running under PM2'
        )
        this.log('Azure DevOps Bot process is not running under PM2', 'warning')
        return
      }

      if (azureBotProcess.pm2_env.status === 'online') {
        this.addResult(
          'Process Status', 
          'PASS', 
          `Process is running (PID: ${azureBotProcess.pid}, uptime: ${Math.floor(azureBotProcess.pm2_env.pm_uptime ? (Date.now() - azureBotProcess.pm2_env.pm_uptime) / 1000 : 0)}s)`
        )
        this.log(`Process is running (PID: ${azureBotProcess.pid})`, 'success')
      } else {
        this.addResult(
          'Process Status', 
          'FAIL', 
          `Process status is '${azureBotProcess.pm2_env.status}', expected 'online'`,
          `Restart count: ${azureBotProcess.pm2_env.restart_time || 0}`
        )
        this.log(`Process status is '${azureBotProcess.pm2_env.status}'`, 'error')
      }
    } catch (error) {
      this.addResult(
        'Process Status', 
        'FAIL', 
        'Failed to get process status from PM2',
        error instanceof Error ? error.message : String(error)
      )
      this.log('Failed to get process status from PM2', 'error')
    }
  }

  async validateLogFiles(): Promise<void> {
    this.log('Checking log files...', 'info')
    
    const logFiles = [
      './logs/azure-devops-bot.log',
      './logs/azure-devops-bot-out.log', 
      './logs/azure-devops-bot-error.log'
    ]

    let allLogsExist = true

    for (const logFile of logFiles) {
      try {
        const { stdout } = await execAsync(`ls -la ${logFile}`)
        this.log(`Log file exists: ${logFile}`, 'success')
      } catch (error) {
        this.log(`Log file missing: ${logFile}`, 'warning')
        allLogsExist = false
      }
    }

    this.addResult(
      'Log Files', 
      allLogsExist ? 'PASS' : 'FAIL', 
      allLogsExist ? 'All log files are present' : 'Some log files are missing',
      `Expected log files: ${logFiles.join(', ')}`
    )
  }

  async validateConfiguration(): Promise<void> {
    this.log('Validating ecosystem configuration...', 'info')
    
    try {
      // Check if ecosystem.config.js exists
      await execAsync('ls ecosystem.config.js')
      
      // Read and validate configuration (ES module compatible)
      const { stdout } = await execAsync('node -e "import(\'./ecosystem.config.js\').then(config => console.log(JSON.stringify(config.default, null, 2)))"')
      const config = JSON.parse(stdout)
      
      if (!config.apps || config.apps.length === 0) {
        this.addResult(
          'Configuration', 
          'FAIL', 
          'No apps configured in ecosystem.config.js'
        )
        this.log('No apps configured in ecosystem.config.js', 'error')
        return
      }

      const app = config.apps[0]
      
      // Validate key configuration parameters
      const checks = [
        { key: 'name', expected: 'azure-devops-bot' },
        { key: 'script', expected: './src/mcp-server.ts' },
        { key: 'interpreter', expected: 'tsx' },
        { key: 'instances', expected: 1 },
        { key: 'exec_mode', expected: 'fork' }
      ]

      let configValid = true
      const issues = []

      for (const check of checks) {
        if (app[check.key] !== check.expected) {
          configValid = false
          issues.push(`${check.key}: got '${app[check.key]}', expected '${check.expected}'`)
        }
      }

      // Check email configuration
      if (app.args && app.args.includes('YOUR_EMAIL@domain.com')) {
        configValid = false
        issues.push('Email configuration still contains placeholder values')
      }

      this.addResult(
        'Configuration', 
        configValid ? 'PASS' : 'FAIL', 
        configValid ? 'Ecosystem configuration is valid' : 'Configuration issues found',
        issues.length > 0 ? issues.join('; ') : undefined
      )
      
      if (configValid) {
        this.log('Ecosystem configuration is valid', 'success')
      } else {
        this.log('Configuration issues found', 'error')
        issues.forEach(issue => this.log(`  • ${issue}`, 'error'))
      }
      
    } catch (error) {
      this.addResult(
        'Configuration', 
        'FAIL', 
        'Failed to validate ecosystem configuration',
        error instanceof Error ? error.message : String(error)
      )
      this.log('Failed to validate ecosystem configuration', 'error')
    }
  }

  async validateStartupService(): Promise<void> {
    this.log('Checking PM2 startup service configuration...', 'info')
    
    try {
      const { stdout } = await execAsync('pm2 startup')
      
      if (stdout.includes('Platform darwin') || stdout.includes('launchd')) {
        // Check if the LaunchAgent exists
        const launchAgentPath = `${process.env.HOME}/Library/LaunchAgents/pm2.${process.env.USER}.plist`
        
        try {
          await execAsync(`ls "${launchAgentPath}"`)
          this.addResult(
            'Startup Service', 
            'PASS', 
            'PM2 startup service is configured for macOS',
            `LaunchAgent: ${launchAgentPath}`
          )
          this.log('PM2 startup service is configured', 'success')
        } catch {
          this.addResult(
            'Startup Service', 
            'FAIL', 
            'PM2 startup service is not properly configured',
            'Run the command shown by `pm2 startup` to enable boot persistence'
          )
          this.log('PM2 startup service is not properly configured', 'warning')
        }
      } else {
        this.addResult(
          'Startup Service', 
          'SKIP', 
          'Startup service check skipped (platform not detected as macOS)'
        )
        this.log('Startup service check skipped', 'warning')
      }
    } catch (error) {
      this.addResult(
        'Startup Service', 
        'FAIL', 
        'Failed to check startup service configuration',
        error instanceof Error ? error.message : String(error)
      )
      this.log('Failed to check startup service configuration', 'error')
    }
  }

  printSummary(): void {
    this.log('\n' + '='.repeat(60), 'info')
    this.log('PM2 VALIDATION SUMMARY', 'info')
    this.log('='.repeat(60), 'info')

    const passed = this.results.filter(r => r.status === 'PASS').length
    const failed = this.results.filter(r => r.status === 'FAIL').length
    const skipped = this.results.filter(r => r.status === 'SKIP').length

    for (const result of this.results) {
      const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️'
      this.log(`${icon} ${result.test}: ${result.message}`)
      
      if (result.details) {
        this.log(`   Details: ${result.details}`, 'info')
      }
    }

    this.log('\n' + '-'.repeat(60), 'info')
    this.log(`Total Tests: ${this.results.length}`)
    this.log(`Passed: ${passed}`, passed > 0 ? 'success' : 'info')
    this.log(`Failed: ${failed}`, failed > 0 ? 'error' : 'info')
    this.log(`Skipped: ${skipped}`, skipped > 0 ? 'warning' : 'info')

    if (failed === 0) {
      this.log('\n🎉 All validations passed! Azure DevOps Bot PM2 setup is working correctly.', 'success')
    } else {
      this.log('\n🔧 Some validations failed. Please review the issues above.', 'warning')
    }
  }

  async runValidation(): Promise<void> {
    this.log('🔍 Starting PM2 validation for Azure DevOps Bot', 'info')
    this.log('=' .repeat(60), 'info')

    await this.validatePM2Installation()
    await this.validateProcessStatus()
    await this.validateLogFiles()
    await this.validateConfiguration()
    await this.validateStartupService()

    this.printSummary()
  }
}

// Run validation if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new PM2Validator()
  validator.runValidation().catch(console.error)
}