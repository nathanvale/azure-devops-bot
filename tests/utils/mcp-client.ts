import type {
  CallToolResult,
  ListToolsResult,
} from '@modelcontextprotocol/sdk/types.js'
import type { ChildProcess } from 'child_process'

import { spawn } from 'child_process'

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

export class TestMCPClient {
  private client: Client
  private transport: StdioClientTransport | null = null
  private process: ChildProcess | null = null

  constructor() {
    this.client = new Client(
      {
        name: 'test-client',
        version: '1.0.0',
      },
      {
        capabilities: {},
      },
    )
  }

  async connect(serverPath: string, args: string[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      // Spawn the MCP server process
      this.process = spawn('node', [serverPath, ...args], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, NODE_ENV: 'test' },
      })

      if (!this.process || !this.process.stdout || !this.process.stdin) {
        reject(new Error('Failed to spawn MCP server process'))
        return
      }

      // Handle process errors
      this.process.on('error', (error) => {
        reject(new Error(`Failed to start MCP server: ${error.message}`))
      })

      this.process.on('exit', (code, signal) => {
        if (code !== null && code !== 0) {
          reject(new Error(`MCP server exited with code ${code}`))
        } else if (signal) {
          reject(new Error(`MCP server killed with signal ${signal}`))
        }
      })

      // Capture stderr for debugging
      this.process.stderr?.on('data', (data) => {
        console.error('MCP Server stderr:', data.toString())
      })

      // Create transport
      this.transport = new StdioClientTransport({
        command: this.process.spawnfile || 'node',
        args: this.process.spawnargs || [],
      })

      // Connect client
      this.client
        .connect(this.transport)
        .then(() => {
          resolve()
        })
        .catch((error) => {
          reject(new Error(`Failed to connect to MCP server: ${error.message}`))
        })
    })
  }

  async listTools(): Promise<ListToolsResult> {
    try {
      return await this.client.listTools()
    } catch (error) {
      throw new Error(
        `Failed to list tools: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  async callTool(name: string, args: any = {}): Promise<CallToolResult> {
    try {
      return (await this.client.callTool({
        name,
        arguments: args,
      })) as CallToolResult
    } catch (error) {
      throw new Error(
        `Failed to call tool '${name}': ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  async close(): Promise<void> {
    try {
      // Close the client connection
      if (this.client) {
        await this.client.close()
      }

      // Close the transport
      if (this.transport) {
        await this.transport.close()
      }

      // Kill the process
      if (this.process && !this.process.killed) {
        this.process.kill('SIGTERM')

        // Wait a moment for graceful shutdown
        await new Promise((resolve) => setTimeout(resolve, 1000))

        // Force kill if still running
        if (!this.process.killed) {
          this.process.kill('SIGKILL')
        }
      }
    } catch (error) {
      console.error('Error closing MCP client:', error)
    } finally {
      this.transport = null
      this.process = null
    }
  }

  isConnected(): boolean {
    return (
      this.transport !== null && this.process !== null && !this.process.killed
    )
  }

  getProcessId(): number | undefined {
    return this.process?.pid
  }
}

// Helper function to create and connect a test client
export async function createTestMCPClient(
  serverPath: string,
  args: string[] = [],
): Promise<TestMCPClient> {
  const client = new TestMCPClient()
  await client.connect(serverPath, args)
  return client
}

// Helper function for testing tool calls with timeout
export async function callToolWithTimeout(
  client: TestMCPClient,
  toolName: string,
  args: any = {},
  timeoutMs = 10000,
): Promise<CallToolResult> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(
        new Error(`Tool call '${toolName}' timed out after ${timeoutMs}ms`),
      )
    }, timeoutMs)

    client
      .callTool(toolName, args)
      .then((result) => {
        clearTimeout(timeout)
        resolve(result)
      })
      .catch((error) => {
        clearTimeout(timeout)
        reject(error)
      })
  })
}

// Helper to wait for process to be ready
export async function waitForServerReady(
  client: TestMCPClient,
  maxWaitMs = 5000,
): Promise<void> {
  const startTime = Date.now()

  while (Date.now() - startTime < maxWaitMs) {
    try {
      if (client.isConnected()) {
        await client.listTools()
        return // Server is ready
      }
    } catch (error) {
      // Server not ready yet, continue waiting
    }

    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  throw new Error(`Server did not become ready within ${maxWaitMs}ms`)
}
