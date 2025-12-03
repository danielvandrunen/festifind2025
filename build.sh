#!/bin/bash

# Display current Node.js version
echo "Node.js version:"
node -v

# Display current npm version
echo "npm version:"
npm -v

# Install dependencies
echo "Installing dependencies..."
npm install

# Build the application
echo "Building the application..."
npm run build

echo "Build process completed." 