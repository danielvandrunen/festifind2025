# FestiFind 2025

A Next.js application for tracking and discovering festivals around the world. This project allows users to browse festivals, manage favorites, and get the latest data from various festival sources.

## Features

- Festival discovery and tracking
- Favorites and archiving system
- Multiple data sources integration
- Responsive design for all devices
- Docker support for consistent development environments
- AI-powered festival research capabilities

## Tech Stack

- Next.js 15.3
- React 19
- Tailwind CSS
- Supabase (database & auth)
- Docker for containerization
- OpenAI integration for research

## Getting Started

### Development

⚠️ **IMPORTANT**: We use Docker for all testing and development to ensure a consistent environment. Please follow the Docker instructions below instead of using `npm run dev` directly.

```bash
# Install dependencies (only needed for IDE support)
npm install

# Start the Docker development environment (recommended)
npm run docker:dev
# OR use the convenience script
./docker-dev.sh
```

### Using Docker

```bash
# Start development environment with npm scripts
npm run docker:dev

# Start detached (background mode)
npm run docker:dev:detached

# View logs
npm run docker:logs

# Access shell inside container
npm run docker:shell

# Stop containers
npm run docker:stop
```

See the [DOCKER.md](DOCKER.md) file for detailed Docker setup and usage instructions.

## Deployment

### Vercel Deployment

```bash
# Simple deployment to Vercel
./vercel-deploy-simple.sh

# Release with versioning and optional deployment
./release.sh --patch -d  # Create patch release and deploy
./release.sh --minor     # Create minor release (no deployment)
./release.sh --major -d  # Create major release and deploy
```

### Docker Deployment

```bash
# Deploy to Docker
./docker/deploy.sh --target docker
```

## Project Structure

- `app/` - Next.js application routes and pages
- `components/` - React components 
- `lib/` - Utility functions and shared code
- `public/` - Static assets
- `scrapers/` - Festival data scraper implementations
- `docker/` - Docker configuration files and scripts

## Scripts

- `release.sh` - Create versioned releases with Git tags
- `vercel-deploy-simple.sh` - Simple Vercel deployment
- `docker/cli.sh` - Docker operations CLI
- `docker/deploy.sh` - Unified deployment script (Vercel/Docker)
- `docker-dev.sh` - Convenience script for Docker development

## Development Rules

We have set up a Cursor IDE rule to ensure consistent development practices:

- **Always Test in Docker**: When testing locally, always use the Docker environment rather than running `npm run dev` directly. This ensures consistent behavior across all developer machines.

For CI/CD process details, see [.cursor/rules/CI_CD_PROCESS.md](.cursor/rules/CI_CD_PROCESS.md). 