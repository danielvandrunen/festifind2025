#!/bin/bash
set -e

echo "🎯 FestiFind Smart Development Launcher"
echo "📋 Implementing escalation system from cursor rules..."

# Function to check if Docker is available
check_docker() {
    docker info > /dev/null 2>&1
}

# Function to check if port is available
check_port() {
    ! lsof -ti:$1 > /dev/null 2>&1
}

# Function to test if service is responding
test_service() {
    local port=$1
    local max_attempts=${2:-10}
    
    for i in $(seq 1 $max_attempts); do
        if curl -sf http://localhost:$port > /dev/null 2>&1; then
            echo "✅ Service responding on port $port"
            return 0
        fi
        sleep 1
    done
    return 1
}

echo ""
echo "🔍 Checking system status..."

# Check Docker availability
if check_docker; then
    echo "✅ Docker daemon is running"
    DOCKER_AVAILABLE=true
else
    echo "❌ Docker daemon not available"
    DOCKER_AVAILABLE=false
fi

# Check if we have existing containers
if [ "$DOCKER_AVAILABLE" = true ]; then
    if docker compose -f docker-compose.dev.yml ps | grep -q "Up"; then
        echo "📦 Existing Docker containers found"
        CONTAINERS_EXIST=true
    else
        echo "📦 No running Docker containers"
        CONTAINERS_EXIST=false
    fi
fi

echo ""

# Escalation logic based on cursor rules
if [ "$DOCKER_AVAILABLE" = true ]; then
    echo "🚀 LEVEL 1: Attempting ultra-fast Docker startup..."
    if ./dev-ultra-fast.sh; then
        echo "🎉 Level 1 successful! Ready for rapid development."
        exit 0
    fi
    
    echo ""
    echo "⬆️  LEVEL 2: Attempting standard Docker startup..."
    if ./dev-fast.sh; then
        echo "🎉 Level 2 successful! Standard development environment ready."
        exit 0
    fi
    
    echo ""
    echo "⬆️  LEVEL 3: Attempting full Docker rebuild..."
    if rm .docker-dev-hash 2>/dev/null && ./dev-fast.sh; then
        echo "🎉 Level 3 successful! Fresh Docker environment ready."
        exit 0
    fi
    
    echo ""
    echo "⚠️  Docker levels failed, escalating to native development..."
fi

echo "⬆️  LEVEL 4: Starting native development (fallback)..."
echo "⚠️  WARNING: Results may differ from production environment"

# Kill any existing processes on port 3000
pkill -f ":3000" 2>/dev/null || true

# Start native development
npm run dev &
NPM_PID=$!

echo "⏳ Waiting for native development server..."
if test_service 3000 15; then
    echo ""
    echo "🎉 Level 4 successful! Native development ready."
    echo "🌐 Application: http://localhost:3000"
    echo "⚠️  Remember: This is fallback mode, test in Docker before deployment"
    echo ""
    echo "💡 To stop: kill $NPM_PID or Ctrl+C"
    wait $NPM_PID
else
    echo "❌ All escalation levels failed!"
    echo "🔧 Try manual debugging:"
    echo "   - Check Node.js installation: node --version"
    echo "   - Check dependencies: npm install"
    echo "   - Check for port conflicts: lsof -ti:3000"
    exit 1
fi 