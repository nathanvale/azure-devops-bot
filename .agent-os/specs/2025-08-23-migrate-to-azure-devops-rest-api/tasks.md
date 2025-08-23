# Spec Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/2025-08-23-migrate-to-azure-devops-rest-api/spec.md

> Created: 2025-08-23
> Status: Ready for Implementation

## Tasks

- [ ] 1. Create abstracted Azure DevOps REST API package structure
  - [ ] 1.1 Create package directory structure in `src/packages/azure-devops-client/`
  - [ ] 1.2 Add independent package.json with required dependencies
  - [ ] 1.3 Set up TypeScript configuration for the package
  - [ ] 1.4 Create main export file and core interfaces

- [ ] 2. Implement core REST API client
  - [ ] 2.1 Write tests for authentication and basic client setup
  - [ ] 2.2 Implement PAT authentication with proper headers
  - [ ] 2.3 Create HTTP client with axios and rate limiting
  - [ ] 2.4 Add error handling and structured error types

- [ ] 3. Implement batch work item operations
  - [ ] 3.1 Write tests for batch work item fetching
  - [ ] 3.2 Implement work item batch API calls (200 items per request)
  - [ ] 3.3 Add WIQL query support for work item discovery
  - [ ] 3.4 Implement work item comment batch operations

- [ ] 4. Add rate limiting and resilience features
  - [ ] 4.1 Write tests for rate limiting behavior
  - [ ] 4.2 Implement intelligent rate limiting using X-RateLimit-Remaining headers
  - [ ] 4.3 Add retry logic with exponential backoff
  - [ ] 4.4 Create concurrent request limiting with p-limit

- [ ] 5. Create provider abstraction layer
  - [ ] 5.1 Write tests for provider interface compliance
  - [ ] 5.2 Implement IWorkItemProvider interface
  - [ ] 5.3 Create Azure DevOps provider implementation
  - [ ] 5.4 Add provider info and capability reporting

- [ ] 6. Integrate with existing codebase
  - [ ] 6.1 Write tests for seamless integration with current interfaces
  - [ ] 6.2 Update AzureDevOpsClient to use REST provider
  - [ ] 6.3 Replace all Azure CLI calls with REST API calls
  - [ ] 6.4 Remove Azure CLI dependencies and subprocess code

- [ ] 7. Add PAT authentication configuration
  - [ ] 7.1 Add AZURE_DEVOPS_PAT environment variable support
  - [ ] 7.2 Update documentation for PAT setup requirements
  - [ ] 7.3 Add validation for PAT authentication
  - [ ] 7.4 Test authentication with user's Azure DevOps organization

- [ ] 8. Performance validation and testing
  - [ ] 8.1 Test batch operations with 1,056 work items
  - [ ] 8.2 Measure and verify 30x performance improvement
  - [ ] 8.3 Test rate limiting compliance under load
  - [ ] 8.4 Verify all existing MCP tools work with new implementation