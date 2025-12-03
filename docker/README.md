# FestiFind Docker Development and Deployment

This directory contains scripts and configurations for Docker-based development and deployment of the FestiFind application.

## Available Scripts

### CLI Tool (`cli.sh`)

The CLI tool provides a unified interface for common Docker operations:

```bash
./docker/cli.sh COMMAND [OPTIONS]
```

Available commands:

- `dev`: Start the development environment
- `prod`: Build and start the production environment
- `build`: Build the Docker images
- `stop`: Stop all running containers
- `logs`: View container logs
- `deploy`: Deploy the application (see deploy.sh)
- `test`: Run tests in Docker
- `clean`: Clean Docker resources (images, containers)

### Deployment Tool (`deploy.sh`)

The deployment script supports both Vercel and Docker deployment:

```bash
./docker/deploy.sh [OPTIONS]
```

Options:
- `--target TARGET`: Deploy target (`vercel` or `docker`) [default: vercel]
- `--build-only`: Build only, don't deploy
- `--dry-run`: Show what would be done without making changes
- `-h, --help`: Show help message

Examples:
```bash
# Deploy to Vercel (default)
./docker/deploy.sh

# Deploy to Docker
./docker/deploy.sh --target docker

# Build only, don't deploy
./docker/deploy.sh --build-only

# Dry run to see what would happen
./docker/deploy.sh --dry-run
```

## Docker Configuration

The project includes:

1. `docker-compose.yml`: Defines services for development and production
2. `Dockerfile`: Multi-stage build for the Next.js application

### Services

The Docker Compose file defines the following services:

- `nextjs-dev`: Development environment with hot reloading
- `nextjs-prod`: Production environment with optimized build

## Environment Variables

Copy `.env.example` to `.env.local` and adjust variables before running:

```bash
cp .env.example .env.local
```

Required variables:
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous key

## Development Workflow

1. Start the development environment:
   ```bash
   ./docker/cli.sh dev
   ```

2. Access the application at http://localhost:3000

3. View logs:
   ```bash
   ./docker/cli.sh logs
   ```

4. Stop the environment:
   ```bash
   ./docker/cli.sh stop
   ```

## Production Deployment

1. Deploy to production:
   ```bash
   ./docker/deploy.sh --target docker
   ```

2. Access the application at http://localhost:3000

## Troubleshooting

### Common Issues

1. **Port conflicts**:
   - Change the port mapping in docker-compose.yml

2. **Environment variables**:
   - Ensure `.env.local` exists with proper values

3. **Container already running**:
   - Stop existing containers: `./docker/cli.sh stop`

4. **Build errors**:
   - Check logs: `docker-compose logs`
   - Clean and rebuild: `./docker/cli.sh clean && ./docker/cli.sh build` 