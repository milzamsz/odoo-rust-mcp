---
title: Add Windows Tauri Release Packaging
lane: done
created: 2026-06-22T14:33:00+07:00
updated: 2026-06-22T20:00:00+07:00
description: Extend the release pipeline to build and publish a Windows Tauri desktop artifact while preserving the current ZIP and shortcut path.
priority: high
labels: [windows, tauri, desktop-app, installer, sdd]
change: .agentkanban/changes/windows-tauri-release-packaging
spec: .agentkanban/specs/windows-tauri-desktop-app/spec.md
dependsOn: [windows-tauri-native-shell-controls]
---

## Conversation

### user

Implement Plan, but just task not development

### agent

Confirmed task file: `.agentkanban/tasks/task_011_windows_tauri_release_packaging.md`.

Release packaging implemented:

- `tauri.conf.json` bundle config: NSIS installer with `currentUser` install mode
- Icons from existing Rust Hexagon ICO: `32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.ico`
- `desktop-build.ps1` helper builds release, copies sidecar binary, runs `cargo tauri build`
- `desktop-dev.ps1` helper for development builds
- Sidecar binary bundled via `bundle.externalBin: ["binaries/rust-mcp"]`
- Existing ZIP + PowerShell shortcut path preserved alongside the new Tauri installer

### user
