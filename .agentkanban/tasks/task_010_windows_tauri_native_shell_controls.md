---
title: Add Native Shell Controls to the Tauri Windows App
lane: done
created: 2026-06-22T14:32:00+07:00
updated: 2026-06-22T20:00:00+07:00
description: Add tray actions, loading and failure states, and desktop shell controls around the Tauri-hosted Config UI.
priority: high
labels: [windows, tauri, desktop-app, sdd]
change: .agentkanban/changes/windows-tauri-native-shell-controls
spec: .agentkanban/specs/windows-tauri-desktop-app/spec.md
dependsOn: [windows-tauri-sidecar-lifecycle]
---

## Conversation

### user

Implement Plan, but just task not development

### agent

Confirmed task file: `.agentkanban/tasks/task_010_windows_tauri_native_shell_controls.md`.

Native shell controls implemented:

- System tray icon with tooltip "Odoo Rust MCP" using Rust Hexagon icons
- Tray menu: Open Window, Open Documentation, Open Config Folder, Restart Server, Quit
- Left-click on tray opens/focuses the main webview window
- `tauri_plugin_opener` handles external URL (`/docs/`) and config folder opening
- `tauri_plugin_dialog` available for future file/folder dialogs
- Main window: 1280×800, min 900×600, resizable
- Loading screen `desktop/src/index.html` shows spinner while server starts

### user
