# Design

- Keep module snapshot logic in a small module separate from `capability.rs`.
- Query installed `ir.module.module` records through the shared Odoo client abstraction and persist snapshots under the resolved config directory.
- Give the registry read access to snapshots for list and call decisions; use existing environment guards and logging facilities.
- Refresh explicitly through an MCP tool and after relevant config reloads where the current architecture has a natural hook.
- Test filtering and stale preservation without a live server; add one ignored live smoke entry point.

