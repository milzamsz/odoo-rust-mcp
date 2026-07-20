# AGENTS.md

## Audience and Scope

This file is the **canonical repo-operator guide for coding agents and contributors** working inside this repository.

Use this document to understand:

- how the repo is structured
- which files are the source of truth
- how to build, test, and validate changes
- which configuration and guard rules are enforced in code
- which repo-specific gotchas matter before editing Rust, UI, or JSON config

This file is **not** the full end-user setup guide for MCP clients. For Cursor, Claude Desktop, Claude Code, Windsurf, ChatGPT Desktop, HTTP auth setup, deployment, and the full Config UI walkthrough, use:

- `README.md`
- `docs/src/functional/configuration.md`
- `docs/src/functional/config-ui.md`
- `rust-mcp/CONFIG_MANAGER.md`

If this file and another doc disagree, **prefer implementation and checked-in config over prose**.

## Project Snapshot

`odoo-rust-mcp` is a dual-stack Model Context Protocol server for Odoo ERP.

- **Backend**: `rust-mcp/`
  Rust MCP server, transport handling, registry loading, Odoo clients, tool execution, config bootstrap, and auth.
- **Frontend**: `config-ui/`
  React 19 + TypeScript + Vite + Mantine Config UI for instances, tools, prompts, server metadata, and security settings.
- **Supported Odoo auth stacks**:
  - Odoo `19+`: JSON-2 API with API key auth
  - Odoo `18 and earlier`: JSON-RPC with username/password auth
- **Supported transports**:
  - `stdio`
  - `http` (Streamable HTTP plus legacy SSE endpoints)
  - `ws`
- **Common MCP client families**:
  - Cursor
  - Claude Desktop
  - Claude Code
  - Windsurf
  - ChatGPT Desktop / OpenAI Codex
- **License**: AGPL-3.0-only
- **Current version**: `0.5.0`

### Version Sync Rule

The Rust crate version in `rust-mcp/Cargo.toml` and the UI version in `config-ui/package.json` must stay in sync.

### Branching & PR Workflow

- **Default Local Branch**: `dev`
- **Production Branch**: `main`

All local development must be performed on the `dev` branch. When completing a task:
1. Update the version in manifests (`rust-mcp/Cargo.toml`, `config-ui/package.json`, etc.) to match the target version.
2. Ensure `CHANGELOG.md` has a new release section corresponding to the target version.
3. Update the version in `README.md` to match the target version.
4. Create a Pull Request (PR) from `dev` to `main` (either using the web UI or local `gh pr create` after unsetting `GITHUB_TOKEN`).

### UI Build Dependency

The React UI builds into `rust-mcp/static/dist/`, and those files are embedded into the Rust binary.

- CI enforces a UI build before the main Rust quality checks.
- `rust-mcp/build.rs` also auto-runs `npm run build` when `config-ui/src` is newer than `static/dist`.
- That auto-build is helpful during local development, but it still depends on Node being installed and UI dependencies already being present.

## Quick Start for Agents

### Recommended Development Loop

From the repo root:

```bash
cd config-ui
npm ci
cd ..
```

```bash
cargo build --manifest-path rust-mcp/Cargo.toml
```

```bash
cargo test --all-features --manifest-path rust-mcp/Cargo.toml
```

```bash
cd config-ui
npm run lint
npm run typecheck
npm test
cd ..
```

### Run the Server Locally

#### Stdio transport

```bash
cargo run --manifest-path rust-mcp/Cargo.toml -- --transport stdio
```

Use this when validating local MCP behavior with desktop clients that launch the binary directly.

#### HTTP transport plus Config UI

```bash
cargo run --manifest-path rust-mcp/Cargo.toml -- \
  --transport http \
  --listen 127.0.0.1:8787 \
  --config-server-port 3008
```

Useful local endpoints:

- MCP: `http://127.0.0.1:8787/mcp`
- Health: `http://127.0.0.1:8787/health`
- OpenAPI: `http://127.0.0.1:8787/openapi.json`
- Config UI: `http://127.0.0.1:3008`

#### WebSocket transport

```bash
cargo run --manifest-path rust-mcp/Cargo.toml -- \
  --transport ws \
  --listen 127.0.0.1:8787
```

