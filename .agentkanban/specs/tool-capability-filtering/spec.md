# Tool Capability Filtering

## Behavior

- Maintain a cached installed-module snapshot for each configured Odoo instance.
- Preserve the last successful module list and mark it stale when refresh fails.
- Allow tool definitions to declare optional `pack` and `requiredModules` metadata.
- Omit unavailable tools from instance-scoped discovery and deny stale direct calls clearly.
- Log metadata-only audit decisions for module, pack, environment guard, and controlled-mode denials.
- Provide one CI-optional live Odoo smoke path without requiring live Odoo for unit tests.

## Acceptance Criteria

- A tool requiring a missing module is absent for that instance and cannot be called.
- A failed refresh never replaces a previous successful module list with an empty list.
- `pack` and `requiredModules` survive config load/save without entering MCP input schemas.
- Audit records contain instance, tool, and reason code but no tool arguments or results.
- Existing mutation capability behavior remains covered and unchanged.

## Verification

- Rust formatting, Clippy, and all-feature tests pass.
- Focused snapshot/filter tests prove missing, installed, and stale behavior.
- A runnable ignored integration test or script documents the live Odoo check.

