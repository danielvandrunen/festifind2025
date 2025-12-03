#!/bin/bash
cd "$(dirname "$0")/.."
echo "Building and testing Docker container..."
docker-compose -f docker/docker-compose.yml build
if [ $? -eq 0 ]; then
  echo "Build successful! Running container for testing..."
  docker-compose -f docker/docker-compose.yml up -d
  echo "Container started. Visit http://localhost:3000 to see your app."
  echo "If the container works correctly, consider committing and pushing with:"
  echo "  git add . && git commit -m \"Docker setup complete\" && git push"
else
  echo "Build failed!"
fi