### UI Hot Reload Loop

If you are actively changing React code, run the Vite dev server separately:

```bash
cd config-ui
npm run dev
```

- Vite dev server: `http://localhost:5173`
- Built Config UI served by Rust server: `http://localhost:3008`

### Pre-Commit Minimum

```bash
cargo fmt --all --check --manifest-path rust-mcp/Cargo.toml
cargo clippy --all-features --manifest-path rust-mcp/Cargo.toml -- -D warnings
cargo test --all-features --manifest-path rust-mcp/Cargo.toml
cd config-ui && npm run lint && npm run typecheck && npm test
```

## Build, Test, and Release Commands

### Rust

```bash
cd rust-mcp
cargo build
cargo build --release
cargo check --all-features
cargo test
cargo test --lib
cargo test test_name
cargo test -- --nocapture
cargo fmt --all --check
cargo fmt --all
cargo clippy --all-features -- -D warnings
cargo audit

# Config manager tests
cargo test --lib config_manager -- --nocapture --test-threads=1
cargo test --test config_manager -- --nocapture
```

### Config UI

```bash
cd config-ui
npm ci
npm run dev
npm run build
npm run lint
npm run typecheck
npm test
npm run test:coverage
```

### Release

```bash
./scripts/release.sh 0.4.0
```

That script is expected to bump both `rust-mcp/Cargo.toml` and `config-ui/package.json`.

## Architecture

### High-Level Layout

```text
rust-mcp/
  build.rs                   auto-builds UI when sources are newer than dist
  src/
    main.rs                  CLI entry, env/bootstrap, transport selection
    mcp/                     MCP handler, registry, transports, prompts, resources
    odoo/                    modern and legacy Odoo clients plus config parsing
    config_manager/          REST API, file watcher, Config UI serving
    cleanup/                 guarded cleanup operations
  config/                    editable runtime config checked into the repo
  config-defaults/           embedded seed defaults copied when runtime config is missing
  tests/                     integration tests

config-ui/
  src/
    components/tabs/         Overview, Instances, Tools, Prompts, Server, Security
    hooks/                   Config UI data/auth hooks
    __tests__/               Vitest coverage for UI behavior and types
  package.json               UI scripts and version
```

### Transport Entry Points

- `rust-mcp/src/main.rs`
  Parses CLI flags, bootstraps config, starts the Config UI server, and selects `stdio`, `http`, or `ws`.
- `rust-mcp/src/mcp/cursor_stdio.rs`
  Plain JSON-RPC over stdio for Cursor-style MCP clients.
- `rust-mcp/src/mcp/http.rs`
  HTTP MCP transport, auth handling, CORS/origin handling, health, OpenAPI, and legacy SSE endpoints.
- `rust-mcp/src/bin/ws_smoke_client.rs`
  Small helper binary for WebSocket smoke testing.

### Dual Odoo Client Selection

The server abstracts Odoo versions behind a shared client interface:

- `rust-mcp/src/odoo/unified_client.rs`
  Shared trait and client pool.
- `rust-mcp/src/odoo/client.rs`
  Odoo `19+` JSON-2 client.
- `rust-mcp/src/odoo/legacy_client.rs`
  Odoo `18 and earlier` JSON-RPC client.
- `rust-mcp/src/odoo/config.rs`
  Instance parsing, protocol override, timeout, retry settings, and auth-mode selection.

Selection rules:

- `apiKey` implies modern JSON-2 flow by default.
- `version < 19` with username/password implies legacy JSON-RPC flow by default.
- `protocol` can explicitly force `auto`, `jsonrpc`, or `json2`.

### MCP Registry, Tools, Prompts, and Resources

- `rust-mcp/src/mcp/registry.rs`
  Loads `tools.json`, `prompts.json`, and `server.json`, validates schemas, and evaluates guards.
- `rust-mcp/src/mcp/tools.rs`
  Routes declarative `op.type` values to implementation functions.
- `rust-mcp/src/mcp/prompts.rs`
  Prompt support.
- `rust-mcp/src/mcp/resources.rs`
  `odoo://` resource handling.
- `rust-mcp/src/mcp/runtime.rs`
  Compatibility wrapper for MCP request handling.

Tool execution flow:

