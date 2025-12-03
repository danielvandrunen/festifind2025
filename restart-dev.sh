#!/bin/bash

# Kill any running Next.js processes
pkill -f "next dev" || true

# Clear cache to prevent stale errors
rm -rf .next

# Make sure supabase key is current by resetting client
rm -rf node_modules/.cache

# Start the development server
npm run dev 