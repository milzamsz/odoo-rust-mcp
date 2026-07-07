# Design: Runtime Tool Catalog Drift Import

## Backend

Extend `ConfigManager` with runtime-vs-default tool catalog comparison. The default source is the compiled-in `rust-mcp/config-defaults/tools.json`, matching first-run bootstrap behavior.

Add response structs for drift status and import results. Missing tools are determined by tool `name` only.

Add protected Config UI endpoints:

- `GET /api/config/tools/drift`
- `POST /api/config/tools/import-missing`

The import endpoint appends missing default tools to the runtime tool array and then calls existing save logic so backup, validation, and rollback behavior are preserved.

## Frontend

Extend `ToolsTab` to load drift status alongside the live tools list. Show a compact status card with runtime count, packaged count, and missing count. If missing tools exist, show their names and an import button.

After import, reload tools and drift status.

## Compatibility

The feature is config-manager/UI only. MCP transports and Odoo clients are not changed. Once runtime config is updated, all transports benefit from the existing registry hot-reload path.

## Security

Only packaged defaults are imported. User-supplied payload is not used to define tools. Existing write/cleanup guards remain intact because imported definitions are copied verbatim from defaults.
