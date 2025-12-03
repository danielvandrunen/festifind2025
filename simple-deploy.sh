#!/bin/bash

# Build the application
echo "Building the application..."
npm run build

if [ $? -ne 0 ]; then
  echo "Build failed! Check the errors above."
  exit 1
fi

# Deploy to Vercel
echo "Deploying to Vercel..."
vercel deploy --prod

echo "Deployment process completed!" 