import { describe, it, expect, beforeEach } from 'vitest'
import { z } from 'zod'

import { MCPToolRegistry } from '../registry/index.js'
import { BaseDomain } from '../types/base.js'

// Mock domain for testing
class TestDomain extends BaseDomain {
  constructor(private name: string) {
    super()
    this.tools = [
      {
        name: `${name}_test_tool`,
        description: `Test tool for ${name} domain`,
        inputSchema: z.object({
          testParam: z.string().optional(),
        }),
        handler: async (args) => {
          const response = { success: true, domain: name, args }
          return response
        },
      },
    ]
  }

  getName(): string {
    return this.name
  }
}

describe('MCPToolRegistry', () => {
  let registry: MCPToolRegistry

  beforeEach(() => {
    registry = new MCPToolRegistry({
      enabledDomains: ['test1', 'test2'],
      defaultDomains: ['test1', 'test2'],
    })
  })

  it('should register and manage domains', () => {
    const domain1 = new TestDomain('test1')
    const domain2 = new TestDomain('test2')

    registry.registerDomain(domain1)
    registry.registerDomain(domain2)

    expect(registry.getDomains()).toHaveLength(2)
    expect(registry.getDomain('test1')).toBe(domain1)
    expect(registry.getDomain('test2')).toBe(domain2)
  })

  it('should return tools from enabled domains only', () => {
    const domain1 = new TestDomain('test1')
    const domain2 = new TestDomain('test2')
    const domain3 = new TestDomain('disabled')

    registry.registerDomain(domain1)
    registry.registerDomain(domain2)
    registry.registerDomain(domain3)

    const tools = registry.getTools()

    expect(tools).toHaveLength(2) // Only enabled domains
    expect(tools.map((t) => t.name)).toContain('test1_test_tool')
    expect(tools.map((t) => t.name)).toContain('test2_test_tool')
    expect(tools.map((t) => t.name)).not.toContain('disabled_test_tool')
  })

  it('should find correct domain for tool', () => {
    const domain1 = new TestDomain('test1')
    registry.registerDomain(domain1)

    const domain = registry.findDomainForTool('test1_test_tool')
    expect(domain).toBe(domain1)

    const unknownDomain = registry.findDomainForTool('unknown_tool')
    expect(unknownDomain).toBeUndefined()
  })

  it('should handle tool calls correctly', async () => {
    const domain1 = new TestDomain('test1')
    registry.registerDomain(domain1)

    const response = await registry.handleTool('test1_test_tool', {
      testParam: 'hello',
    })

    expect(response.content).toHaveLength(1)
    expect(response.content[0]?.type).toBe('text')

    const responseData = JSON.parse(response.content[0]?.text!)
    expect(responseData.success).toBe(true)
    expect(responseData.domain).toBe('test1')
    expect(responseData.args.testParam).toBe('hello')
  })

  it('should handle unknown tool calls', async () => {
    const response = await registry.handleTool('unknown_tool', {})

    expect(response.content).toHaveLength(1)
    const responseData = JSON.parse(response.content[0]?.text!)
    expect(responseData.error.code).toBe('TOOL_NOT_FOUND')
    expect(responseData.error.message).toContain('unknown_tool')
  })

  it('should provide accurate statistics', () => {
    const domain1 = new TestDomain('test1')
    const domain2 = new TestDomain('test2')

    registry.registerDomain(domain1)
    registry.registerDomain(domain2)

    const stats = registry.getStats()

    expect(stats.totalDomains).toBe(2)
    expect(stats.enabledDomains).toBe(2)
    expect(stats.disabledDomains).toBe(0)
    expect(stats.totalTools).toBe(2)
    expect(stats.enabledTools).toBe(2)
    expect(stats.domainBreakdown.test1).toBe(1)
    expect(stats.domainBreakdown.test2).toBe(1)
    expect(stats.collisionInfo.hasCollisions).toBe(false)
    expect(stats.collisionInfo.totalConflicts).toBe(0)
  })

  it('should prevent tool name collisions during domain registration', () => {
    // Create two domains with conflicting tool names
    const domain1 = new TestDomain('test1')
    const domain2 = new (class extends BaseDomain {
      constructor() {
        super()
        this.tools = [
          {
            name: 'test1_test_tool', // Same name as domain1
            description: 'Conflicting tool',
            inputSchema: z.object({}),
            handler: async () => ({ collision: true }),
          },
        ]
      }
      getName() {
        return 'test2'
      }
    })()

    registry.registerDomain(domain1)

    expect(() => {
      registry.registerDomain(domain2)
    }).toThrow(/Tool name collisions detected.*test1_test_tool/)
  })

  it('should detect existing collisions with checkCollisions method', () => {
    const registry = new MCPToolRegistry()
    const domain1 = new TestDomain('test1')
    const domain2 = new TestDomain('test2')

    registry.registerDomain(domain1)
    registry.registerDomain(domain2)

    const collisions = registry.checkCollisions()
    expect(collisions.hasCollisions).toBe(false)
    expect(collisions.totalConflicts).toBe(0)
    expect(collisions.duplicates).toEqual({})
  })

  it('should update configuration correctly', () => {
    const domain1 = new TestDomain('test1')
    const domain2 = new TestDomain('test2')

    registry.registerDomain(domain1)
    registry.registerDomain(domain2)

    // Initially both should be enabled
    expect(registry.getEnabledDomains()).toHaveLength(2)

    // Disable test2
    registry.updateConfig({ disabledDomains: ['test2'] })
    expect(registry.getEnabledDomains()).toHaveLength(1)
    expect(registry.getEnabledDomains()[0]?.getName()).toBe('test1')

    // Re-enable all
    registry.updateConfig({ disabledDomains: [] })
    expect(registry.getEnabledDomains()).toHaveLength(2)
  })

  it('should prevent duplicate domain registration', () => {
    const domain1 = new TestDomain('test1')
    const domain1Duplicate = new TestDomain('test1')

    registry.registerDomain(domain1)

    expect(() => registry.registerDomain(domain1Duplicate)).toThrow(
      "Domain 'test1' is already registered",
    )
  })

  it('should validate required domains', () => {
    const domain1 = new TestDomain('test1')
    registry.registerDomain(domain1)

    // Should not throw for existing domain
    expect(() => registry.validateRequiredDomains(['test1'])).not.toThrow()

    // Should throw for missing domain
    expect(() =>
      registry.validateRequiredDomains(['test1', 'missing']),
    ).toThrow('Required domains not found: missing')
  })
})
