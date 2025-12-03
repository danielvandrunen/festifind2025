#!/bin/bash

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print a green success message
success() {
  echo -e "${GREEN}✓ $1${NC}"
}

# Print a yellow warning message
warning() {
  echo -e "${YELLOW}⚠ $1${NC}"
}

# Print a red error message
error() {
  echo -e "${RED}✗ $1${NC}"
}

# Print a blue info message
info() {
  echo -e "${BLUE}ℹ $1${NC}"
}

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
  error "Vercel CLI is not installed. Please install it with 'npm install -g vercel'"
  exit 1
fi

# Check for uncommitted changes
if [[ -n $(git status --porcelain) ]]; then
  warning "There are uncommitted changes in the repository."
  read -p "Do you want to proceed with deployment anyway? (y/n): " PROCEED
  
  if [[ ! "$PROCEED" =~ ^[Yy]$ ]]; then
    error "Deployment aborted. Commit your changes first."
    exit 1
  fi
fi

# Save original next.config.js content
if [[ -f "next.config.js" ]]; then
  info "Checking next.config.js for API compatibility..."
  cp next.config.js next.config.js.backup
  NEEDS_RESTORE=true
  
  # Check if output: 'export' is present and remove it for deployment
  if grep -q "output: *['\"]export['\"]" next.config.js || grep -q "output: *process.env" next.config.js; then
    info "Temporarily modifying next.config.js to support API routes..."
    # Remove output: 'export' setting to enable API routes
    sed -i '' -e '/output:/d' next.config.js
    success "Configuration updated for deployment"
  fi
else
  NEEDS_RESTORE=false
fi

# Run a local build check
info "Running a build check before deployment..."
npm run build

if [[ $? -ne 0 ]]; then
  error "Build failed. Please fix the errors before deploying."
  
  # Restore original config if needed
  if [[ "$NEEDS_RESTORE" = true ]]; then
    info "Restoring original next.config.js..."
    mv next.config.js.backup next.config.js
  fi
  
  exit 1
fi

# Deploy to Vercel
info "Deploying to Vercel..."
vercel deploy --prod

DEPLOY_STATUS=$?

# Restore original config if needed
if [[ "$NEEDS_RESTORE" = true ]]; then
  info "Restoring original next.config.js..."
  mv next.config.js.backup next.config.js
fi

if [[ $DEPLOY_STATUS -eq 0 ]]; then
  success "Deployment completed successfully!"
else
  error "Deployment failed with status code $DEPLOY_STATUS"
  exit $DEPLOY_STATUS
fi 