import axios from 'axios'

import type { AzureDevOpsClientConfig } from '../types/config.js'

export class PATAuth {
  public readonly organization: string
  public readonly project: string
  public readonly apiVersion: string
  public readonly baseUrl: string
  private readonly pat: string

  constructor(config: AzureDevOpsClientConfig) {
    PATAuth.validateConfig(config)

    this.organization = config.organization
    this.project = config.project
    this.pat = config.pat
    this.apiVersion = config.apiVersion || '7.1-preview.3'
    this.baseUrl =
      config.baseUrl || `https://dev.azure.com/${config.organization}`
  }

  /**
   * Validates the configuration for required fields
   */
  static validateConfig(config: AzureDevOpsClientConfig): void {
    if (!config.organization?.trim()) {
      throw new Error('Organization is required')
    }

    if (!config.project?.trim()) {
      throw new Error('Project is required')
    }

    if (!config.pat?.trim()) {
      throw new Error('Personal Access Token is required')
    }
  }

  /**
   * Gets authentication headers for Azure DevOps API requests
   */
  getAuthHeaders(): Record<string, string> {
    const encodedPat = Buffer.from(`:${this.pat}`).toString('base64')

    return {
      Authorization: `Basic ${encodedPat}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'azure-devops-client/1.0.0',
    }
  }

  /**
   * Builds a complete API URL with query parameters
   */
  buildUrl(apiPath: string, queryParams?: Record<string, string>): string {
    const url = new URL(`${this.baseUrl}/${this.project}${apiPath}`)

    // Add query parameters
    if (queryParams) {
      Object.entries(queryParams).forEach(([key, value]) => {
        url.searchParams.append(key, value)
      })
    }

    // Always add api-version
    url.searchParams.append('api-version', this.apiVersion)

    return url.toString()
  }

  /**
   * Validates PAT format (basic validation)
   */
  isValidPATFormat(): boolean {
    // Basic validation: should be at least 40 characters and contain only alphanumeric
    return this.pat.length >= 40 && /^[a-zA-Z0-9]+$/.test(this.pat)
  }

  async validateAuthentication(): Promise<boolean> {
    try {
      // Test PAT with a minimal API call to verify authentication works
      const testUrl = this.buildUrl('/_apis/projects')
      const response = await axios.get(testUrl, {
        headers: this.getAuthHeaders(),
        timeout: 10000,
      })
      return response.status === 200
    } catch (error) {
      return false
    }
  }

  /**
   * Gets organization and project info
   */
  getConnectionInfo(): {
    organization: string
    project: string
    baseUrl: string
  } {
    return {
      organization: this.organization,
      project: this.project,
      baseUrl: this.baseUrl,
    }
  }
}
