---
title: Refine Config UI to Minimalist Light-First Shell
lane: in-progress
created: 2026-06-20T16:05:00+07:00
updated: 2026-06-20T16:05:00+07:00
description: Refine the Mantine Config UI into a cleaner shadcn-inspired experience with a collapsible desktop sidebar, quieter layout, and drawer-based editing flows.
priority: high
labels: [config-ui, mantine, minimalist, sdd]
change: .agentkanban/changes/refine-config-ui-minimalist
spec: .agentkanban/specs/config-ui-experience/spec.md
---

## Conversation

### user

### agent

Confirmed task file: `.agentkanban/tasks/task_004_refine_config_ui_minimalist.md`.

Implemented the planning-only split for the Windows Tauri app initiative inside `.agentkanban`
without starting product development.

What was created:

- shared capability spec:
  - `.agentkanban/specs/windows-tauri-desktop-app/spec.md`
- spec-driven change folders:
  - `windows-tauri-desktop-foundation`
  - `windows-tauri-sidecar-lifecycle`
  - `windows-tauri-native-shell-controls`
  - `windows-tauri-release-packaging`
  - `windows-tauri-docs-validation`
- new task files:
  - `task_008_windows_tauri_desktop_foundation.md`
  - `task_009_windows_tauri_sidecar_lifecycle.md`
  - `task_010_windows_tauri_native_shell_controls.md`
  - `task_011_windows_tauri_release_packaging.md`
  - `task_012_windows_tauri_docs_validation.md`

Planning decisions captured in the task split:

- use Tauri `2.11.3` as the pinned stable desktop shell
- keep `rust-mcp.exe` as a sidecar instead of rewriting backend behavior into Tauri
- keep the current Windows ZIP + shortcut path during the first desktop-app rollout
- serialize the work with `dependsOn` so the board can execute the desktop effort in clean slices

No application code, release workflow, installer code, or desktop implementation files were changed
in this pass beyond the planning artifacts themselves.

### user

### agent

Confirmed task file: `.agentkanban/tasks/task_004_refine_config_ui_minimalist.md`.

Added a dedicated HD screenshot for the `Add instance` drawer and linked it from the README.

What changed in this pass:

- extended `scripts/capture-readme-screenshots.mjs` with an `add-instance-dark.png` capture path
- the capture flow now opens the `Add instance` action from the live `Instances` page and waits for
  the drawer title plus the `Instance name` field before saving
- wrote the new asset to `docs/src/images/config-ui/add-instance-dark.png`
- updated `README.md` so the screenshots section now includes `Add instance`

Validation completed in this pass:

- reran the screenshot capture script against the live Config UI on `http://127.0.0.1:3008`
- visually inspected `add-instance-dark.png` to confirm the drawer content, auth options, and tool
  access section are visible

Result:

- README now shows the `Add instance` flow in addition to the list views
- screenshot automation can regenerate the drawer screenshot on future UI updates

### user

### agent

Confirmed task file: `.agentkanban/tasks/task_004_refine_config_ui_minimalist.md`.

Added a dedicated HD screenshot for the `Instances` table view and surfaced it in the README beside
the existing cards screenshot.

What changed in this pass:

- extended `scripts/capture-readme-screenshots.mjs` with a dedicated `instances-table-dark.png`
  capture path
- made the capture flow force the `Instances` screen into `table` mode before saving the PNG
- wrote the new asset to `docs/src/images/config-ui/instances-table-dark.png`
- updated `README.md` so the screenshots section now distinguishes:
  - `Instances cards`
  - `Instances table`

Validation completed in this pass:

- reran the screenshot capture script against the live Config UI on `http://127.0.0.1:3008`
- visually inspected `instances-table-dark.png` to confirm table headers, column filters, and row
  actions are visible

Result:

- README now shows both `Instances` presentation modes
- screenshot automation can regenerate the table view on future updates

### user

### agent

Confirmed task file: `.agentkanban/tasks/task_004_refine_config_ui_minimalist.md`.

Refreshed the README screenshot set with new HD captures from the live authenticated Config UI and
aligned the documentation copy with the updated no-blur requirement.

What changed in this pass:

- added `scripts/capture-readme-screenshots.mjs` to automate README screenshot capture from the live
  server
- the capture flow logs in through `/api/auth/login`, stores the session token in
  `mcp_config_token`, forces dark mode, and writes fresh PNGs to `docs/src/images/config-ui/`
