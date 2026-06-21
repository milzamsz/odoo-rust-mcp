# Proposal

## Why

The desktop app only becomes useful when it can reliably launch and supervise the existing
`rust-mcp.exe` runtime. The repo already has proven launcher behavior in PowerShell, so the next
slice should translate that runtime contract into a native Tauri sidecar lifecycle.

## What changes

- bundle `rust-mcp.exe` as a Tauri sidecar
- start the sidecar with the existing local ports and transport mode
- wait for the Config UI to become healthy before showing the window as ready
- stop only the app-owned sidecar process on desktop-app quit

## Non-goals

- tray UI
- installer automation
- changing backend ports, auth, or config resolution policy
