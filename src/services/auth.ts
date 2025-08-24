import type { AzureDevOpsClientConfig } from '../packages/azure-devops-client/src/types/config.js'

import { PATAuth } from '../packages/azure-devops-client/src/auth/pat-auth.js'

export class AzureAuth {
  private static readonly ORGANIZATION = 'fwcdev'
  private static readonly PROJECT = 'Customer Services Platform'
  private static readonly AZURE_DEVOPS_URL = 'https://dev.azure.com/fwcdev'

  private patAuth: PATAuth | null = null

  constructor() {
    // Initialize PAT authentication if environment variables are available
    this.initializePATAuth()
  }

  private initializePATAuth(): void {
    const pat = process.env.AZURE_DEVOPS_PAT
    if (pat && pat.trim().length > 0) {
      try {
        const config: AzureDevOpsClientConfig = {
          organization: AzureAuth.ORGANIZATION,
          project: AzureAuth.PROJECT,
          pat: pat.trim(),
          apiVersion: '7.0',
        }
        this.patAuth = new PATAuth(config)
      } catch (error) {
        // PAT configuration failed, will be handled in checkAuth
        this.patAuth = null
      }
    }
  }

  async checkAuth(): Promise<boolean> {
    if (!this.patAuth) {
      return false
    }

    try {
      // Validate PAT format first
      if (!this.patAuth.isValidPATFormat()) {
        return false
      }

      // Test authentication with Azure DevOps API
      return await this.patAuth.validateAuthentication()
    } catch {
      return false
    }
  }

  async login(): Promise<void> {
    const pat = process.env.AZURE_DEVOPS_PAT

    if (!pat || pat.trim().length === 0) {
      console.log(`❌ AZURE_DEVOPS_PAT environment variable is not set`)
      console.log(
        `🔗 Please create a Personal Access Token at: ${AzureAuth.AZURE_DEVOPS_URL}/_usersSettings/tokens`,
      )
      console.log(`💡 Steps to set up PAT authentication:`)
      console.log(
        `   1. Visit: ${AzureAuth.AZURE_DEVOPS_URL}/_usersSettings/tokens`,
      )
      console.log(
        `   2. Create a new token with "Work items (read & write)" permission`,
      )
      console.log(
        `   3. Set the environment variable: export AZURE_DEVOPS_PAT="your-token-here"`,
      )
      console.log(`   4. Restart the service`)
      throw new Error('AZURE_DEVOPS_PAT environment variable is required')
    }

    // PAT is set but authentication failed
    console.log(`❌ PAT authentication failed`)
    console.log(`🔑 Your Personal Access Token may be invalid or expired`)
    console.log(`💡 Please check:`)
    console.log(`   1. Your PAT is valid and not expired`)
    console.log(`   2. Your PAT has "Work items (read & write)" permission`)
    console.log(
      `   3. Update your environment variable: export AZURE_DEVOPS_PAT="new-token"`,
    )
    console.log(`   4. Restart the service`)
    throw new Error('Azure DevOps PAT authentication failed')
  }

  async ensureAuth(): Promise<void> {
    const isAuthenticated = await this.checkAuth()
    if (!isAuthenticated) {
      await this.login()
    }
  }

  /**
   * Get PAT authentication instance for advanced operations
   */
  getPATAuth(): PATAuth | null {
    return this.patAuth
  }

  /**
   * Get connection information
   */
  getConnectionInfo(): {
    organization: string
    project: string
    azureDevOpsUrl: string
  } {
    return {
      organization: AzureAuth.ORGANIZATION,
      project: AzureAuth.PROJECT,
      azureDevOpsUrl: AzureAuth.AZURE_DEVOPS_URL,
    }
  }
}
