# Tests Specification

This is the tests coverage details for the spec detailed in @.agent-os/specs/2025-08-27-cli-enhancement/spec.md

> Created: 2025-08-27
> Version: 1.0.0

## Test Coverage Overview

The CLI enhancement requires comprehensive testing across multiple layers: unit tests for individual components, integration tests for CLI workflows, and end-to-end tests for complete user scenarios. Testing strategy follows Agent OS principles with light coverage on critical paths while avoiding database mocking complexity.

## Unit Tests

### CLI Configuration Testing

**CLIConfig (src/cli/cli-config.ts)**

- Argument parsing with various flag combinations
- Validation of conflicting options (--quiet + --verbose)
- Format option validation (text, json, markdown)
- Default value handling and query parameter extraction
- Help text generation and version display

```typescript
// Example unit test structure
describe('CLI Configuration', () => {
  describe('setupCLI', () => {
    it('should parse basic query argument', () => {
      const mockArgv = ['node', 'script', 'my work items']
      const { query } = setupCLI(mockArgv)
      expect(query).toBe('my work items')
    })

    it('should handle verbose flag', () => {
      const mockArgv = ['node', 'script', '--verbose', 'status']
      const { options } = setupCLI(mockArgv)
      expect(options.verbose).toBe(true)
    })

    it('should reject conflicting flags', () => {
      const mockArgv = ['node', 'script', '--quiet', '--verbose']
      expect(() => setupCLI(mockArgv)).toThrow()
    })
  })

  describe('determineVerbosityLevel', () => {
    it('should return QUIET for quiet flag', () => {
      const level = determineVerbosityLevel({
        quiet: true,
        verbose: false,
        debug: false,
      })
      expect(level).toBe(VerbosityLevel.QUIET)
    })

    it('should return DEBUG for debug flag', () => {
      const level = determineVerbosityLevel({
        quiet: false,
        verbose: false,
        debug: true,
      })
      expect(level).toBe(VerbosityLevel.DEBUG)
    })
  })
})
```

### Output Manager Testing

**OutputManager (src/cli/output-manager.ts)**

- Verbosity level filtering for different message types
- Output format switching (text, JSON, markdown)
- Spinner lifecycle management (start, update, stop)
- Message formatting and colorization
- Error handling with context and suggestions

```typescript
describe('OutputManager', () => {
  let outputManager: OutputManager
  let consoleSpy: jest.SpyInstance

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation()
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  describe('verbosity filtering', () => {
    it('should suppress info messages in QUIET mode', () => {
      outputManager = new OutputManager(VerbosityLevel.QUIET, OutputFormat.TEXT)
      outputManager.info('test message')
      expect(consoleSpy).not.toHaveBeenCalled()
    })

    it('should show info messages in NORMAL mode', () => {
      outputManager = new OutputManager(
        VerbosityLevel.NORMAL,
        OutputFormat.TEXT,
      )
      outputManager.info('test message')
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('test message'),
      )
    })

    it('should always show error messages', () => {
      outputManager = new OutputManager(VerbosityLevel.QUIET, OutputFormat.TEXT)
      const errorSpy = jest.spyOn(console, 'error').mockImplementation()
      outputManager.error('error message')
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('error message'),
      )
      errorSpy.mockRestore()
    })
  })

  describe('format switching', () => {
    it('should output valid JSON in JSON mode', () => {
      outputManager = new OutputManager(
        VerbosityLevel.NORMAL,
        OutputFormat.JSON,
      )
      outputManager.info('test message')
      const output = consoleSpy.mock.calls[0][0]
      expect(() => JSON.parse(output)).not.toThrow()
    })

    it('should format markdown properly', () => {
      outputManager = new OutputManager(
        VerbosityLevel.NORMAL,
        OutputFormat.MARKDOWN,
      )
      outputManager.success('test success')
      const output = consoleSpy.mock.calls[0][0]
      expect(output).toContain('✅ **Success:**')
    })
  })

  describe('spinner management', () => {
    it('should not create spinner in QUIET mode', () => {
      outputManager = new OutputManager(VerbosityLevel.QUIET, OutputFormat.TEXT)
      outputManager.startSpinner('test')
      expect(outputManager['activeSpinner']).toBeNull()
    })

    it('should create and manage spinner in NORMAL mode', () => {
      outputManager = new OutputManager(
        VerbosityLevel.NORMAL,
        OutputFormat.TEXT,
      )
      outputManager.startSpinner('test')
      expect(outputManager['activeSpinner']).toBeTruthy()
      outputManager.stopSpinner()
      expect(outputManager['activeSpinner']).toBeNull()
    })
  })
})
```

