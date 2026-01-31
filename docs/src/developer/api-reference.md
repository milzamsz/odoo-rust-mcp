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
      "version": "1.0.0"
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

Internal operation types mapped from `tools.json`:

| Type | Description |
|------|-------------|
| `search` | Search for record IDs |
| `search_read` | Search and read records |
| `read` | Read records by IDs |
| `create` | Create new record |
| `write` | Update records |
| `unlink` | Delete records |
| `search_count` | Count records |
| `execute` | Execute model method |
| `workflow_action` | Call workflow action |
| `generate_report` | Generate PDF report |
| `get_model_metadata` | Get model fields |
| `list_models` | List available models |
| `check_access` | Check permissions |
| `create_batch` | Batch create records |
| `read_group` | Aggregate data |
| `name_search` | Autocomplete search |
| `name_get` | Get display names |
| `default_get` | Get default values |
| `copy` | Duplicate record |
| `onchange` | Simulate onchange |
| `database_cleanup` | Clean database |
| `deep_cleanup` | Deep clean database |

---

## HTTP Endpoints

When running in HTTP transport mode:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/mcp` | POST | MCP JSON-RPC requests |
| `/mcp` | GET | SSE stream |
| `/mcp` | DELETE | Terminate session |
| `/health` | GET | Health check |
| `/openapi.json` | GET | OpenAPI spec |

### Health Check

```json
{
  "status": "ok",
  "version": "1.0.0",
  "instance": {
    "name": "production",
    "reachable": true
  }
}
```

---

## Config UI API

Config server on port 3008:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/config/instances` | GET/POST | Manage instances |
| `/api/config/tools` | GET/POST | Manage tools |
| `/api/config/prompts` | GET/POST | Manage prompts |
| `/api/config/server` | GET/POST | Manage server config |
| `/api/config/auth/status` | GET | Auth status |
| `/api/config/auth/enable` | POST | Enable/disable auth |
| `/api/config/auth/token/generate` | POST | Generate auth token |
| `/health` | GET | Health check |

---

## Odoo API Mapping

### JSON-2 API (v19+)

```
POST /json/2/{db}/{model}/{method}
Authorization: Bearer {api_key}
```

### JSON-RPC API (<v19)

```
POST /jsonrpc
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

| Code | Description |
|------|-------------|
| -32700 | Parse error |
| -32600 | Invalid request |
| -32601 | Method not found |
| -32602 | Invalid params |
| -32603 | Internal error |
| -32000 | Odoo error |
| -32001 | Authentication error |
| -32002 | Access denied |
