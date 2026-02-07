# CLAUDE.md

## Project Overview

A **dual-stack Model Context Protocol (MCP) server** for Odoo ERP integration, written in Rust with a React TypeScript configuration UI.

- **Backend** (`rust-mcp/`): Rust MCP server - protocol handling, Odoo API clients, tool execution
- **Frontend** (`config-ui/`): React 18 + TypeScript + Vite + Tailwind CSS - web-based config editor
- Supports **Odoo 19+** (JSON-2 External API, API key auth) and **Odoo <19** (JSON-RPC, username/password)
- License: AGPL-3.0 | Current version: 0.3.30

## Build & Test Commands

### Rust (`rust-mcp/`)

```bash
cd rust-mcp
cargo build                    # debug build
cargo build --release          # release build
cargo test                     # all tests
cargo test --lib               # lib tests only
cargo test test_name           # single test
cargo test -- --nocapture      # tests with output
cargo fmt --check              # check formatting
cargo fmt                      # auto-format
cargo clippy -- -D warnings    # lint (must pass with zero warnings)
cargo audit                    # security audit

# Config manager tests (serial)
cargo test --lib config_manager -- --nocapture --test-threads=1
cargo test --test config_manager -- --nocapture
```

### Config UI (`config-ui/`)

```bash
cd config-ui
npm ci                         # install deps
npm run dev                    # dev server (:5173 with HMR)
npm run build                  # production build (outputs to ../rust-mcp/static/dist)
npm run typecheck              # TypeScript checking
npm test                       # unit tests (vitest)
npm run test:coverage          # tests with Istanbul coverage
npm run lint                   # ESLint
```

### Running the Server

```bash
# stdio (for Cursor/Claude Desktop)
./rust-mcp/target/release/rust-mcp --transport stdio

# HTTP (Streamable HTTP + SSE)
./rust-mcp/target/release/rust-mcp --transport http --listen 127.0.0.1:8787

# WebSocket
./rust-mcp/target/release/rust-mcp --transport ws --listen 127.0.0.1:8787

# Docker
docker compose up --build
```

### Release

```bash
./scripts/release.sh 0.3.31   # bumps Cargo.toml + package.json, commits, tags, pushes
```

Both `rust-mcp/Cargo.toml` and `config-ui/package.json` versions must stay in sync.

## Architecture

### Build Order

The React UI must be built **before** the Rust binary. Built assets in `rust-mcp/static/dist/` are embedded into the binary via `include_dir!`. CI enforces this: `build-ui` job runs first, all other jobs depend on it.

### Source Layout

```
rust-mcp/src/
  main.rs                    # CLI entry: transport selection (stdio/http/ws), arg parsing
  lib.rs                     # Library root: pub mod cleanup, config_manager, mcp, odoo
  mcp/
    mod.rs                   # McpOdooHandler (ServerHandler trait impl)
    tools.rs                 # Tool dispatch: execute_op() routes op.type -> handler fns
    registry.rs              # Tool/prompt/server config loading, guard evaluation
    cache.rs                 # Metadata caching with configurable TTL
    cursor_stdio.rs          # stdio transport for Cursor/Claude Desktop
    http.rs                  # Axum HTTP server + SSE transport
    prompts.rs               # MCP prompt handling
    resources.rs             # odoo:// URI resource definitions
    runtime.rs               # ServerCompat wrapper
  odoo/
    unified_client.rs        # OdooClient trait - abstraction over modern + legacy
    client.rs                # Odoo 19+ JSON-2 API client (API key auth)
    legacy_client.rs         # Odoo <19 JSON-RPC client (username/password)
    config.rs                # Instance config parsing, auth mode detection
    types.rs                 # OdooError, shared types
  config_manager/
    manager.rs               # Config CRUD (instances, tools, prompts, server JSON files)
    server.rs                # Axum REST API (port 3008), serves React UI
    watcher.rs               # File system watcher for hot-reload
  cleanup/                   # Guarded cleanup operations (require ODOO_ENABLE_CLEANUP_TOOLS=true)

config-ui/src/
  App.tsx                    # Main app component
  components/                # React components (tabs, forms, editors)
    tabs/                    # InstancesTab, ToolsTab, PromptsTab, ServerTab, SecurityTab
  hooks/                     # useConfig, useAuth custom hooks
  __tests__/                 # Vitest tests
  types.ts                   # TypeScript types mirroring Rust config structs

rust-mcp/config/             # Runtime-editable config (tools.json, prompts.json, server.json)
rust-mcp/config-defaults/    # Seed defaults embedded in binary (do NOT edit for normal config)
rust-mcp/tests/              # Integration tests
```

### Key Design Decisions

