#!/bin/bash

# Start Docker development environment for FestiFind
echo "Starting FestiFind Docker development environment..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "Docker is not running. Please start Docker and try again."
  exit 1
fi

# Run docker-compose with the development configuration
docker-compose -f docker-compose-dev.yml up -d

# Show container logs in follow mode
echo "Docker containers started. Showing logs..."
docker-compose -f docker-compose-dev.yml logs -f 