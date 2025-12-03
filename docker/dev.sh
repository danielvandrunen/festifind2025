#!/bin/bash

# Run the Next.js development server in Docker
# with hot reloading and all dev features

set -e

echo "🛠️  Starting development environment..."
docker-compose up --build nextjs-dev 