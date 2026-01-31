# Architecture Overview

This document describes the internal architecture of odoo-rust-mcp.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         MCP Clients                              │
│        (Cursor, Claude Desktop, Custom Integrations)            │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Transport Layer                               │
│     ┌─────────┬─────────┬─────────┬─────────┐                   │
│     │  stdio  │  HTTP   │   SSE   │   WS    │                   │
│     └────┬────┴────┬────┴────┬────┴────┬────┘                   │
│          └─────────┴─────────┴─────────┘                        │
└─────────────────────────┬───────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MCP Protocol Handler                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │    Tools     │  │   Prompts    │  │  Resources   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────┬───────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Operation Dispatcher                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │  search  │  │   read   │  │  create  │  │ execute  │ ...    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
└─────────────────────────┬───────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Odoo Client                                 │
│  ┌──────────────────┐  ┌──────────────────┐                     │
│  │   JSON-2 (v19+)  │  │  JSON-RPC (<19)  │                     │
│  └──────────────────┘  └──────────────────┘                     │
└─────────────────────────┬───────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Odoo Instance(s)                              │
│              Production | Staging | Development                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
odoo-rust-mcp/
├── rust-mcp/                    # Main Rust project
│   ├── src/
│   │   ├── main.rs              # Entry point, CLI parsing
│   │   ├── lib.rs               # Library exports
│   │   ├── mcp/                 # MCP protocol implementation
│   │   │   ├── mod.rs           # Module exports
│   │   │   ├── server.rs        # MCP server core
│   │   │   ├── tools.rs         # Tool handling
│   │   │   ├── prompts.rs       # Prompt handling
│   │   │   ├── resources.rs     # Resource handling
│   │   │   └── transport/       # Transport implementations
│   │   │       ├── stdio.rs     # stdio transport
│   │   │       ├── http.rs      # HTTP/SSE transport
│   │   │       └── ws.rs        # WebSocket transport
│   │   ├── odoo/                # Odoo integration
│   │   │   ├── mod.rs           # Module exports
│   │   │   ├── client.rs        # HTTP client for Odoo
│   │   │   ├── config.rs        # Instance configuration
│   │   │   ├── json2.rs         # JSON-2 API (v19+)
│   │   │   ├── jsonrpc.rs       # JSON-RPC API (<v19)
│   │   │   └── operations.rs    # CRUD operations
│   │   ├── config_manager/      # Config UI server
│   │   │   ├── mod.rs           # Module exports
│   │   │   ├── server.rs        # HTTP server for UI
│   │   │   └── handlers.rs      # API handlers
│   │   └── cleanup/             # Database cleanup tools
│   ├── config/                  # Runtime config files
│   │   ├── tools.json           # Tool definitions
│   │   ├── prompts.json         # Prompt definitions
│   │   └── server.json          # Server metadata
│   ├── config-defaults/         # Seed defaults (embedded)
│   ├── tests/                   # Unit and integration tests
│   ├── Cargo.toml               # Rust dependencies
│   └── Dockerfile               # Container build
├── config/                      # Example configs
├── config-ui/                   # React config UI
├── k8s/                         # Kubernetes manifests
├── helm/                        # Helm chart
├── scripts/                     # Helper scripts
└── .github/                     # CI/CD workflows
```

---

## Key Components

### 1. Transport Layer

Handles communication with MCP clients.

| Transport | Module | Use Case |
|-----------|--------|----------|
| stdio | `transport/stdio.rs` | Local AI clients (Cursor, Claude) |
| HTTP | `transport/http.rs` | Remote access, webhooks |
| SSE | `transport/http.rs` | Legacy streaming |
| WebSocket | `transport/ws.rs` | Real-time integrations |

### 2. MCP Protocol Handler

Implements the Model Context Protocol specification.

**Key functions:**
- `initialize`: Capability negotiation
- `tools/list`: Return available tools
- `tools/call`: Execute tool operations
- `prompts/list`: Return available prompts
- `prompts/get`: Return prompt content
- `resources/list`: Return Odoo resources

### 3. Operation Dispatcher

Maps tool operations to Odoo API calls.

**Operation types:**
- `search`, `search_read`, `read`, `create`, `write`, `unlink`
- `search_count`, `execute`, `workflow_action`
- `get_model_metadata`, `list_models`, `check_access`
- `generate_report`, `create_batch`
- `database_cleanup`, `deep_cleanup`

### 4. Odoo Client

Handles communication with Odoo instances.

**Dual API support:**
- **JSON-2** (`/json/2/...`): For Odoo 19+ with API keys
- **JSON-RPC** (`/jsonrpc`): For Odoo <19 with username/password

### 5. Config Manager

Web-based configuration UI on port 3008.

**Features:**
- Edit JSON config files
- Manage instances
- Authentication settings
- Hot-reload support

---

## Data Flow

### Tool Call Flow

```
1. Client sends tools/call request
      ↓
2. Transport layer receives request
      ↓
3. MCP handler parses tool name and arguments
      ↓
4. Operation dispatcher maps to Odoo operation
      ↓
5. Odoo client makes API request
      ↓
6. Response transformed to MCP format
      ↓
7. Result returned to client
```

### Configuration Loading

```
1. Server starts
      ↓
2. Load environment variables (.env)
      ↓
3. Parse ODOO_INSTANCES_JSON or ODOO_INSTANCES
      ↓
4. Load tools.json, prompts.json, server.json
      ↓
5. Validate configurations
      ↓
6. Start transport listeners
      ↓
7. File watchers for hot-reload
```

---

## Thread Safety

- **Arc<RwLock>** for shared configuration state
- **Async/await** with Tokio runtime
- Configuration changes trigger atomic swaps
- No locking during Odoo API calls

---

## Error Handling

All errors propagate as MCP error responses:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32000,
    "message": "Odoo error: Access Denied"
  }
}
```

**Error categories:**
- Transport errors
- Authentication errors
- Odoo API errors
- Validation errors