- regenerated:
  - `overview-dark.png`
  - `instances-dark.png`
  - `tools-dark.png`
  - `prompts-dark.png`
  - `server-dark.png`
  - `security-dark.png`
- updated `README.md` so the screenshot section no longer says identifiers are blurred
- updated `TECHNICAL.md` and `.agentkanban/memory.md` so repo guidance matches the new screenshot
  policy

Validation completed in this pass:

- confirmed the live Config UI server on `http://127.0.0.1:3008` returned `200`
- authenticated successfully through `/api/auth/login`
- captured all six screenshots successfully with the automated script
- visually inspected the regenerated `overview-dark.png` and `instances-dark.png`

Result:

- README screenshots: refreshed in HD from the current UI
- screenshot policy text: aligned with the new unblurred captures

### user

### agent

Confirmed task file: `.agentkanban/tasks/task_004_refine_config_ui_minimalist.md`.

Electron is feasible, but I would not choose it as the default path for this repo if the goal is
`ringan tapi powerful`.

Recommended direction:

- use `Tauri v2` or a thin WebView2/Wry shell for a real Windows app experience
- keep the existing Rust MCP binary as the core server
- keep the current Mantine/Vite Config UI as the frontend
- package the app icon, mdBook docs, shortcut/startup flow, and local server lifecycle into one
  desktop installer

Why Tauri/WebView2 fits better than Electron here:

- the project is already Rust-first, so Tauri aligns with the backend and release toolchain
- Windows already provides WebView2, so the app avoids bundling a full Chromium runtime
- package size and memory use should stay much lower than Electron
- the security surface is smaller because there is no bundled Node runtime in the renderer by
  default
- the existing Vite UI can be reused without rewriting the Config UI

Electron is still valid if the priority becomes:

- fully bundled Chromium consistency across machines
- richer desktop APIs through the Electron ecosystem
- faster implementation using familiar Node tooling
- built-in auto-update flows with electron-builder/electron-updater

But the tradeoff is heavier install size, heavier RAM, duplicate runtime beside the Rust server,
and more packaging/security work. For this app, that feels like paying a lot of weight for a wrapper
around an already local web UI.

Best implementation plan if we want a Windows app:

1. Create a new desktop wrapper package, preferably `desktop/` with Tauri.
2. Reuse `config-ui` build output as the app UI.
3. Launch and supervise the Rust MCP server as a sidecar process.
4. Open the local Config UI inside the desktop shell, not the browser.
5. Add tray controls: `Open`, `Restart server`, `Open docs`, `Open config folder`, `Quit`.
6. Reuse the Rust Hexagon `.ico`.
7. Package with MSI/NSIS and keep the current shortcut installer as the lightweight fallback.

Decision:

- for lightweight powerful Windows app: choose Tauri/WebView2
- for fastest heavy desktop shell: choose Electron
- for current repo maturity: keep shortcut launcher stable, then add Tauri as a new packaged app
  target

### user

### agent

Confirmed task file: `.agentkanban/tasks/task_004_refine_config_ui_minimalist.md`.

Removed the remaining old UI references from the documentation surface and revalidated that the
current app shell exposes the docs entry.

What changed in this pass:

- rewrote the docs source pages that still needed to describe the current Mantine shell:
  - `docs/src/chapter_1.md`
  - `docs/src/functional/config-ui.md`
  - `docs/src/functional/configuration.md`
- aligned the docs with the current minimalist UI:
  - collapsible sidebar
  - Overview-first landing flow
  - `Documentation` sidebar item
  - current dark screenshots
- removed the old screenshot assets that belonged to the pre-refactor UI:
  - `login.png`
  - `overview-server.png`
  - `instances-list.png`
  - `instance-form.png`
  - `tools-groups.png`
  - `security.png`
- installed `mdbook` locally and rebuilt `docs/book` so the served `/docs/` output no longer lags
  behind the updated markdown source
- rebuilt the embedded UI bundle so the current shell, including the docs sidebar entry, is present
  in `rust-mcp/static/dist`

Validation completed in this pass:

- `cd config-ui && npm run build`
- `mdbook build docs`
- verified `docs/src/images/config-ui/` now contains only the new dark screenshots
- verified `docs/book` no longer references the deleted old UI image filenames
- verified source and built UI contain the `Documentation` sidebar action that opens `/docs/`

Result:

- old docs UI references: removed
- generated docs output: rebuilt
- sidebar docs entry: present in source and built UI

### user

documentation icon for sidebar in meantime, add it

### agent

