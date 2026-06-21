---
title: Add Tauri Sidecar Lifecycle for rust-mcp
lane: backlog
created: 2026-06-22T14:31:00+07:00
updated: 2026-06-22T14:31:00+07:00
description: Launch and supervise rust-mcp.exe from the Tauri Windows app using the current Config UI and MCP HTTP ports.
priority: high
labels: [windows, tauri, desktop-app, sdd]
change: .agentkanban/changes/windows-tauri-sidecar-lifecycle
spec: .agentkanban/specs/windows-tauri-desktop-app/spec.md
dependsOn: [windows-tauri-desktop-foundation]
---

## Conversation

### user

Implement Plan, but just task not development

### agent

Confirmed task file: `.agentkanban/tasks/task_009_windows_tauri_sidecar_lifecycle.md`.

Planning scaffold created for the Tauri sidecar lifecycle slice.

This task owns:

- bundling `rust-mcp.exe` as a sidecar
- starting it with the current local MCP and Config UI ports
- waiting for the Config UI to become healthy before the desktop shell is considered ready

This task assumes the desktop foundation task lands first.

### user
