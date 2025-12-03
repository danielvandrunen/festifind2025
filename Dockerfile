FROM node:18-slim AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Install dependencies for Playwright browsers
RUN apt-get update && apt-get install -y libc6-dev chromium firefox-esr wget curl && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PLAYWRIGHT_BROWSERS_PATH=/usr/bin

# Copy package files
COPY package.json package-lock.json* ./

# Create custom next.config.js that forces SWC usage
RUN echo "/** @type {import('next').NextConfig} */\nconst nextConfig = {\n  experimental: {\n    forceSwcTransforms: true,\n  },\n  reactStrictMode: true,\n  swcMinify: true,\n};\n\nexport default nextConfig;" > next.config.js

RUN npm ci --legacy-peer-deps

# Development environment
FROM base AS development
WORKDIR /app

# Install Docker CLI and Docker Compose (for controlling the host Docker daemon)
RUN apt-get update && \
    apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release && \
    mkdir -p /etc/apt/keyrings && \
    curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null && \
    apt-get update && \
    apt-get install -y docker-ce-cli && \
    curl -L "https://github.com/docker/compose/releases/download/v2.23.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose && \
    chmod +x /usr/local/bin/docker-compose && \
    ln -s /usr/local/bin/docker-compose /usr/bin/docker-compose && \
    rm -rf /var/lib/apt/lists/*

# Set environment variables
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max_old_space_size=4096"
ENV PLAYWRIGHT_BROWSERS_PATH=/usr/bin
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV CHROME_BIN=/usr/bin/chromium-browser

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/next.config.js ./next.config.js

# Set up for ES modules and other build tools
COPY .eslintrc* tsconfig* prettier* ./
COPY docker ./docker

# Make scripts executable
RUN chmod +x /app/docker/entrypoint.sh /app/docker/fix-js-modules.sh /app/docker/cleanup-build.sh

# Copy application code (but explicitly delete any .babelrc)
COPY . .
RUN rm -f /app/.babelrc

# Force type:module in package.json
RUN sed -i 's/"private": true,/"private": true,\n  "type": "module",/' package.json

# Expose the port
EXPOSE 3000

# Use our entrypoint script
ENTRYPOINT ["/app/docker/entrypoint.sh"]

# Start development server
CMD ["npm", "run", "dev"]

# Build the application for production
FROM base AS builder
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/next.config.js ./next.config.js

# Set up for ES modules and other build tools
COPY .eslintrc* tsconfig* prettier* ./
COPY docker ./docker

# Make scripts executable
RUN chmod +x /app/docker/entrypoint.sh /app/docker/fix-js-modules.sh /app/docker/cleanup-build.sh

# Copy application code (but explicitly delete any .babelrc)
COPY . .
RUN rm -f /app/.babelrc

# Force type:module in package.json
RUN sed -i 's/"private": true,/"private": true,\n  "type": "module",/' package.json

# Clear the cache and build
RUN /app/docker/cleanup-build.sh
RUN npm run build

# Production image
FROM base AS production
WORKDIR /app

# Set environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PLAYWRIGHT_BROWSERS_PATH=/usr/bin
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV CHROME_BIN=/usr/bin/chromium-browser

# Copy built application and configs from builder stage
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.js ./next.config.js
COPY --from=builder /app/docker ./docker

# Make scripts executable
RUN chmod +x /app/docker/entrypoint.sh /app/docker/fix-js-modules.sh /app/docker/cleanup-build.sh

# Create a non-root user and change permissions
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
RUN chown -R nextjs:nodejs /app
USER nextjs

# Expose the port
EXPOSE 3000

# Use our entrypoint script
ENTRYPOINT ["/app/docker/entrypoint.sh"]

# Start the application
CMD ["npm", "run", "start"]