```text
tools/call
  -> execute_op() in rust-mcp/src/mcp/tools.rs
  -> op_search / op_read / op_create / ...
  -> OdooClientPool
  -> modern or legacy Odoo client
```

Tools are declarative. The JSON config provides:

- tool metadata
- input schema
- `op.type`
- JSON pointer field mapping under `op.map`
- optional guards

### Config Manager and Config UI

- `rust-mcp/src/config_manager/manager.rs`
  Reads and writes instances, tools, prompts, and server config.
- `rust-mcp/src/config_manager/watcher.rs`
  Watches files for changes and triggers reload behavior.
- `rust-mcp/src/config_manager/server.rs`
  Hosts the Config UI, REST API, login/session auth, and MCP HTTP auth management.
- `config-ui/src/`
  React application for editing the same underlying JSON and env-backed settings.

Current UI architecture highlights:

- Mantine `AppShell` with hash-route navigation
- Operations Overview landing page after login
- dual-view instances workflow with card and table modes
- TanStack Table state for instances sorting and column filtering
- notification and confirmation flows replacing browser-native alerts/confirmations

Hot-reload boundaries:

- Saving `instances.json` reloads the live `OdooClientPool`.
- Saving `tools.json`, `prompts.json`, or `server.json` reloads the registry.
- Updating Config UI credentials or MCP HTTP auth reloads in memory without a restart.

### Config Resolution and Runtime Defaults

Current startup/bootstrap behavior is defined in `rust-mcp/src/main.rs`.

On startup the server:

1. Resolves the config directory.
2. Creates an `env` file if it does not exist.
3. Loads env vars from that file.
4. Migrates legacy single-instance env configuration into `instances.json` when possible.
5. Creates a default `instances.json` if still missing.
6. Copies `tools.json`, `prompts.json`, and `server.json` into the runtime config dir when missing.
7. Backfills newer env keys into older env files during upgrade paths.

Config directory behavior:

- Unix root / service context: `/etc/rust-mcp`
- Regular user and current default local behavior: `~/.config/odoo-rust-mcp`

Runtime files:

- `instances.json`
- `tools.json`
- `prompts.json`
- `server.json`
- `env`

Do not confuse runtime config with seed defaults:

- Edit `rust-mcp/config/*` for normal repo changes and examples.
- Edit user runtime config in `~/.config/odoo-rust-mcp/` or `/etc/rust-mcp/` for deployed behavior.
- `rust-mcp/config-defaults/*` are embedded seed defaults used to create missing runtime files.

## Agent Rules and Gotchas

### Runtime Config vs Seed Defaults

- For normal behavior changes, edit runtime config definitions in `rust-mcp/config/*`.
- Only edit `rust-mcp/config-defaults/*` when you intentionally want new bootstrap defaults embedded into the binary.
- If you change only `config-defaults/*`, the effect will not appear in an already-running deployed instance until a rebuild/redeploy happens and a missing runtime file is regenerated.

### Keep Versions in Sync

If you bump the release version, update both:

- `rust-mcp/Cargo.toml`
- `config-ui/package.json`

### Use Real Guard Names

Current guard env vars in code and checked-in tool config are:

- `ODOO_ENABLE_WRITE_TOOLS`
- `ODOO_ENABLE_CLEANUP_TOOLS`
- `ODOO_ENABLE_EXECUTE_TOOL`

Do not introduce or propagate stale names such as `ODOO_ENABLE_WRITE_OPERATIONS`.

### Important Environment Variables

Core runtime:

- `ODOO_INSTANCES`
- `ODOO_INSTANCES_JSON`
- `ODOO_URL`
- `ODOO_DB`
- `ODOO_API_KEY`
- `ODOO_VERSION`
- `ODOO_USERNAME`
- `ODOO_PASSWORD`
- `ODOO_TIMEOUT_MS`
- `ODOO_MAX_RETRIES`
- `ODOO_CONFIG_DIR`
- `ODOO_CONFIG_SERVER_PORT`
- `RUST_LOG`

Feature gates:

- `ODOO_ENABLE_WRITE_TOOLS`
- `ODOO_ENABLE_CLEANUP_TOOLS`
- `ODOO_ENABLE_EXECUTE_TOOL`

Config UI auth:

