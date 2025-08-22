import { exec } from 'child_process'
import { promisify } from 'util'

export class AzureAuth {
  private static readonly SSO_URL = 'https://dev.azure.com/fwcdev'
  private execAsync: (
    command: string,
  ) => Promise<{ stdout: string; stderr: string }>

  constructor(
    execAsyncFunction?: (
      command: string,
    ) => Promise<{ stdout: string; stderr: string }>,
  ) {
    this.execAsync = execAsyncFunction || promisify(exec)
  }

  async checkAuth(): Promise<boolean> {
    try {
      const { stdout } = await this.execAsync('az account show')
      return stdout.trim().length > 0
    } catch (error) {
      return false
    }
  }

  async login(): Promise<void> {
    console.log(`❌ Not authenticated with Azure CLI`)
    console.log(`🔗 Please sign in at: ${AzureAuth.SSO_URL}`)
    console.log(`💡 Then run: az login`)
    throw new Error('Azure CLI authentication required')
  }

  async ensureAuth(): Promise<void> {
    const isAuthenticated = await this.checkAuth()
    if (!isAuthenticated) {
      await this.login()
    }
  }
}
