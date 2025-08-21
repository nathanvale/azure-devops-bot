# Spec Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/2025-08-22-eslint-prettier-setup/spec.md

> Created: 2025-08-22
> Status: Ready for Implementation

## Tasks

- [ ] 1. Install ESLint and Prettier Dependencies
  - [ ] 1.1 Add eslint@^9.30.0 and related TypeScript plugins to devDependencies
  - [ ] 1.2 Add prettier@3.6.2 and eslint-config-prettier for integration
  - [ ] 1.3 Add eslint-plugin-perfectionist for import sorting
  - [ ] 1.4 Verify all dependencies install correctly

- [ ] 2. Create Configuration Files
  - [ ] 2.1 Create eslint.config.js with flat config matching @orchestr8
  - [ ] 2.2 Create prettier.config.js with no-semicolon rules
  - [ ] 2.3 Create .vscode/settings.json for IDE integration
  - [ ] 2.4 Verify all configuration files load without errors

- [ ] 3. Update Package.json Scripts
  - [ ] 3.1 Add lint, lint:fix, format, and format:check scripts
  - [ ] 3.2 Add type-check script for TypeScript validation
  - [ ] 3.3 Add comprehensive check script combining all validations
  - [ ] 3.4 Verify all scripts execute successfully

- [ ] 4. Transform Existing Codebase
  - [ ] 4.1 Run prettier --write on all TypeScript files to remove semicolons
  - [ ] 4.2 Apply ESLint auto-fixes for import sorting and TypeScript issues
  - [ ] 4.3 Manually fix any remaining linting issues
  - [ ] 4.4 Verify all tests still pass after formatting changes

- [ ] 5. Validate Complete Setup
  - [ ] 5.1 Run full test suite and ensure 100% pass rate
  - [ ] 5.2 Run TypeScript build to verify no compilation errors
  - [ ] 5.3 Verify VS Code auto-format works on file save
  - [ ] 5.4 Confirm lint command shows zero warnings/errors