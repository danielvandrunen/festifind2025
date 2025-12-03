#!/bin/bash

# Run the Next.js production environment in Docker
# to test the production build before deploying to Vercel

set -e

echo "🚀 Starting production environment..."
docker-compose up --build nextjs-prod 