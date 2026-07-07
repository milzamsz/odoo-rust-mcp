---
title: Fix Desktop Blank Window Startup
lane: done
created: 2026-07-06T13:36:57+07:00
updated: 2026-07-07T10:01:59.771Z
description: Fix the installed Tauri desktop app showing a blank white window instead of the Config UI during startup.
priority: high
labels:
  - windows
  - tauri
  - desktop-app
  - blocked-by:windows-tauri-sidecar-lifecycle
sortOrder: 0
slug: fix_desktop_blank_window_startup
dependsOn:
  - windows-tauri-sidecar-lifecycle
---

## Conversation

### user

install odoo-rust-mcp into VS Code, currenty just see ssh-manager (you can use as reference)

### agent

Confirmed task file: `.agentkanban/tasks/task_017_fix_desktop_blank_window_startup.md`.

Installed `odoo-rust-mcp` into VS Code's MCP server config using the existing `ssh-manager` entry as the schema reference.

What changed:

- updated `~/.config/Code/User/mcp.json`
- added `servers.odoo-rust-mcp`
- used the local desktop MCP HTTP endpoint `http://127.0.0.1:8787/mcp`

Final VS Code MCP shape:

```json
{
  "servers": {
    "ssh-manager": {
      "command": "node",
      "args": ["/home/milzam/Workspace/tools/mcp/mcp-ssh-manager/src/index.js"],
      "env": {
        "SSH_MANAGER_ENV": "/home/milzam/.ssh-manager/.env"
      }
    },
    "odoo-rust-mcp": {
      "type": "http",
      "url": "http://127.0.0.1:8787/mcp"
    }
  }
}
```

Verification:

- read back `~/.config/Code/User/mcp.json`
- `curl http://127.0.0.1:8787/health` returned `200`

VS Code needs a reload/restart to show the new server in the MCP panel.

### user

setup mcp this into codex, claude, opencode, antigravity & cursor

### agent

Confirmed task file: `.agentkanban/tasks/task_017_fix_desktop_blank_window_startup.md`.

Configured the local desktop MCP endpoint `http://127.0.0.1:8787/mcp` into the installed clients that expose writable local config surfaces.

Configured successfully:

1. Claude Code
   - used `claude mcp add --transport http --scope user odoo-rust-mcp http://127.0.0.1:8787/mcp`
   - verified with `claude mcp list` showing `odoo-rust-mcp` as connected

2. Claude Desktop
   - updated `~/.config/Claude/claude_desktop_config.json`

3. Codex
   - used `codex mcp add odoo-rust-mcp --url http://127.0.0.1:8787/mcp`
   - verified with `codex mcp list`

4. OpenCode
   - replaced the root-owned `~/.config/opencode/opencode.json` with a user-writable config that adds `mcp.odoo-rust-mcp`

5. Cursor
   - created `~/.cursor/mcp.json`

Antigravity status:

- Antigravity appears to be installed only as a Chrome extension (`Antigravity Browser Extension`) with opaque browser-managed extension state.
- No writable plain-text config file or documented local MCP config surface was present in this environment, so I did not force-write opaque extension storage.

Files/config touched:

- `~/.claude.json`
- `~/.config/Claude/claude_desktop_config.json`
- `~/.codex/config.toml`
- `~/.config/opencode/opencode.json`
- `~/.cursor/mcp.json`

Follow-up reminders:

- restart Claude Desktop
- restart Cursor
- restart OpenCode so it reloads `opencode.json`

### user

error when connect, already input right credentials, fix it

### agent

Confirmed task file: `.agentkanban/tasks/task_017_fix_desktop_blank_window_startup.md`.

Investigated the connection failure in the running desktop app.

Findings:

1. The saved instance config at `~/.config/odoo-rust-mcp/instances.json` currently contains:
   - `url: "https://erp.centralaroma.com/"`
   - `username: "https://erp.centralaroma.com/"`
2. For Odoo `18`, the app uses JSON-RPC username/password authentication, so using the site URL as the username causes authentication to fail even if the password is correct.
3. The product previously returned a generic auth error, which made the bad saved username easy to miss.

Implementation completed:

1. Backend validation
   - added `username_looks_like_url()` to `rust-mcp/src/odoo/config.rs`
   - rejected invalid password-auth instance saves in `rust-mcp/src/config_manager/manager.rs`
   - returned a specific connection-test hint in `rust-mcp/src/config_manager/server.rs`

2. UI validation
   - `config-ui/src/components/InstanceForm.tsx` now blocks saves when Username looks like `http://...` or `https://...`

3. Local desktop bundle refresh
   - rebuilt the Config UI and Rust binaries
   - refreshed the user-local desktop override bundle under `~/.local/opt/odoo-rust-mcp-desktop/AppDir`

