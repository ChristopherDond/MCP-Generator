#!/bin/bash

# MCP-Generator Release Script
# Usage: ./scripts/release.sh [patch|minor|major|prerelease]

set -e

VERSION_TYPE="${1:-prerelease}"

echo "🚀 MCP-Generator Release Process"
echo "=================================="
echo "Version type: $VERSION_TYPE"
echo ""

# Check prerequisites
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found"
    exit 1
fi

if ! command -v git &> /dev/null; then
    echo "❌ Git not found"
    exit 1
fi

# Check git status
if [[ $(git status -s) ]]; then
    echo "❌ Working directory not clean. Commit changes first."
    git status -s
    exit 1
fi

# Ensure on main branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "❌ Not on main branch. Current branch: $CURRENT_BRANCH"
    exit 1
fi

# Pull latest
echo "📥 Pulling latest changes..."
git pull origin main

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Run tests
echo "🧪 Running tests..."
npm test

# Build
echo "🔨 Building..."
npm run build

# Update version
echo "📝 Bumping version ($VERSION_TYPE)..."
if [ "$VERSION_TYPE" = "prerelease" ]; then
    npm version prerelease --preid=rc
else
    npm version "$VERSION_TYPE"
fi

# Get new version
NEW_VERSION=$(node -p "require('./package.json').version")
echo "✅ New version: $NEW_VERSION"

# Push to GitHub
echo "🔄 Pushing to GitHub..."
git push origin main --tags

# Create GitHub Release
echo "📌 Creating GitHub Release..."
gh release create "v$NEW_VERSION" \
    --title "MCP-Generator v$NEW_VERSION" \
    --notes "Automated release from release script" \
    --generate-release-notes

echo ""
echo "✅ Release Complete!"
echo "📦 npm publish will be handled by GitHub Actions"
echo "🔗 Release: https://github.com/ChristopherDond/MCP-Generator/releases/tag/v$NEW_VERSION"
echo ""
echo "Next steps:"
echo "  1. Monitor GitHub Actions for npm publish"
echo "  2. Update Product Hunt if needed"
echo "  3. Share on social media"
