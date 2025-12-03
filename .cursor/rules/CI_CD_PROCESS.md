# FestiFind CI/CD Process

This document outlines the Continuous Integration (CI) and Continuous Deployment (CD) process for the FestiFind application.

## Release Process

The release process is managed by the `release.sh` script in the root directory. This script handles:

1. Creating Git tags with semantic versioning (major, minor, patch)
2. Ensuring all changes are committed
3. Pushing changes to the repository
4. Optionally deploying to Vercel

### Using the Release Script

The release script supports the following options:

```bash
./release.sh [OPTIONS]

Options:
  --patch                Create a patch release (0.0.X)
  --minor                Create a minor release (0.X.0)
  --major                Create a major release (X.0.0)
  -v, --version VERSION  Specify a specific version
  -m, --message MESSAGE  Custom commit message
  -d, --deploy           Deploy to Vercel after pushing
  -h, --help             Show this help message
```

Examples:
- Create a patch release: `./release.sh --patch`
- Create a minor release and deploy: `./release.sh --minor -d`
- Create a specific version: `./release.sh -v 1.5.2 -m "Special release"`

## Deployment Process

### Manual Deployment

There are multiple ways to deploy the application:

1. **Simple Vercel Deployment**:
   ```bash
   ./vercel-deploy-simple.sh
   ```
   This script:
   - Checks for Vercel CLI installation
   - Checks for uncommitted changes
   - Performs necessary configuration adjustments
   - Runs a local build check
   - Deploys to Vercel
   - Restores original configuration

2. **As Part of a Release**:
   ```bash
   ./release.sh --patch -d
   ```
   This combines version tagging and deployment in one command.

3. **Direct Vercel Command**:
   ```bash
   vercel deploy --prod
   ```
   Use this only if you're familiar with Vercel deployment and have checked all configurations.

## Important Notes

### Next.js Configuration

The `next.config.js` file requires special handling for deployment:

- The `output: 'export'` setting is not compatible with API routes
- The deployment scripts automatically handle this configuration
- If deploying manually, ensure this setting is removed or properly configured

### Environment Variables

Make sure all required environment variables are set in the Vercel dashboard or your local `.env.local` file:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Additional project-specific variables

## Docker Development

The project includes Docker support for development and testing:

```bash
# Start development environment
./docker/cli.sh dev

# Build and start production environment
./docker/cli.sh prod

# Run tests in Docker
./docker/cli.sh test

# View logs
./docker/cli.sh logs
```

## Troubleshooting

Common deployment issues:

1. **Build Failures**:
   - Check for type errors in API routes
   - Ensure all dependencies are properly installed
   - Review Next.js configuration

2. **API Routes Not Working**:
   - Verify that `output: 'export'` is not enabled when using API routes
   - Check Next.js configuration

3. **Environment Variables**:
   - Ensure all required variables are set in Vercel
   - Check for proper naming of variables

4. **Vercel CLI Issues**:
   - Update Vercel CLI: `npm install -g vercel@latest`
   - Re-login if necessary: `vercel login` 