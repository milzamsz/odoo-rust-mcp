# Configuration Guide

This guide covers all configuration options for odoo-rust-mcp.

## Instance Configuration

### Multi-Instance Setup (Recommended)

Create `instances.json`:

```json
{
  "production": {
    "url": "https://prod.example.com",
    "db": "production",
    "apiKey": "prod_api_key_here"
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

**Instance Fields:**

| Field | Required | Description |
|-------|----------|-------------|
| `url` | ✅ | Odoo server URL |
| `db` | ✅ (v<19) | Database name |
| `apiKey` | ✅ (v19+) | API key for authentication |
| `version` | v<19 | Odoo version (triggers username/password mode) |
| `username` | v<19 | Username for JSON-RPC auth |
| `password` | v<19 | Password for JSON-RPC auth |

### Single Instance (Legacy)

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
| `ODOO_INSTANCES_JSON` | - | Path to `instances.json` file |
| `ODOO_INSTANCES` | - | Inline JSON (single-line, alternative to file) |
| `ODOO_URL` | - | Single instance URL (fallback) |
| `ODOO_DB` | - | Database name |
| `ODOO_API_KEY` | - | API key for v19+ |
| `ODOO_VERSION` | - | Odoo version (triggers legacy mode) |
| `ODOO_USERNAME` | - | Username for v<19 |
| `ODOO_PASSWORD` | - | Password for v<19 |

### Feature Toggles

| Variable | Default | Description |
|----------|---------|-------------|
| `ODOO_ENABLE_WRITE_TOOLS` | `false` | Enable create/update/delete tools |
| `ODOO_ENABLE_CLEANUP_TOOLS` | `false` | Enable database cleanup tools |
| `ODOO_TIMEOUT_MS` | `30000` | Request timeout in milliseconds |
| `ODOO_MAX_RETRIES` | `2` | Retry attempts for failed requests |
| `ODOO_METADATA_CACHE_TTL_SECS` | `3600` | Metadata cache duration (1 hour) |

### MCP Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_TOOLS_JSON` | Auto | Path to `tools.json` |
| `MCP_PROMPTS_JSON` | Auto | Path to `prompts.json` |
| `MCP_SERVER_JSON` | Auto | Path to `server.json` |

### Authentication (HTTP Transport)

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_AUTH_ENABLED` | `false` | Enable Bearer token auth |
| `MCP_AUTH_TOKEN` | - | Auth token (generate with `openssl rand -hex 32`) |
| `MCP_ALLOWED_ORIGINS` | - | Comma-separated allowed origins |

### Config UI

| Variable | Default | Description |
|----------|---------|-------------|
| `ODOO_CONFIG_SERVER_PORT` | `3008` | Config UI port |
| `CONFIG_UI_USERNAME` | `admin` | Login username |
| `CONFIG_UI_PASSWORD` | `changeme` | **Change immediately!** |

---

## Transport Modes

### stdio (Recommended for AI Clients)

```bash
rust-mcp --transport stdio
```
- Used by Cursor, Claude Desktop
- Communication via stdin/stdout

### HTTP (Remote/Multi-user)

```bash
rust-mcp --transport http --listen 127.0.0.1:8787
```
- Endpoints: `/mcp`, `/health`, `/openapi.json`
- Supports Bearer token authentication

### WebSocket

```bash
rust-mcp --transport ws --listen 127.0.0.1:8787
```
- For custom integrations

### SSE (Legacy)

```bash
rust-mcp --transport http --listen 127.0.0.1:8787
```
- Available at `/sse` endpoint

---

## Config UI (Web Interface)

Access the visual configuration interface at `http://localhost:3008`.

**Features:**
- Edit `tools.json`, `prompts.json`, `server.json`
- Manage Odoo instances
- Enable/disable tools
- Generate auth tokens
- Real-time validation

**First-time setup:**
1. Login with `admin` / `changeme`
2. Go to **Security** tab → Change password
3. Configure instances in **Instances** tab

---

## Customizing Tools

Edit `tools.json` to:
- Remove tools you don't need
- Add guards for conditional enabling
- Modify tool descriptions

**Example: Read-only mode**
Remove `odoo_create`, `odoo_update`, `odoo_delete` from the `tools` array.

**Example: Conditional tools**
```json
{
  "name": "odoo_create",
  "guards": { "requiresEnvTrue": "ODOO_ENABLE_WRITE_TOOLS" },
  ...
}
```

---

## Deployment Options

| Method | Best For |
|--------|----------|
| Binary | Local development, single user |
| Docker | Quick deployment, isolation |
| Docker Compose | Multi-service setups (n8n, Dify) |
| Kubernetes | Production, high availability |
| Helm | Production, customizable deployment |

See [Developer: Building](../developer/building.md) for details.
