# Getting Started

This guide walks you through installing and configuring odoo-rust-mcp for your first use.

## Prerequisites

- **Odoo Instance**: A running Odoo server (v16-19+)
- **Credentials**: API Key (for v19+) or Username/Password (for v16-18)
- **AI Client**: Cursor, Claude Desktop, or other MCP-compatible client

## Installation Options

### Option 1: Pre-built Binary (Recommended)

Download the latest release for your platform:

| Platform | Download |
|----------|----------|
| Windows x64 | `rust-mcp-x86_64-pc-windows-msvc.zip` |
| macOS Intel | `rust-mcp-x86_64-apple-darwin.tar.gz` |
| macOS Apple Silicon | `rust-mcp-aarch64-apple-darwin.tar.gz` |
| Linux x64 | `rust-mcp-x86_64-unknown-linux-gnu.tar.gz` |

**Download URL**: https://github.com/rachmataditiya/odoo-rust-mcp/releases/latest

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
  -p 8787:8787 \
  ghcr.io/rachmataditiya/odoo-rust-mcp:latest
```

---

## Quick Configuration

### Step 1: Create Instance Configuration

Create `instances.json`:

```json
{
  "production": {
    "url": "https://your-odoo.com",
    "db": "production",
    "apiKey": "YOUR_API_KEY"
  }
}
```

> **For Odoo < 19**, use `username` and `password` instead of `apiKey`, plus add `"version": "18"`.

### Step 2: Set Environment Variables

Create `.env` file:

```bash
ODOO_INSTANCES_JSON=/path/to/instances.json

# Optional: Enable write tools
ODOO_ENABLE_WRITE_TOOLS=true
```

### Step 3: Configure Your AI Client

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

---

## Verify Installation

1. Restart your AI client
2. Ask: "List available Odoo tools"
3. The assistant should show tools like `odoo_search`, `odoo_read`, etc.

**Test a simple query:**
```
Search for the first 5 partners in my Odoo instance
```

---

## Next Steps

- [Configuration Guide](./configuration.md) - Advanced configuration options
- [Tools Reference](./tools-reference.md) - Complete tool documentation
- [Use Cases](./use-cases.md) - Real-world examples
