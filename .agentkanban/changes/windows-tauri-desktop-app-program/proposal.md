# Proposal

## Why

The current `.agentkanban` board already has the Tauri work split into five implementation slices,
but it lacks a single visible umbrella task that makes the desktop-app initiative easy to spot at a
glance.

Adding one parent planning task makes the Tauri effort discoverable without changing the underlying
execution split.

## What changes

- add one umbrella Agentic Kanban task for the Windows Tauri desktop app initiative
- point it at the existing shared capability spec
- make it explicitly reference the existing child tasks:
  - `task_008_windows_tauri_desktop_foundation.md`
  - `task_009_windows_tauri_sidecar_lifecycle.md`
  - `task_010_windows_tauri_native_shell_controls.md`
  - `task_011_windows_tauri_release_packaging.md`
  - `task_012_windows_tauri_docs_validation.md`
  - `task_015_deploy_windows_tauri_app_to_github.md`

## Non-goals

- the umbrella itself authors no new scope; it merely coordinates and records the delivered implementation across the child slices.
- no replacement of the split task structure
