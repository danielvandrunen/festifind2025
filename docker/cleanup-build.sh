#!/bin/sh
set -e

echo "=== Cleaning up Next.js build ==="

# Remove the .next directory completely
rm -rf /app/.next

# Remove node_modules/.cache
rm -rf /app/node_modules/.cache

# Force clean install of dependencies if needed
if [ "$1" = "--force" ]; then
  echo "Forcing clean install of dependencies..."
  rm -rf /app/node_modules
  npm install --legacy-peer-deps
fi

# Create necessary directories
mkdir -p /app/.next/cache
mkdir -p /app/.next/server
mkdir -p /app/.next/static

# Set correct permissions
chmod -R 755 /app/.next

echo "=== Cleanup complete ===" 