### Progress Manager Testing

**ProgressManager (src/cli/progress-manager.ts)**

- Progress bar creation and updates
- Indeterminate progress indicators
- Progress reporting at different verbosity levels
- Cleanup and completion handling
- Format-specific progress output

```typescript
describe('ProgressManager', () => {
  let progressManager: ProgressManager

  describe('progress bar management', () => {
    it('should not create progress bar in QUIET mode', () => {
      progressManager = new ProgressManager(
        VerbosityLevel.QUIET,
        OutputFormat.TEXT,
      )
      progressManager.startProgress('test', 100)
      expect(progressManager['progressBar']).toBeNull()
    })

    it('should create progress bar in NORMAL mode', () => {
      progressManager = new ProgressManager(
        VerbosityLevel.NORMAL,
        OutputFormat.TEXT,
      )
      progressManager.startProgress('test', 100)
      expect(progressManager['progressBar']).toBeTruthy()
      progressManager.completeProgress()
      expect(progressManager['progressBar']).toBeNull()
    })

    it('should update progress correctly', () => {
      progressManager = new ProgressManager(
        VerbosityLevel.NORMAL,
        OutputFormat.TEXT,
      )
      const mockProgressBar = {
        update: jest.fn(),
        stop: jest.fn(),
        start: jest.fn(),
      }
      progressManager['progressBar'] = mockProgressBar as any

      progressManager.updateProgress(50)
      expect(mockProgressBar.update).toHaveBeenCalledWith(50)
    })
  })

  describe('indeterminate progress', () => {
    it('should handle indeterminate progress lifecycle', (done) => {
      progressManager = new ProgressManager(
        VerbosityLevel.NORMAL,
        OutputFormat.TEXT,
      )
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      progressManager.startIndeterminate('testing')
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('testing'),
      )

      setTimeout(() => {
        progressManager.stopIndeterminate('completed')
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('completed'),
        )
        consoleSpy.mockRestore()
        done()
      }, 100)
    })
  })
})
```

### Formatter Testing

**TextFormatter, JSONFormatter, MarkdownFormatter**

- Work item formatting across different output types
- Sync summary formatting and statistics
- Edge cases (empty arrays, missing fields)
- Color coding and visual formatting
- JSON schema validation for structured output

```typescript
describe('Formatters', () => {
  const mockWorkItems = [
    { id: 1, title: 'Test Item 1', state: 'Active', assignedTo: 'user1' },
    { id: 2, title: 'Test Item 2', state: 'Closed', assignedTo: null },
  ]

  describe('TextFormatter', () => {
    it('should format work items with colors and structure', () => {
      const formatted = TextFormatter.formatWorkItems(mockWorkItems)
      expect(formatted).toContain('📋 Work Items')
      expect(formatted).toContain('Test Item 1')
      expect(formatted).toContain('Active')
      expect(formatted).toContain('unassigned')
    })

    it('should handle empty work items array', () => {
      const formatted = TextFormatter.formatWorkItems([])
      expect(formatted).toContain('No work items found')
    })
  })

  describe('JSONFormatter', () => {
    it('should produce valid JSON output', () => {
      const formatted = JSONFormatter.formatWorkItems(mockWorkItems)
      const parsed = JSON.parse(formatted)
      expect(parsed.count).toBe(2)
      expect(parsed.items).toHaveLength(2)
      expect(parsed.timestamp).toBeDefined()
    })

    it('should include metadata when provided', () => {
      const metadata = { query: 'test query', source: 'api' }
      const formatted = JSONFormatter.formatWorkItems(mockWorkItems, metadata)
      const parsed = JSON.parse(formatted)
      expect(parsed.metadata).toEqual(metadata)
    })
  })

  describe('MarkdownFormatter', () => {
    it('should format work items as markdown', () => {
      const formatted = MarkdownFormatter.formatWorkItems(mockWorkItems)
      expect(formatted).toContain('# Azure DevOps Work Items Report')
      expect(formatted).toContain('## Summary')
      expect(formatted).toContain('Found **2** work items')
      expect(formatted).toContain('### 1. Test Item 1')
    })
  })
})
```