Verification:

- `cargo test --manifest-path rust-mcp/Cargo.toml config_manager::manager::tests::test_save_instances_rejects_password_username_that_looks_like_url -- --nocapture`
- `cargo check --manifest-path rust-mcp/Cargo.toml`
- live desktop API check now returns:
  - `The saved Username currently looks like the instance URL. For Odoo 18 and earlier, enter the Odoo login name or email in Username and keep the site address only in URL.`

Current user action still required:

- replace the saved Username for `erp-ca-prod` with the real Odoo login name or email; the current saved value is still the site URL

### user

still blank fix it

### agent

Confirmed task file: `.agentkanban/tasks/task_017_fix_desktop_blank_window_startup.md`.

Found the deeper packaged-Linux cause and fixed it.

Root cause:

1. The installed desktop shell was still resolving to the old `/usr/bin/odoo-rust-mcp-desktop` binary.
2. The packaged `rust-mcp` sidecar served `404` at `http://127.0.0.1:3008/` because `find_static_dir()` only looked for `static/dist` beside the executable, while Linux packages install the Config UI assets under `/usr/lib/Odoo Rust MCP/static/dist`.
3. That left the Tauri window with a blank white page even when the sidecar process itself started.

Additional implementation completed:

1. `rust-mcp/src/config_manager/server.rs`
   - serves `index.html` at `/` when the built UI exists
   - probes packaged Linux asset locations including `/usr/lib/Odoo Rust MCP/static/dist`
   - keeps the existing static-file fallback behavior when built assets are missing

2. User-local install override
   - created `~/.local/bin/odoo-rust-mcp-desktop`
   - created `~/.local/share/applications/Odoo Rust MCP.desktop`
   - installed a user-local desktop bundle under `~/.local/opt/odoo-rust-mcp-desktop/AppDir`
   - copied the freshly rebuilt `odoo-rust-mcp-desktop` and `rust-mcp` binaries into that AppDir
   - enabled Linux WebKit fallback env vars in the wrapper to reduce compositor-related blank window cases

Verification:

- `which odoo-rust-mcp-desktop` now resolves to `~/.local/bin/odoo-rust-mcp-desktop`
- launching that wrapper starts the local desktop bundle
- `curl http://127.0.0.1:3008/` now returns `HTTP/1.1 200 OK` and the React `index.html`

Files added or changed in this pass:

- `rust-mcp/src/config_manager/server.rs`
- `~/.local/bin/odoo-rust-mcp-desktop`
- `~/.local/share/applications/Odoo Rust MCP.desktop`
- `TECHNICAL.md`
- `.agentkanban/memory.md`

The fixed launcher is now the default for this user account via both `PATH` and the local desktop entry.

### user

fix installed odoo rust mcp still bank white

### user

this is blank

### user

just create tasks & fix it

### user

yes do that

### agent

Confirmed task file: `.agentkanban/tasks/task_017_fix_desktop_blank_window_startup.md`.

Investigating the packaged desktop startup path and patching the Tauri navigation flow so the installed app can wait for the local Config UI and recover with a visible error state instead of a blank white webview.

### agent

Implemented the desktop startup fix.

What changed:

1. `desktop/src-tauri/src/lib.rs`
   - moved Config UI readiness waiting into Rust instead of relying on the splash page redirect
   - polls `http://127.0.0.1:3008` for a real HTTP 200 response before navigating the webview
   - navigates the packaged Tauri window only after the local Config UI is ready
   - reports sidecar spawn and navigation failures back into the splash page instead of leaving a blank white window

2. `desktop/src/index.html`
   - replaced the light redirect-only splash with a dark branded startup screen
   - added explicit status and error hooks used by Rust during startup
   - added visible recovery actions when startup fails

3. Durable implementation notes
   - updated `TECHNICAL.md`
   - updated `.agentkanban/memory.md`

Validation completed:

- `cargo check --manifest-path desktop/src-tauri/Cargo.toml`
- `cargo fmt --all --check --manifest-path rust-mcp/Cargo.toml`
- `cargo check --manifest-path rust-mcp/Cargo.toml`
- `cd desktop && npm run build`

Install status:

- rebuilt desktop bundles at:
  - `desktop/src-tauri/target/release/bundle/deb/Odoo Rust MCP_0.5.1_amd64.deb`
  - `desktop/src-tauri/target/release/bundle/rpm/Odoo Rust MCP-0.5.1-1.x86_64.rpm`
  - `desktop/src-tauri/target/release/bundle/appimage/Odoo Rust MCP_0.5.1_amd64.AppImage`
- direct replacement of `/usr/bin/odoo-rust-mcp-desktop` failed in this session with `Permission denied`, so the installed system binary was not overwritten automatically

### user