- **Fully declarative tools**: Tools defined in `tools.json`, not Rust code. JSON `op.type` maps to handler functions in `tools.rs`
- **Multi-instance**: Each tool call can specify an `instance` parameter targeting different Odoo servers. `OdooClientPool` caches clients per instance
- **Hot-reload**: File changes detected by watcher -> registry reloads -> MCP handler reflects changes (no restart needed)
- **Dual client**: Version field in instance config determines JSON-2 API vs legacy JSON-RPC client
- **Guard system**: `requiresEnv` / `requiresEnvTrue` in tool definitions gate access to dangerous operations
- **JSON Schema constraint**: Avoid `anyOf`, `oneOf`, `allOf`, `$ref`, `definitions`, type arrays in tools.json - Cursor rejects these

### Tool Execution Flow

`tools/call` -> `execute_op()` in `tools.rs` -> `op_search`, `op_read`, `op_create`, etc. -> Odoo client (unified_client.rs)

### JSON Pointer Mapping

Tools use `"map": { "field": "/path/to/field" }` to extract args. Helper functions: `ptr()`, `req_str()`, `opt_str()`, `opt_i64()`, `opt_vec_string()`

## CI Pipeline (`.github/workflows/ci.yml`)

Multi-stage, runs on push/PR to `main`:

1. **Stage 1**: `build-ui` - builds React app, uploads artifact
2. **Stage 2** (parallel): `check`, `fmt`, `clippy`, `test` (ubuntu/macos/windows), `ui-tests`, `coverage`, `security`, `config-tests`, `config-integration`, `helm-validation`, `docker-test`
3. **Stage 3**: `build-release` (after quality checks pass)
4. **Stage 4**: `test-systemd-service` (Linux), `test-macos-service`

## Conventions

- **Commit messages**: Imperative mood, verb-first ("Add", "Fix", "Update"). Keep first line under 72 chars
- **Branch naming**: `feature/name` or `fix/name`
- **Rust formatting**: `cargo fmt` defaults, `cargo clippy -- -D warnings` must pass
- **Config UI**: React 18 + TypeScript strict mode + Vite + Tailwind CSS + Vitest
- **Test naming**: `test_should_return_error_when_invalid_input()` style
- **Shell commands**: Do NOT use `2>&1` - stdout/stderr already go to terminal

## Pre-Commit Checklist

```bash
cargo fmt --all --manifest-path rust-mcp/Cargo.toml
cargo clippy --all-features --manifest-path rust-mcp/Cargo.toml -- -D warnings
cargo test --manifest-path rust-mcp/Cargo.toml
cd config-ui && npm run lint && npm test
```

CI will **FAIL** if fmt or clippy produce any output/warnings.

## Configuration

User config directory: `~/.config/odoo-rust-mcp/` (created on first run, seed defaults copied from `config-defaults/`)

| File | Purpose |
|------|---------|
| `instances.json` | Odoo instance definitions (URL, DB, auth, version) |
| `config/tools.json` | MCP tool definitions (runtime-editable) |
| `config/prompts.json` | MCP prompt definitions |
| `config/server.json` | Server metadata |
| `config-defaults/*` | Seed defaults embedded in binary |

### Key Environment Variables

| Variable | Purpose |
|----------|---------|
| `ODOO_INSTANCES` / `ODOO_INSTANCES_JSON` | Override instances JSON path |
| `ODOO_ENABLE_CLEANUP_TOOLS` | Gate cleanup tools (`true` to enable) |
| `RUST_LOG` | Tracing level (e.g. `debug,odoo=trace`) |
| `ODOO_CONFIG_DIR` | Config directory override |
| `ODOO_CONFIG_SERVER_PORT` | Config UI port (default: 3008) |
| `MCP_AUTH_ENABLED` | Enable HTTP basic auth |
| `MCP_TOOLS_JSON` / `MCP_PROMPTS_JSON` / `MCP_SERVER_JSON` | Override config file paths |

## Common Workflows

### Adding a New Tool

1. Add JSON definition to `rust-mcp/config/tools.json` (and `config-defaults/tools.json`)
2. Implement `op_my_tool()` in `src/mcp/tools.rs`
3. Add `"my_tool"` case in `execute_op()` router
4. Write unit tests in `src/mcp/tools.rs::tests` module
5. Update `config-ui/src/types.ts` if new config fields are needed

### Modifying Config Schema

1. Update Rust struct in `src/odoo/config.rs` (e.g., `InstanceConfig`)
2. Update `config-ui/src/types.ts` to match
3. Add migration in `src/config_manager/manager.rs` if backwards compat needed

### Testing Hooks

React hook tests cannot call hooks directly (need React context). Test types and shapes via `source-import.test.tsx` pattern instead.
