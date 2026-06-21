---
title: Refine README for Install, Shortcut, UI Usage, and Screenshot Gallery
lane: done
created: 2026-06-21T23:55:00+07:00
updated: 2026-06-22T17:42:00+07:00
description: Rewrite the README into a Windows-first onboarding guide, fix release packaging so shortcut docs stay truthful, and add a dark-mode screenshot gallery with sensitive identifiers blurred.
priority: medium
labels: [docs, windows, installer, screenshots]
---

## Conversation

### user

Implement Plan

### agent

Confirmed task file: `.agentkanban/tasks/task_006_refine_readme_install_shortcuts_and_screenshots.md`.

Implementation started for the approved README and screenshot refresh.

Scope for this task:

- rewrite `README.md` into a short Windows-first onboarding guide
- prioritize install, desktop shortcut, and Config UI usage
- include a copy-paste AI-assisted install prompt
- fix Windows release packaging and shortcut-install flow where the current release ZIP is incomplete
- capture a dark-mode screenshot gallery of the authenticated main UI pages only
- blur instance names, database names, URLs, usernames, and other visible identifiers before saving the final images

Work is being kept separate from the earlier Config UI refactor task so the audit trail for docs and release packaging stays clean.

### user

### agent

Confirmed task file: `.agentkanban/tasks/task_006_refine_readme_install_shortcuts_and_screenshots.md`.

Implementation completed for the README, release packaging, and screenshot refresh.

What changed:

- rewrote `README.md` into a short Windows-first onboarding guide focused on install, shortcut
  launch, Config UI login, first instance setup, and a copy-paste AI install prompt
- added a compact screenshot gallery to the README using six authenticated dark-mode UI captures:
  overview, instances, tools, prompts, server, and security
- saved the final screenshot assets under `docs/src/images/config-ui/` at `1920x1080`
- blurred visible identifiers in the published screenshots before saving them
- fixed the Windows release workflow so the ZIP now includes `install.ps1` plus the native and WSL
  launcher/shortcut files
- updated both `install.ps1` copies so the installer also copies launcher files into
  `C:\Program Files\odoo-rust-mcp`
- updated `Start-MCP-Server.ps1` so it works in both source-checkout layout and installed release
  layout instead of assuming a repo checkout
- updated `TECHNICAL.md` and `.agentkanban/memory.md` with the new release and screenshot
  conventions

Validation completed:

- PowerShell parse check passed for:
  - `Start-MCP-Server.ps1`
  - `install.ps1`
  - `scripts/install.ps1`
- README line count: `111`
- verified all six README screenshot assets exist at `1920x1080`
- validated an installed-layout launcher smoke run from a temporary release-style folder:
  - Config UI on `http://127.0.0.1:3008` returned `200`
  - the launched process came from the temp release folder's `rust-mcp.exe`

Validation note:

- during the installed-layout smoke run, the same process exposed `127.0.0.1:8787`, but the
  `/health` request timed out in this environment, so this task records only the verified Config UI
  success and does not overclaim the HTTP MCP endpoint as fully revalidated from the temp folder

### agent

Confirmed task file: `.agentkanban/tasks/task_006_refine_readme_install_shortcuts_and_screenshots.md`.

Task moved to `done` after full validation gate passed:

- `cd config-ui && npm run lint` — passed
- `cd config-ui && npm run typecheck` — passed
- `cd config-ui && npm test` — 192/192 tests passed
- `cd config-ui && npm run build` — production build successful
- README.md verified at 155 lines with 8 screenshot assets in `docs/src/images/config-ui/`
- All checklist items confirmed complete in `todo_006_refine_readme_install_shortcuts_and_screenshots.md`

No Rust or auth/transport changes in this task — Rust validation gate skipped (documentation-only).

### user
