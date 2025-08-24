# Spec Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/2025-08-23-coderabbit-cleanup-documentation/spec.md

> Created: 2025-08-23
> Status: Ready for Implementation

## Tasks

- [x] 1. Address P0 Blocking Issues - Service Code Cleanup
  - [x] 1.1 Update field-discovery.ts to use REST client instead of Azure CLI subprocess calls
  - [x] 1.2 Update auth.ts to use PAT validation instead of Azure CLI authentication checks
  - [x] 1.3 Update scripts/init-database.ts to use REST client initialization instead of CLI commands
  - [x] 1.4 Update scripts/pm2-validate.ts to remove CLI usage from health-check logic
  - [x] 1.5 Update security section in tech-stack.md to reflect PAT authentication and HTTPS communication
  - [x] 1.6 Verify all P0 service files successfully import and use azure-devops-client package
  - [x] 1.7 Run full test suite to ensure no regressions from service file changes

- [x] 2. Address P1 Important Updates - Architecture Documentation
  - [x] 2.1 Update External Integrations section in tech-stack.md from Azure CLI to REST API
  - [x] 2.2 Update API Integration Details in tech-stack.md with REST specifics (WIQL, batch processing, rate limiting)
  - [x] 2.3 Update Data Flow Architecture in tech-stack.md to reflect REST API input instead of CLI commands
  - [x] 2.4 Fix schema-migration.ts to use REST client instead of CLI commands
  - [x] 2.5 Verify all architecture documentation accurately reflects implemented REST client patterns
  - [x] 2.6 Test that all documented examples and configurations are executable

- [x] 3. Address P2 Consistency Updates - Project Documentation
  - [x] 3.1 Update CLAUDE.md references from Azure CLI to REST API + PAT authentication
  - [x] 3.2 Update performance documentation to reflect HTTP calls instead of subprocess overhead
  - [x] 3.3 Review and update any remaining high-level project documentation with CLI references
  - [x] 3.4 Ensure consistent messaging across all project documentation files
  - [x] 3.5 Verify all environment setup instructions reflect PAT requirements

- [x] 4. Address P3 Future Items - Testing and Completeness
  - [x] 4.1 Verify and clean up testing artifacts that may target CLI commands instead of REST methods
  - [x] 4.2 Review test mocks to ensure they target REST endpoints rather than CLI output
  - [x] 4.3 Update any remaining documentation references in specs and technical documents
  - [x] 4.4 Perform final review to ensure no Azure CLI references remain in core functionality
  - [x] 4.5 Validate that all CodeRabbit actionable comments have been systematically addressed

- [x] 5. Quality Assurance and Documentation Verification
  - [x] 5.1 Run comprehensive test suite to ensure all functionality preserved
  - [x] 5.2 Test environment setup instructions manually with clean environment
  - [x] 5.3 Verify all code examples in documentation are executable and accurate
  - [x] 5.4 Confirm no remaining references to removed Azure CLI functionality
  - [x] 5.5 Validate production readiness with updated service files and documentation
        ⚠️ Note: TypeScript errors exist but are separate from documentation cleanup scope
