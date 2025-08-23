#!/bin/bash

# Azure DevOps Bot PM2 Setup Script
# This script installs PM2 and configures the always-on service

set -e

echo "🚀 Setting up PM2 for Azure DevOps Bot Always-On Service"
echo "============================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo -e "${RED}❌ This script is designed for macOS. For other platforms, please install PM2 manually.${NC}"
    exit 1
fi

# Function to print status
print_status() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if Node.js is installed
print_status "Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version 18 or higher is required. Current version: $(node --version)"
    exit 1
fi
print_success "Node.js $(node --version) is installed"

# Check if tsx is available (needed for TypeScript execution)
print_status "Checking tsx availability..."
if ! command -v tsx &> /dev/null; then
    if ! npx tsx --version &> /dev/null; then
        print_error "tsx is not available. Please run 'npm install' first."
        exit 1
    fi
fi
print_success "tsx is available for TypeScript execution"

# Install PM2 globally if not already installed
print_status "Checking PM2 installation..."
if ! command -v pm2 &> /dev/null; then
    print_status "Installing PM2 globally..."
    npm install -g pm2
    print_success "PM2 installed successfully"
else
    print_success "PM2 is already installed: $(pm2 --version)"
fi

# Create logs directory
print_status "Creating logs directory..."
mkdir -p logs
print_success "Logs directory created"

# Check if ecosystem.config.js exists and validate email configuration
if [ ! -f "ecosystem.config.js" ]; then
    print_error "ecosystem.config.js not found. Please run this script from the project root directory."
    exit 1
fi

# Check for email configuration
if grep -q "YOUR_EMAIL@domain.com" ecosystem.config.js; then
    print_warning "Please update the email configuration in ecosystem.config.js"
    print_warning "Edit the 'args' field to include your actual email address(es)"
    echo ""
    echo -e "${YELLOW}Example:${NC}"
    echo "  args: '--emails=john.doe@company.com,j.doe@company.com'"
    echo ""
    read -p "Press Enter after updating the configuration..."
fi

# Install PM2 startup service
print_status "Setting up PM2 startup service for macOS..."
pm2 startup

print_warning "Please run the command shown above to enable PM2 startup on boot"
read -p "Press Enter after running the startup command..."

# Start the Azure DevOps Bot service
print_status "Starting Azure DevOps Bot service..."
pm2 start ecosystem.config.js --env production

# Save PM2 process list
print_status "Saving PM2 process list..."
pm2 save

print_success "PM2 setup complete!"
echo ""
echo "📋 Available Commands:"
echo "  pm2 start azure-devops-bot     # Start the service"
echo "  pm2 stop azure-devops-bot      # Stop the service"  
echo "  pm2 restart azure-devops-bot   # Restart the service"
echo "  pm2 reload azure-devops-bot    # Reload with zero downtime"
echo "  pm2 logs azure-devops-bot      # View live logs"
echo "  pm2 logs azure-devops-bot --lines 100  # View last 100 log lines"
echo "  pm2 status                     # Check process status"
echo "  pm2 monit                      # Launch monitoring dashboard"
echo ""
echo "📁 Log Files:"
echo "  ./logs/azure-devops-bot.log           # Combined logs"
echo "  ./logs/azure-devops-bot-out.log       # Standard output"
echo "  ./logs/azure-devops-bot-error.log     # Error logs"
echo ""
echo "🔄 Service Status:"
pm2 status

print_success "Azure DevOps Bot is now running as an always-on service!"
print_status "The service will automatically restart on crashes and start on system boot."