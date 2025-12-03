#!/bin/bash

# Stop any running containers and clean up
echo "Stopping any running containers..."
docker-compose down

# Clean up node_modules volume if it exists and has permission issues
echo "Cleaning up problematic volumes..."
docker volume rm $(docker volume ls -q -f name=festifind2025_node_modules) 2>/dev/null || true
docker volume rm $(docker volume ls -q -f name=festifind2025_.next) 2>/dev/null || true

# Get the Docker GID from the host system
DOCKER_GID=$(stat -c '%g' /var/run/docker.sock 2>/dev/null || stat -f '%g' /var/run/docker.sock)

if [ -z "$DOCKER_GID" ]; then
  echo "Warning: Could not determine Docker socket group ID. Using default (999)."
  DOCKER_GID=999
else
  echo "Using Docker socket group ID: $DOCKER_GID"
fi

# Export the Docker GID for docker-compose
export DOCKER_GID

# Make sure scraper directories exist with proper permissions
echo "Setting up scraper directories..."
mkdir -p scrapers/eblive/logs
mkdir -p scrapers/eblive/output
chmod -R 777 scrapers/eblive/logs scrapers/eblive/output

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
  echo "Creating .env file..."
  cat > .env << EOF
# Supabase credentials
NEXT_PUBLIC_SUPABASE_URL=https://sxdbptmmvhluyxrlzgmh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4ZGJwdG1tdmhsdXl4cmx6Z21oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU0MTYwMDUsImV4cCI6MjA2MDk5MjAwNX0.asGZCsnEHuxMd09FrH-bPHGhs99Z0s5RE7kIz087kkY
EOF
fi

# Build the images first with no cache to ensure clean build
echo "Building Docker images from scratch..."
docker-compose build --no-cache

# Start the services
echo "Starting services with Docker access..."
docker-compose up -d

echo "Services started. Access the web interface at http://localhost:3005"
echo "To view logs: docker-compose logs -f"

# Follow the logs to see any issues
echo "Following logs for troubleshooting (Ctrl+C to exit)..."
docker-compose logs -f 