- `CONFIG_UI_USERNAME`
- `CONFIG_UI_PASSWORD`

MCP HTTP auth and origin controls:

- `MCP_AUTH_ENABLED`
- `MCP_AUTH_TOKEN`
- `MCP_ALLOWED_ORIGINS`
- `MCP_TOOLS_JSON`
- `MCP_PROMPTS_JSON`
- `MCP_SERVER_JSON`

### Config UI Auth Defaults

First-run bootstrap currently seeds:

- `CONFIG_UI_USERNAME=admin`
- `CONFIG_UI_PASSWORD=changeme`
- `MCP_AUTH_ENABLED=false`

Agents changing auth flows should verify behavior in both:

- `rust-mcp/src/main.rs`
- `rust-mcp/src/config_manager/server.rs`

### HTTP Auth Behavior

HTTP auth is controlled by `MCP_AUTH_ENABLED` plus `MCP_AUTH_TOKEN`.

- If auth is enabled and a bearer token is configured, HTTP clients must send `Authorization: Bearer <token>`.
- If `MCP_AUTH_ENABLED=false` or the token is empty, HTTP auth is effectively disabled.
- `stdio` transport does not use HTTP bearer auth.

### Cursor-Friendly JSON Schema Only

Tool schemas must stay compatible with picky MCP clients.

Avoid:

- `anyOf`
- `oneOf`
- `allOf`
- `$ref`
- `definitions`
- type arrays such as `"type": ["string", "null"]`

This rule is enforced by behavior in `rust-mcp/src/mcp/registry.rs` and guarded by tests such as `rust-mcp/tests/cursor_schema.rs`.

### Absolute Paths for Stdio Client Configs

When documenting or validating stdio client setup, use **absolute paths** for:

- the `rust-mcp` binary
- `MCP_TOOLS_JSON`
- `MCP_PROMPTS_JSON`
- `MCP_SERVER_JSON`
- env files referenced by clients

Some MCP clients launch the server from a different working directory, so relative paths are fragile.

### Shell and CI Conventions

- Do not add `2>&1` to commands in docs or scripts unless there is a concrete reason.
- CI expects `cargo fmt` and `cargo clippy` to be clean.
- The UI build job runs before the Rust jobs in CI; if a change depends on new UI assets, confirm the built output path still matches `rust-mcp/static/dist`.

### Related Agent-Facing Files

This repo also contains:

- `CLAUDE.md`
- `.github/copilot-instructions.md`
- `.agent/skills/odoo-mcp/SKILL.md`

They are useful context, but this file should still follow implementation truth first. If shared guidance drifts, plan a follow-up sync rather than copying stale text forward.

## Common Agent Playbooks

### Add a New Tool

Required changes:

1. Add or update the tool definition in `rust-mcp/config/tools.json`.
2. If the tool should exist in first-run defaults, mirror the change into `rust-mcp/config-defaults/tools.json`.
3. Implement the handler in `rust-mcp/src/mcp/tools.rs`.
4. Add the router case in `execute_op()`.
5. If schema or editor fields change, update `config-ui/src/types.ts` and the relevant UI tab.
6. If the tool needs gating, use `requiresEnvTrue` or `requiresEnv` with real env names.

Validation:

- `cargo test --all-features --manifest-path rust-mcp/Cargo.toml`
- `cargo clippy --all-features --manifest-path rust-mcp/Cargo.toml -- -D warnings`
- `cd config-ui && npm run typecheck && npm test`

### Change Instance or Config Schema

Required changes:

1. Update Rust config structs in `rust-mcp/src/odoo/config.rs` or the relevant config manager types.
2. Update corresponding UI types in `config-ui/src/types.ts`.
3. Update any Config UI forms or tabs that edit the affected fields.
4. Update migrations or bootstrap logic in `rust-mcp/src/main.rs` or `rust-mcp/src/config_manager/manager.rs` if backward compatibility matters.
5. Update checked-in example config if the field is user-facing.

Validation:

- `cargo test --all-features --manifest-path rust-mcp/Cargo.toml`
- `cd config-ui && npm run typecheck && npm test`

### Update Prompts or Server Instructions

Required changes:

