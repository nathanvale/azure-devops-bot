# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-08-23-coderabbit-cleanup-documentation/spec.md

> Created: 2025-08-23  
> Version: 1.0.0

## Technical Requirements

- **Service Integration**: Replace all `child_process.exec` calls with `azure-devops-client` package methods
- **Authentication Migration**: Update from Azure CLI SSO references to PAT-based authentication with environment variable validation
- **Documentation Accuracy**: Ensure all technical documentation reflects REST API architecture with proper security posture
- **Legacy Reference Removal**: Eliminate all `az boards` and `az rest` command references from service code and scripts
- **Error Handling**: Maintain existing resilience patterns while using REST client error handling
- **Environment Configuration**: Update all environment setup documentation to reflect PAT requirements instead of CLI authentication

## Approach Options

**Option A: Manual File-by-File Cleanup**

- Pros: Complete control, can verify each change
- Cons: Time-intensive, potential for missed references

**Option B: Documentation Expert Agent with Systematic Approach** (Selected)

- Pros: Comprehensive analysis, systematic prioritization, expert-level documentation patterns
- Cons: Requires careful coordination of multiple file updates

**Rationale:** Documentation expert agent can systematically analyze all 75 CodeRabbit comments, cross-reference with existing specs, and implement consistent patterns across all documentation and code files.

## External Dependencies

- **No new dependencies required** - All functionality uses existing `azure-devops-client` package
- **Existing packages maintained**: Leverages implemented REST client, Prisma ORM, and MCP protocol components

## Implementation Strategy

### Phase 1: P0 Blocking Issues

1. **Service File Migration** - Update `field-discovery.ts`, `auth.ts`, and scripts to use REST client
2. **Security Documentation** - Correct security posture documentation to reflect PAT + HTTPS architecture

### Phase 2: P1 Important Updates

3. **Tech Stack Documentation** - Update all technical architecture sections
4. **Service Layer Completion** - Wire REST client into all remaining service modules

### Phase 3: P2-P3 Consistency

5. **Project Documentation** - Update high-level docs and performance analysis
6. **Testing Cleanup** - Verify and clean testing artifacts

## File Impact Analysis

### High Impact (P0)

- `src/services/field-discovery.ts` - Core service functionality
- `src/services/auth.ts` - Authentication and validation
- `.agent-os/product/tech-stack.md` - Architecture documentation
- `scripts/init-database.ts` - Database initialization
- `scripts/pm2-validate.ts` - Health check logic

### Medium Impact (P1)

- `src/services/schema-migration.ts` - Schema management
- Documentation files across `.agent-os/` and `docs/`

### Low Impact (P2-P3)

- High-level project documentation
- Performance analysis documentation
- Testing artifact references

## Quality Gates

- All service files must successfully import and use `azure-devops-client`
- No remaining references to `az boards` or `az rest` in service code
- Documentation accurately reflects implemented architecture
- All existing functionality preserved with REST client implementation
- Environment setup instructions updated for PAT-based authentication
