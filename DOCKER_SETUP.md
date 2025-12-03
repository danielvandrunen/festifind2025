# Docker Setup for FestiFind on macOS

This guide will help you set up Docker for the FestiFind project on macOS.

## Installing Docker Desktop on macOS

1. Download Docker Desktop for Mac from the official website:
   - Visit [https://www.docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop)
   - Click on "Download for Mac"
   - Choose the Apple Silicon or Intel chip version based on your Mac

2. Install Docker Desktop:
   - Open the downloaded .dmg file
   - Drag the Docker icon to your Applications folder
   - Open Docker from your Applications folder
   - Follow the installation wizard
   - When prompted, authorize Docker with your system password

3. Verify installation:
   ```bash
   docker --version
   docker-compose --version
   ```

## Quick Setup

For a quick setup that avoids JavaScript module issues, run the provided setup script:

```bash
# From the project root
./docker/restart.sh
```

This will:
- Stop any running containers
- Remove existing containers, networks, volumes, and images
- Clean the Next.js build directory
- Rebuild Docker images from scratch with all fixes
- Start the development container

## Running FestiFind with Docker

The project includes two Docker configurations:
- Development environment (real-time changes, debugging)
- Production environment (optimized build)

### Development Environment

To start the development environment:

```bash
# From the project root
docker-compose up nextjs-dev
```

This will:
- Build the Docker image (first time only)
- Start the Next.js development server
- Mount your local files for real-time changes
- Expose the application on port 3005 (http://localhost:3005)

### Production Environment

To start the production environment:

```bash
# From the project root
docker-compose up nextjs-prod
```

This will:
- Build an optimized production image
- Start the Next.js production server
- Expose the application on port 3006 (http://localhost:3006)

### Using Helper Scripts

The project includes helper scripts in the `docker` directory:

- `./docker/dev.sh` - Start development environment
- `./docker/prod.sh` - Start production environment
- `./docker/test-deploy.sh` - Test a production deployment

## Environment Variables

Docker will use the environment variables from your local .env file. Our setup script creates a default .env file with required variables:

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## Module Errors and Fixes

If you encounter the "SyntaxError: Invalid or unexpected token" or "Module parse failed: 'import' and 'export' may appear only with 'sourceType: module'" errors, our setup includes several fixes:

1. **Project Type**: The package.json now includes `"type": "module"` to ensure all JavaScript files are treated as ES modules.

2. **Next.js Configuration**: The updated next.config.js configures webpack to handle JS files properly.

3. **Babel Configuration**: The project now includes .babelrc for proper transpilation of modern JavaScript.

4. **Automated Fix Script**: Our entrypoint script automatically fixes import/export statements and adds proper headers to JavaScript files.

To apply all these fixes manually, run:

```bash
# Clean up and rebuild
./docker/cleanup-build.sh --force
```

## Troubleshooting

### Common Issues

- **Port conflicts**: If ports 3005 or 3006 are already in use, you can modify the port mappings in `docker-compose.yml`
- **Memory issues**: Increase Docker's resource allocation in Docker Desktop preferences
- **Container not starting**: Check logs with `docker-compose logs nextjs-dev` or `docker-compose logs nextjs-prod`

### JavaScript Module Errors

If you continue to encounter JavaScript module errors, try the following steps:

1. Edit the file causing the error to manually fix import/export statements
2. Add `// @ts-nocheck` at the top of problematic .js files 
3. Change the file extension from .js to .mjs for files that need to be treated as ES modules

### Playwright Browser Issues

If you encounter errors about missing Playwright browsers:

1. Make sure the environment variables are set correctly:
   ```
   PLAYWRIGHT_BROWSERS_PATH=/usr/bin
   PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
   CHROME_BIN=/usr/bin/chromium-browser
   ```

2. Try installing the browsers manually inside the container:
   ```bash
   docker exec -it festifind2025-nextjs-dev-1 npx playwright install
   ```

### Rebuilding from Scratch

If all else fails, completely rebuild everything from scratch:

```bash
# Stop all containers and remove volumes
docker-compose down -v

# Remove all Docker resources related to the project
docker system prune -f --volumes

# Rebuild without using cache
docker-compose build --no-cache

# Start development environment
docker-compose up nextjs-dev
``` 