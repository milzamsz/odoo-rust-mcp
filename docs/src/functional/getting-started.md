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
| Windows x64 | `odoo-rust-mcp-x86_64-pc-windows-msvc.zip` |
| macOS Intel | `odoo-rust-mcp-x86_64-apple-darwin.tar.gz` |
| macOS Apple Silicon | `odoo-rust-mcp-aarch64-apple-darwin.tar.gz` |
| Linux x64 | `odoo-rust-mcp-x86_64-unknown-linux-gnu.tar.gz` |

**Download URL**: [github.com/rachmataditiya/odoo-rust-mcp/releases/latest](https://github.com/rachmataditiya/odoo-rust-mcp/releases/latest)

**Windows Installation:**
```powershell
# Download and extract
Expand-Archive odoo-rust-mcp-x86_64-pc-windows-msvc.zip -DestinationPath C:\odoo-mcp
cd C:\odoo-mcp
.\install.ps1
```

> [!NOTE]
> The Windows installer automatically sets up two shortcuts on your desktop:
> - **Odoo MCP Server**: Starts the server natively on Windows.
> - **Odoo WSL MCP Server**: Starts the server inside WSL (Ubuntu) in the background.
>
> If you ever need to recreate or refresh these desktop shortcuts, run:
> ```powershell
> .\install.ps1 -Shortcut
> ```
>
> The shortcut creators call the launcher scripts directly with PowerShell `-File`, so they behave more consistently when the repository lives on a normal Windows drive or a UNC-backed path.

**Linux/macOS Installation:**
```bash
tar -xzf odoo-rust-mcp-<platform>.tar.gz
cd rust-mcp-<platform>
./install.sh
```

### Option 2: Homebrew (macOS/Linux)

```bash
curl -fsSL https://raw.githubusercontent.com/milzamsz/odoo-rust-mcp/main/homebrew/Formula/odoo-rust-mcp.rb -o odoo-rust-mcp.rb
brew install ./odoo-rust-mcp.rb
```

### Option 3: APT (Debian/Ubuntu)

```bash
curl -fsSL https://milzamsz.github.io/odoo-rust-mcp/pubkey.gpg | sudo gpg --dearmor -o /usr/share/keyrings/odoo-rust-mcp.gpg
echo "deb [signed-by=/usr/share/keyrings/odoo-rust-mcp.gpg] https://milzamsz.github.io/odoo-rust-mcp stable main" | sudo tee /etc/apt/sources.list.d/odoo-rust-mcp.list
sudo apt update && sudo apt install odoo-rust-mcp
```

### Option 4: Docker

```bash
docker run -d --name odoo-mcp \
  -e ODOO_URL=https://your-odoo.com \
  -e ODOO_DB=mydb \
  -e ODOO_API_KEY=your-key \
  -p 8787:8787 -p 3008:3008 \
  ghcr.io/milzamsz/odoo-rust-mcp:latest
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
      "command": "odoo-rust-mcp",
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
      "command": "/path/to/odoo-rust-mcp",
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
      "command": "odoo-rust-mcp",
      "args": ["--transport", "stdio"],
      "env": {
        "ODOO_INSTANCES_JSON": "/path/to/instances.json"
      }
    }
  }
}
```

**Windsurf**: Follow Windsurf's MCP configuration guide. The server configuration is identical -- use `odoo-rust-mcp --transport stdio` as the command.

---

## Verify Installation

### Step 1: Validate Configuration

```bash
odoo-rust-mcp validate-config
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
odoo-rust-mcp [OPTIONS] [COMMAND]

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

## Connecting MCP Clients to the Desktop App

When running the native Tauri desktop application, the local MCP HTTP server is automatically started in the background on port `8787` (`http://127.0.0.1:8787`).

You can connect external AI tools (Cursor, Claude Desktop, Claude Code, VS Code, Antigravity, etc.) using one of the following methods.

### Option 1: HTTP / SSE Connection (Recommended for Desktop App)

If your client supports HTTP/SSE, you can configure it to connect directly to the running desktop app. This is the most efficient method as it doesn't spawn additional processes.

#### 1. Claude Code
Add to your project's `.mcp.json` file:
```json
{
  "mcpServers": {
    "odoo-rust-mcp": {
      "url": "http://127.0.0.1:8787/mcp"
    }
  }
}
```
*(If HTTP Authentication is enabled, make sure to add `"headers": { "Authorization": "Bearer <YOUR_TOKEN>" }` inside the server configuration object)*

#### 2. VS Code / Antigravity / Other HTTP-capable clients
Configure your client settings with the server URL:
`http://127.0.0.1:8787/mcp` (or `/sse` depending on the client).

---

### Option 2: Stdio Connection (For Cursor and Claude Desktop)

Clients like **Cursor** and **Claude Desktop** require launching their own MCP subprocess. For these clients, configure them to run the standalone `odoo-rust-mcp.exe` binary.

#### 1. Cursor (`~/.cursor/mcp.json`)
Add the following configuration (replace with the absolute path to your downloaded binary):
```json
{
  "mcpServers": {
    "odoo-rust-mcp": {
      "command": "C:\\path\\to\\odoo-rust-mcp.exe",
      "args": ["--transport", "stdio"]
    }
  }
}
```

#### 2. Claude Desktop (`%APPDATA%\Claude\claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "odoo-rust-mcp": {
      "command": "C:\\path\\to\\odoo-rust-mcp.exe",
      "args": ["--transport", "stdio"]
    }
  }
}
```

> [!TIP]
> Surfacing ready-to-paste configurations is built into the desktop app! Click **Copy MCP Endpoint** from the system tray menu, or navigate to the **Overview** tab in the app to copy tailored configuration snippets.

---

## Next Steps

- [Configuration Guide](./configuration.md) - Advanced configuration, protocol selection, environment variables
- [Tools Reference](./tools-reference.md) - Complete tool documentation with examples
- [Use Cases](./use-cases.md) - Real-world examples and workflows
- [Deployment](./deployment.md) - Docker, Kubernetes, and service deployment
