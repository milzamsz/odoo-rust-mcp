#!/bin/bash
# Complete release script: bump version, commit, push, and create tag

set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <new-version>"
    echo "Example: $0 0.3.15"
    exit 1
fi

NEW_VERSION="$1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# Run bump-version script
"$SCRIPT_DIR/bump-version.sh" "$NEW_VERSION"

# Commit changes
echo ""
echo "Committing changes..."
git add rust-mcp/Cargo.toml config-ui/package.json
git commit -m "chore: bump version to $NEW_VERSION" || {
    echo "Error: Commit failed. Maybe no changes to commit?"
    exit 1
}

# Push to remote
echo ""
echo "Pushing to remote..."
git push

# Create and push tag
echo ""
echo "Creating tag v$NEW_VERSION..."
git tag "v$NEW_VERSION"
git push origin "v$NEW_VERSION"

echo ""
echo "✓ Release $NEW_VERSION created successfully!"
echo ""
echo "GitHub Actions will now:"
echo "  - Build binaries for all platforms"
echo "  - Build Docker image"
echo "  - Build Debian package"
echo "  - Create GitHub release"
echo "  - Update Homebrew formula"
echo "  - Update APT repository"
echo ""
echo "Monitor progress: https://github.com/rachmataditiya/odoo-rust-mcp/actions"