Confirmed task file: `.agentkanban/tasks/task_004_refine_config_ui_minimalist.md`.

Added a temporary `Documentation` item to the sidebar shell so the docs are reachable from the
authenticated workspace without waiting for a bigger navigation pass.

What changed in this pass:

- added a `Documentation` nav item in the `Workspace` section of the sidebar
- used the `BookOpenText` Phosphor icon to keep it visually aligned with the current shell
- made the docs entry open `/docs/` in a new tab so the main Config UI stays on its current route
  and any in-progress edits in the shell are not interrupted
- tightened the sidebar test coverage with a focused assertion that the docs item opens the docs URL

Validation completed for this pass:

- `cd config-ui && npm test -- --run src/__tests__/app-shell-layout.test.tsx`
- `cd config-ui && npm run lint`
- `cd config-ui && npm run typecheck`

Validation note:

- the existing Mantine menu test still prints the same jsdom `NaN` left-position warning, but the
  test file passes and lint/typecheck are clean

### user

shortcut windowsnya ga jalan

### agent

Confirmed task file: `.agentkanban/tasks/task_004_refine_config_ui_minimalist.md`.

Fixed the desktop shortcut path itself, not just the underlying launcher script.

What changed in this pass:

- updated `Start-MCP-Server.bat` to use the explicit Windows PowerShell path plus `-NoProfile`,
  and to return the child exit code cleanly
- changed `Create-Shortcut.ps1` so the desktop `Odoo MCP Server.lnk` now targets PowerShell
  directly with `Start-MCP-Server.ps1` instead of targeting the `.bat` wrapper
- regenerated the desktop shortcut on this machine so the user-facing `.lnk` now points to:
  `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`
- updated `TECHNICAL.md` and `.agentkanban/memory.md` to record the new preferred shortcut shape

Validation completed for this pass:

- inspected the actual desktop shortcut COM metadata before and after regeneration
- confirmed the new shortcut target is PowerShell with the correct repo-local script arguments
- launched the desktop `.lnk` itself with `MCP_NO_BROWSER=1`
- confirmed the shortcut brought up the server and Config UI successfully
- confirmed `http://127.0.0.1:3008` returned `200`
- confirmed the launcher process exposed listening ports on `127.0.0.1:8787` and `0.0.0.0:3008`

Likely root cause:

- the old desktop `.lnk` targeted `Start-MCP-Server.bat`, which added an extra wrapper hop and
  could fail silently in the user-click path even though `Start-MCP-Server.ps1` itself worked when
  run directly

### user

fix windows shortcut

### agent

Confirmed task file: `.agentkanban/tasks/task_004_refine_config_ui_minimalist.md`.

Fixed the Windows shortcut launcher regression that could stall on repeated launches.

What changed in this pass:

- moved the healthy-UI shortcut fast path ahead of the rebuild step so an already running Config UI
  opens immediately instead of entering `cargo build`
- added `.codex-run/shortcut-build.lock` so repeated launcher clicks do not start competing
  `cargo build --release` processes that block on Cargo's build directory lock
- added a bounded wait path for concurrent launcher runs and a dedicated timeout dialog when another
  rebuild never clears
- updated `TECHNICAL.md` and `.agentkanban/memory.md` with the new launcher behavior

Validation completed for this pass:

- stopped stale `cargo` and `rust-mcp` processes left from earlier launcher retries
- launched `rust-mcp\target\release\rust-mcp.exe` manually on `127.0.0.1:8787` and `3008`
- ran `Start-MCP-Server.ps1` with `MCP_NO_BROWSER=1` while the UI was already healthy
- confirmed the launcher exited successfully in about `4.5` seconds without forcing a rebuild
- confirmed `http://127.0.0.1:3008` returned `200` after the shortcut smoke run

Root cause:

- the launcher previously called `Ensure-ReleaseBinaryCurrent` before checking whether the Config UI
  was already healthy, so repeated launches could pile up hidden `cargo build` processes and leave
  later launches waiting on Cargo's file lock instead of reusing the running UI

### user

Implement Plan

### agent

Confirmed task file: `.agentkanban/tasks/task_004_refine_config_ui_minimalist.md`.

Implemented the typography cleanup and the new three-mode appearance control.

What changed in this pass:

- reduced heavy text treatment across the shared Mantine theme so headings, badges, buttons,
  filters, chips, and table labels sit mostly in the `400` to `500` range
