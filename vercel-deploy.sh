#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Functions for colored output
print_info() {
  echo -e "${YELLOW}INFO:${NC} $1"
}

print_success() {
  echo -e "${GREEN}SUCCESS:${NC} $1"
}

print_error() {
  echo -e "${RED}ERROR:${NC} $1"
}

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
  print_error "Vercel CLI is not installed. Please install it with 'npm install -g vercel'"
  exit 1
fi

# Make sure we're in the project root
if [ ! -f "package.json" ]; then
  print_error "package.json not found. Please run this script from the project root."
  exit 1
fi

# Check for uncommitted changes
if [[ -n $(git status --porcelain) ]]; then
  print_info "You have uncommitted changes. Consider committing them before deploying."
  read -p "Continue anyway? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_info "Deployment cancelled."
    exit 0
  fi
fi

# Create a temporary directory for the deployment
print_info "Creating a temporary deployment directory..."
TEMP_DIR=$(mktemp -d)
mkdir -p $TEMP_DIR

# Copy project files to the temporary directory
print_info "Copying project files..."
rsync -av --exclude='node_modules' --exclude='.git' --exclude='.next' --exclude='out' --exclude='tmp_*' . $TEMP_DIR/

# Create a simplified next.config.js that works on Vercel (ES Module format)
print_info "Creating a simplified next.config.js for Vercel..."
cat > $TEMP_DIR/next.config.js << EOF
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  }
}

export default nextConfig
EOF

# Create a .env.local file with the environment variables
print_info "Creating environment variables file..."
cat > $TEMP_DIR/.env.local << EOF
NEXT_PUBLIC_SUPABASE_URL=https://sxdbptmmvhluyxrlzgmh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4ZGJwdG1tdmhsdXl4cmx6Z21oIiwicm9sZSI6ImFub24iLCJpYXQiOjE2MTYxODMyOTEsImV4cCI6MTkzMTc1OTI5MX0.xZnyf5iqVRnfzbp5a0bDFCWDQ66Vfdbi1pZG7yhL5VU

# Perplexity AI Configuration
PERPLEXITY_API_KEY=YOUR_PERPLEXITY_API_KEY
PPLX_API_KEY=YOUR_PERPLEXITY_API_KEY

# API Service Configuration
PERPLEXITY_SERVICE_API_KEY=festifind-perplexity-service-2025
EOF

# Copy the same to .env.production
cp $TEMP_DIR/.env.local $TEMP_DIR/.env.production

# API routes are already correctly formatted for Next.js 15
print_info "API routes are already using correct Next.js 15 format - skipping fixes..."

# Change to the temporary directory
cd $TEMP_DIR

# Install dependencies
print_info "Installing dependencies..."
npm install

# Run a test build to make sure everything compiles
print_info "Testing the build before deployment..."
npm run build

if [ $? -ne 0 ]; then
  print_error "Build failed! Please check the errors above and fix them before deploying."
  cd - > /dev/null
  exit 1
fi

print_success "Test build successful!"

# Deploy to Vercel
print_info "Deploying to Vercel..."
vercel deploy --prod --yes

# Cleanup
print_info "Cleaning up temporary files..."
cd - > /dev/null
rm -rf $TEMP_DIR

print_success "Deployment process completed!" 