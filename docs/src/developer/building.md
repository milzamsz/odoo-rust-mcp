# Building from Source

Guide to building odoo-rust-mcp from source code.

---

## Prerequisites

- **Rust toolchain**: 1.70+ (install via [rustup](https://rustup.rs/))
- **Git**: For cloning the repository
- **Odoo instance**: For testing (optional)

---

## Quick Build

```bash
# Clone the repository
git clone https://github.com/rachmataditiya/odoo-rust-mcp.git
cd odoo-rust-mcp

# Build debug version
cd rust-mcp
cargo build

# Build release version (optimized)
cargo build --release
```

**Binary location:**
- Debug: `rust-mcp/target/debug/rust-mcp`
- Release: `rust-mcp/target/release/rust-mcp`

---

## Development Setup

### 1. Install Rust

```bash
# Linux/macOS
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Windows
# Download and run rustup-init.exe from https://rustup.rs/
```

### 2. Clone and Build

```bash
git clone https://github.com/rachmataditiya/odoo-rust-mcp.git
cd odoo-rust-mcp/rust-mcp
cargo build
```

### 3. Configure Environment

```bash
# Create config directory
mkdir -p ~/.config/odoo-rust-mcp

# Create env file
cat > ~/.config/odoo-rust-mcp/env <<EOF
ODOO_URL=http://localhost:8069
ODOO_DB=mydb
ODOO_VERSION=18
ODOO_USERNAME=admin
ODOO_PASSWORD=admin
EOF
```

### 4. Run the Server

```bash
# stdio transport
./target/debug/rust-mcp --transport stdio

# HTTP transport
./target/debug/rust-mcp --transport http --listen 127.0.0.1:8787
```

---

## Build Options

### Debug Build (Fast compilation)

```bash
cargo build
```

### Release Build (Optimized)

```bash
cargo build --release
```

### Build with All Features

```bash
cargo build --release --all-features
```

### Cross-Compilation

Using [cross](https://github.com/cross-rs/cross):

```bash
# Install cross
cargo install cross

# Build for Linux (from macOS/Windows)
cross build --release --target x86_64-unknown-linux-gnu

# Build for Windows (from Linux/macOS)
cross build --release --target x86_64-pc-windows-msvc
```

---

## Running Tests

```bash
cd rust-mcp

# Run all tests
cargo test

# Run tests with output
cargo test -- --nocapture

# Run specific test
cargo test test_name

# Run with warnings as errors
RUSTFLAGS='-Dwarnings' cargo test
```

---

## Linting & Formatting

```bash
cd rust-mcp

# Format code
cargo fmt

# Check formatting (CI mode)
cargo fmt --check

# Run clippy linter
cargo clippy

# Run clippy with all warnings
cargo clippy -- -W clippy::all
```

---

## Docker Build

```bash
# From repository root
docker build -t odoo-rust-mcp:latest .

# Run container
docker run -d \
  -e ODOO_URL=http://host.docker.internal:8069 \
  -e ODOO_DB=mydb \
  -e ODOO_API_KEY=your-key \
  -p 8787:8787 \
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

## Config UI Development

The Config UI is a React application in `config-ui/`.

```bash
cd config-ui

# Install dependencies
npm install

# Development server
npm run dev

# Production build
npm run build
```

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
cargo clean

# Update dependencies
cargo update

# Rebuild
cargo build
```

### Missing system libraries (Linux)

```bash
# Debian/Ubuntu
sudo apt install build-essential libssl-dev pkg-config

# Fedora
sudo dnf install gcc openssl-devel
```

### Slow compilation

- Use `cargo build` (debug) instead of `cargo build --release`
- Consider using [sccache](https://github.com/mozilla/sccache)