## Integration Tests

### CLI Workflow Testing

**Complete command-line workflows**

- Full argument parsing through to output generation
- Error handling with different verbosity levels
- Output consistency across multiple invocations
- Performance impact of different CLI options

```typescript
describe('CLI Workflow Integration', () => {
  let mockBot: jest.Mocked<CLIAzureDevOpsBot>

  beforeEach(() => {
    // Mock the CLIAzureDevOpsBot class
    mockBot = {
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
    } as any
  })

  it('should handle quiet mode workflow', async () => {
    const mockArgv = ['node', 'script', '--quiet', 'my items']

    // Simulate CLI setup and execution
    const { options, query } = setupCLI(mockArgv)
    const verbosity = determineVerbosityLevel(options)

    expect(verbosity).toBe(VerbosityLevel.QUIET)
    expect(query).toBe('my items')
  })

  it('should handle verbose JSON output workflow', async () => {
    const mockArgv = [
      'node',
      'script',
      '--verbose',
      '--format',
      'json',
      'status',
    ]
    const { options, query } = setupCLI(mockArgv)

    expect(options.verbose).toBe(true)
    expect(options.format).toBe('json')
    expect(query).toBe('status')
  })

  it('should reject invalid format options', () => {
    const mockArgv = ['node', 'script', '--format', 'invalid']
    expect(() => setupCLI(mockArgv)).toThrow()
  })
})
```

### Output Integration Testing

**Cross-component output coordination**

- OutputManager and ProgressManager coordination
- Logger integration with CLI output
- Spinner and progress bar interaction
- Error propagation through CLI layers

```typescript
describe('Output Integration', () => {
  let outputManager: OutputManager
  let progressManager: ProgressManager

  beforeEach(() => {
    outputManager = new OutputManager(VerbosityLevel.NORMAL, OutputFormat.TEXT)
    progressManager = new ProgressManager(
      VerbosityLevel.NORMAL,
      OutputFormat.TEXT,
    )
  })

  it('should coordinate spinner and output messages', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

    outputManager.startSpinner('Processing...')
    expect(outputManager['activeSpinner']).toBeTruthy()

    outputManager.success('Operation completed')
    expect(outputManager['activeSpinner']).toBeNull()

    consoleSpy.mockRestore()
  })

  it('should handle progress and output in different formats', () => {
    const jsonOutput = new OutputManager(
      VerbosityLevel.VERBOSE,
      OutputFormat.JSON,
    )
    const jsonProgress = new ProgressManager(
      VerbosityLevel.VERBOSE,
      OutputFormat.JSON,
    )

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

    jsonProgress.startProgress('test', 100) // Should not create UI progress bar
    expect(jsonProgress['progressBar']).toBeNull()

    jsonOutput.info('test message')
    const output = consoleSpy.mock.calls[0][0]
    expect(() => JSON.parse(output)).not.toThrow()

    consoleSpy.mockRestore()
  })
})
```

## End-to-End Test Scenarios

### Complete User Workflows