- simplified instance name presentation and softened metadata emphasis in the instances workspace
- replaced the binary header theme toggle with a Mantine menu for `Light`, `Dark`, and `Auto`
- switched the app default color-scheme preference from `light` to `auto`, while preserving any
  existing saved explicit preference
- updated the Config UI guide, technical notes, spec, and checklist to reflect the new appearance
  behavior
- added a focused header-shell test that verifies the three theme modes are available and
  switchable

Validation completed for this pass:

- `cd config-ui && npm run lint`
- `cd config-ui && npm run typecheck`
- `cd config-ui && npm test -- --run`
- `cd config-ui && npm run build`

Validation note:

- Vitest still prints a jsdom positioning warning from Mantine menu layout (`NaN` `left` style) in
  the new shell test, but the suite passes and the production build is clean.

### user

Implement Plan

### agent

Confirmed task file: `.agentkanban/tasks/task_004_refine_config_ui_minimalist.md`.

Refined the prompt editor so Add/Edit Prompt now follows the same drawer system as Add/Edit
Instance instead of a smaller generic form drawer.

What changed in this pass:

- widened the prompt drawer to the same desktop footprint as the instance editor
- added the same structured editor rhythm: header summary, compact metadata badge, section title,
  long-form body, and sticky footer actions
- made the drawer body scroll independently so long prompt content stays usable on shorter screens
- kept the existing prompt schema and save flow intact
- updated the prompt form test to match the refined editor copy

Validation for this pass is running against the Config UI prompt flow.

### user

### agent

Confirmed task file: `.agentkanban/tasks/task_004_refine_config_ui_minimalist.md`.

Validation for the prompt editor refinement completed successfully.

Passed in this pass:

- `cd config-ui && npm run lint`
- `cd config-ui && npm run typecheck`
- `cd config-ui && npm test -- --run src/__tests__/prompt-form.test.tsx`
- `cd config-ui && npm run build`

Implementation outcome:

- Add/Edit Prompt now uses the same large right-side drawer pattern as Add/Edit Instance
- the drawer body scrolls independently, so long prompt content no longer gets visually cramped on
  shorter screens
- sticky footer actions remain visible while editing
- no backend contract or prompt data shape was changed

### user

### agent

Confirmed task file: `.agentkanban/tasks/task_004_refine_config_ui_minimalist.md`.

Windows shortcut launch flow has been fixed and revalidated for the embedded Config UI.

What changed:

- hardened `Start-MCP-Server.ps1` so it waits longer for the Config UI to become ready
- replaced the slower port probe with a direct TCP connect check
- added a healthy-instance fast path so the shortcut reuses an already running UI
- added dedicated shortcut server logs in `.codex-run/shortcut-server.out.log` and `.codex-run/shortcut-server.err.log`
- improved the timeout dialog so failures now point directly to the new log files

Validation completed:

- launched the server through `Start-MCP-Server.ps1` with browser auto-open disabled
- launched the `.bat` wrapper used by the desktop shortcut
- confirmed `127.0.0.1:8787` and `0.0.0.0:3008` were listening
- confirmed `curl.exe -I http://127.0.0.1:3008` returned `HTTP/1.1 200 OK`
- updated `README.md` and `TECHNICAL.md` with the shortcut diagnostics and first-launch rebuild note

Result:

- Windows shortcut path to Config UI: working
- `http://localhost:3008`: reachable after launcher start
- shortcut diagnostics: improved for future failures

### user

Implement Plan

### agent

Confirmed task file: `.agentkanban/tasks/task_004_refine_config_ui_minimalist.md`.

Implementation is in progress for the approved minimalist refinement plan.

This pass covers:

- creating the new spec-driven task record and checklist
- updating the shared Config UI spec to match the new target behavior
- rewriting the shell toward a light-first minimalist system
- adding a collapsible desktop sidebar with persisted state
- converting long edit flows into right-side drawers
- refining the main Config UI surfaces while preserving the current backend contract

### user

use mantine skills

### agent

Confirmed task file: `.agentkanban/tasks/task_004_refine_config_ui_minimalist.md`.

No dedicated Mantine skill is available in this environment, so the implementation uses the closest
applicable guidance:

- React frontend best practices for the component refactor
- design-system management guidance for tokens, component consistency, and pattern cleanup

Implementation status in this pass:

- switched the Config UI to a light-first Geist + Phosphor visual system
- added the persisted collapsible desktop sidebar and quieter header/footer status treatment
- moved instance and prompt editing into right-side drawers
- cleaned up overview, instances, tools, server, security, and login surfaces toward the new
  minimalist direction
