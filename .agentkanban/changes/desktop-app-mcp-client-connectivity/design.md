# Design — Desktop App MCP Client Connectivity

## System Tray Clipboard Action

- Add a `copy_mcp` menu item to `build_tray_menu()` in `desktop/src-tauri/src/lib.rs`.
- Read `MCP_AUTH_ENABLED` and `MCP_AUTH_TOKEN` from the `env` file in the user's config directory to determine if auth is enabled and construct the endpoint string.
- If auth is enabled, format as `http://127.0.0.1:8787/mcp (Authorization: Bearer <token>)`. Otherwise, format as `http://127.0.0.1:8787/mcp`.
- Write the formatted string to the clipboard using the `tauri-plugin-clipboard-manager` crate.

## Config UI Connection Panel

- Integrate a new card at the bottom of the `OverviewTab` in `config-ui/src/components/tabs/OverviewTab.tsx`.
- Use a `SegmentedControl` to toggle between HTTP / SSE and Stdio connections.
- Show copyable JSON blocks using Mantine's `Code` and `CopyButton` components.
- Auto-detect if HTTP auth is enabled and inject the bearer header placeholder if so.

## Sidecar Process Lifecycle Fix

- Manage `SidecarState` containing a mutex-wrapped option of `CommandChild` in `desktop/src-tauri/src/lib.rs`.
- In `start_sidecar`, kill the prior child process if one exists, then spawn the new one and store its handle.
- Call kill on quit/exit to clean up the process.
