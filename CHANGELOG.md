# Changelog

All notable changes to the **Odoo Rust MCP Server** are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [v0.6.0] - 2026-07-20

### Added
- Add cached per-instance installed-module snapshots with TTL, explicit refresh, and stale-on-failure preservation.
- Add optional tool `pack` and `requiredModules` metadata, per-instance `disabledPacks`, module-aware discovery/call filtering, and metadata-only denial audit events.
- Add an ignored live Odoo module-gating smoke test and a short developer scope ADR.

### Security
- Add `odoo_execute_capability`, a closed HMAC-signed mutation envelope with exact registry/target binding, schema validation, crash-safe idempotency, runtime receipts, and post-write verification.
- Add the version-neutral `oc_mcp_mutation` Odoo helper for row-locked, ACL-aware allowed-field draft updates with stale-write rejection; correct quotation tax/UoM mappings for Odoo 17/18 versus 19.
- Hide and reject generic mutation and cleanup tools when `ODOO_CAPABILITY_CONTROLLED_MODE=true`.
- Require both write and cleanup flags for cleanup tools, and default every cleanup path to dry-run.
- Propagate legacy JSON-RPC context and never retry transport-uncertain mutations on either Odoo protocol.

## [v0.5.3] - 2026-07-20

### Security
- Gate `odoo_execute` separately with `ODOO_ENABLE_EXECUTE_TOOL`, require a per-instance allowlist, and honor instance `readOnly` for mutating tools.
- Log only model and record-id count alongside existing metadata; never tool arguments or results.

## [v0.5.2] - 2026-07-08

### Added
- Runtime tool catalog drift import support for Config UI tool management.

### Fixed
- Improved Config UI handling for tool catalog updates and persisted tool metadata.

## [v0.5.1] - 2026-06-22

### Added
- Best-practice Dependabot configuration (supporting GitHub Actions, Cargo, NPM, Docker, and Helm updates).
- Support for remote localhost/127.0.0.1 origins (port 3008) in default.json capability to allow Tauri API access.

### Fixed
- Fixed unclickable documentation sidebar link by unconditionally intercepting external links and delegating them to the system default browser.
- Fixed double-opening of external links in Tauri desktop app by rendering external navigation entries as plain buttons inside the webview.

## [v0.5.0] - 2026-06-21

### Added
- Native Windows Tauri desktop application packaging
- System tray integration with window toggle, docs, config folder, and server restart
- MCP client connectivity panel in Config UI Overview tab
- Clipboard-copy shortcut for MCP HTTP/SSE endpoints from system tray

### Fixed
- Fixed sidecar process restart bug where multiple instances could bind to the same port

## [v0.4.2] - 2026-06-21

### Added
- Display application version in the Config UI footer bar
- Version badge showing current release across all UI tabs

## [v0.4.1] - 2026-06-11

### Changed
- Updated dependency versions across Rust and TypeScript stacks

## [v0.4.0] - 2026-05-15

### Added
- Config UI rewrite with Mantine 9, Vite, and React 19
- Operations Overview landing page with config summary metrics
- Dual-view instances management (card + table modes)
- Right-side drawer editing for instances and prompts
- Persisted collapsible sidebar (icon rail on collapse)
- Light/Dark/Auto theme selector (default: Auto)
- Keyboard shortcut panel (? shortcut)
- Runtime env sync status card in Server tab
- Documentation entry in sidebar (opens /docs/ in new tab)
- Rust Hexagon app mark as shared product identity

### Changed
- Simplified Lite workflow profile as the default Agentic Kanban profile
- quieter UI typography with Geist Sans/Mono at 400–500 weight
- Tailwind removed from active Config UI runtime

## [v0.3.30] - 2026-03-10

### Fixed
- Windows shortcut launcher: serialize `cargo build` with lock file to avoid contention
- `install.ps1`: copy shortcut files to `Program Files` so `.lnk` works outside extracted ZIP

### Added
- Windows release ZIP now includes `install.ps1`, native `.lnk`, and WSL shortcuts

## [v0.3.0] - 2026-02-27

### Fixed
- Migrated to new dual-instance sync mechanism via `ODOO_INSTANCES_JSON` env var

## [v0.2.0] - 2026-02-05

### Added
- Initial public release
- Config UI with React 18, Vite, Tailwind CSS
- Odoo 19+ JSON-2 API support (API key auth)
- Odoo <19 JSON-RPC support (username/password auth)
- Multi-instance connection pooling
- Guard-based tool access (write tools, cleanup tools)
- Rust backend with MCP stdio, HTTP, and WebSocket transports
