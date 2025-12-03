#!/bin/bash

# This script checks for common Vercel compatibility issues
# Run this before deploying to Vercel to catch common problems

set -e

echo "🔍 Checking for Vercel compatibility issues..."

# Check for required files
echo "Checking required files..."
required_files=("next.config.js" "package.json" "package-lock.json")
for file in "${required_files[@]}"; do
  if [ ! -f "$file" ]; then
    echo "❌ Missing required file: $file"
    exit 1
  fi
done
echo "✅ All required files present"

# Check for environment variables
echo "Checking environment variables..."
if [ ! -f ".env.local" ]; then
  echo "⚠️ Warning: No .env.local file found"
else
  echo "✅ .env.local file exists"
  
  # Extract variable names from .env.local (without values)
  ENV_VARS=$(grep -v '^#' .env.local | grep '=' | cut -d '=' -f1)
  
  echo "The following environment variables need to be set in Vercel dashboard:"
  for var in $ENV_VARS; do
    echo "  - $var"
  done
fi

# Check Next.js config for common issues
echo "Checking Next.js configuration..."
if grep -q "appDir" next.config.js; then
  echo "⚠️ Warning: appDir is deprecated in Next.js 15+, might cause issues on Vercel"
fi

if grep -q "swcMinify" next.config.js; then
  echo "⚠️ Warning: swcMinify is deprecated in Next.js 15+, might cause issues on Vercel"
fi

# Check for proper API routes
echo "Checking API routes..."
if [ -d "app/api" ]; then
  # Check for async params handling
  if grep -r "context.params" --include="*.ts" --include="*.js" app/api | grep -v "await"; then
    echo "⚠️ Warning: Some API routes may be using context.params without await"
    echo "   This can cause issues in Vercel's serverless environment"
  else
    echo "✅ API routes look good"
  fi
fi

# Check for hard-coded paths
echo "Checking for hard-coded paths..."
if grep -r "/Users/" --include="*.ts" --include="*.js" --include="*.tsx" --include="*.jsx" app/; then
  echo "❌ Found hard-coded absolute paths that will break on Vercel"
else
  echo "✅ No hard-coded absolute paths found"
fi

# Verify Docker setup
echo "Checking Docker setup..."
if docker-compose config -q; then
  echo "✅ docker-compose.yml is valid"
else
  echo "❌ docker-compose.yml has errors"
fi

echo ""
echo "🚀 Pre-deployment check completed"
echo "Next steps:"
echo "1. Run './docker/vercel-preview.sh' to test production build"
echo "2. Ensure all environment variables are set in Vercel dashboard"
echo "3. Deploy to Vercel using Git integration or Vercel CLI" 