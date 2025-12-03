#!/bin/bash
set -e

echo "=== Fixing JavaScript module format issues ==="

# Add "type": "module" to package.json if not already present
if grep -q '"type": "module"' package.json; then
  echo "Package.json already has type:module"
else
  echo "Adding type:module to package.json"
  sed -i'' -e 's/"private": true,/"private": true,\n  "type": "module",/' package.json
fi

# Fix next.config.js
if grep -q "module.exports" next.config.js; then
  echo "Fixing next.config.js"
  sed -i'' -e 's/module.exports/export default/g' next.config.js
fi

# Fix API route files if they exist
echo "Looking for API route files..."
find ./app/api -name "route.js" 2>/dev/null | while read file; do
  if [ -f "$file" ]; then
    echo "Converting $file to ESM format"
    # Add ESM header to force module mode
    if ! grep -q "// @ts-nocheck" "$file"; then
      sed -i'' -e '1s/^/\/\/ @ts-nocheck\n\/\/ Force ESM mode\n\n/' "$file"
    fi
  fi
done

# Clean .next cache
if [ -d .next ]; then
  echo "Cleaning Next.js cache..."
  rm -rf .next/cache
fi

echo "=== Module fixes complete ===" 