#!/bin/bash
set -e

echo "==== Starting FestiFind Simple Development Environment ===="

# Stop existing containers
docker-compose -f docker-compose.simple.yml down

# Clean up volumes
docker volume rm node_modules next_cache 2>/dev/null || true

# Install babel runtime locally
npm install --save @babel/runtime || true

# Build and start the container
docker-compose -f docker-compose.simple.yml up --build

echo "==== Development environment stopped ====" 