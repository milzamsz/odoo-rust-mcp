# Building from Source

Guide to building odoo-rust-mcp from source code.

---

## Prerequisites

- **Rust toolchain**: 1.85+ (for Rust 2024 edition) -- install via [rustup](https://rustup.rs/)
- **Node.js**: 20+ with npm
- **Git**: For cloning the repository

---

## Build Order

The React Config UI must be built **before** the Rust binary, because the built UI assets are embedded into the binary via `include_dir!`.

```
1. config-ui (npm ci && npm run build)
       |
       v
   rust-mcp/static/dist/  (generated)
       |
       v
2. rust-mcp (cargo build --release)
       |
       v
   rust-mcp/target/release/rust-mcp  (final binary)
```

---

## Quick Build

```bash
# Clone the repository
git clone https://github.com/rachmataditiya/odoo-rust-mcp.git
cd odoo-rust-mcp

# Step 1: Build React UI
cd config-ui
npm ci
npm run build
cd ..

# Step 2: Build Rust binary
cd rust-mcp
cargo build --release
```

**Binary location:**
- Debug: `rust-mcp/target/debug/rust-mcp`
- Release: `rust-mcp/target/release/rust-mcp`

**Windows (PowerShell):**
```powershell
git clone https://github.com/rachmataditiya/odoo-rust-mcp.git
cd odoo-rust-mcp

# Step 1: Build React UI
cd config-ui
npm ci
npm run build
cd ..

# Step 2: Build Rust binary
cd rust-mcp
cargo build --release
```

---

## Development Setup

### 1. Install Rust

```bash
# Linux/macOS
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Windows: Download and run rustup-init.exe from https://rustup.rs/
```

Verify: `rustc --version` (must be 1.85+)

### 2. Install Node.js

Use [nvm](https://github.com/nvm-sh/nvm) or download from [nodejs.org](https://nodejs.org/):

```bash
nvm install 20
nvm use 20
```

Verify: `node --version` (must be 20+)

### 3. Clone and Build

```bash
git clone https://github.com/rachmataditiya/odoo-rust-mcp.git
cd odoo-rust-mcp

# Build config UI first
cd config-ui && npm ci && npm run build && cd ..

# Build Rust server
cd rust-mcp && cargo build && cd ..
```

### 4. Configure Environment

```bash
# Create config directory
mkdir -p ~/.config/odoo-rust-mcp

# Create instances.json
cat > ~/.config/odoo-rust-mcp/instances.json <<EOF
{
  "local": {
    "url": "http://localhost:8069",
    "db": "mydb",
    "version": "18",
    "username": "admin",
    "password": "admin"
  }
}
EOF
```

### 5. Run the Server

```bash
# stdio transport (for AI clients)
./rust-mcp/target/debug/rust-mcp --transport stdio

# HTTP transport (with Config UI on :3008)
./rust-mcp/target/debug/rust-mcp --transport http --listen 127.0.0.1:8787
```

---

## Config UI Development

The Config UI is a React 18 + TypeScript + Tailwind CSS app in `config-ui/`.

```bash
cd config-ui

# Install dependencies
npm ci

# Development server (HMR on :5173)
npm run dev

# Production build (outputs to ../rust-mcp/static/dist)
npm run build

# Type checking
npm run typecheck

# Linting
npm run lint

# Run tests
npm test

# Tests with coverage
npm run test:coverage
```

During development, run the Rust server in one terminal and the Vite dev server in another:

```bash
# Terminal 1: Rust server
cd rust-mcp && cargo run -- --transport http --listen 127.0.0.1:8787

# Terminal 2: Vite dev server with HMR
cd config-ui && npm run dev
# Access UI at http://localhost:5173
```

---

## Build Options

### Debug Build (Fast compilation)

```bash
cd rust-mcp && cargo build
```

### Release Build (Optimized, stripped)

```bash
cd rust-mcp && cargo build --release
```

### Cross-Compilation

Using [cross](https://github.com/cross-rs/cross):

```bash
cargo install cross

# Build for Linux (from macOS/Windows)
cross build --release --target x86_64-unknown-linux-gnu

# Build for Windows (from Linux/macOS)
cross build --release --target x86_64-pc-windows-msvc
```

---

## Linting & Formatting

```bash
cd rust-mcp

# Format code (required before commit)
cargo fmt

# Check formatting (CI mode)
cargo fmt --check

# Run clippy linter (must pass with zero warnings)
cargo clippy -- -D warnings
```

CI will **fail** if `cargo fmt` or `cargo clippy` produce any output.

---

## Docker Build

The Dockerfile is at `rust-mcp/Dockerfile` and uses a multi-stage build:

1. **Builder stage**: Installs Node.js 20, builds React UI, then builds Rust binary
2. **Runtime stage**: Debian slim with just the binary and static assets

```bash
# From repository root
docker build -f rust-mcp/Dockerfile -t odoo-rust-mcp:latest .

# Run container
docker run -d \
  -e ODOO_URL=http://host.docker.internal:8069 \
  -e ODOO_DB=mydb \
  -e ODOO_API_KEY=your-key \
  -p 8787:8787 -p 3008:3008 \
  odoo-rust-mcp:latest
```

### Docker Compose

```bash
# Create .env from example
cp dotenv.example .env
# Edit .env with your credentials

# Build and run
docker compose up --build
```

---

## Release Process

```bash
./scripts/release.sh 0.3.31
```

This script:
1. Bumps version in `rust-mcp/Cargo.toml` and `config-ui/package.json`
2. Commits with message `chore: bump version to 0.3.31`
3. Pushes to remote
4. Creates and pushes git tag `v0.3.31`

The tag triggers GitHub Actions to build multi-platform binaries, Docker images, and packages.

---

## IDE Setup

### VS Code

Recommended extensions:
- `rust-analyzer`: Rust language support
- `crates`: Dependency version hints
- `TOML Language Support`: Cargo.toml editing

**settings.json:**
```json
{
  "rust-analyzer.checkOnSave.command": "clippy",
  "rust-analyzer.cargo.features": "all"
}
```

### IntelliJ / RustRover

- Install Rust plugin
- Enable clippy on save

---

## Troubleshooting

### Build errors

```bash
# Clean build artifacts
cd rust-mcp && cargo clean

# Update dependencies
cargo update

# Rebuild
cargo build
```

### Missing static/dist

If you get "static/dist directory not found" at runtime, rebuild the React UI:

```bash
cd config-ui && npm ci && npm run build
```

The built assets must be at `rust-mcp/static/dist/` before the Rust binary runs.

### Missing system libraries (Linux)

```bash
# Debian/Ubuntu
sudo apt install build-essential libssl-dev pkg-config

# Fedora
sudo dnf install gcc openssl-devel
```

### Slow compilation

- Use `cargo build` (debug) instead of `cargo build --release`
- Consider [sccache](https://github.com/mozilla/sccache)
