# Configuration Guide

This guide covers the runtime configuration surface for `odoo-rust-mcp`.

## Instance Configuration

### Multi-Instance Setup (Recommended)

Create `instances.json`:

```json
{
  "production": {
    "url": "https://prod.example.com",
    "db": "production",
    "apiKey": "prod_api_key_here",
    "tags": ["prod", "finance"]
  },
  "staging": {
    "url": "https://staging.example.com",
    "db": "staging",
    "apiKey": "staging_api_key_here"
  },
  "local": {
    "url": "http://localhost:8069",
    "db": "localdb",
    "version": "18",
    "username": "admin",
    "password": "admin"
  }
}
```

### Instance Fields

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `url` | Yes | - | Odoo server URL |
| `db` | Odoo 18 and earlier | - | Database name |
| `apiKey` | Odoo 19+ | - | API key for JSON-2 authentication |
| `version` | No | - | Odoo version |
| `username` | Odoo 18 and earlier | - | Username for JSON-RPC auth |
| `password` | Odoo 18 and earlier | - | Password for JSON-RPC auth |
| `protocol` | No | `auto` | `auto`, `jsonrpc`, or `json2` |
| `tags` | No | `[]` | Manual labels used by the Config UI |
| `readOnly` | No | `false` | When `true`, deny mutating/cleanup/execute tools for this instance even if write env is set. Edit via JSON; Config UI preserves the field on save. |
| `toolConfig.disabledTools` | No | `[]` | Per-instance tool denylist |
| `toolConfig.executeAllowlist` | No | `[]` | Required for `odoo_execute`: `[{ "model": "...", "methods": ["..."] }]`. Empty denies all execute calls. |
| `timeout_ms` | No | `30000` | Request timeout in milliseconds |
| `max_retries` | No | `2` | Maximum retry attempts |

### Protocol Selection

By default, the server auto-detects the protocol based on available credentials:

| Condition | Protocol Used |
|-----------|---------------|
| `apiKey` present | JSON-2 API (Odoo 19+) |
| `username` + `password` + `version` present | JSON-RPC (Odoo 18 and earlier) |

You can override this with the `protocol` field when needed.

### Single Instance (Legacy)

For simple setups, use environment variables instead of `instances.json`:

```bash
ODOO_URL=https://your-odoo.com
ODOO_DB=mydb
ODOO_API_KEY=your-key
```

---

## Environment Variables

### Core Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `ODOO_INSTANCES_JSON` | - | Path to `instances.json` |
| `ODOO_INSTANCES` | - | Inline JSON snapshot |
| `ODOO_URL` | - | Single-instance URL fallback |
| `ODOO_DB` | - | Database name |
| `ODOO_API_KEY` | - | API key for Odoo 19+ |
| `ODOO_VERSION` | - | Odoo version |
| `ODOO_USERNAME` | - | Username for Odoo 18 and earlier |
| `ODOO_PASSWORD` | - | Password for Odoo 18 and earlier |

### Feature Toggles

| Variable | Default | Description |
|----------|---------|-------------|
| `ODOO_ENABLE_WRITE_TOOLS` | `false` | Enable create, update, delete, workflow, copy tools |
| `ODOO_ENABLE_EXECUTE_TOOL` | `false` | Enable `odoo_execute` (still requires a non-empty per-instance `executeAllowlist`) |
| `ODOO_ENABLE_CLEANUP_TOOLS` | `false` | Enable cleanup tools only when `ODOO_ENABLE_WRITE_TOOLS` is also true; cleanup defaults to dry-run |
| `ODOO_CAPABILITY_CONTROLLED_MODE` | `false` | Hide/reject generic mutations and expose only `odoo_execute_capability` |
| `ODOO_CAPABILITY_REGISTRY` | — | Required in controlled mode: normalized `odoo-agent` registry JSON |
| `ODOO_CAPABILITY_APPROVAL_HMAC_KEY` | — | Required in controlled mode: approval-envelope HMAC key of at least 32 bytes |
| `ODOO_CAPABILITY_STATE_DIR` | — | Required in controlled mode: persistent 0700 idempotency-state directory |
| `ODOO_TIMEOUT_MS` | `30000` | Request timeout in milliseconds |
| `ODOO_MAX_RETRIES` | `2` | Retry attempts |
| `ODOO_MODULE_SNAPSHOT_TTL_SECS` | `300` | Installed-module snapshot TTL; `0` refreshes every instance-scoped list |

