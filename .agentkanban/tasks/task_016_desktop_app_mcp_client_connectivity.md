---
title: Desktop App MCP Client Connectivity
lane: done
created: 2026-06-21T22:58:00+07:00
updated: 2026-06-21T23:04:00+07:00
description: Add a tray action, config UI panel, and docs to connect external MCP clients to the running desktop app, and fix the sidecar restart bug.
priority: high
labels: [windows, tauri, mcp, config-ui, sdd]
change: .agentkanban/changes/desktop-app-mcp-client-connectivity
spec: .agentkanban/specs/windows-tauri-desktop-app/spec.md
dependsOn: [windows-tauri-native-shell-controls]
---

## Conversation

### user

Implement the MCP client connectivity for the Windows Tauri desktop app, including tray menu copy, config UI panel, docs, and sidecar restart fix.

### agent

I will add the clipboard copy menu item to the system tray, a tabbed connection config panel in the Config UI Overview page, connectivity docs, and resolve the sidecar process lifecycle bug on restart.

### agent

Confirmed task file: `.agentkanban/tasks/task_016_desktop_app_mcp_client_connectivity.md`.

Implementation completed for the desktop app MCP client connectivity and sidecar process lifecycle management.

**What was delivered:**

1. **Tray Action — "Copy MCP Endpoint"**
   - Added `tauri-plugin-clipboard-manager` to desktop dependencies and configured capability permissions (`clipboard-manager:allow-write-text`).
   - Registered the plugin and implemented a clipboard copy menu item in `desktop/src-tauri/src/lib.rs`.
   - The action reads `MCP_AUTH_ENABLED` and `MCP_AUTH_TOKEN` from the config directory `env` file to copy the correct formatted endpoint including the Bearer token when auth is enabled.

2. **Config UI — "MCP Connection" panel**
   - Added a SegmentedControl-based panel at the bottom of `OverviewTab.tsx` that lets users select and copy connection configurations for HTTP (Codex, VS Code, Antigravity) and Stdio (Cursor, Claude Desktop, Claude Code).
   - Cleanly handles dynamic bearer token suffix placeholder when HTTP auth is active.

3. **Lifecycle & Restart Fix**
   - Introduced a managed `SidecarState` to track the running sidecar process handle.
   - Fixed the restart process lifecycle bug by explicitly killing the prior child sidecar process before spawning a new one. Also cleans up the process on application exit.

4. **Documentation**
   - Updated `docs/src/functional/getting-started.md` with connection configurations and step-by-step guides for external MCP clients.

**Validation completed:**
- All type checks, lints, backend tests, and frontend tests passed successfully.
- Rust compile check (`cargo check` and `cargo clippy` on both backend and desktop app) completed with 0 errors.

### user
