#!/bin/bash

# This script builds and runs the Next.js app in production mode
# to simulate a Vercel-like environment for final testing

set -e

echo "🚀 Building production image to simulate Vercel deployment..."
docker build -t festifind-vercel-preview --target production .

echo "🔧 Running production preview on http://localhost:3006..."
docker run -p 3006:3000 \
  --env-file .env \
  --rm \
  --name festifind-vercel-preview \
  festifind-vercel-preview

# This container will remain running until stopped with Ctrl+C 