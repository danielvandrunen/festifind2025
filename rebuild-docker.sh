#!/bin/bash
set -e

echo "===== Rebuilding FestiFind Docker Environment ====="

# 1. Stop any running containers
echo "Stopping any running containers..."
docker-compose down

# 2. Remove conflicting Docker resources
echo "Removing Docker resources..."
docker system prune -f --volumes

# 3. Create .env file if it doesn't exist
if [ ! -f .env ]; then
  echo "Creating .env file..."
  cat > .env << EOL
# Supabase credentials
NEXT_PUBLIC_SUPABASE_URL=https://sxdbptmmvhluyxrlzgmh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4ZGJwdG1tdmhsdXl4cmx6Z21oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU0MTYwMDUsImV4cCI6MjA2MDk5MjAwNX0.6Vigaa_cKm8QrXXd_-d88q-YgpfMrEFM3FYhKbBKy_A

# Node environment
NODE_ENV=development

# Next.js settings
NEXT_TELEMETRY_DISABLED=1
NODE_OPTIONS=--max_old_space_size=4096

# Playwright settings
PLAYWRIGHT_BROWSERS_PATH=/usr/bin
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
CHROME_BIN=/usr/bin/chromium-browser
EOL
else
  echo ".env file exists, using existing file"
fi

# 4. Fix JavaScript module format issues
echo "Fixing module format issues..."
./fix-modules.sh

# 5. Ensure scripts are executable
echo "Making scripts executable..."
chmod +x ./docker/entrypoint.sh ./docker/fix-js-modules.sh ./docker/cleanup-build.sh 2>/dev/null || true
chmod +x ./fix-modules.sh 2>/dev/null || true

# 6. Clean build caches
echo "Cleaning build caches..."
rm -rf .next
rm -rf node_modules/.cache

# 7. Rebuild Docker containers
echo "Rebuilding Docker containers..."
docker-compose build --no-cache

# 8. Start development container
echo "Starting development container..."
docker-compose up -d nextjs-dev

echo "===== Rebuild complete! ====="
echo "Access the application at: http://localhost:3005"
echo "View logs with: docker-compose logs -f nextjs-dev" 