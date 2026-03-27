# Architecture Overview

This document describes the internal architecture of odoo-rust-mcp.

---

## High-Level Architecture

```
+-------------------------------------------------------------------+
|                         MCP Clients                               |
|        (Cursor, Claude Desktop, Claude Code, Windsurf)            |
+-------------------------------+-----------------------------------+
                                |
                                v
+-------------------------------------------------------------------+
|                    Transport Layer                                 |
|     +----------+-----------+-----------+----------+               |
|     |  stdio   |   HTTP    |    SSE    |    WS    |               |
|     +----+-----+-----+-----+-----+-----+----+----+               |
|          +------------+-----+-----+-----------+                   |
+-------------------------------+-----------------------------------+
                                v
+-------------------------------------------------------------------+
|                    MCP Protocol Handler                            |
|  +--------------+  +--------------+  +--------------+             |
|  |    Tools     |  |   Prompts    |  |  Resources   |             |
|  +--------------+  +--------------+  +--------------+             |
+-------------------------------+-----------------------------------+
                                v
+-------------------------------------------------------------------+
|                    Operation Dispatcher                            |
|  +--------+  +------+  +--------+  +---------+  +---------+      |
|  | search |  | read |  | create |  | execute |  | cleanup | ...  |
|  +--------+  +------+  +--------+  +---------+  +---------+      |
+-------------------------------+-----------------------------------+
                                v
+-------------------------------------------------------------------+
|                      Odoo Client Pool                             |
|  +--------------------+  +--------------------+                   |
|  |  JSON-2 (v19+)     |  |  JSON-RPC (<19)    |                  |
|  |  client.rs          |  |  legacy_client.rs  |                  |
|  +--------------------+  +--------------------+                   |
+-------------------------------+-----------------------------------+
                                v
+-------------------------------------------------------------------+
|                    Odoo Instance(s)                                |
|              Production | Staging | Development                   |
+-------------------------------------------------------------------+
```

---

## Directory Structure

```
odoo-rust-mcp/
+-- rust-mcp/                       # Main Rust project
|   +-- src/
|   |   +-- main.rs                 # CLI entry: transport selection, config setup
|   |   +-- lib.rs                  # Library root: pub mod cleanup, config_manager, mcp, odoo
|   |   +-- bin/                    # Additional binaries (ws_smoke_client)
|   |   +-- mcp/                    # MCP protocol implementation
|   |   |   +-- mod.rs              # McpOdooHandler (ServerHandler trait impl)
|   |   |   +-- tools.rs            # Tool dispatch: execute_op() router, 22 op handlers
|   |   |   +-- registry.rs         # Config loading, tool/prompt definitions, guard evaluation
|   |   |   +-- cache.rs            # MetadataCache: TTL-based in-memory caching
|   |   |   +-- cursor_stdio.rs     # stdio transport for Cursor/Claude Desktop
|   |   |   +-- http.rs             # Axum HTTP server, Streamable HTTP + SSE transport
|   |   |   +-- prompts.rs          # MCP prompt handling
|   |   |   +-- resources.rs        # odoo:// URI resource definitions
|   |   |   +-- runtime.rs          # ServerCompat wrapper for MCP SDK
|   |   +-- odoo/                   # Odoo API clients
|   |   |   +-- mod.rs              # Module exports
|   |   |   +-- unified_client.rs   # OdooClient trait (abstraction over both clients)
|   |   |   +-- client.rs           # Odoo 19+ JSON-2 API client (API key auth)
|   |   |   +-- legacy_client.rs    # Odoo <19 JSON-RPC client (username/password)
|   |   |   +-- config.rs           # Instance config parsing, OdooProtocol enum
|   |   |   +-- types.rs            # OdooError, shared serialization types
|   |   +-- config_manager/         # Web UI backend (port 3008)
|   |   |   +-- mod.rs              # Module exports
|   |   |   +-- manager.rs          # Config CRUD (load/save instances, tools, prompts, server)
|   |   |   +-- server.rs           # Axum HTTP server: REST API, static file serving
|   |   |   +-- watcher.rs          # File system watcher for hot-reload
|   |   +-- cleanup/                # Database cleanup operations (guarded)
|   |       +-- mod.rs              # Module exports
|   |       +-- database.rs         # Database cleanup tool
|   |       +-- deep.rs             # Deep record cleanup with relationships
|   +-- config/                     # Runtime-editable config files
|   |   +-- tools.json              # 24 tool definitions
|   |   +-- prompts.json            # 7 prompt definitions
|   |   +-- server.json             # Server metadata
|   +-- config-defaults/            # Seed defaults (embedded in binary via include_dir!)
|   +-- tests/                      # Integration tests (20+ test files)
|   +-- static/dist/                # Built React UI (generated by config-ui build)
|   +-- Cargo.toml                  # Rust dependencies (edition 2024)
|   +-- Dockerfile                  # Multi-stage Docker build
+-- config-ui/                      # React TypeScript config UI
|   +-- src/
|   |   +-- App.tsx                 # Main app (5-tab layout with auth)
|   |   +-- components/             # React components
|   |   |   +-- tabs/               # InstancesTab, ToolsTab, PromptsTab, ServerTab, SecurityTab
|   |   +-- hooks/                  # useConfig, useAuth custom hooks
|   |   +-- __tests__/              # Vitest tests
|   |   +-- types.ts                # TypeScript types mirroring Rust config structs
|   +-- vite.config.ts              # Builds to ../rust-mcp/static/dist
|   +-- vitest.config.ts            # Test config (Istanbul coverage)
|   +-- package.json                # Version must match Cargo.toml
+-- config/                         # Top-level config (same as rust-mcp/config)
+-- k8s/                            # Kubernetes manifests (7 files)
+-- helm/                           # Helm chart
+-- scripts/                        # Release, install, version bump scripts
+-- .github/workflows/              # CI/CD (ci.yml, release.yml)
```

