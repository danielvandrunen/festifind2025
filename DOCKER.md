# Docker Development Environment for FestiFind

This document outlines how to use the Docker development environment for testing and development of the FestiFind application.

## Prerequisites

- Docker Desktop installed and running
- Docker Compose installed (typically included with Docker Desktop)

## Starting the Development Environment

Instead of running `npm run dev` for local development, always use the Docker environment by running:

```bash
# Option 1: Use the convenience script
./docker-dev.sh

# Option 2: Run docker-compose directly
docker-compose -f docker-compose-dev.yml up
```

The development server will be available at:
- http://localhost:3000

## Benefits of Docker Development

1. **Consistent Environment**: Everyone on the team uses the same development environment configuration
2. **Isolated Dependencies**: All dependencies are contained within the Docker environment
3. **Production-like**: The Docker environment closely mimics the production environment
4. **Resource Management**: Docker ensures the application gets consistent resources

## Debugging

### Viewing Logs

To view logs from the Docker containers:

```bash
docker-compose -f docker-compose-dev.yml logs -f
```

### Accessing the Container Shell

To access a shell inside the running container:

```bash
docker-compose -f docker-compose-dev.yml exec nextjs-dev /bin/bash
```

### Stopping the Environment

To stop the Docker environment:

```bash
docker-compose -f docker-compose-dev.yml down
```

## Environment Variables

Environment variables are loaded from the `.env` file. You can modify this file to change the configuration of the application.

## Troubleshooting

If you encounter issues with the Docker environment:

1. **Port Conflicts**: Ensure port 3000 is not in use by another application
2. **Docker Not Running**: Make sure Docker Desktop is running
3. **Permission Issues**: On Linux, you may need to run the commands with `sudo`
4. **Cache Issues**: Try rebuilding the containers with `docker-compose -f docker-compose-dev.yml build --no-cache`

For other issues, check the Docker logs for error messages. 