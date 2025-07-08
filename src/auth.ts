import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class AzureAuth {
  private static readonly SSO_URL = 'https://dev.azure.com/fwcdev';
  
  async checkAuth(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('az account show');
      return stdout.trim().length > 0;
    } catch (error) {
      return false;
    }
  }
  
  async login(): Promise<void> {
    console.log(`❌ Not authenticated with Azure CLI`);
    console.log(`🔗 Please sign in at: ${AzureAuth.SSO_URL}`);
    console.log(`💡 Then run: az login`);
    throw new Error('Azure CLI authentication required');
  }
  
  async ensureAuth(): Promise<void> {
    const isAuthenticated = await this.checkAuth();
    if (!isAuthenticated) {
      await this.login();
    }
  }
}