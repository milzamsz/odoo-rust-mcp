# Getting Started

This guide walks you through installing and configuring odoo-rust-mcp for your first use.

## Prerequisites

- **Odoo Instance**: A running Odoo server (v16-19+)
- **Credentials**: API Key (for v19+) or Username/Password (for v16-18)
- **AI Client**: Cursor, Claude Desktop, Claude Code, Windsurf, or other MCP-compatible client

## Installation Options

### Option 1: Pre-built Binary (Recommended)

Download the latest release for your platform:

| Platform | Download |
|----------|----------|
| Windows x64 | `rust-mcp-x86_64-pc-windows-msvc.zip` |
| macOS Intel | `rust-mcp-x86_64-apple-darwin.tar.gz` |
| macOS Apple Silicon | `rust-mcp-aarch64-apple-darwin.tar.gz` |
| Linux x64 | `rust-mcp-x86_64-unknown-linux-gnu.tar.gz` |

**Download URL**: [github.com/rachmataditiya/odoo-rust-mcp/releases/latest](https://github.com/rachmataditiya/odoo-rust-mcp/releases/latest)

**Windows Installation:**
```powershell
# Download and extract
Expand-Archive rust-mcp-x86_64-pc-windows-msvc.zip -DestinationPath C:\odoo-mcp
cd C:\odoo-mcp
.\install.ps1
```

**Linux/macOS Installation:**
```bash
tar -xzf rust-mcp-<platform>.tar.gz
cd rust-mcp-<platform>
./install.sh
```

### Option 2: Homebrew (macOS/Linux)

```bash
brew tap rachmataditiya/odoo-rust-mcp
brew install rust-mcp
```

### Option 3: APT (Debian/Ubuntu)

```bash
curl -fsSL https://rachmataditiya.github.io/odoo-rust-mcp/pubkey.gpg | sudo gpg --dearmor -o /usr/share/keyrings/rust-mcp.gpg
echo "deb [signed-by=/usr/share/keyrings/rust-mcp.gpg] https://rachmataditiya.github.io/odoo-rust-mcp stable main" | sudo tee /etc/apt/sources.list.d/rust-mcp.list
sudo apt update && sudo apt install rust-mcp
```

### Option 4: Docker

```bash
docker run -d --name odoo-mcp \
  -e ODOO_URL=https://your-odoo.com \
  -e ODOO_DB=mydb \
  -e ODOO_API_KEY=your-key \
  -p 8787:8787 -p 3008:3008 \
  ghcr.io/rachmataditiya/odoo-rust-mcp:latest
```

### Option 5: Build from Source

See [Building from Source](../developer/building.md) for full instructions.

---

## Quick Configuration

### Step 1: Create Instance Configuration

Create `instances.json` with your Odoo connection details:

**Odoo 19+ (API Key authentication):**
```json
{
  "production": {
    "url": "https://your-odoo.com",
    "db": "production",
    "apiKey": "YOUR_API_KEY"
  }
}
```

**Odoo 16-18 (Username/Password authentication):**
```json
{
  "production": {
    "url": "https://your-odoo.com",
    "db": "production",
    "version": "18",
    "username": "admin",
    "password": "admin"
  }
}
```

**Multi-instance (mix and match):**
```json
{
  "production": {
    "url": "https://prod.example.com",
    "db": "production",
    "apiKey": "prod_api_key"
  },
  "staging": {
    "url": "https://staging.example.com",
    "db": "staging",
    "version": "18",
    "username": "admin",
    "password": "admin"
  }
}
```

### Step 2: Configure Your AI Client

**Cursor (`~/.cursor/mcp.json`):**

```json
{
  "mcpServers": {
    "odoo": {
      "command": "rust-mcp",
      "args": ["--transport", "stdio"],
      "env": {
        "ODOO_INSTANCES_JSON": "/path/to/instances.json"
      }
    }
  }
}
```

**Claude Desktop (`claude_desktop_config.json`):**

```json
{
  "mcpServers": {
    "odoo": {
      "command": "/path/to/rust-mcp",
      "args": ["--transport", "stdio"],
      "env": {
        "ODOO_INSTANCES_JSON": "/path/to/instances.json"
      }
    }
  }
}
```

**Claude Code (`.mcp.json` in project root):**

```json
{
  "mcpServers": {
    "odoo": {
      "command": "rust-mcp",
      "args": ["--transport", "stdio"],
      "env": {
        "ODOO_INSTANCES_JSON": "/path/to/instances.json"
      }
    }
  }
}
```

**Windsurf**: Follow Windsurf's MCP configuration guide. The server configuration is identical -- use `rust-mcp --transport stdio` as the command.

---

## Verify Installation

### Step 1: Validate Configuration

```bash
rust-mcp validate-config
```

This checks that your `instances.json` is valid and all required fields are present.

### Step 2: Test in Your AI Client

Restart your AI client, then ask:

```
List available Odoo tools
```

The assistant should respond with the 24 available tools (e.g., `odoo_search`, `odoo_read`, `odoo_create`, etc.).

### Step 3: Run a Simple Query

```
Search for the first 5 partners in my Odoo instance
```

If using multi-instance, specify which one:

```
Search for the first 5 partners in my production instance
```

---

## CLI Reference

```
rust-mcp [OPTIONS] [COMMAND]

Commands:
  validate-config    Validate Odoo instance configuration

Options:
  --transport <MODE>              Transport: stdio, http, ws (default: stdio)
  --listen <ADDR>                 Listen address for http/ws (default: 127.0.0.1:8787)
  --enable-cleanup-tools          Enable destructive cleanup tools
  --config-server-port <PORT>     Config UI port (default: 3008)
  --config-dir <DIR>              Config directory override
  -h, --help                      Print help
  -V, --version                   Print version
```

---

## Next Steps

- [Configuration Guide](./configuration.md) - Advanced configuration, protocol selection, environment variables
- [Tools Reference](./tools-reference.md) - Complete tool documentation with examples
- [Use Cases](./use-cases.md) - Real-world examples and workflows
- [Deployment](./deployment.md) - Docker, Kubernetes, and service deployment
