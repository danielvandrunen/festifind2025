# Docker Workflow for Next.js + Vercel

This document outlines the Docker workflow for ensuring consistency between local development and Vercel deployments.

## Core Principles

1. **Environment Parity**: Local Docker environment closely mimics Vercel's production environment
2. **Dependency Consistency**: Same dependency installation flags used locally and in production
3. **Configuration Management**: Environment variables handled consistently across environments
4. **Pre-Deployment Testing**: Production builds tested locally before deployment

## Setup Requirements

- Docker and Docker Compose installed
- Node.js v18+ installed locally (for running commands outside Docker)
- `.env.local` file with required environment variables

## Workflow Commands

### Development (Recommended)

```bash
# Start development environment with hot reloading
./dev.sh

# Or manually:
docker-compose -f docker-compose-dev.yml up --build
```

### Alternative Development Setup

```bash
# Use the original Docker setup (if needed)
docker-compose up nextjs-dev
```

### Local Production Testing

```bash
# Run production build locally (simulates Vercel)
./docker/prod.sh

# Or for standalone container:
./docker/vercel-preview.sh
```

### Local Docker Rebuilding

If you encounter Docker-related issues, you can rebuild the Docker environment:

```bash
# Completely rebuild Docker environment
./rebuild-docker.sh
```

### Pre-Deployment Checklist

Before deploying to Vercel, ensure:

1. All environment variables in `.env.local` are also configured in Vercel dashboard
2. Run `./docker/vercel-preview.sh` to verify production build works locally
3. Commit changes to Git and deploy via Vercel CLI or GitHub integration

## Troubleshooting Common Issues

### Environment Variables

If your app works locally but fails on Vercel:
- Verify all required environment variables are set in Vercel dashboard
- Check variable names match between local and Vercel (case-sensitive)

### Build Failures

If Vercel build fails:
- Test with `./docker/vercel-preview.sh` locally first
- Check Node.js version compatibility
- Verify dependency installation works with `--legacy-peer-deps` flag

### Module Format Issues

If you encounter JavaScript module format issues:
- Run `./fix-modules.sh` to fix module format issues
- Make sure package.json has `"type": "module"`
- Check for missing dependencies like cheerio

### Docker Issues

If Docker containers aren't starting or have problems:
- Use `docker-compose -f docker-compose-dev.yml logs` to check logs
- Rebuild using `./dev.sh` which uses the simplified Docker setup
- If all else fails, run `docker system prune -f --volumes` to clean up all Docker resources

## Best Practices

1. **Use Docker for all development**: Avoid "works on my machine" problems
2. **Test production builds locally**: Catch issues before deploying to Vercel
3. **Keep environment variables consistent**: Use `.env.local` for development and Vercel dashboard for production
4. **Be mindful of filesystem differences**: Vercel's filesystem is read-only in production
5. **Use the simplified dev.sh script**: For the most reliable local development experience 