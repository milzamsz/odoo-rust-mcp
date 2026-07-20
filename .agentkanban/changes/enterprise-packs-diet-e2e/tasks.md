# Implementation Checklist

- [x] Confirm branch and preserve existing uncommitted work.
- [x] Trace registry, client pool, config reload, resources, and mutation guard flows.
- [x] Add cached per-instance module snapshots with TTL, persistence, refresh, and stale preservation.
- [x] Add `pack` and `requiredModules` tool metadata and round-trip coverage.
- [x] Filter list and deny call paths using the selected instance snapshot.
- [x] Add metadata-only decision audit events for required denial paths.
- [x] Add explicit refresh and a CI-optional live Odoo smoke check.
- [x] Tag suitable existing tools without adding domain-specific operations.
- [x] Add the short developer ADR and technical note.
- [x] Run formatting, Clippy, all-feature tests, and completion audit.
