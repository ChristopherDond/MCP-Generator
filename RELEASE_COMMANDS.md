#!/bin/bash

# MCP-Generator v2.0.0 Launch Commands
# Quick reference for the release process

# ===== PRE-LAUNCH SETUP =====

# 1. Ensure you have the necessary tools
node --version        # Should be 20+
npm --version         # Should be 9+
git --version         # Required
gh --version          # GitHub CLI (optional, for release creation)

# ===== LOCAL PREPARATION =====

# 2. Sync with main branch
git checkout main
git pull origin main

# 3. Install and test locally
npm ci
npm run build
npm test

# ===== VERSION BUMP =====

# 4. Bump version to RC (creates tag automatically)
npm version prerelease --preid=rc
# This updates:
# - package.json version to 1.0.0-rc.2 (or next RC)
# - Creates git tag v1.0.0-rc.2

# ===== PUSH TO GITHUB =====

# 5. Push commits and tags to GitHub
git push origin main --tags
# GitHub Actions will automatically:
# - Run tests
# - Build project
# - Publish to npm with @rc tag
# - Create Release on GitHub

# ===== VERIFY PUBLICATION =====

# 6. Verify npm publication (wait 2-3 minutes for npm sync)
npm view mcp-gen@rc

# 7. Test installation
npm install mcp-gen@rc -g
mcp-gen --version

# ===== PRODUCT HUNT LAUNCH =====

# 8. When ready for Product Hunt:
# - See PRODUCT_HUNT.md for detailed guide
# - Go to producthunt.com/dashboard
# - Create new "Launch"
# - Fill in title, description, images, video
# - Set launch time (12:01 AM PT is optimal)
# - Publish!

# ===== POST-LAUNCH ENGAGEMENT =====

# 9. Monitor and engage
# - Watch Product Hunt metrics
# - Respond to comments
# - Share on Twitter with #MCP #OpenAPI #AI
# - Monitor GitHub stars/issues

# ===== OPTIONAL: Release via GitHub CLI =====

# Alternative to manual tag push:
VERSION=$(node -p "require('./package.json').version")
gh release create "v$VERSION" \
  --title "MCP-Generator v$VERSION" \
  --notes "Release candidate $(echo $VERSION | grep -oE 'rc\.[0-9]+')" \
  --generate-release-notes

# ===== QUICK SUMMARY =====

echo ""
echo "✅ Release Checklist:"
echo "  [x] npm version prerelease --preid=rc"
echo "  [x] git push origin main --tags"
echo "  [ ] Wait for GitHub Actions (2-5 min)"
echo "  [ ] Verify npm publication"
echo "  [ ] Launch on Product Hunt"
echo "  [ ] Engage with community"
echo ""
echo "📚 Additional Resources:"
echo "  - RELEASE_STRATEGY.md    - Detailed release strategy"
echo "  - PRODUCT_HUNT.md        - Complete PH launch guide"
echo "  - PRODUCT_HUNT_GUIDE.md  - Step-by-step PH instructions"
echo "  - LAUNCH_CHECKLIST.md    - Full pre/post launch checklist"
echo "  - CHANGELOG.md           - What's included in RC.1"
echo ""
echo "🚀 Happy launching!"
