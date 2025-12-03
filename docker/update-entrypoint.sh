#!/bin/bash
cat > docker/entrypoint.sh << 'EOL'
#!/bin/sh
set -e

# Create .env file if it doesn't exist
if [ ! -f /app/.env ]; then
  echo "Creating .env file..."
  cat > /app/.env << EOENV
# Supabase credentials
NEXT_PUBLIC_SUPABASE_URL=https://sxdbptmmvhluyxrlzgmh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4ZGJwdG1tdmhsdXl4cmx6Z21oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU0MTYwMDUsImV4cCI6MjA2MDk5MjAwNX0.6Vigaa_cKm8QrXXd_-d88q-YgpfMrEFM3FYhKbBKy_A

# Node environment
NODE_ENV=${NODE_ENV:-development}

# Next.js settings
NEXT_TELEMETRY_DISABLED=1
NODE_OPTIONS=--max_old_space_size=4096
EOENV
fi

# Ensure environment variables are exported
export NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL:-https://sxdbptmmvhluyxrlzgmh.supabase.co}
export NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4ZGJwdG1tdmhsdXl4cmx6Z21oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU0MTYwMDUsImV4cCI6MjA2MDk5MjAwNX0.6Vigaa_cKm8QrXXd_-d88q-YgpfMrEFM3FYhKbBKy_A}
export NEXT_TELEMETRY_DISABLED=1
export NODE_OPTIONS=--max_old_space_size=4096

# Print environment variables for debugging
echo "=== Environment variables ==="
echo "NEXT_PUBLIC_SUPABASE_URL: ${NEXT_PUBLIC_SUPABASE_URL}"
echo "NEXT_PUBLIC_SUPABASE_ANON_KEY: ${NEXT_PUBLIC_SUPABASE_ANON_KEY:0:10}... (masked)"
echo "NODE_ENV: ${NODE_ENV}"
echo "==========================="

# Ensure browsers are available
if [ ! -f /usr/bin/chromium-browser ]; then
  echo "Installing Chromium browser..."
  apk add --no-cache chromium
fi

# Create playwright config
mkdir -p /app/playwright
cat > /app/playwright.config.js << EOPLAY
/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  use: {
    // Use the pre-installed browsers
    executablePath: '/usr/bin/chromium-browser',
    channel: 'chrome',
  },
};
module.exports = config;
EOPLAY

# Fix JavaScript module issues
if [ -f /app/docker/fix-js-modules.sh ]; then
  echo "Running JavaScript module fix script..."
  sh /app/docker/fix-js-modules.sh
fi

# Clean the .next directory to ensure a fresh build
echo "Cleaning Next.js build cache..."
rm -rf /app/.next

# If this is a development environment, install Playwright browsers
if [ "$NODE_ENV" = "development" ]; then
  echo "Setting up development environment..."
  
  # Set PLAYWRIGHT_BROWSERS_PATH explicitly
  export PLAYWRIGHT_BROWSERS_PATH=/usr/bin
  export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
  export CHROME_BIN=/usr/bin/chromium-browser
fi

echo "Environment setup complete. Starting application..."

# Run the command provided to the docker container
exec "$@"
EOL

chmod +x docker/entrypoint.sh
echo "Updated entrypoint.sh" 