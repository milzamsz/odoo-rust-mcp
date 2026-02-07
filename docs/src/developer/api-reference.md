# API Reference

Internal API documentation for odoo-rust-mcp developers.

---

## MCP Protocol Methods

### initialize

Called by clients to establish a session.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2025-03-26",
    "clientInfo": {
      "name": "cursor",
      "version": "1.0.0"
    }
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2025-03-26",
    "serverInfo": {
      "name": "odoo-rust-mcp",
      "version": "0.3.30"
    },
    "capabilities": {
      "tools": {},
      "prompts": {},
      "resources": {}
    }
  }
}
```

---

### tools/list

List available tools.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list"
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "tools": [
      {
        "name": "odoo_search",
        "description": "Search for Odoo records...",
        "inputSchema": { ... }
      }
    ]
  }
}
```

---

### tools/call

Execute a tool.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "odoo_search_read",
    "arguments": {
      "instance": "production",
      "model": "res.partner",
      "domain": [["is_company", "=", true]],
      "fields": ["name", "email"],
      "limit": 10
    }
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"records\":[...],\"count\":10}"
      }
    ]
  }
}
```

---

### prompts/list

List available prompts.

**Response:**
```json
{
  "result": {
    "prompts": [
      {
        "name": "odoo_common_models",
        "description": "List of commonly used Odoo models"
      }
    ]
  }
}
```

---

### prompts/get

Get prompt content.

**Request:**
```json
{
  "method": "prompts/get",
  "params": {
    "name": "odoo_domain_filters"
  }
}
```

---

### resources/list

List Odoo resources.

**Response:**
```json
{
  "result": {
    "resources": [
      { "uri": "odoo://instances", "name": "Odoo Instances" },
      { "uri": "odoo://production/models", "name": "Models" }
    ]
  }
}
```

---

## Operation Types

Internal operation types mapped from `tools.json` via `op.type`:

| Type | Tool Name | Description |
|------|-----------|-------------|
| `search` | `odoo_search` | Search for record IDs |
| `search_read` | `odoo_search_read` | Search and read records |
| `read` | `odoo_read` | Read records by IDs |
| `create` | `odoo_create` | Create new record |
| `write` | `odoo_update` | Update records |
| `unlink` | `odoo_delete` | Delete records |
| `search_count` | `odoo_count` | Count records |
| `execute` | `odoo_execute` | Execute model method |
| `workflow_action` | `odoo_workflow_action` | Call workflow action |
| `generate_report` | `odoo_generate_report` | Generate PDF report |
| `get_model_metadata` | `odoo_get_model_metadata` | Get model fields |
| `list_models` | `odoo_list_models` | List available models |
| `check_access` | `odoo_check_access` | Check permissions |
| `create_batch` | `odoo_create_batch` | Batch create records |
| `read_group` | `odoo_read_group` | Aggregate data |
| `name_search` | `odoo_name_search` | Autocomplete search |
| `name_get` | `odoo_name_get` | Get display names |
| `default_get` | `odoo_default_get` | Get default values |
| `copy` | `odoo_copy` | Duplicate record |
| `onchange` | `odoo_onchange` | Simulate onchange |
| `database_cleanup` | `odoo_database_cleanup` | Clean database |
| `deep_cleanup` | `odoo_deep_cleanup` | Deep clean database |

---

## MCP HTTP Endpoints

When running in HTTP transport mode (`--transport http`):

### MCP Streamable HTTP (per MCP spec)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/mcp` | POST | Send JSON-RPC messages |
| `/mcp` | GET | Open SSE stream for server-to-client notifications |
| `/mcp` | DELETE | Terminate a session |

### Legacy Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/sse` | GET | Legacy SSE transport |
| `/messages` | POST | Legacy message endpoint |

### Public Endpoints (no auth)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/openapi.json` | GET | OpenAPI specification |

### Health Check Response

```json
{
  "service": "odoo-rust-mcp",
  "status": "ok"
}
```

---

## Config UI API (Port 3008)

### Authentication

The Config UI uses Bearer token authentication. Token is stored in `localStorage` as `mcp_config_token` and sent via the `Authorization: Bearer {token}` header.

### Public Endpoints (no auth required)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Config server health check |
| `/api/auth/status` | GET | Check authentication status |
| `/api/auth/login` | POST | Login with username/password |
| `/api/auth/logout` | POST | Logout and invalidate token |

### Protected Endpoints (require auth)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/config/instances` | GET | Get instances configuration |
| `/api/config/instances` | POST | Save instances configuration |
| `/api/config/tools` | GET | Get tools configuration |
| `/api/config/tools` | POST | Save tools configuration |
| `/api/config/prompts` | GET | Get prompts configuration |
| `/api/config/prompts` | POST | Save prompts configuration |
| `/api/config/server` | GET | Get server configuration |
| `/api/config/server` | POST | Save server configuration |
| `/api/auth/change-password` | POST | Change Config UI password |
| `/api/auth/mcp-auth-status` | GET | Get MCP HTTP auth status |
| `/api/auth/mcp-auth-enabled` | POST | Enable/disable MCP HTTP auth |
| `/api/auth/generate-mcp-token` | POST | Generate new MCP auth token |

### Static Files

The React UI is served as a fallback via `ServeDir` from the `static/dist/` directory.

### Config Server Health Check Response

```json
{
  "service": "odoo-rust-mcp-config",
  "status": "ok"
}
```

---

## Odoo API Mapping

### JSON-2 API (v19+)

```
POST /json/2/{db}/{model}/{method}
Authorization: Bearer {api_key}
Content-Type: application/json
```

### JSON-RPC API (<v19)

```
POST /jsonrpc
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "method": "call",
  "params": {
    "service": "object",
    "method": "execute_kw",
    "args": [db, uid, password, model, method, args, kwargs]
  }
}
```

---

## Error Codes

| Code | Category | Description |
|------|----------|-------------|
| -32700 | Parse error | Invalid JSON |
| -32600 | Invalid request | Malformed JSON-RPC |
| -32601 | Method not found | Unknown MCP method |
| -32602 | Invalid params | Missing or invalid parameters |
| -32603 | Internal error | Server-side error |
| -32000 | Odoo error | Error from Odoo API |
| -32001 | Authentication error | Invalid credentials |
| -32002 | Access denied | Insufficient permissions |
