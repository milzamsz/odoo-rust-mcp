# Design

## CI flow

- build UI
- build docs
- build Rust release binary
- build Windows Tauri bundle

## Packaging contract

- include `rust-mcp.exe`
- include `docs/book`
- include Rust Hexagon icon assets
- keep current PowerShell launcher and install scripts in the ZIP path
- hand off GitHub publication, updater metadata, and release signatures to the dedicated deployment
  slice

## Validation

- release workflow asserts the Tauri artifact exists
- Windows smoke install validates the desktop artifact contents