---

## Key Components

### 1. Transport Layer

Handles communication with MCP clients.

| Transport | Module | Use Case |
|-----------|--------|----------|
| stdio | `mcp/cursor_stdio.rs` | Local AI clients (Cursor, Claude Desktop, Claude Code) |
| HTTP | `mcp/http.rs` | Remote access, webhooks, SSE streaming |
| WebSocket | `mcp/http.rs` (ws mode) | Real-time bidirectional integrations |

### 2. MCP Protocol Handler (`mcp/mod.rs`)

Implements the `ServerHandler` trait with:

- `initialize`: Capability negotiation (tools, prompts, resources)
- `tools/list`: Returns tools from Registry (filtered by guards)
- `tools/call`: Routes to `execute_op()` in `mcp/tools.rs`
- `prompts/list`, `prompts/get`: Returns prompts from Registry
- `resources/list`, `resources/read`: Returns Odoo instance metadata via `odoo://` URIs
- `ping`: Health check

### 3. Registry (`mcp/registry.rs`)

Centralized configuration store:

- Loads `tools.json`, `prompts.json`, `server.json` from config directory
- Evaluates guards (`requiresEnv`, `requiresEnvTrue`) to filter tool visibility
- Provides `Arc<Registry>` for thread-safe shared access
- Supports hot-reload when files change

### 4. Operation Dispatcher (`mcp/tools.rs`)

Maps tool `op.type` to handler functions. All 22 operation types:

| Operation | Handler | Description |
|-----------|---------|-------------|
| `search` | `op_search()` | Search for record IDs |
| `search_read` | `op_search_read()` | Search and read records |
| `read` | `op_read()` | Read records by IDs |
| `create` | `op_create()` | Create new record |
| `write` | `op_write()` | Update records |
| `unlink` | `op_unlink()` | Delete records |
| `search_count` | `op_search_count()` | Count records |
| `execute` | `op_execute()` | Execute model method |
| `workflow_action` | `op_workflow_action()` | Call workflow action |
| `generate_report` | `op_generate_report()` | Generate PDF report |
| `get_model_metadata` | `op_get_model_metadata()` | Get model fields |
| `list_models` | `op_list_models()` | List available models |
| `check_access` | `op_check_access()` | Check permissions |
| `create_batch` | `op_create_batch()` | Batch create records |
| `read_group` | `op_read_group()` | Aggregate data |
| `name_search` | `op_name_search()` | Autocomplete search |
| `name_get` | `op_name_get()` | Get display names |
| `default_get` | `op_default_get()` | Get default values |
| `copy` | `op_copy()` | Duplicate record |
| `onchange` | `op_onchange()` | Simulate form onchange |
| `database_cleanup` | `op_database_cleanup()` | Clean database |
| `deep_cleanup` | `op_deep_cleanup()` | Deep clean database |

### 5. Odoo Client Pool (`mcp/tools.rs`)

`OdooClientPool` is a cloneable, thread-safe wrapper around the loaded instance configuration:

```rust
pub struct OdooClientPool {
    env:     Arc<RwLock<OdooEnvConfig>>,           // hot-reloadable config
    clients: Arc<Mutex<HashMap<String, OdooClient>>>, // cached per-instance clients
    pub metadata_cache: MetadataCache,
}
```

Key behaviours:

