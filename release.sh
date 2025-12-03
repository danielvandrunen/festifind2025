#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Functions for colored output
print_info() {
  echo -e "${YELLOW}INFO:${NC} $1"
}

print_success() {
  echo -e "${GREEN}SUCCESS:${NC} $1"
}

print_error() {
  echo -e "${RED}ERROR:${NC} $1"
}

# Check if a version argument is provided
if [ -z "$1" ]; then
  print_error "Please provide a version argument (e.g., v1.0.0)"
  echo "Usage: ./release.sh v1.0.0"
  exit 1
fi

VERSION=$1

# Check for uncommitted changes
if [[ -n $(git status --porcelain) ]]; then
  print_info "You have uncommitted changes."
  read -p "Would you like to commit them with a standard message? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    git add .
    git commit -m "Release preparation for $VERSION"
    print_success "Changes committed."
  else
    print_error "Please commit your changes before creating a release."
    exit 1
  fi
fi

# Build the production Docker image
print_info "Building production Docker image..."
docker-compose build nextjs-prod

# Tag the Docker image with the version
print_info "Tagging Docker image with $VERSION..."
docker tag festifind2025-nextjs-prod:latest festifind2025-nextjs-prod:$VERSION

# Create a Git tag
print_info "Creating Git tag $VERSION..."
git tag -a $VERSION -m "Release $VERSION"

# Push the Git tag
print_info "Pushing Git tag $VERSION..."
git push origin $VERSION

print_success "Release $VERSION has been created and pushed to Git."
print_info "To deploy this release to Vercel, run:"
print_info "  ./deploy.sh $VERSION"

# Update package.json with the new version
sed -i '' "s/\"version\": \".*\"/\"version\": \"${VERSION#v}\"/" package.json
print_success "Updated package.json version to ${VERSION#v}"

print_info "Would you like to push the updated package.json to Git? (y/n) "
read -p "" -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  git add package.json
  git commit -m "Bump version to $VERSION"
  git push
  print_success "Version bump committed and pushed."
else
  print_info "Skipped pushing version bump. Don't forget to push it later."
fi

print_success "Release process complete!"