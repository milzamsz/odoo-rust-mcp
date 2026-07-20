---
title: Enterprise Packs Diet E2E
lane: done
created: 2026-07-20T00:00:00+07:00
updated: 2026-07-21T00:00:00+07:00
description: Add per-instance installed-module snapshots, declarative tool pack metadata and module filtering, guard audit events, a live-capable smoke check, and a short scope ADR without introducing a pack framework.
priority: high
labels: [mcp, rust, odoo, tools, sdd]
change: .agentkanban/changes/enterprise-packs-diet-e2e
spec: .agentkanban/specs/tool-capability-filtering/spec.md
evidence:
  lint: {ran: true, passed: true}
  test: {ran: true, passed: true}
  build: {ran: true, passed: true}
  behavior: {ran: true, passed: true}
---

## Conversation

### user

Implement `.cursor/plans/enterprise_packs_e2e_add67b91.plan.md`; all plan decisions are approved.

### agent

Confirmed task file: `.agentkanban/tasks/task_020_enterprise_packs_diet_e2e.md`.

Implementation started on `release/v0.6.0`. Existing uncommitted mutation/capability work will be preserved. Scope is limited to the approved diet plan: snapshots, declarative metadata and filtering, audit decisions, smoke coverage, and a short ADR.

### user

### agent

Completed the approved diet plan and explicitly transitioned this Lite task from `in-progress` to `done` after independent review.

Evidence:

- Rust formatting and Clippy passed with warnings denied.
- Rust all-feature suite passed: 401 tests, with the live-only test ignored by default.
- Config UI lint passed with one pre-existing hook warning; typecheck and all 195 tests passed.
- Rust and Config UI production builds passed.
- Live Odoo 18 CE smoke passed against `mutation_matrix_18ce` (64 installed modules, `stock` absent, gated tool hidden) and `oc_theme_e2e_clean` (75 installed modules, `stock` present, gated tool visible).
- Independent implementation review found and prompted fixes for standard unscoped `tools/list` filtering and the UI `requiresEnvTrueAll` type, then returned PASS after re-review.
- `mdbook build docs` was not run because `mdbook` is not installed locally; the new SUMMARY entry and Markdown were inspected, and mdBook is outside the plan's required validation commands.

Delivered snapshots with persistence/TTL/stale preservation, explicit refresh, `pack`/`requiredModules` plus `disabledPacks`, list/call enforcement, metadata-only denial audit events, live-capable smoke coverage, the short ADR, and synchronized v0.6.0 release metadata. Deferred subsystems remain absent.

### user

Update progressnya di `.cursor/plans/enterprise_packs_e2e_add67b91.plan.md`.

### agent

Confirmed task file: `.agentkanban/tasks/task_020_enterprise_packs_diet_e2e.md`.

Updated the plan with a dated 100% progress section covering all six completed items, delivered artifacts, Rust/UI validation totals, live Odoo missing/present evidence, independent review, synchronized v0.6.0 metadata, and the remaining operational notes (`mdbook` unavailable locally; no commit or PR created).

### user
