# Spec: Runtime Tool Catalog Drift

## Capability

Detect and repair drift between the live runtime MCP tools catalog and the packaged default tools catalog.

## Behavior

- The backend compares runtime tools from the configured runtime `tools.json` with packaged default tools from `rust-mcp/config-defaults/tools.json`.
- Tools are matched by `name`.
- Missing packaged tools are reported with their name, description, and guard metadata.
- Import appends missing packaged tools to the runtime catalog without modifying existing runtime tools.
- Import uses existing save/backup/rollback behavior.
- Runtime registry hot reload is notified after successful import.

## Acceptance Criteria

1. `GET /api/config/tools/drift` returns runtime count, packaged/default count, missing count, and missing tool summaries.
2. `POST /api/config/tools/import-missing` appends only missing packaged tools and preserves existing runtime definitions.
3. Duplicate tool names in either runtime or default config are rejected with actionable errors.
4. Imported tool definitions retain security guards such as `ODOO_ENABLE_WRITE_TOOLS` and `ODOO_ENABLE_CLEANUP_TOOLS`.
5. The Config UI Tools tab displays drift status and provides an import action when missing tools exist.
6. No drift state is visible and non-disruptive.
7. Existing MCP transports and Odoo client behavior are not changed.

## Verification

- Rust tests cover drift comparison, import behavior, duplicate rejection, and guard preservation.
- Frontend tests or type checks cover the new API contract and UI logic where practical.
- Focused backend and frontend validation commands pass.
