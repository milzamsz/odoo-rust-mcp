---
title: Runtime Tool Catalog Drift Import
lane: done
created: 2026-07-07T00:00:00+07:00
updated: 2026-07-07T00:00:00+07:00
description: Detect when live runtime tools.json is missing newly shipped default MCP tools and provide a safe Config UI import action that appends missing tools without overwriting local edits.
priority: high
labels: [mcp, rust, config-ui, tools, upgrade]
evidence:
	lint: {ran: true, passed: true}
	test: {ran: true, passed: true}
	build: {ran: true, passed: true}
	behavior: {ran: true, passed: true}
spec: .agentkanban/specs/runtime-tool-catalog-drift/spec.md
change: .agentkanban/changes/runtime-tool-catalog-drift-import
---

## Conversation

### user

oke now rebuild for linux

### agent

Confirmed task file: `.agentkanban/tasks/task_019_runtime_tool_catalog_drift_import.md`.

Rebuilt Linux desktop artifacts from the current `dev` worktree.

Commands completed successfully:
- `cd config-ui && npm run build`
- `cargo build --release --manifest-path rust-mcp/Cargo.toml`
- copied `rust-mcp/target/release/rust-mcp` to `desktop/src-tauri/binaries/rust-mcp_x86_64-unknown-linux-gnu` equivalent sidecar path `desktop/src-tauri/binaries/rust-mcp-x86_64-unknown-linux-gnu`
- `cd desktop && npm run build -- --bundles appimage,deb`

Generated artifacts:
- `desktop/src-tauri/target/release/bundle/appimage/Odoo Rust MCP_0.5.1_amd64.AppImage` size `89.7M`
- `desktop/src-tauri/target/release/bundle/appimage/Odoo Rust MCP_0.5.1_amd64.AppImage.sig` size `428B`
- `desktop/src-tauri/target/release/bundle/deb/Odoo Rust MCP_0.5.1_amd64.deb` size `11.9M`
- `desktop/src-tauri/target/release/bundle/deb/Odoo Rust MCP_0.5.1_amd64.deb.sig` size `420B`

Verification:
- Debian metadata reports package `odoo-rust-mcp`, version `0.5.1`, architecture `amd64`.
- Extracted `.deb` contains `ToolsTab-Cz5xvTro.js`.
- Extracted static assets include the new Tools tab strings `Import missing tools` / `Catalog drift`.

Note: Tauri emitted updater signing warnings because the local temporary signing key does not match the configured public updater key. The `.deb` and AppImage artifacts were still produced successfully.

### user

### agent

Confirmed task file: `.agentkanban/tasks/task_019_runtime_tool_catalog_drift_import.md`.

Implemented Runtime Tool Catalog Drift Import.

Implementation summary:
- Added ConfigManager drift/import support comparing live runtime `tools.json` against packaged defaults from `rust-mcp/config-defaults/tools.json`.
- Added duplicate tool-name validation for tool load/save/drift/import paths.
- Added protected Config UI API endpoints:
	- `GET /api/config/tools/drift`
	- `POST /api/config/tools/import-missing`
- Added Config UI types and API helpers for drift/import.
- Added a Tools tab catalog drift card showing live count, packaged count, missing names, refresh, and import controls.

Validation so far:
- `cargo test --manifest-path rust-mcp/Cargo.toml --test config_manager test_tools_drift -- --nocapture` passed: 2 tests.
- `cargo test --manifest-path rust-mcp/Cargo.toml --test config_manager test_import_missing_tools -- --nocapture` passed: 1 test.
- `cargo check --manifest-path rust-mcp/Cargo.toml --all-features` passed.
- `cd config-ui && npm test -- --run src/__tests__/useConfig.test.ts` passed: 33 tests.
- `cd config-ui && npm run typecheck` passed.

Remaining: run lint/build as practical, review diff/security, and update final evidence.

### user

### agent

Confirmed task file: `.agentkanban/tasks/task_019_runtime_tool_catalog_drift_import.md`.

Completed implementation and validation for Runtime Tool Catalog Drift Import.

Additional validation:
- `cargo fmt --all --check --manifest-path rust-mcp/Cargo.toml` passed.
- `cargo test --manifest-path rust-mcp/Cargo.toml --test config_manager -- --nocapture` passed: 16 tests.
- `cargo clippy --all-features --manifest-path rust-mcp/Cargo.toml -- -D warnings` passed.
- `cd config-ui && npm run build` passed.
- Direct ESLint command `cd config-ui && ./node_modules/.bin/eslint . --format stylish` completed with 0 errors and 1 existing warning in `config-ui/src/components/tabs/InstancesTab.tsx` about `rows.length` dependency.

Security review:
- Import uses only packaged defaults compiled into the server, not network or user-supplied tool definitions.
- Existing runtime tool definitions are preserved and never overwritten by import.
- Duplicate tool names are rejected.
- Existing guards such as `ODOO_ENABLE_CLEANUP_TOOLS` are preserved on imported tools.
- No Odoo protocol/client behavior or transport authentication behavior was changed.

### user

do this now

### agent

Confirmed task file: `.agentkanban/tasks/task_019_runtime_tool_catalog_drift_import.md`.

Finished the Lite `in-progress -> done` flow for Runtime Tool Catalog Drift Import and moved the task to `done`.

Final validation evidence:
- `cargo fmt --all --check --manifest-path rust-mcp/Cargo.toml` passed.
- `cargo clippy --all-features --manifest-path rust-mcp/Cargo.toml -- -D warnings` passed.
- `cargo test --all-features --manifest-path rust-mcp/Cargo.toml` passed: 386 tests across 23 suites.
- `cd config-ui && npm run typecheck` passed.
- `cd config-ui && npm test` passed: 195 tests across 13 files. Vitest stayed in watch mode after passing and was exited with `q`.
- `cd config-ui && ./node_modules/.bin/eslint . --format stylish` completed with 0 errors and 1 existing warning in `config-ui/src/components/tabs/InstancesTab.tsx` about `rows.length` dependency.
- `cd config-ui && npm run build` passed.
- HTTP smoke server started with `cargo run --manifest-path rust-mcp/Cargo.toml --bin rust-mcp -- --transport http --listen 127.0.0.1:8797 --config-server-port 3018`.
- Smoke `/health` passed with HTTP 200 and version `0.5.1`.
- Smoke MCP initialize POST to `/mcp` passed with HTTP 200 and server version `0.5.1`.
- Smoke Config UI root on port `3018` passed with HTTP 200.
- Smoke unauthenticated `GET /api/config/tools/drift` returned HTTP 401, confirming the new endpoint is protected by the existing Config UI auth middleware.

Documentation updated:
- `docs/src/functional/config-ui.md` documents the Tools tab catalog drift panel and import behavior.
- `TECHNICAL.md` records the durable Config UI implementation note.

Residual note:
- The ESLint warning is pre-existing and outside this feature scope.

### user

oke create comprehensive .agengkanban tasks & do development

### agent

Confirmed task file: `.agentkanban/tasks/task_019_runtime_tool_catalog_drift_import.md`.

Starting implementation for Runtime Tool Catalog Drift Import. The task is in `in-progress` under the Lite workflow profile. Spec, proposal, design, and checklist artifacts are being created before code changes.

### user
