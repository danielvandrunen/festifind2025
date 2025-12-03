# Next.js Project Setup Best Practices

This guide outlines the recommended approach for setting up FestiFind and similar Next.js projects to avoid the issues encountered in the past.

## Project Structure

1. **One Next.js Project Per Repository**
   - Keep only one Next.js project in a single repository
   - Use monorepo tools like Turborepo if you need multiple apps

2. **File Organization**
   - Use the App Router structure consistently (`app/` directory)
   - Don't mix Pages Router and App Router unnecessarily
   - Avoid duplicate page files with the same route

3. **Component Organization**
   - Group components by feature or page (e.g., `components/festivals/`, `components/ui/`)
   - Use proper relative imports with `@/` path aliases
   - Create reusable UI components in a separate directory

## Configuration

1. **Environment Variables**
   - Always create a `.env.example` file with placeholder values
   - Never commit real `.env` files to Git
   - Document required environment variables

2. **Next.js Configuration**
   - Keep `next.config.js` simple and focused
   - Avoid deprecated configuration options
   - Document any non-standard configuration

3. **Tailwind CSS Setup**
   - Follow the official Tailwind CSS + Next.js setup guide
   - Keep the Tailwind config in the project root
   - Use content paths that match your project structure

## Deployment

1. **Vercel Deployment**
   - Set up project environment variables in Vercel dashboard
   - Use the Vercel CLI for testing deployments locally
   - Configure proper build settings in `vercel.json`

2. **Git Management**
   - Use `.gitignore` to exclude `.env` files and build artifacts
   - Keep sensitive data out of the repository
   - Use Git tags for versioning important releases

## Development Workflow

1. **Local Development**
   - Use `npm run dev` for local development
   - Check for port conflicts and processes that need to be terminated
   - Run with specific ports using `npm run dev -- -p 3001` if needed

2. **Testing**
   - Test API endpoints and UI components separately
   - Verify environment configurations before deployment
   - Use local mock data when needed 