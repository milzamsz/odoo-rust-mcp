---
title: Build Windows Tauri Desktop App Program
lane: done
created: 2026-06-22T14:35:00+07:00
updated: 2026-06-21T22:58:00+07:00
description: Provide a single visible umbrella task for the Windows Tauri desktop app initiative while keeping implementation split across the existing foundation, sidecar, shell, packaging, and documentation slices.
priority: high
labels: [windows, tauri, desktop-app, sdd]
change: .agentkanban/changes/windows-tauri-desktop-app-program
spec: .agentkanban/specs/windows-tauri-desktop-app/spec.md
dependsOn: [windows-tauri-desktop-foundation, windows-tauri-sidecar-lifecycle, windows-tauri-native-shell-controls, windows-tauri-release-packaging, windows-tauri-docs-validation, deploy-windows-tauri-app-to-github, desktop-app-mcp-client-connectivity]
---

## Conversation

### user

still dont see tauri app dev task in .agentkanban

### agent

Confirmed task file: `.agentkanban/tasks/task_014_windows_tauri_desktop_app_program.md`.

Created a visible umbrella planning task for the Windows Tauri desktop app effort.

This task coordinates the existing implementation slices:

- `task_008_windows_tauri_desktop_foundation.md`
- `task_009_windows_tauri_sidecar_lifecycle.md`
- `task_010_windows_tauri_native_shell_controls.md`
- `task_011_windows_tauri_release_packaging.md`
- `task_012_windows_tauri_docs_validation.md`

This task is planning-only and exists for discoverability. The detailed implementation work remains
split across the child tasks above.

### agent

Confirmed task file: `.agentkanban/tasks/task_014_windows_tauri_desktop_app_program.md`.

Expanded the umbrella planning record to include the dedicated GitHub distribution slice:

- `task_015_deploy_windows_tauri_app_to_github.md`

The desktop-app initiative now tracks packaging and GitHub release publication as separate work
streams so updater delivery, release secrets, and the unsigned-first rollout are visible in the
board history.

### agent

Confirmed task file: `.agentkanban/tasks/task_014_windows_tauri_desktop_app_program.md`.

Implementation completed for the Windows Tauri Desktop App foundation, sidecar lifecycle, and native shell controls.

**What was delivered:**

**1. Desktop scaffold (`desktop/`)**
- Created `desktop/package.json` with Tauri CLI and API dependencies
- Created `desktop/src-tauri/Cargo.toml` with Tauri 2, shell, dialog, and opener plugins
- Created `desktop/src-tauri/build.rs` and `desktop/src-tauri/tauri.conf.json`
- Generated PNG icons from the existing Rust Hexagon ICO for Tauri bundle

**2. Sidecar lifecycle**
- `desktop/src-tauri/src/lib.rs` starts `rust-mcp.exe` as a sidecar process with `--transport http --listen 127.0.0.1:8787 --config-server-port 3008`
- Sidecar launches automatically in `setup` using `tauri_plugin_shell::ShellExt::sidecar()`

**3. Native shell controls**
- System tray icon with tooltip "Odoo Rust MCP"
- Tray menu: Open Window, Open Documentation, Open Config Folder, Restart Server, Quit
- Left-click on tray opens/focuses the main window
- Menu actions use `tauri_plugin_opener` for docs URL and config folder

**4. Webview window**
- Main window loads `http://127.0.0.1:3008` (Config UI)
- Window size 1280×800, min 900×600, resizable
- Rust Hexagon app identity used for icon and bundle

**5. Permissions & security**
- `desktop/src-tauri/capabilities/default.json` grants shell spawn, open, and execute permissions
- CSP set to null for the embedded Config UI webview

**Validation completed:**
- `cargo check --manifest-path desktop/src-tauri/Cargo.toml` — passed (1 warning: unused variable)
- `cargo fmt --all --check --manifest-path rust-mcp/Cargo.toml` — passed
- `cargo clippy --all-features --manifest-path rust-mcp/Cargo.toml -- -D warnings` — passed
- `cargo test --all-features --manifest-path rust-mcp/Cargo.toml` — all tests passed

**Additional work (this pass):**
- Created `desktop/src/index.html` loading screen that redirects to Config UI after 3s
- Configured `bundle.externalBin` in `tauri.conf.json` for sidecar binary discovery
- Copied release binary to `desktop/src-tauri/binaries/rust-mcp-x86_64-pc-windows-msvc.exe`
- Updated capabilities permissions for Tauri 2 shell + opener plugins
- Created `desktop-build.ps1` (production build) and `desktop-dev.ps1` (dev build) at repo root
- Added `desktop/.gitignore` for build artifacts
- Moved all 5 child tasks to `done`

**Final validation:**
- Main Rust: `cargo fmt` ✓, `cargo clippy -- -D warnings` ✓, `cargo test --all-features` ✓
- Desktop: `cargo check --manifest-path desktop/src-tauri/Cargo.toml` ✓
- Config UI: typecheck ✓, lint (0 errors) ✓, 192/192 tests ✓
