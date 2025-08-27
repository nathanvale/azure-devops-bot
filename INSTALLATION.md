# Azure DevOps Bot Installation Guide

## Making `azure-devops-bot` Command Available

There are several ways to make the bot available as the `azure-devops-bot` command in your terminal.

## Method 1: Global Installation (Recommended for Production)

### Step 1: Build the Project

```bash
# First, build the TypeScript project
pnpm build

# Or if using npm
npm run build
```

### Step 2: Create Executable Wrapper

Create a file called `bin/azure-devops-bot` (without extension):

```bash
mkdir -p bin
cat > bin/azure-devops-bot << 'EOF'
#!/usr/bin/env node
import('../dist/src/index.js');
EOF
chmod +x bin/azure-devops-bot
```

### Step 3: Update package.json

```json
{
  "bin": {
    "azure-devops-bot": "./bin/azure-devops-bot"
  }
}
```

### Step 4: Install Globally

```bash
# From the project directory
npm link

# Or install globally from npm (if published)
npm install -g azure-devops-bot
```

### Step 5: Verify Installation

```bash
# Test the command
azure-devops-bot --help

# Check where it's installed
which azure-devops-bot
```

## Method 2: Using npx (No Installation Required)

If the package is published to npm or you're in the project directory:

```bash
# From anywhere (if published)
npx azure-devops-bot --help

# From project directory
npx . --help
```

## Method 3: Development Setup with tsx

### Step 1: Install tsx globally

```bash
npm install -g tsx
```

### Step 2: Create Development Wrapper

Create `bin/azure-devops-bot-dev`:

```bash
cat > bin/azure-devops-bot-dev << 'EOF'
#!/usr/bin/env tsx
import '../src/index.ts';
EOF
chmod +x bin/azure-devops-bot-dev
```

### Step 3: Link for Development

```bash
# Update package.json temporarily
{
  "bin": {
    "azure-devops-bot": "./bin/azure-devops-bot-dev"
  }
}

# Link it
npm link
```

## Method 4: Shell Alias (Quick Setup)

Add to your shell configuration (`~/.bashrc`, `~/.zshrc`, etc.):

```bash
# For production (compiled)
alias azure-devops-bot='node /path/to/azure-devops-bot/dist/src/index.js'

# For development (TypeScript)
alias azure-devops-bot='tsx /path/to/azure-devops-bot/src/index.ts'

# Or using npx
alias azure-devops-bot='cd /path/to/azure-devops-bot && npx tsx src/index.ts'
```

Then reload your shell:

```bash
source ~/.bashrc  # or ~/.zshrc
```

## Method 5: Direct Execution (Current Implementation)

The current setup already supports direct execution:

```bash
# Make the TypeScript file executable
chmod +x src/index.ts

# Run directly (requires tsx installed globally)
./src/index.ts --help

# Or with explicit tsx
tsx src/index.ts --help
```

## Method 6: Creating a Production Binary

For a standalone binary without Node.js dependencies:

### Using pkg (Node Packager)

```bash
# Install pkg
npm install -g pkg

# Build binaries
pkg dist/src/index.js -t node18-macos-x64 -o azure-devops-bot

# Move to PATH
sudo mv azure-devops-bot /usr/local/bin/

# Test
azure-devops-bot --help
```

## Recommended Setup for Different Use Cases

### For Development

1. Use Method 3 (tsx wrapper) or Method 4 (shell alias)
2. This allows running TypeScript directly without compilation

### For Local Production Use

1. Use Method 1 (global installation with npm link)
2. Compile TypeScript and use the JavaScript version

### For Distribution

1. Publish to npm registry
2. Users can then install with `npm install -g azure-devops-bot`

### For CI/CD

Use npx directly:
```bash
npx azure-devops-bot --quiet --format json "my work items"
```

## Troubleshooting

### Issue: "command not found"

**Solution**: Check if the command is in your PATH:
```bash
echo $PATH
npm config get prefix
# Add npm's bin directory to PATH if needed
export PATH="$(npm config get prefix)/bin:$PATH"
```

### Issue: "Permission denied"

**Solution**: Make the file executable:
```bash
chmod +x src/index.ts
chmod +x bin/azure-devops-bot
```

### Issue: "Cannot find module"

**Solution**: Ensure dependencies are installed and built:
```bash
pnpm install
pnpm build
```

### Issue: "tsx: command not found"

**Solution**: Install tsx globally:
```bash
npm install -g tsx
```

## Current Project Setup

The project is already configured with:

1. ✅ Shebang in `src/index.ts`: `#!/usr/bin/env node`
2. ✅ Bin configuration in `package.json`: `"azure-devops-bot": "./src/index.ts"`
3. ✅ TypeScript execution support

To make it work immediately:

```bash
# Option A: Link the current project
npm link

# Option B: Use npx from project directory
npx . --help

# Option C: Direct execution
chmod +x src/index.ts
./src/index.ts --help
```

## Environment Setup

Regardless of installation method, ensure your environment is configured:

```bash
# Create .env file or export variables
export AZURE_DEVOPS_USER_EMAILS="your.email@company.com"
export AZURE_DEVOPS_PAT="your-personal-access-token"

# Test the command
azure-devops-bot --help
azure-devops-bot --quiet "my work items"
```

## PM2 Integration

For always-on service with PM2:

```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
pm2 start ecosystem.config.js

# Or create a custom PM2 config for the CLI
pm2 start azure-devops-bot -- --quiet "sync"
```

---

Choose the method that best fits your use case. For most users, Method 1 (global installation) or Method 4 (shell alias) provides the best balance of convenience and functionality.