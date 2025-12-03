# FestiFind Release Workflow Guide

This document outlines the complete workflow for releasing and deploying new versions of the FestiFind application.

## Release Process Overview

The release process for FestiFind follows these general steps:

1. Develop and test features locally
2. Commit changes to Git
3. Tag the release with a version number
4. Push changes and tags to GitHub
5. Deploy to Vercel (production environment)
6. Monitor the deployment

## Using the Automated Release Script

For convenience, we've created a unified release script that handles Git tagging and Vercel deployment in one step.

### Prerequisites

- Git repository set up with remote origin
- Vercel CLI installed and configured
- Proper environment variables set up

### Usage

```bash
./release.sh <version> [commit message]
```

For example:
```bash
./release.sh v3.3.0 "Add user authentication features"
```

### What the Script Does

1. Checks for uncommitted changes and offers to commit them
2. Verifies if the tag already exists and offers to force update it
3. Creates a new Git tag with the provided version
4. Pushes the changes and tag to the remote repository
5. Runs the Vercel deployment script
6. Displays a success message with the production URL

## Manual Release Process

If you prefer to handle the release process manually, follow these steps:

### 1. Commit Changes

```bash
git add .
git commit -m "Your commit message"
```

### 2. Create a Tag

```bash
git tag -a v3.3.0 -m "Release message"
```

### 3. Push Changes and Tag

```bash
git push origin main
git push origin v3.3.0
```

### 4. Deploy to Vercel

```bash
./vercel-deploy-simple.sh
```

Or for a basic deployment:
```bash
./simple-deploy.sh
```

## Version Naming Convention

We follow semantic versioning (SemVer) for our releases:

- **Major version (X.0.0)**: Incompatible API changes or major feature overhauls
- **Minor version (X.Y.0)**: Backward-compatible new features
- **Patch version (X.Y.Z)**: Backward-compatible bug fixes

## Handling Deployment Issues

If you encounter issues during deployment:

1. Check the Vercel deployment logs
2. Verify that all environment variables are correctly set
3. Ensure that API route handlers have the correct typing
4. Consider rolling back to a previous version if necessary

### Rolling Back

To roll back to a previous version:

```bash
git checkout v3.2.0
./vercel-deploy-simple.sh
```

## Post-Deployment Verification

After each deployment, verify that:

1. The application loads correctly at https://festifind-app.vercel.app/
2. API endpoints are functioning properly
3. Database connections are working
4. User authentication flows are operational
5. Festival creation and management features work as expected

## Continuous Integration

For future improvements, consider implementing:

- Automated testing before deployment
- Pull request previews
- Staging environment deployments before production
- Automated rollbacks if health checks fail

---

*This guide is part of the FestiFind project documentation. For questions or improvements, contact the project maintainers.* 