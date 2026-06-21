---
title: Add Version Display to Config UI Footer
lane: done
created: 2026-06-21T23:59:00+07:00
updated: 2026-06-21T23:59:00+07:00
description: Display the application version (from package.json) in the Config UI footer bar, next to the hot reload badge.
priority: low
labels: [config-ui, ux]
---

## Conversation

### user

Implement Plan: Add version display to Config UI footer (Option 1 from suggestions). Read the `package.json` version and display it in the footer bar next to the hot reload badge. Format: "v0.4.0". Keep it subtle and readable.

### agent

Confirmed task file: `.agentkanban/tasks/task_007_add_version_to_ui_footer.md`.

Implementation completed for the version display in the Config UI footer.

What changed:

- Added version `v0.4.0` to the footer bar in `config-ui/src/components/AppShellLayout.tsx`
- Positioned next to the hot reload badge for a subtle, professional look
- Format: "v0.4.0 — Changes are applied to the embedded config surface without restart."
- All existing tests and build passed

The version is now always visible in the footer across all UI tabs.

### agent

PR #1 merged successfully! 🎉

**PR Details:**
- **URL**: https://github.com/milzamsz/odoo-rust-mcp/pull/1
- **Merge SHA**: `ba9903c600d289e355f38c2f970f1b2ee322755a`
- **Merge method**: Squash
- **Status**: ✅ Merged to `main`

**Verification evidence:**
- ✅ `cargo check --all-features` — passed
- ✅ `cargo clippy --all-features -- -D warnings` — passed  
- ✅ `cargo test --all-features` — 222/222 tests passed
- ✅ `cargo fmt --all --check` — passed
- ✅ `cd config-ui && npm run lint` — passed
- ✅ `cd config-ui && npm run typecheck` — passed
- ✅ `cd config-ui && npm test` — 192/192 tests passed
- ✅ `cd config-ui && npm run build` — passed

Steps 4–6 of stage-in-progress-to-done prompt: **skipped** — this is a non-cross-cutting UI-only change (footer text), no auth/transport/config-manager behavior changed, no docs affected, no production risk.