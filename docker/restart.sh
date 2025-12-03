#!/bin/bash
set -e

echo "===== FestiFind Docker Restart Script ====="
echo "This script will rebuild and restart the Docker containers"

# Stop any running containers
echo "Stopping any running containers..."
docker-compose down

# Remove containers, volumes, and images
echo "Removing containers, networks, volumes, and images..."
docker-compose rm -f
docker system prune -f --volumes

# Clean .next directory
echo "Cleaning Next.js build directory..."
rm -rf .next

# Force rebuild images
echo "Building images from scratch..."
docker-compose build --no-cache

# Run development container
echo "Starting development container..."
docker-compose up nextjs-dev

echo "===== Restart complete! =====" 