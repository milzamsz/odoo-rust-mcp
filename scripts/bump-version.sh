#!/bin/bash
# Script to bump version across all files before release

set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <new-version>"
    echo "Example: $0 0.3.15"
    exit 1
fi

NEW_VERSION="$1"
OLD_VERSION=$(grep -E '^version = ' rust-mcp/Cargo.toml | cut -d'"' -f2)

if [ -z "$OLD_VERSION" ]; then
    echo "Error: Could not find current version in rust-mcp/Cargo.toml"
    exit 1
fi

echo "Bumping version from $OLD_VERSION to $NEW_VERSION"

# Update Cargo.toml
sed -i '' "s/^version = \"$OLD_VERSION\"/version = \"$NEW_VERSION\"/" rust-mcp/Cargo.toml
echo "✓ Updated rust-mcp/Cargo.toml"

# Update package.json
sed -i '' "s/\"version\": \"$OLD_VERSION\"/\"version\": \"$NEW_VERSION\"/" config-ui/package.json
echo "✓ Updated config-ui/package.json"

# Show changes
echo ""
echo "Changes:"
git diff rust-mcp/Cargo.toml config-ui/package.json

echo ""
echo "Next steps:"
echo "  1. Review the changes above"
echo "  2. Commit: git add -A && git commit -m \"chore: bump version to $NEW_VERSION\""
echo "  3. Push: git push"
echo "  4. Create tag: git tag v$NEW_VERSION && git push origin v$NEW_VERSION"
