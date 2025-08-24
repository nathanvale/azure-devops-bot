# Tests Specification

This is the tests coverage details for the spec detailed in @.agent-os/specs/2025-08-23-coderabbit-cleanup-documentation/spec.md

> Created: 2025-08-23
> Version: 1.0.0

## Test Coverage

### Unit Tests

**Service Integration Tests**

- Verify `field-discovery.ts` successfully uses REST client methods instead of CLI
- Test `auth.ts` PAT validation without CLI dependencies
- Validate script files (`init-database.ts`, `pm2-validate.ts`) work with REST client

### Integration Tests

**REST Client Functionality**

- Ensure all service files successfully initialize and use `azure-devops-client`
- Test error handling flows use REST client error patterns
- Verify environment variable validation works for PAT authentication

**Documentation Accuracy**

- Validate all code examples in documentation are executable
- Test that environment setup instructions work for PAT configuration
- Verify no broken references to removed CLI functionality

### Regression Tests

**Existing Functionality Preservation**

- All existing MCP tools continue working with REST client backend
- Performance characteristics maintained (sub-100ms queries)
- Data sync functionality unaffected by service layer changes

### Mocking Requirements

- **No new mocks required** - Existing MSW handlers for Azure DevOps REST API sufficient
- **Remove CLI mocks** - Clean up any remaining `mockExecAsync` or subprocess mocks
- **Environment validation** - Mock PAT environment variable scenarios for testing

## Testing Strategy

### Validation Approach

- **Documentation Testing**: Verify all code examples and setup instructions are accurate
- **Integration Verification**: Ensure service files successfully use REST client without CLI dependencies
- **Regression Protection**: Maintain all existing test coverage while removing CLI-based tests

### Test Execution

- Run full test suite after each P0 service file update
- Validate environment setup instructions manually
- Test error scenarios for PAT authentication and REST client failures

## Success Criteria

- All tests pass without any CLI subprocess dependencies
- Service files successfully use REST client methods
- Documentation examples are executable and accurate
- No regression in existing functionality or performance
