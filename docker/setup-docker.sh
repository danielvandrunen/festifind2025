#!/bin/bash
set -e

echo "===== FestiFind Docker Setup ====="
echo "This script will set up Docker for FestiFind"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
  echo "Docker is not installed. Please install Docker first."
  exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
  echo "Docker daemon is not running. Please start Docker first."
  exit 1
fi

# Clean up existing containers
echo "Stopping any running FestiFind containers..."
docker-compose down 2>/dev/null || true

# Force rebuild
echo "Building Docker images from scratch..."
docker-compose build --no-cache

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
  echo "Creating .env file..."
  cat > .env << EOL
# Supabase credentials
NEXT_PUBLIC_SUPABASE_URL=https://sxdbptmmvhluyxrlzgmh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4ZGJwdG1tdmhsdXl4cmx6Z21oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU0MTYwMDUsImV4cCI6MjA2MDk5MjAwNX0.6Vigaa_cKm8QrXXd_-d88q-YgpfMrEFM3FYhKbBKy_A

# Next.js settings
NEXT_TELEMETRY_DISABLED=1
NODE_OPTIONS=--max_old_space_size=4096
EOL
  echo ".env file created"
fi

echo "===== Setup complete! ====="
echo ""
echo "To run the development server:"
echo "  docker-compose up nextjs-dev"
echo ""
echo "To run the production server:"
echo "  docker-compose up nextjs-prod"
echo ""
echo "Development server will be available at: http://localhost:3005"
echo "Production server will be available at: http://localhost:3006" 