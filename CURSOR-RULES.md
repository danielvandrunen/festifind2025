# Cursor Rules for FestiFind Docker Workflow

The following rules should be followed to ensure consistent development and deployment between local environments and Vercel.

## Development Rules

1. **Always use Docker for development**
   - Run `./dev.sh` to start the development environment (recommended)
   - Or use `docker-compose -f docker-compose-dev.yml up` for manual control
   - Never run npm commands directly on the host unless necessary

2. **Environment Variable Management**
   - All environment variables must be defined in `.env.local` for local development
   - Any new environment variable must be added to:
     - `.env.local` for local development
     - Vercel dashboard for production
     - `.env.example` (without actual values) for documentation

3. **Dependency Management**
   - Add dependencies using Docker: `docker-compose exec nextjs-dev npm install <package>`
   - Use `--legacy-peer-deps` flag for compatibility with Vercel
   - Always commit both package.json and package-lock.json

## Pre-Deployment Rules

4. **Required Testing Before Deployment**
   - Run production build in Docker: `./docker/vercel-preview.sh`
   - Verify all features work in the production environment
   - Test API endpoints in the production container

5. **Build Verification**
   - Ensure Docker production build succeeds before deploying to Vercel
   - Fix any warnings or errors in the build process
   - Test the production build with the same Node.js version as Vercel (v18)

## Code Practices

6. **File Path Handling**
   - Use relative imports or proper alias paths (e.g., `@/components/`)
   - Avoid hardcoded file paths
   - Consider case sensitivity (MacOS is case-insensitive, Vercel is case-sensitive)

7. **API Routes Implementation**
   - Use proper async/await in all API routes
   - Handle params correctly: `const id = await context.params.id;`
   - Implement proper error handling that works in a serverless environment

8. **Next.js Configuration**
   - Keep next.config.js simple and compatible with Vercel
   - Remove deprecated options like `appDir` and `swcMinify`
   - Remove experimental options that may cause issues: `experimental.esmExternals`, `experimental.serverComponentsExternalPackages`
   - Test configuration changes in Docker before deploying

## Styling Rules

9. **CSS/Tailwind Configuration**
   - Ensure TailwindCSS config is properly set up
   - Test styling in both development and production Docker containers
   - Verify CSS builds correctly in the production environment

## Deployment Rules

10. **Vercel Deployment Process**
    - Always push to Git before deploying
    - Use Vercel CLI or GitHub integration for deployment
    - Verify environment variables are set in Vercel dashboard

## Error Resolution

11. **Systematic Error Resolution**
    - For styling issues: Check TailwindCSS configuration
    - For build errors: Test in Docker production container first
    - For module format issues: Run `./fix-modules.sh`
    - For Docker issues: Run `./dev.sh` which uses the simplified Docker setup
    - For missing files: Verify case sensitivity and path resolution

12. **Docker Troubleshooting**
    - If Docker is not behaving as expected, try the simplified setup with `./dev.sh`
    - For persistent Docker issues, run `docker system prune -f --volumes` to clean up all Docker resources
    - Check container logs with `docker-compose -f docker-compose-dev.yml logs`

By following these rules, you'll maintain a consistent environment between local development and Vercel deployments, eliminating the "works locally but not in production" problem. 