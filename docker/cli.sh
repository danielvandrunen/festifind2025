#!/bin/bash

# FestiFind Docker CLI Tool
# Unified interface for Docker operations

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions for colored output
print_info() {
  echo -e "${BLUE}INFO:${NC} $1"
}

print_success() {
  echo -e "${GREEN}SUCCESS:${NC} $1"
}

print_error() {
  echo -e "${RED}ERROR:${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}WARNING:${NC} $1"
}

# Help function
show_help() {
  echo "FestiFind Docker CLI Tool"
  echo ""
  echo "Usage: $0 COMMAND [OPTIONS]"
  echo ""
  echo "Available commands:"
  echo "  dev      Start the development environment"
  echo "  prod     Build and start the production environment"
  echo "  build    Build the Docker images"
  echo "  stop     Stop all running containers"
  echo "  logs     View container logs"
  echo "  test     Run tests in Docker"
  echo "  clean    Clean Docker resources (images, containers)"
  echo "  deploy   Deploy the application"
  echo "  help     Show this help message"
  echo ""
  echo "Examples:"
  echo "  $0 dev       # Start development environment"
  echo "  $0 test      # Run tests"
  echo "  $0 logs      # View logs"
  echo "  $0 clean     # Clean up Docker resources"
}

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Change to project directory
cd "$PROJECT_DIR"

# Check if Docker is running
check_docker() {
  if ! docker info >/dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
  fi
}

# Main command handling
case "${1:-help}" in
  "dev")
    print_info "Starting development environment..."
    check_docker
    # Check for .env.local
    if [ ! -f ".env.local" ]; then
      print_warning ".env.local not found. Creating from .env.example..."
      if [ -f ".env.example" ]; then
        cp .env.example .env.local
        print_info "Please update .env.local with your Supabase credentials"
      fi
    fi
    # Set environment variables for docker-compose
    export NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-$(grep NEXT_PUBLIC_SUPABASE_URL .env.local 2>/dev/null | cut -d'=' -f2)}"
    export NEXT_PUBLIC_SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-$(grep NEXT_PUBLIC_SUPABASE_ANON_KEY .env.local 2>/dev/null | cut -d'=' -f2)}"
    docker-compose -f docker/docker-compose.yml up --build web
    ;;
    
  "prod")
    print_info "Starting production environment..."
    check_docker
    # Build production image
    docker-compose -f docker/docker-compose.yml build web
    docker-compose -f docker/docker-compose.yml up web
    ;;
    
  "build")
    print_info "Building Docker images..."
    check_docker
    docker-compose -f docker/docker-compose.yml build
    print_success "Build completed"
    ;;
    
  "stop")
    print_info "Stopping all containers..."
    docker-compose -f docker/docker-compose.yml down
    print_success "All containers stopped"
    ;;
    
  "logs")
    print_info "Viewing container logs..."
    docker-compose -f docker/docker-compose.yml logs -f
    ;;
    
  "test")
    print_info "Running tests in Docker..."
    check_docker
    
    # Set environment variables for docker-compose
    export NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-$(grep NEXT_PUBLIC_SUPABASE_URL .env.local 2>/dev/null | cut -d'=' -f2)}"
    export NEXT_PUBLIC_SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-$(grep NEXT_PUBLIC_SUPABASE_ANON_KEY .env.local 2>/dev/null | cut -d'=' -f2)}"
    
    # Build test image if it doesn't exist
    docker-compose -f docker/docker-compose.yml build web
    
    # Run tests
    print_info "Running lint and build tests..."
    docker-compose -f docker/docker-compose.yml run --rm web npm test
    
    # Test API endpoints if the server is running
    print_info "Testing API endpoints..."
    docker-compose -f docker/docker-compose.yml up -d web
    sleep 10  # Wait for server to start
    
    # Basic health check
    if curl -f http://localhost:3003/api/health >/dev/null 2>&1; then
      print_success "API health check passed"
    else
      print_warning "API health check failed (endpoint may not exist)"
    fi
    
    # Test Chrome extension API endpoints
    print_info "Testing Chrome extension API..."
    if curl -f -H "X-API-Key: test" http://localhost:3003/api/auth/extension >/dev/null 2>&1; then
      print_success "Chrome extension auth API accessible"
    else
      print_warning "Chrome extension auth API test failed"
    fi
    
    docker-compose -f docker/docker-compose.yml down
    print_success "Tests completed"
    ;;
    
  "clean")
    print_info "Cleaning Docker resources..."
    
    # Stop containers
    docker-compose -f docker/docker-compose.yml down --remove-orphans
    
    # Remove unused containers
    docker container prune -f
    
    # Remove unused images
    docker image prune -f
    
    # Remove unused volumes
    docker volume prune -f
    
    # Remove unused networks
    docker network prune -f
    
    print_success "Docker cleanup completed"
    ;;
    
  "deploy")
    print_info "Running deployment script..."
    if [ -f "docker/deploy.sh" ]; then
      ./docker/deploy.sh "$@"
    else
      print_error "Deploy script not found"
      exit 1
    fi
    ;;
    
  "help"|"-h"|"--help")
    show_help
    ;;
    
  *)
    print_error "Unknown command: $1"
    echo ""
    show_help
    exit 1
    ;;
esac 