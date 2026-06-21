# Proposal — Desktop App MCP Client Connectivity

## Why

External MCP clients (Cursor, Claude Desktop, Claude Code, Antigravity, etc.) need a clean, discoverable, and reliable way to connect to the running Tauri desktop application. Additionally, restarting the sidecar server currently has a bug where the old sidecar process isn't killed, causing port collisions.

## What changes

- Add a "Copy MCP Endpoint" action to the system tray menu.
- Add an "MCP Connection" panel in the Config UI's Overview Tab showing copy-ready configuration snippets.
- Document how to connect MCP clients to the running desktop app.
- Fix the sidecar restart bug by tracking and killing the prior child process before re-spawning.
