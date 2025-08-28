import type { Tool } from '@modelcontextprotocol/sdk/types.js'

import type { Domain, ToolResponse } from '../types/base.js'

import { createTimestamp } from '../schemas/index.js'

/**
 * Registry configuration for domain loading
 */
export interface DomainRegistryConfig {
  enabledDomains?: string[]
  defaultDomains?: string[]
  disabledDomains?: string[]
}

/**
 * Tool registry that manages all domains and their tools
 */
export class MCPToolRegistry {
  private domains = new Map<string, Domain>()
  private config: DomainRegistryConfig

  constructor(config: DomainRegistryConfig = {}) {
    this.config = {
      defaultDomains: ['cache', 'sync', 'admin'],
      enabledDomains: config.enabledDomains ||
        config.defaultDomains || ['cache', 'sync', 'admin'],
      disabledDomains: config.disabledDomains || [],
      ...config,
    }
  }

  /**
   * Register a domain with the registry
   */
  registerDomain(domain: Domain): void {
    const name = domain.getName()

    if (this.domains.has(name)) {
      throw new Error(`Domain '${name}' is already registered`)
    }

    // Check for tool name collisions with existing domains
    this.validateNoToolCollisions(domain)

    this.domains.set(name, domain)
  }

  /**
   * Validate that a domain's tools don't collide with existing tool names
   */
  private validateNoToolCollisions(newDomain: Domain): void {
    const existingToolNames = new Set<string>()

    // Collect all existing tool names
    for (const domain of this.domains.values()) {
      for (const tool of domain.getTools()) {
        existingToolNames.add(tool.name)
      }
    }

    // Check new domain's tools for collisions
    const newTools = newDomain.getTools()
    const collisions: string[] = []

    for (const tool of newTools) {
      if (existingToolNames.has(tool.name)) {
        collisions.push(tool.name)
      }
    }

    if (collisions.length > 0) {
      throw new Error(
        `Tool name collisions detected in domain '${newDomain.getName()}': ${collisions.join(', ')}. ` +
          `These tools already exist in other registered domains.`,
      )
    }
  }

  /**
   * Unregister a domain from the registry
   */
  unregisterDomain(name: string): boolean {
    return this.domains.delete(name)
  }

  /**
   * Get a domain by name
   */
  getDomain(name: string): Domain | undefined {
    return this.domains.get(name)
  }

  /**
   * Get all registered domains
   */
  getDomains(): Domain[] {
    return Array.from(this.domains.values())
  }

  /**
   * Get all enabled domains based on configuration
   */
  getEnabledDomains(): Domain[] {
    return Array.from(this.domains.values()).filter((domain) => {
      const name = domain.getName()

      // Check if explicitly disabled
      if (this.config.disabledDomains?.includes(name)) {
        return false
      }

      // Check if in enabled list
      return this.config.enabledDomains?.includes(name) ?? false
    })
  }

  /**
   * Get all tools from enabled domains
   */
  getTools(): Tool[] {
    const enabledDomains = this.getEnabledDomains()
    const tools: Tool[] = []

    for (const domain of enabledDomains) {
      const domainTools = domain.getTools()
      tools.push(...domainTools)
    }

    return tools
  }

  /**
   * Get tools from specific domains
   */
  getToolsFromDomains(domainNames: string[]): Tool[] {
    const tools: Tool[] = []

    for (const domainName of domainNames) {
      const domain = this.domains.get(domainName)
      if (domain) {
        const domainTools = domain.getTools()
        tools.push(...domainTools)
      }
    }

    return tools
  }

  /**
   * Find which domain can handle a specific tool
   */
  findDomainForTool(toolName: string): Domain | undefined {
    const enabledDomains = this.getEnabledDomains()

    return enabledDomains.find((domain) => domain.canHandle(toolName))
  }

  /**
   * Handle a tool call by finding the appropriate domain
   */
  async handleTool(toolName: string, args: unknown): Promise<ToolResponse> {
    const domain = this.findDomainForTool(toolName)

    if (!domain) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                error: {
                  code: 'TOOL_NOT_FOUND',
                  message: `Tool '${toolName}' not found in any enabled domain`,
                  availableDomains: this.getEnabledDomains().map((d) =>
                    d.getName(),
                  ),
                  timestamp: createTimestamp(),
                },
              },
              null,
              2,
            ),
          },
        ],
      }
    }

    return await domain.handleTool(toolName, args)
  }

  /**
   * Update registry configuration
   */
  updateConfig(config: Partial<DomainRegistryConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Get current registry configuration
   */
  getConfig(): DomainRegistryConfig {
    return { ...this.config }
  }

  /**
   * Check for potential tool name collisions across all domains
   * Returns information about any collisions found
   */
  checkCollisions(): {
    hasCollisions: boolean
    duplicates: Record<string, string[]>
    totalConflicts: number
  } {
    const toolDomainMap = new Map<string, string[]>()

    // Map each tool name to the domains that provide it
    for (const domain of this.domains.values()) {
      const domainName = domain.getName()
      for (const tool of domain.getTools()) {
        if (!toolDomainMap.has(tool.name)) {
          toolDomainMap.set(tool.name, [])
        }
        toolDomainMap.get(tool.name)!.push(domainName)
      }
    }

    // Find duplicates
    const duplicates: Record<string, string[]> = {}
    for (const [toolName, domains] of toolDomainMap.entries()) {
      if (domains.length > 1) {
        duplicates[toolName] = domains
      }
    }

    return {
      hasCollisions: Object.keys(duplicates).length > 0,
      duplicates,
      totalConflicts: Object.keys(duplicates).length,
    }
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    totalDomains: number
    enabledDomains: number
    disabledDomains: number
    totalTools: number
    enabledTools: number
    domainBreakdown: Record<string, number>
    collisionInfo: {
      hasCollisions: boolean
      totalConflicts: number
    }
  } {
    const allDomains = this.getDomains()
    const enabledDomains = this.getEnabledDomains()
    const allTools = this.getTools()
    const collisionCheck = this.checkCollisions()

    const domainBreakdown: Record<string, number> = {}
    for (const domain of allDomains) {
      domainBreakdown[domain.getName()] = domain.getTools().length
    }

    return {
      totalDomains: allDomains.length,
      enabledDomains: enabledDomains.length,
      disabledDomains: allDomains.length - enabledDomains.length,
      totalTools: allDomains.reduce(
        (sum, domain) => sum + domain.getTools().length,
        0,
      ),
      enabledTools: allTools.length,
      domainBreakdown,
      collisionInfo: {
        hasCollisions: collisionCheck.hasCollisions,
        totalConflicts: collisionCheck.totalConflicts,
      },
    }
  }

  /**
   * Validate that all required domains are available
   */
  validateRequiredDomains(requiredDomains: string[]): void {
    const missing = requiredDomains.filter((name) => !this.domains.has(name))

    if (missing.length > 0) {
      throw new Error(`Required domains not found: ${missing.join(', ')}`)
    }
  }
}