1. Edit `rust-mcp/config/prompts.json` or `rust-mcp/config/server.json`.
2. If this should affect new bootstrap installs, also update the matching file in `rust-mcp/config-defaults/`.
3. If the Config UI shape changes, update `config-ui/src/types.ts` and the relevant tab.
4. If behavior depends on protocol defaults, verify `protocolVersionDefault` handling in the registry and UI.

Validation:

- Confirm the JSON remains valid.
- `cargo test --all-features --manifest-path rust-mcp/Cargo.toml`
- `cd config-ui && npm test`

### Change Auth or Transport Behavior

Required changes:

1. Update transport logic in `rust-mcp/src/main.rs`, `rust-mcp/src/mcp/http.rs`, or `rust-mcp/src/mcp/cursor_stdio.rs`.
2. Update Config UI auth flows in `rust-mcp/src/config_manager/server.rs` and `config-ui/src/components/tabs/SecurityTab.tsx` if user-visible behavior changes.
3. Update bootstrap env defaults in `rust-mcp/src/main.rs` if new auth/env fields are introduced.
4. Update OpenAPI or health/auth expectations if HTTP semantics change.
5. Review deployment surfaces such as Docker, Helm, Debian service files, and docs if the env contract changes.

Validation:

- `cargo test --all-features --manifest-path rust-mcp/Cargo.toml`
- run a local HTTP smoke test against `/health` and `/mcp`
- `cd config-ui && npm test`

## CI Pipeline Snapshot

The main pipeline lives in `.github/workflows/ci.yml`.

Current stages:

1. `build-ui`
2. parallel quality checks including `check`, `fmt`, `clippy`, cross-platform `test`, `ui-tests`, `coverage`, `security`, `config-tests`, `config-integration`, `helm-validation`, and `docker-test`
3. `build-release`
4. service integration tests on Linux and macOS

Before claiming a change is safe, check whether it touches:

- embedded UI assets
- auth/bootstrap env handling
- config manager behavior
- packaging or deployment files
- transport behavior

Those areas have CI coverage outside the simple unit-test path.

## Source of Truth

When you need to verify behavior before editing, check these first:

### Commands, versions, and scripts

- `rust-mcp/Cargo.toml`
- `config-ui/package.json`
- `rust-mcp/build.rs`
- `scripts/release.sh`

### Startup, bootstrap, and config resolution

- `rust-mcp/src/main.rs`

### Tool definitions and guard names

- `rust-mcp/config/tools.json`
- `rust-mcp/config-defaults/tools.json`
- `rust-mcp/src/mcp/registry.rs`
- `rust-mcp/src/mcp/tools.rs`

### Odoo instance schema and client selection

- `rust-mcp/src/odoo/config.rs`
- `rust-mcp/src/odoo/unified_client.rs`
- `config-ui/src/types.ts`

### Config UI and auth behavior

- `rust-mcp/src/config_manager/server.rs`
- `config-ui/src/components/tabs/`

### HTTP transport behavior

- `rust-mcp/src/mcp/http.rs`

### CI expectations

- `.github/workflows/ci.yml`

### End-user and operational docs

- `README.md`
- `docs/src/functional/configuration.md`
- `docs/src/functional/config-ui.md`
- `rust-mcp/CONFIG_MANAGER.md`

## Compatibility Note for Runtime MCP Clients

This repo serves end-user AI agents through MCP, but this file intentionally does not duplicate full client configuration examples.

For runtime/client setup, use:

- `README.md#cursor-config-example`
- `README.md#claude-desktop-config-example`
- `README.md#chatgpt-desktop-openai-codex-config-example`
- `docs/src/functional/configuration.md`
- `docs/src/functional/config-ui.md`

That is where client JSON or TOML snippets, HTTP auth examples, deployment instructions, and full operational walkthroughs belong.

<!-- BEGIN AGENTIC KANBAN — DO NOT EDIT THIS SECTION -->
## Agentic Kanban

Read `.agentkanban/INSTRUCTION.md` for task workflow rules.
Read `.agentkanban/memory.md` for project context.

Enforcement mode: `warn`

If a task file (`.agentkanban/tasks/**/*.md`) was referenced earlier in this conversation, re-read it before responding and always respond in and at the end the task file.
<!-- END AGENTIC KANBAN -->
