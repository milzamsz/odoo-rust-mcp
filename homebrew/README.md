# Homebrew Formula for odoo-rust-mcp

This folder contains the Homebrew formula for installing `rust-mcp` via Homebrew.

## Setup Homebrew Tap

To make this formula available via Homebrew, you need to create a separate repository named `homebrew-odoo-rust-mcp`.

### Step 1: Create the Tap Repository

Create a new GitHub repository:
- Repository name: `homebrew-odoo-rust-mcp`
- Make it public

### Step 2: Copy Formula

Copy the `Formula/` folder to the new repository:

```bash
# Clone your new tap repository
git clone https://github.com/YOUR_USERNAME/homebrew-odoo-rust-mcp.git
cd homebrew-odoo-rust-mcp

# Copy the Formula folder
cp -r /path/to/odoo-rust-mcp/homebrew/Formula .

# Commit and push
git add -A
git commit -m "Add rust-mcp formula"
git push
```

### Step 3: Update SHA256 Checksums

After creating a release, update the SHA256 checksums in `Formula/rust-mcp.rb`:

```bash
# Download release artifacts and generate checksums
curl -sL https://github.com/rachmataditiya/odoo-rust-mcp/releases/download/v0.1.0/rust-mcp-aarch64-apple-darwin.tar.gz | shasum -a 256
curl -sL https://github.com/rachmataditiya/odoo-rust-mcp/releases/download/v0.1.0/rust-mcp-x86_64-apple-darwin.tar.gz | shasum -a 256
curl -sL https://github.com/rachmataditiya/odoo-rust-mcp/releases/download/v0.1.0/rust-mcp-x86_64-unknown-linux-gnu.tar.gz | shasum -a 256
```

Replace `PLACEHOLDER_SHA256_*` values in the formula with actual checksums.

## Installation

Once the tap is set up:

```bash
# Add the tap
brew tap YOUR_USERNAME/odoo-rust-mcp

# Install
brew install rust-mcp
```

Or install directly:

```bash
brew install YOUR_USERNAME/odoo-rust-mcp/rust-mcp
```

## Automated Updates

The GitHub Actions workflow in `.github/workflows/release.yml` can be configured to automatically update the formula when a new release is created. See the workflow file for details.
