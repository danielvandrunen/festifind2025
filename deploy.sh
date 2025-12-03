#!/bin/bash
set -e

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

# Check if version tag is provided
if [ -z "$1" ]; then
  print_error "Please provide a version tag to deploy (e.g., v1.0.0)"
  echo "Usage: ./deploy.sh v1.0.0"
  exit 1
fi

VERSION=$1

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
  print_error "Vercel CLI is not installed. Installing it now..."
  npm install -g vercel
fi

# Check if the tag exists
if ! git show-ref --tags | grep -q "refs/tags/$VERSION"; then
  print_error "Tag $VERSION does not exist in the repository."
  exit 1
fi

print_info "Preparing to deploy version $VERSION to Vercel..."

# Create a temporary directory for the deployment
TEMP_DIR=$(mktemp -d)
print_info "Created temporary directory at $TEMP_DIR"

# Checkout the specified tag into the temporary directory
print_info "Checking out tag $VERSION..."
git archive --format=tar --prefix=deploy/ "$VERSION" | tar -xf - -C "$TEMP_DIR"

# Move to the deployment directory
cd "$TEMP_DIR/deploy"

# Create necessary configuration files for Vercel
print_info "Creating Vercel configuration..."
cat > vercel.json << EOF
{
  "version": 2,
  "buildCommand": "npm run build",
  "installCommand": "npm install --legacy-peer-deps",
  "framework": "nextjs",
  "env": {
    "NEXT_PUBLIC_SUPABASE_URL": "https://sxdbptmmvhluyxrlzgmh.supabase.co",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4ZGJwdG1tdmhsdXl4cmx6Z21oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU0MTYwMDUsImV4cCI6MjA2MDk5MjAwNX0.asGZCsnEHuxMd09FrH-bPHGhs99Z0s5RE7kIz087kkY",
    "NEXT_TELEMETRY_DISABLED": "1"
  }
}
EOF

# Create a simplified next.config.js for Vercel
print_info "Creating optimized next.config.js for Vercel..."
cat > next.config.js << EOF
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    forceSwcTransforms: true,
  }
};

export default nextConfig;
EOF

# Create a .env file for local build verification
print_info "Creating environment files..."
cat > .env << EOF
NEXT_PUBLIC_SUPABASE_URL=https://sxdbptmmvhluyxrlzgmh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4ZGJwdG1tdmhsdXl4cmx6Z21oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU0MTYwMDUsImV4cCI6MjA2MDk5MjAwNX0.asGZCsnEHuxMd09FrH-bPHGhs99Z0s5RE7kIz087kkY
NEXT_TELEMETRY_DISABLED=1
EOF

# Copy to .env.local for next.js to pick up during build
cp .env .env.local

# Install dependencies
print_info "Installing dependencies..."
npm install --legacy-peer-deps

# Run a test build to verify everything works
print_info "Testing the build locally before deployment..."
npm run build

# Ask for confirmation before deploying
print_info "Build successful! Ready to deploy to Vercel."
read -p "Do you want to proceed with the deployment? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  print_info "Deployment cancelled."
  exit 0
fi

# Deploy to Vercel
print_info "Deploying to Vercel..."
vercel deploy --prod

# Clean up
print_info "Cleaning up temporary directory..."
cd - > /dev/null
rm -rf "$TEMP_DIR"

print_success "Deployment of version $VERSION to Vercel complete!" 