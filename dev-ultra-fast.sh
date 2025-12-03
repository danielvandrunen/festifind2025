#!/bin/bash
set -e

echo "===== 🚀 ULTRA-FAST Development Mode ====="
echo "⚠️  Warning: Minimal safety checks for maximum speed"

# Enable all Docker optimizations
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1
export BUILDKIT_PROGRESS=plain

# Quick port cleanup
pkill -f ":3005" 2>/dev/null || true

# Start without rebuild check (assumes image exists)
echo "⚡ Starting container with existing image..."
docker compose -f docker-compose.dev.yml up -d nextjs-dev 2>/dev/null || {
    echo "📦 No existing image found, building..."
    docker compose -f docker-compose.dev.yml build --parallel --build-arg BUILDKIT_INLINE_CACHE=1
    docker compose -f docker-compose.dev.yml up -d nextjs-dev
}

# Minimal health check
echo "⏳ Quick health check..."
for i in {1..10}; do
    if curl -sf http://localhost:3005 > /dev/null 2>&1; then
        echo "✅ Ready in ${i}s!"
        echo "🌐 http://localhost:3005"
        exit 0
    fi
    sleep 1
done

echo "⚠️  Taking longer than expected, check logs:"
docker compose -f docker-compose.dev.yml logs --tail=10 nextjs-dev 