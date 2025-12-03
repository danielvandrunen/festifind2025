#!/bin/bash
set -e

echo "===== ⚡ Ultra-Fast FestiFind Development Startup ====="

# Enable Docker BuildKit for faster builds
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Kill any process using port 3005 more efficiently
echo "🧹 Clearing port 3005..."
pkill -f ":3005" 2>/dev/null || true

# Stop any running containers (but don't remove them)
echo "🛑 Stopping existing containers..."
docker compose -f docker-compose.dev.yml down --remove-orphans

# Enhanced rebuild detection with more file types
REBUILD_NEEDED=false
CACHE_FILE=".docker-dev-hash"

# Check if critical files changed
if [ ! -f "$CACHE_FILE" ]; then
    REBUILD_NEEDED=true
    echo "📝 First time build - creating cache"
else
    # Include more files in the hash check
    NEW_HASH=$(find . -name "Dockerfile.dev" -o -name "package*.json" -o -name "docker-compose.dev.yml" -o -name "tsconfig.json" | \
               xargs md5sum 2>/dev/null | md5sum)
    OLD_HASH=$(cat "$CACHE_FILE" 2>/dev/null || echo "")
    
    if [ "$NEW_HASH" != "$OLD_HASH" ]; then
        REBUILD_NEEDED=true
        echo "📝 Configuration changes detected"
    fi
fi

if [ "$REBUILD_NEEDED" = true ]; then
    echo "🔨 Building optimized Docker image..."
    
    # Build with all optimizations enabled
    docker compose -f docker-compose.dev.yml build \
        --parallel \
        --build-arg BUILDKIT_INLINE_CACHE=1
    
    # Store new hash
    find . -name "Dockerfile.dev" -o -name "package*.json" -o -name "docker-compose.dev.yml" -o -name "tsconfig.json" | \
    xargs md5sum 2>/dev/null | md5sum > "$CACHE_FILE"
    
    echo "✅ Build completed and cached"
else
    echo "⚡ Using cached image - no rebuild needed"
fi

# Start development container
echo "🚀 Starting development container..."
docker compose -f docker-compose.dev.yml up -d nextjs-dev

# Optimized health check with shorter intervals
echo "⏳ Waiting for application to start..."
timeout=30  # Reduced from 60
counter=0
check_interval=1  # Check every second instead of every 2 seconds

while [ $counter -lt $timeout ]; do
    # Use Docker's built-in health check first
    if docker compose -f docker-compose.dev.yml ps nextjs-dev | grep -q "healthy"; then
        echo "✅ Application is ready!"
        break
    fi
    
    # Fallback to manual check
    if curl -sf http://localhost:3005 > /dev/null 2>&1; then
        echo "✅ Application is ready!"
        break
    fi
    
    # Show progress dots
    if [ $((counter % 5)) -eq 0 ] && [ $counter -gt 0 ]; then
        echo -n "."
    fi
    
    # Show logs if taking too long
    if [ $counter -eq 15 ]; then
        echo ""
        echo "📋 Still starting... checking logs:"
        docker compose -f docker-compose.dev.yml logs --tail=5 nextjs-dev
    fi
    
    sleep $check_interval
    counter=$((counter + check_interval))
done

echo ""

if [ $counter -ge $timeout ]; then
    echo "❌ Application failed to start within $timeout seconds"
    echo "📋 Full logs:"
    docker compose -f docker-compose.dev.yml logs nextjs-dev
    exit 1
fi

# Success output with timing
echo ""
echo "🎉 FestiFind is running in ${counter}s!"
echo "📱 Web App:      http://localhost:3005"
echo "🔧 Extension Feed: http://localhost:3005/extension-feed"
echo ""
echo "📋 Useful commands:"
echo "   View logs:    docker compose -f docker-compose.dev.yml logs -f nextjs-dev"
echo "   Stop:         docker compose -f docker-compose.dev.yml down"
echo "   Restart:      docker compose -f docker-compose.dev.yml restart nextjs-dev"
echo "   Rebuild:      rm $CACHE_FILE && ./dev-fast.sh"
echo "" 