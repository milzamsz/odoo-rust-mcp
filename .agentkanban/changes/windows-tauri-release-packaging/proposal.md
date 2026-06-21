# Proposal

## Why

A desktop shell is only real product value if it ships through the repo's release pipeline and does
not break the existing Windows ZIP + shortcut install path that users already rely on.

## What changes

- add Windows Tauri build and bundle jobs to release automation
- include sidecar binary, docs, icons, and static assets in the desktop artifact
- keep the current ZIP release and shortcut installer alive during the transition

## Non-goals

- removing the ZIP distribution path in the first release
- adding auto-update infrastructure
- cross-platform desktop packaging beyond Windows in this slice
