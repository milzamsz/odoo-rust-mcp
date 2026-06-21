# Windows Tauri desktop app spec

## Intent

Add a native Windows desktop app for `odoo-rust-mcp` using the latest stable Tauri 2 release while
preserving the current Rust MCP server and Mantine Config UI architecture.

## Required behavior

1. The Windows desktop app uses Tauri `2.11.3` as the pinned stable foundation.
2. The desktop app wraps the existing `rust-mcp.exe` as a sidecar instead of rewriting the MCP
   server into the Tauri crate.
3. The main window loads the existing Config UI from the local config server at
   `http://127.0.0.1:3008`.
4. The sidecar starts `rust-mcp.exe` with the current HTTP transport and Config UI ports unless a
   later additive setting explicitly changes them.
5. The desktop shell reuses the Rust Hexagon app identity for the window, tray, shortcut, and
   installer iconography.
6. The desktop app exposes system-tray controls for opening the app window, opening bundled docs,
   restarting the local server, opening the config directory, and quitting cleanly.
7. The bundled `/docs/` route remains available from the desktop shell because `docs/book` is
   packaged with the app.
8. The current Windows ZIP + PowerShell shortcut install path remains available during the first
   desktop-app rollout.
9. The Tauri app does not change MCP API behavior, config schema, auth semantics, or Odoo tool
   behavior.
10. Release automation produces a Windows desktop-app installer artifact in addition to the current
    ZIP release path.

## Visual direction

- Quiet operational desktop shell
- Native-feeling Windows app framing around the existing Config UI
- No browser-first dependency for the primary admin workflow
- Reuse current Config UI typography, theme modes, and navigation patterns

## Acceptance criteria

- a new `desktop/` application exists with Tauri `2.11.3`
- the sidecar launches `rust-mcp.exe` and the app window reaches `http://127.0.0.1:3008`
- tray actions work for open, docs, restart, config folder, and quit
- the packaged app includes the Rust Hexagon icon and `docs/book`
- the release pipeline builds a Windows Tauri installer artifact
- the current ZIP + shortcut flow still works after desktop-app changes
- docs explain when to use the Tauri app versus the ZIP install path

## Verification

- `cd config-ui && npm run lint`
- `cd config-ui && npm run typecheck`
- `cd config-ui && npm test -- --run`
- `cd config-ui && npm run build`
- `cargo fmt --all --check --manifest-path rust-mcp/Cargo.toml`
- `cargo clippy --all-features --manifest-path rust-mcp/Cargo.toml -- -D warnings`
- `cargo test --all-features --manifest-path rust-mcp/Cargo.toml`
- `mdbook build docs`
- `cd desktop && npm run tauri build`