**Real CLI invocation scenarios**

- Spawning actual CLI processes with different arguments
- Capturing and validating stdout/stderr output
- Testing complete error handling flows
- Performance validation under different loads

```typescript
describe('E2E CLI Scenarios', () => {
  const CLI_SCRIPT = path.join(__dirname, '../../../dist/index.js')

  it('should display help when requested', async () => {
    const { stdout } = await execAsync(`node ${CLI_SCRIPT} --help`)

    expect(stdout).toContain('azure-devops-bot')
    expect(stdout).toContain('Azure DevOps work item sync and query tool')
    expect(stdout).toContain('--verbose')
    expect(stdout).toContain('--quiet')
    expect(stdout).toContain('--format')
  })

  it('should handle version flag', async () => {
    const { stdout } = await execAsync(`node ${CLI_SCRIPT} --version`)
    expect(stdout).toMatch(/\d+\.\d+\.\d+/)
  })

  it('should validate environment requirements', async () => {
    // Test without AZURE_DEVOPS_USER_EMAILS
    const env = { ...process.env }
    delete env.AZURE_DEVOPS_USER_EMAILS

    try {
      await execAsync(`node ${CLI_SCRIPT} "test query"`, { env })
      fail('Should have thrown error')
    } catch (error) {
      expect(error.stderr).toContain('AZURE_DEVOPS_USER_EMAILS')
      expect(error.stderr).toContain('environment variable is required')
    }
  })

  it('should produce valid JSON output', async () => {
    const mockEnv = {
      ...process.env,
      AZURE_DEVOPS_USER_EMAILS: 'test@example.com',
    }

    // Mock Azure DevOps responses would be needed here
    const { stdout } = await execAsync(
      `node ${CLI_SCRIPT} --format json "summary"`,
      { env: mockEnv },
    )

    expect(() => JSON.parse(stdout)).not.toThrow()
  })

  it('should handle quiet mode appropriately', async () => {
    const mockEnv = {
      ...process.env,
      AZURE_DEVOPS_USER_EMAILS: 'test@example.com',
    }

    const { stdout } = await execAsync(`node ${CLI_SCRIPT} --quiet "status"`, {
      env: mockEnv,
    })

    // In quiet mode, output should be minimal
    const lines = stdout.split('\n').filter((line) => line.trim())
    expect(lines.length).toBeLessThan(5)
  })
})
```

### Performance Testing

**CLI performance validation**

- Startup time measurement with different options
- Memory usage monitoring during operation
- Output generation performance benchmarking
- Progress indicator impact assessment

```typescript
describe('Performance Tests', () => {
  it('should start CLI within performance budget', async () => {
    const start = Date.now()

    const { program } = setupCLI(['node', 'script', 'test'])

    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(5) // <5ms CLI setup requirement
  })

  it('should format large datasets efficiently', () => {
    const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      title: `Work Item ${i}`,
      state: 'Active',
      assignedTo: `user${i % 10}`,
    }))

    const start = Date.now()
    const formatted = TextFormatter.formatWorkItems(largeDataset)
    const elapsed = Date.now() - start

    expect(formatted).toContain('1000 found')
    expect(elapsed).toBeLessThan(100) // <100ms for 1000 items
  })

  it('should handle progress indicators efficiently', (done) => {
    const progressManager = new ProgressManager(
      VerbosityLevel.NORMAL,
      OutputFormat.TEXT,
    )

    const start = Date.now()
    progressManager.startProgress('Performance test', 1000)

    for (let i = 0; i < 1000; i++) {
      progressManager.updateProgress(i)
    }

    progressManager.completeProgress()

    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(50) // <50ms for 1000 updates
    done()
  })
})
```

## Mocking Requirements

### External Service Mocking

Following Agent OS DEC-006 guidelines to avoid database mocking while still testing CLI functionality:

**Azure DevOps API Responses**

