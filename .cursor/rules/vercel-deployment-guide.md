# FestiFind Vercel Deployment Guide

This document outlines the process for deploying the FestiFind application to Vercel, including continuous integration and deployment processes.

## Prerequisites

- Git repository set up with proper access
- Vercel CLI installed (`npm install -g vercel`)
- Vercel account with proper permissions
- Supabase account and API credentials

## CI/CD Process

1. **Development workflow**:
   - Develop and test locally using `npm run dev`
   - Make changes to the application
   - Test thoroughly to ensure functionality

2. **Preparing for deployment**:
   - Ensure all changes are committed to Git
   - Run a local build test with `npm run build`
   - Fix any build errors before proceeding

3. **Deploying to Vercel**:
   - Use one of the deployment scripts described below
   - Review the deployment in the Vercel dashboard
   - Verify the application is working correctly in production

## Deployment Scripts

The repository includes several deployment scripts to help automate the process:

### 1. Simple Deploy Script (`simple-deploy.sh`)

A basic script that builds the app locally and deploys to Vercel:

```bash
./simple-deploy.sh
```

### 2. Vercel Deploy Script (`vercel-deploy-simple.sh`)

A more advanced script that:
- Creates a clean deployment directory
- Sets up proper environment variables
- Fixes API route handlers for Vercel compatibility
- Runs a test build locally
- Deploys to Vercel production

```bash
./vercel-deploy-simple.sh
```

## Common Issues and Solutions

### API Route Handler Issues

If you encounter issues with API routes on Vercel, ensure your route handlers use the correct parameter format:

```typescript
// Correct format for Next.js 15.3+
export async function POST(
  request: NextRequest,
  { params }: any // or { params }: { params: { id: string } }
) {
  const id = params.id;
  // Rest of your code
}
```

### Environment Variables

Make sure all required environment variables are set in both:
1. Local `.env.local` file for development
2. Vercel project settings for production

Required variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Tagging Releases

We use Git tags to mark release versions:

1. Make your changes and commit them
2. Create a new tag for the release:
   ```bash
   git tag -a vX.Y.Z -m "Description of the release"
   ```
3. Push the tag to the remote repository:
   ```bash
   git push origin vX.Y.Z
   ```

## Complete Deployment Workflow

For a complete workflow from development to production:

```bash
# 1. Make changes to your code
# 2. Commit changes
git add .
git commit -m "Description of changes"

# 3. Run tests locally
npm run dev
# (Test manually in browser)

# 4. Build locally to verify
npm run build

# 5. Create a new tag (increment version number)
git tag -a vX.Y.Z -m "Release description"

# 6. Push commits and tag
git push origin main
git push origin vX.Y.Z

# 7. Deploy to Vercel
./vercel-deploy-simple.sh
```

## Monitoring and Rollbacks

- Monitor the application after deployment using Vercel's dashboard
- If issues are discovered, you can roll back to a previous deployment in the Vercel dashboard
- Alternatively, deploy a previous tagged version:
  ```bash
  git checkout vX.Y.Z
  ./vercel-deploy-simple.sh
  git checkout main
  ``` 