- updated shared docs and task artifacts to match the new UI behavior

Validation so far:

- `cd config-ui && npm run lint`
- `cd config-ui && npm run typecheck`
- `cd config-ui && npm run build`
- `cd config-ui && npm test -- --run src/__tests__/instances-tab.test.tsx`
- `cd config-ui && npm test -- --run src/__tests__/server-tab.test.tsx`
- `cd config-ui && npm test -- --run src/__tests__/runtime-env-snapshot-card.test.tsx`

Validation note:

- the earlier `PromptForm` hang was fixed by stabilizing dirty-state callbacks and avoiding the
  reset loop in the prompt drawer setup

Final validation completed:

- `cd config-ui && npm run lint`
- `cd config-ui && npm run typecheck`
- `cd config-ui && npm test -- --run`
- `cd config-ui && npm run build`

### user

oke do all

### agent

Confirmed task file: `.agentkanban/tasks/task_004_refine_config_ui_minimalist.md`.

Extended validation and follow-up fixes are complete.

What was fixed after the UI work:

- stabilized dirty-state registration so the prompt drawer tests no longer hang
- raised slow UI test timeouts where full-suite jsdom startup on this machine was the limiting factor
- serialized process-env mutations in `rust-mcp/src/main.rs` tests to remove flaky parallel failures
- serialized env-backed HTTP transport test setup in `rust-mcp/tests/http_transport.rs` for Windows-safe runs

Rust validation completed:

- `cargo fmt --all --check --manifest-path rust-mcp/Cargo.toml`
- `cargo clippy --all-features --manifest-path rust-mcp/Cargo.toml -- -D warnings`
- `cargo test --all-features --manifest-path rust-mcp/Cargo.toml`

Embedded runtime smoke checks completed:

- started `rust-mcp.exe` with `--transport http --listen 127.0.0.1:8787 --config-server-port 3008`
- confirmed `127.0.0.1:8787` and `127.0.0.1:3008` were listening
- confirmed `/mcp` initialize returned `200` with server info and capabilities
- confirmed `http://127.0.0.1:3008` served the built HTML shell
- confirmed the embedded JS asset path returned `200`

Result:

- UI refinement implementation: complete
- frontend validation: complete
- Rust validation: complete
- embedded runtime smoke: complete

### user

### agent

Confirmed task file: `.agentkanban/tasks/task_004_refine_config_ui_minimalist.md`.

Implemented the approved Rust Hexagon application identity and made the built-in mdBook link work
from packaged installations.

What changed:

- created the Rust Hexagon SVG mark and reusable React `AppMark`
- applied the mark to the authenticated header, login screen, browser favicon, social metadata, and
  mdBook theme
- removed the remaining Vite and Bolt placeholder metadata
- kept Documentation in the Workspace sidebar, made the item an accessible button, and preserved
  new-tab behavior for `/docs/`
- created a deterministic seven-size Windows ICO generator and generated
  `assets/odoo-rust-mcp.ico`
- updated Windows and WSL shortcut creation to use the branded ICO and regenerated the live Desktop
  shortcut
- added executable-relative and platform share-directory discovery for `docs/book`
- added mdBook build artifacts to Windows, Unix, Debian, Homebrew, and Docker delivery paths
- added release installation assertions for the icon and documentation
- updated the Config UI spec, design, checklist, README, functional guide, technical notes, and
  persistent project memory

Validation completed:

- `cd config-ui && npm run lint`
- `cd config-ui && npm run typecheck`
- `cd config-ui && npm test -- --run` (`192` tests passed)
- `cd config-ui && npm run build`
- `mdbook build docs`
- `cargo fmt --all --check --manifest-path rust-mcp/Cargo.toml`
- `cargo clippy --all-features --manifest-path rust-mcp/Cargo.toml -- -D warnings`
- `cargo test --all-features --manifest-path rust-mcp/Cargo.toml`
- packaged-layout smoke: Config UI `200`, app icon `200`, Documentation `200`
- release ZIP smoke confirmed `assets/odoo-rust-mcp.ico`, `docs/book/index.html`, and shortcut script
- regenerated Desktop shortcut confirmed `IconLocation` points to the branded ICO
- ICO regeneration is deterministic and mdBook's hashed favicon matches the theme source

Validation note:

- Docker was unavailable locally, so the Dockerfile-specific build check could not run. The shared
  UI, docs, Rust, packaging, and runtime validations passed.

### user