- Mock HTTP responses for work item queries
- Simulate different response scenarios (success, error, timeout)
- Test rate limiting and retry behavior
- Validate request formatting and authentication

```typescript
// Mock strategy using MSW for HTTP responses
import { rest } from 'msw'
import { setupServer } from 'msw/node'

const server = setupServer(
  rest.post('https://dev.azure.com/:org/_apis/wit/wiql', (req, res, ctx) => {
    return res(
      ctx.json({
        workItems: [
          {
            id: 1,
            url: 'https://dev.azure.com/org/project/_apis/wit/workItems/1',
          },
          {
            id: 2,
            url: 'https://dev.azure.com/org/project/_apis/wit/workItems/2',
          },
        ],
      }),
    )
  }),

  rest.get(
    'https://dev.azure.com/:org/_apis/wit/workItems',
    (req, res, ctx) => {
      const ids = req.url.searchParams.get('ids')?.split(',') || []
      const workItems = ids.map((id) => ({
        id: parseInt(id),
        fields: {
          'System.Title': `Work Item ${id}`,
          'System.State': 'Active',
          'System.AssignedTo': { displayName: 'Test User' },
        },
      }))

      return res(ctx.json({ value: workItems }))
    },
  ),
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

### Process and Environment Mocking

**Environment Variables and Process Interaction**

- Mock process.argv for CLI argument testing
- Environment variable simulation
- Process exit handling
- Signal handling (SIGINT, SIGTERM)

```typescript
// Environment mocking strategy
const mockEnv = (overrides: Record<string, string>) => {
  const originalEnv = process.env
  process.env = { ...originalEnv, ...overrides }

  return () => {
    process.env = originalEnv
  }
}

// Process mocking for CLI tests
const mockProcessExit = () => {
  const originalExit = process.exit
  const exitSpy = jest.fn()
  process.exit = exitSpy as any

  return {
    exitSpy,
    restore: () => {
      process.exit = originalExit
    },
  }
}
```

## Test Data Management

**Consistent test data across all test types**

- Shared fixtures for work items and responses
- Generated test data for performance scenarios
- Edge case data (empty, malformed, large datasets)
- Localization and character encoding test cases

```typescript
// Test data fixtures
export const TestFixtures = {
  workItems: {
    standard: [
      {
        id: 1,
        title: 'Test Work Item 1',
        state: 'Active',
        assignedTo: 'test.user@company.com',
        workItemType: 'User Story',
        createdDate: '2025-08-01T10:00:00Z',
        changedDate: '2025-08-26T15:30:00Z',
      },
      {
        id: 2,
        title: 'Test Work Item 2',
        state: 'Closed',
        assignedTo: null,
        workItemType: 'Bug',
        createdDate: '2025-08-15T14:20:00Z',
        changedDate: '2025-08-25T09:15:00Z',
      },
    ],

    empty: [],

    large: Array.from({ length: 500 }, (_, i) => ({
      id: i + 1,
      title: `Generated Work Item ${i + 1}`,
      state: ['New', 'Active', 'Resolved', 'Closed'][i % 4],
      assignedTo: i % 3 === 0 ? null : `user${i % 10}@company.com`,
      workItemType: ['User Story', 'Bug', 'Task'][i % 3],
    })),

    edgeCases: [
      {
        id: 999,
        title: 'Item with "quotes" and special chars: <>&',
        state: 'Active',
        assignedTo: 'user.with+special@email-domain.co.uk',
      },
    ],
  },

  syncSummaries: {
    successful: {
      totalItems: 156,
      totalComments: 23,
      successRate: 100,
      durationMs: 8432,
    },

    partial: {
      totalItems: 200,
      totalComments: 15,
      successRate: 95,
      durationMs: 12500,
      errors: ['Work item 45 inaccessible', 'Rate limit exceeded'],
    },
  },
}
```

This comprehensive testing strategy ensures robust validation of CLI functionality while following Agent OS principles of focused, practical test coverage that validates real-world usage scenarios.
