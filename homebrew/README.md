# Homebrew Formula for odoo-rust-mcp

This folder contains the Homebrew formula source for `rust-mcp`.

The actual Homebrew tap is hosted at: https://github.com/rachmataditiya/homebrew-odoo-rust-mcp

## For Users

### Quick Install

```bash
brew tap rachmataditiya/odoo-rust-mcp
brew install rust-mcp
```

### After Installation

1. Edit your Odoo credentials:
   ```bash
   nano ~/.config/odoo-rust-mcp/env
   ```

2. Start the service:
   ```bash
   brew services start rust-mcp
   ```

3. Service runs at: `http://127.0.0.1:8787/mcp`

For complete documentation, see: https://github.com/rachmataditiya/homebrew-odoo-rust-mcp

## For Maintainers

### Formula Location

- Source: `homebrew/Formula/rust-mcp.rb` (this repo)
- Published: https://github.com/rachmataditiya/homebrew-odoo-rust-mcp

### Updating the Formula

1. Update `Formula/rust-mcp.rb` in this repo
2. Copy to homebrew-odoo-rust-mcp repo
3. Commit and push both repos

### Automated Updates

The GitHub Actions workflow (`.github/workflows/release.yml`) automatically:
1. Generates SHA256 checksums for release artifacts
2. Updates the formula with new version and checksums
3. Pushes to the homebrew tap repository

**Required GitHub Settings:**

Set these in repository Settings > Secrets and variables:

| Type | Name | Value |
|------|------|-------|
| Variable | `HOMEBREW_TAP_REPO` | `rachmataditiya/homebrew-odoo-rust-mcp` |
| Secret | `HOMEBREW_TAP_TOKEN` | Personal access token with `repo` scope |

### Manual Checksum Generation

After creating a release, generate checksums:

```bash
VERSION=0.1.0
curl -sL "https://github.com/rachmataditiya/odoo-rust-mcp/releases/download/v${VERSION}/rust-mcp-aarch64-apple-darwin.tar.gz" | shasum -a 256
curl -sL "https://github.com/rachmataditiya/odoo-rust-mcp/releases/download/v${VERSION}/rust-mcp-x86_64-apple-darwin.tar.gz" | shasum -a 256
curl -sL "https://github.com/rachmataditiya/odoo-rust-mcp/releases/download/v${VERSION}/rust-mcp-x86_64-unknown-linux-gnu.tar.gz" | shasum -a 256
```