| Method | Description |
|--------|-------------|
| `from_env()` | Loads instances from `ODOO_INSTANCES_JSON` / env vars |
| `get(name)` | Returns cached client or creates a new one; reads config under `RwLock` |
| `instance_names()` | Returns available instance names (lock-free `try_read`) |
| `reload()` | **Hot-reload**: re-reads `ODOO_INSTANCES_JSON`, swaps config under write lock, clears client cache |

#### Bidirectional instance sync

The pool and Config UI stay in sync through two paths:

1. **Config UI → pool** (`server.rs → pool.reload()`): After `update_instances` saves `instances.json`, it calls `pool.reload().await`. The `std::sync::RwLock` write guard is released *before* the async `clients.lock().await` to keep the future `Send`-safe.

2. **Env vars → `instances.json`** (`main.rs → sync_env_instances_to_file()`): At startup, if `ODOO_INSTANCES` contains instances not yet in `instances.json`, they are merged in additively so they appear in the Config UI.

#### Thread-safety note

`OdooClientPool` uses `std::sync::RwLock` (not Tokio's) for the config field because `instance_names()` is called from synchronous contexts. The lock is never held across an `.await` point.

### 6. Metadata Cache (`mcp/cache.rs`)

- TTL-based in-memory cache for `fields_get` results
- Key: `(instance_name, model_name)` tuple
- Thread-safe via `Arc<RwLock<HashMap>>`
- Automatic expiration with configurable TTL

### 7. Config Manager

Web-based configuration UI on port 3008.

- **Manager** (`manager.rs`): CRUD operations for JSON config files with backup/rollback
- **Watcher** (`watcher.rs`): File system monitoring; triggers Registry reload for `tools.json` / `prompts.json` / `server.json`; notifies the pool when `instances.json` changes
- **Server** (`server.rs`): Axum HTTP server with:
  - REST API for all config CRUD and auth management
  - Instance connection test endpoint (`POST /api/config/instances/{name}/test`)
  - Static file serving for the React UI (`/` via `ServeDir`)
  - Optional docs serving at `/docs/` when `docs/book/` is present

The `AppState` struct carries an `Option<OdooClientPool>` so the REST handlers can trigger `pool.reload()` when instances are saved:

```rust
struct AppState {
    config_manager:   ConfigManager,
    config_watcher:   Arc<ConfigWatcher>,
    sessions:         Arc<RwLock<HashMap<String, SessionInfo>>>,
    auth_config:      DynamicAuthConfig,
    env_file_path:    PathBuf,
    http_auth_config: Option<HttpAuthConfig>,
    pool:             Option<OdooClientPool>,   // for instance hot-reload
}
```

---

## Data Flow

### Tool Call Flow

```
1. Client sends tools/call request
      |
2. Transport layer receives and deserializes
      |
3. McpOdooHandler.handle_method() dispatches to call_tool()
      |
4. Registry looks up tool definition from tools.json
      |
5. execute_op() maps op.type to handler function
      |
6. Handler extracts args using JSON pointer mapping
      |
7. OdooClientPool.get(instance) returns appropriate client
      |
8. Client makes HTTP request to Odoo (JSON-2 or JSON-RPC)
      |
9. Response transformed to MCP content format
      |
10. Result returned to client
```

### Configuration Hot-Reload Flow

```
Tools / Prompts / Server config:

1. User saves via Config UI (or edits file directly)
      |
2. ConfigWatcher detects change
      |
3. Registry reloads tool/prompt/server definitions
      |
4. Next MCP tools/list or tools/call uses updated config
      (no restart needed)

Instances:

1. User saves instances in Config UI
      |
2. ConfigManager writes instances.json
      |
3. update_instances handler calls pool.reload().await
      |
4. OdooClientPool re-reads ODOO_INSTANCES_JSON,
   swaps OdooEnvConfig under RwLock, clears client cache
      |
5. Next tool call uses updated credentials immediately
```

---

## Thread Safety

| Shared State | Mechanism | Notes |
|-------------|-----------|-------|
| Registry (tools/prompts/server) | `Arc<RwLock<T>>` (Tokio) | Read-heavy; write on reload |
| OdooClientPool.env | `Arc<std::sync::RwLock<T>>` | Sync lock; never held across `.await` |
| OdooClientPool.clients | `Arc<tokio::sync::Mutex<T>>` | Async lock; cleared on reload |
| MetadataCache | `Arc<RwLock<HashMap>>` (Tokio) | TTL-based; per `(instance, model)` key |
| Sessions (Config UI) | `Arc<tokio::sync::RwLock<T>>` | 24-hour session tokens |

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

| Code | Category |
|------|----------|
| -32700 | Parse error |
| -32600 | Invalid request |
| -32601 | Method not found |
| -32602 | Invalid params |
| -32603 | Internal error |
| -32000 | Odoo error |
| -32001 | Authentication error |
| -32002 | Access denied |
