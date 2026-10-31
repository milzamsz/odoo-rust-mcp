# Changelog

All notable changes to the **Odoo Rust MCP Server** are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

Odoo 20 support, planned as v0.7.0. Supported: Odoo 16, 17, 18, 19, Odoo Online saas~19.x and 20, Community and Enterprise.

### Breaking
- `odoo_read_group` takes `groupby`, `aggregates`, `having`, `offset`, `limit` and `order`, and always returns `{groups: [...]}` with one key per aggregate spec (e.g. `"amount_total:sum"`). The old `fields`/`orderby`/`lazy` input still works in 0.7 and adds a `deprecation` note to the result; it will be removed in 0.8. An existing runtime `tools.json` keeps the old tool definition (old input keeps working); copy the new `odoo_read_group` definition from `config-defaults/tools.json` to use `aggregates`, `having` and `order`.

### Added
- Detect the Odoo version and edition from `/web/webclient/version_info`. The configured `version` still wins; a mismatch is logged and shown in the Config UI.
- `minVersion` on tool definitions hides a tool from older instances (`version_unsupported`).
- `odoo_access_rules`: access rights and record rules for a model (`ir.access` on saas~19.4+/20, `ir.model.access` + `ir.rule` before).
- `odoo_model_schema` (Odoo 19+, `api_doc`): fields and methods from `/doc-bearer`.
- `odoo_web_search_read` (Odoo 17+): search and read with a field specification.
- Version notes for Odoo 19/20 in the built-in prompts and server instructions.

### Changed
- `odoo_read_group` uses `formatted_read_group` on 19+ and translates to `read_group` on 16–18.
- `odoo_name_get` reads `display_name` (Odoo removed `name_get` in 18).
- `odoo_check_access` uses `has_access` on 18+, returns the real result instead of always `true`, and accepts `create`.
- JSON-2 `name_search`, `default_get` and `onchange` send the argument names Odoo 17+ expects; `copy` accepts both return shapes.
- On Odoo 20, binary fields are flattened back to base64 on read, and `ir.attachment` `datas` is sent as `raw` on write.
- Controlled capabilities refuse a write when the version or edition Odoo reports differs from the approved registry cell.
- Cleanup tools skip models from modules that are not installed and use the 17+ archived-activity model; removed calls to cache methods that no longer exist.
- Password instances on Odoo 20 log a warning that Odoo removes `/jsonrpc` in 22; JSON-2 401 errors explain the `rpc` key scope.

### Fixed
- JSON-2 `search`, `search_read` and `search_count` always send a `domain`; Odoo 19+ rejected calls without one.
- `odoo_generate_report` reports a clear error when Odoo 19+ redirects an API-key request to the login page instead of returning a PDF.

## [v0.6.5] - 2026-09-15

### Fixed
- Fall back to Odoo's web-session authentication when legacy JSON-RPC authentication is rejected by request-context-dependent custom addons.
- Publish the fallback in the Windows, Linux, and macOS release builds.

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