### MCP Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_TOOLS_JSON` | Auto | Path to `tools.json` |
| `MCP_PROMPTS_JSON` | Auto | Path to `prompts.json` |
| `MCP_SERVER_JSON` | Auto | Path to `server.json` |

### Authentication (HTTP Transport)

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_AUTH_ENABLED` | `false` | Enable bearer-token auth for MCP HTTP |
| `MCP_AUTH_TOKEN` | - | Auth token |
| `MCP_ALLOWED_ORIGINS` | - | Allowed CORS origins |

### Config UI

| Variable | Default | Description |
|----------|---------|-------------|
| `ODOO_CONFIG_SERVER_PORT` | `3008` | Config UI port |
| `ODOO_CONFIG_DIR` | `~/.config/odoo-rust-mcp` | Config directory path |
| `CONFIG_UI_USERNAME` | `admin` | Login username |
| `CONFIG_UI_PASSWORD` | `changeme` | Login password |

### Logging

| Variable | Default | Description |
|----------|---------|-------------|
| `RUST_LOG` | `info` | Log level |

---

## Transport Modes

### stdio

```bash
odoo-rust-mcp --transport stdio
```

- used by local AI clients
- Config UI still runs on port `3008`

### HTTP

```bash
odoo-rust-mcp --transport http --listen 127.0.0.1:8787
```

- MCP endpoint: `POST /mcp`
- health endpoint: `GET /health`
- optional bearer-token auth

### WebSocket

```bash
odoo-rust-mcp --transport ws --listen 127.0.0.1:8787
```

---

## Config UI

Access the visual configuration interface at `http://localhost:3008`.

### Main Areas

| Area | Purpose |
|------|---------|
| **Overview** | Runtime summary and posture checks |
| **Instances** | Add, edit, test, import, and export Odoo connections |
| **Tools** | Enable or disable tool groups and individual tools |
| **Prompts** | Edit prompt content and descriptions |
| **Server** | Edit server name, instructions, protocol version |
| **Security** | Change Config UI password and manage MCP HTTP auth |
| **Documentation** | Open the built-in docs in a separate tab |

### First-time Setup

1. Open `http://localhost:3008`
2. Sign in with `admin` / `changeme`
3. Go to **Security** and change the default password
4. Configure instances in **Instances**
5. Optionally enable MCP HTTP auth in **Security**
6. Use the **Documentation** sidebar entry when you want the built-in docs in a new tab

### Hot Reload

Changes made through the Config UI or by directly editing JSON config files take effect immediately.

---

## Configuration File Locations

### User Config (Runtime)

| Platform | Directory |
|----------|-----------|
| Linux/macOS | `~/.config/odoo-rust-mcp/` |
| Windows | `%APPDATA%\\odoo-rust-mcp\\` or user-specified |

Files: `instances.json`, `tools.json`, `prompts.json`, `server.json`, `env`

### System Config (Service Installs)

| Platform | Directory |
|----------|-----------|
| Linux (systemd) | `/etc/odoo-rust-mcp/` |
| Linux (deb) | `/usr/share/odoo-rust-mcp/` |
| Windows | `%ProgramData%\\odoo-rust-mcp\\` |

### Config Resolution Order

1. Explicit environment variable path
2. User config directory
3. Embedded defaults

---

## Deployment Notes

| Method | Best For |
|--------|----------|
| Binary + stdio | Local development and single AI client use |
| Binary + HTTP | Remote access and multiple users |
| Docker | Quick isolated deployment |
| Docker Compose | Multi-service setups |
| Kubernetes / Helm | Production deployments |
| systemd / Windows Service | Background service installs |

See [Deployment Guide](./deployment.md) for full setup detail.
