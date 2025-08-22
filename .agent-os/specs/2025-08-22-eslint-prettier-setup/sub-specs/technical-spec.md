# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-08-22-eslint-prettier-setup/spec.md

> Created: 2025-08-22
> Version: 1.0.0

## Technical Requirements

- **ESLint v9 flat configuration** with modern import syntax using `export default`
- **TypeScript parser integration** with project service for proper type checking
- **Perfectionist plugin** for automatic import and export sorting
- **Prettier integration** via eslint-config-prettier to prevent conflicts
- **VS Code settings** for automatic formatting and linting on save
- **Node.js and test globals** properly configured for the runtime environment
- **File ignores** for dist, build, node_modules, coverage, and other generated directories

## Approach Options

**Option A: Copy @orchestr8 configuration exactly**

- Pros: Proven configuration, consistent with existing codebase, includes perfectionist
- Cons: May include rules not needed for this smaller project

**Option B: Minimal ESLint setup with Prettier** (Selected)

- Pros: Matches @orchestr8 exactly, includes import sorting, comprehensive TypeScript rules
- Cons: None - this is the established pattern

**Rationale:** Following the exact @orchestr8 configuration ensures consistency across projects and leverages a proven setup that works well with TypeScript, Vitest, and Node.js.

## External Dependencies

- **eslint@^9.33.0** - Core linting engine with flat config support
- **prettier@3.6.2** - Code formatting engine
- **@eslint/js@^9.33.0** - JavaScript recommended rules
- **@typescript-eslint/eslint-plugin@^8.40.0** - TypeScript-specific linting rules
- **@typescript-eslint/parser@^8.40.0** - TypeScript parser for ESLint
- **eslint-config-prettier@^10.1.8** - Disables ESLint rules that conflict with Prettier
- **eslint-plugin-perfectionist@^4.15.0** - Import and export sorting

**Justification:** These exact versions match the @orchestr8 configuration and provide a complete linting and formatting solution for TypeScript projects.

## Configuration Details

### ESLint Configuration (eslint.config.js)

- Uses ESM export with flat config array
- Applies recommended JavaScript rules as baseline
- Configures TypeScript parser with project service for type-aware linting
- Sets up globals for Node.js runtime and Vitest testing environment
- Includes perfectionist for import/export sorting with natural order
- Adds TypeScript-specific rules: no-explicit-any, no-unused-vars with underscore pattern, consistent-type-imports
- Configures file ignores for build artifacts and dependencies

### Prettier Configuration (prettier.config.js)

- No semicolons (semi: false) - matches @orchestr8 style
- Single quotes (singleQuote: true) for strings
- Trailing commas (trailingComma: 'all') for cleaner diffs
- 80 character print width for readability
- 2 space indentation consistent with TypeScript
- LF line endings for Unix compatibility

### VS Code Integration (.vscode/settings.json)

- Format on save enabled with Prettier as default formatter
- ESLint auto-fix on save for import sorting and minor issues
- Flat config flag enabled for ESLint v9 compatibility

## Implementation Strategy

1. **Install Dependencies**: Add all required dev dependencies via pnpm
2. **Create Configurations**: Copy exact config files from @orchestr8 with minimal adjustments
3. **Add NPM Scripts**: Include lint, format, and check commands
4. **Format Codebase**: Run prettier on all TypeScript files
5. **Fix Linting Issues**: Apply ESLint auto-fixes for imports and TypeScript issues
6. **Validate Setup**: Ensure tests pass and build succeeds after changes
