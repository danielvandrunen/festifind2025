#!/bin/bash

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Set default values
DEPLOY_TARGET="vercel"
BUILD_ONLY=false
DRY_RUN=false

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

# Function to display script usage
show_usage() {
  echo "Usage: $0 [OPTIONS]"
  echo
  echo "Options:"
  echo "  --target TARGET      Deploy target (vercel, docker) [default: vercel]"
  echo "  --build-only         Build only, don't deploy"
  echo "  --dry-run            Show what would be done without making changes"
  echo "  -h, --help           Show this help message"
  echo
  exit 1
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)
      DEPLOY_TARGET="$2"
      shift 2
      ;;
    --build-only)
      BUILD_ONLY=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    -h|--help)
      show_usage
      ;;
    *)
      error "Unknown option: $1"
      show_usage
      ;;
  esac
done

# Validate deploy target
if [[ "$DEPLOY_TARGET" != "vercel" && "$DEPLOY_TARGET" != "docker" ]]; then
  error "Invalid deploy target: $DEPLOY_TARGET. Supported targets are 'vercel' or 'docker'."
  show_usage
fi

# Function to deploy to Vercel
deploy_to_vercel() {
  info "Preparing for Vercel deployment..."
  
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
  if [[ "$DRY_RUN" = true ]]; then
    info "[DRY RUN] Would run: npm run build"
    BUILD_STATUS=0
  else
    npm run build
    BUILD_STATUS=$?
  fi
  
  if [[ $BUILD_STATUS -ne 0 ]]; then
    error "Build failed. Please fix the errors before deploying."
    
    # Restore original config if needed
    if [[ "$NEEDS_RESTORE" = true ]]; then
      info "Restoring original next.config.js..."
      mv next.config.js.backup next.config.js
    fi
    
    exit 1
  fi
  
  # If build-only flag is set, stop here
  if [[ "$BUILD_ONLY" = true ]]; then
    success "Build completed successfully."
    
    # Restore original config if needed
    if [[ "$NEEDS_RESTORE" = true ]]; then
      info "Restoring original next.config.js..."
      mv next.config.js.backup next.config.js
    fi
    
    exit 0
  fi
  
  # Deploy to Vercel
  info "Deploying to Vercel..."
  if [[ "$DRY_RUN" = true ]]; then
    info "[DRY RUN] Would run: vercel deploy --prod"
    DEPLOY_STATUS=0
  else
    vercel deploy --prod
    DEPLOY_STATUS=$?
  fi
  
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
}

# Function to deploy to Docker
deploy_to_docker() {
  info "Preparing for Docker deployment..."
  
  # Check if Docker is installed
  if ! command -v docker &> /dev/null; then
    error "Docker is not installed. Please install Docker first."
    exit 1
  fi
  
  # Check if docker-compose is installed
  if ! command -v docker-compose &> /dev/null; then
    error "docker-compose is not installed. Please install docker-compose first."
    exit 1
  fi
  
  # Check for .env.local file
  if [[ ! -f ".env.local" ]]; then
    warning "No .env.local file found. Creating a sample file..."
    
    if [[ "$DRY_RUN" = false ]]; then
      echo "NEXT_PUBLIC_SUPABASE_URL=your-supabase-url" > .env.local
      echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key" >> .env.local
      warning "Please edit .env.local with your actual Supabase credentials."
    else
      info "[DRY RUN] Would create a sample .env.local file"
    fi
  fi
  
  # Build Docker image
  info "Building Docker image..."
  if [[ "$DRY_RUN" = true ]]; then
    info "[DRY RUN] Would run: docker-compose build"
    BUILD_STATUS=0
  else
    docker-compose build
    BUILD_STATUS=$?
  fi
  
  if [[ $BUILD_STATUS -ne 0 ]]; then
    error "Docker build failed with status code $BUILD_STATUS"
    exit 1
  fi
  
  # If build-only flag is set, stop here
  if [[ "$BUILD_ONLY" = true ]]; then
    success "Docker build completed successfully."
    exit 0
  fi
  
  # Start Docker containers
  info "Starting Docker containers..."
  if [[ "$DRY_RUN" = true ]]; then
    info "[DRY RUN] Would run: docker-compose up -d"
    DEPLOY_STATUS=0
  else
    docker-compose up -d
    DEPLOY_STATUS=$?
  fi
  
  if [[ $DEPLOY_STATUS -eq 0 ]]; then
    success "Docker deployment completed successfully!"
    info "Your application is now running in Docker containers."
    info "To view logs: docker-compose logs -f"
    info "To stop: docker-compose down"
  else
    error "Docker deployment failed with status code $DEPLOY_STATUS"
    exit $DEPLOY_STATUS
  fi
}

# Main execution
main() {
  info "Starting deployment process for target: $DEPLOY_TARGET"
  
  if [[ "$DRY_RUN" = true ]]; then
    warning "Running in DRY RUN mode. No actual changes will be made."
  fi
  
  if [[ "$BUILD_ONLY" = true ]]; then
    info "Build-only mode activated. Will not deploy after building."
  fi
  
  case "$DEPLOY_TARGET" in
    vercel)
      deploy_to_vercel
      ;;
    docker)
      deploy_to_docker
      ;;
  esac
}

# Execute main function
main 