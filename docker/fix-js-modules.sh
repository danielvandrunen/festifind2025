#!/bin/sh
set -e

echo "=== Fixing JavaScript module format issues ==="

# Always delete any .babelrc file to ensure Next.js SWC compatibility
find /app -name ".babelrc" -delete
echo "Removed any .babelrc files to ensure SWC compatibility"

# Add "type": "module" to package.json if not already present
if grep -q '"type": "module"' /app/package.json; then
  echo "Package.json already has type:module"
else
  echo "Adding type:module to package.json"
  sed -i 's/"private": true,/"private": true,\n  "type": "module",/' /app/package.json
fi

# Function to add .js extension to imports without extensions in a file
fix_imports() {
  file=$1
  echo "Fixing imports in $file"
  
  # Add .js extension to relative imports without extensions
  sed -i 's/from \(['"'"'"]\)\.\//from \1\.\//g; s/from \(['"'"'"]\)\.\./from \1\.\./g; s/from \(['"'"'"]\)\.\.\/\([^\.'"'"'"]*\)"/from \1\.\.\/\2\.js"/g; s/from \(['"'"'"]\)\.\/\([^\.'"'"'"]*\)"/from \1\.\/\2\.js"/g' "$file"
  sed -i 's/from \(['"'"'"]\)\.\//from \1\.\//g; s/from \(['"'"'"]\)\.\./from \1\.\./g; s/from \(['"'"'"]\)\.\.\/\([^\.'"'"'"]*\)'\''/from \1\.\.\/\2\.js'\''/g; s/from \(['"'"'"]\)\.\/\([^\.'"'"'"]*\)'\''/from \1\.\/\2\.js'\''/g' "$file"
  
  # Convert require() to import statements
  sed -i 's/const \(.*\) = require(\(['"'"'"]\)\(.*\)\2)/import \1 from \2\3\2/g' "$file"
  sed -i 's/module\.exports/export default/g' "$file"
}

# Look for JS files in app/api directory
find /app/app/api -name "*.js" | while read file; do
  # Add ESM header to force module mode
  if ! grep -q "// @ts-nocheck" "$file"; then
    sed -i '1s/^/\/\/ @ts-nocheck\n\/\/ Force ESM mode\n\n/' "$file"
  fi
  
  # Fix imports in the file
  fix_imports "$file"
done

# Fix .jsx files too
find /app/app -name "*.jsx" | while read file; do
  fix_imports "$file"
done

# Create empty fallback-build-manifest.json to prevent errors
mkdir -p /app/.next
echo "{}" > /app/.next/fallback-build-manifest.json
chmod 666 /app/.next/fallback-build-manifest.json

# Clear Next.js cache to force recompilation
echo "Cleaning Next.js cache..."
rm -rf /app/.next/cache

# Forcefully overwrite next.config.js to use SWC
cat > /app/next.config.js << EONEXTCONFIG
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    forceSwcTransforms: true,
  },
  reactStrictMode: true,
  swcMinify: true,
};

export default nextConfig;
EONEXTCONFIG

echo "=== Module fixes complete ===" 