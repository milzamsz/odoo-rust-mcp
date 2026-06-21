# Proposal

## Why

The repo already has a stable local Config UI and Windows launcher flow, but the primary Windows
experience still depends on a browser plus PowerShell shortcut plumbing. A Tauri shell can make the
product feel like a real desktop app without discarding the existing Rust server or Mantine UI.

## What changes

- add a `desktop/` Tauri 2 application for Windows
- pin the desktop stack to Tauri `2.11.3`
- establish app identity, icons, bundle metadata, and local dev/build scripts
- prepare the repo for sidecar-driven desktop execution without changing backend behavior yet

## Non-goals

- changing MCP protocol behavior
- replacing `rust-mcp.exe` with a new backend implementation
- shipping tray actions or installer automation in this foundation slice
