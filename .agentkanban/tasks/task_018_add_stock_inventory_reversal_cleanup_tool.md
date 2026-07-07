---
title: Add Stock Inventory Reversal Cleanup Tool
lane: done
created: 2026-07-07T00:00:00+07:00
updated: 2026-07-07T00:00:00+07:00
description: Add a guarded Odoo MCP cleanup tool to reverse wrong inventory adjustment quantities through stock.quant inventory adjustment flow, and use it to resolve the ERP CA safe reversal worklist.
priority: high
labels: [mcp, rust, cleanup, odoo, stock]
evidence:
  test: {ran: true, passed: true}
  build: {ran: true, passed: true}
  behavior: {ran: true, passed: true}
---

## Conversation

### user

still v0.5.0

### agent

Confirmed task file: `.agentkanban/tasks/task_018_add_stock_inventory_reversal_cleanup_tool.md`.

Added a desktop navigation cache-buster because the live server and installed assets were already corrected but the Tauri webview could still render a cached root page.

Implementation:
- Changed `desktop/src-tauri/src/lib.rs` so the desktop app opens `http://127.0.0.1:3008/?desktopVersion=0.5.1` using `env!("CARGO_PKG_VERSION")`.
- Changed the fallback loader button in `desktop/src/index.html` to open the same versioned URL.
- Rebuilt the Rust sidecar and Linux `.deb` package.
- Updated the user-local AppDir install from the rebuilt package and cleared WebKit cache again.

Verification:
- The installed local desktop binary contains `http://127.0.0.1:3008/?desktopVersion=0.5.1`.
- The versioned live URL serves `assets/index-y9mYti0s.js`.
- The live `AppShellLayout-DA-u314N.js` chunk returns `v0.5.1`.
- The active sidecar process is `/home/milzam/.local/opt/odoo-rust-mcp-desktop/AppDir/usr/bin/rust-mcp`.
- `grep -R -l "v0.5.0" /home/milzam/.local/share/com.odoo-rust-mcp.desktop` returns no files.

### user

still v0.5.0

### agent

Confirmed task file: `.agentkanban/tasks/task_018_add_stock_inventory_reversal_cleanup_tool.md`.

Resolved the remaining visible stale `v0.5.0` footer. The rebuilt app and live server were already serving `v0.5.1`; the stale text shown in the desktop window came from WebKit cache under `/home/milzam/.local/share/com.odoo-rust-mcp.desktop/WebKitCache`.

Actions:
- Stopped `odoo-rust-mcp-desktop` and `rust-mcp`.
- Cleared stale app webview cache directories under `/home/milzam/.local/share/com.odoo-rust-mcp.desktop`.
- Relaunched `/home/milzam/.local/bin/odoo-rust-mcp-desktop`.

Verification after relaunch:
- `curl http://127.0.0.1:3008/` serves `assets/index-y9mYti0s.js`.
- `curl http://127.0.0.1:3008/assets/AppShellLayout-DA-u314N.js | grep -o 'v0\.5\.[01]'` returns `v0.5.1`.
- `grep -R -l "v0.5.0" /home/milzam/.local/share/com.odoo-rust-mcp.desktop` returns no files.
- Runtime catalog still reports 23 tools and includes `odoo_stock_inventory_reversal_cleanup`.

### user

rebuid again

### agent

Confirmed task file: `.agentkanban/tasks/task_018_add_stock_inventory_reversal_cleanup_tool.md`.

Rebuilt the Linux desktop artifacts again after the asset-sync fix.

Commands completed successfully:
- `cd config-ui && npm run build`
- `cargo build --release --manifest-path rust-mcp/Cargo.toml`
- copied `rust-mcp/target/release/rust-mcp` into `desktop/src-tauri/binaries/rust-mcp-x86_64-unknown-linux-gnu`
- `cd desktop && npm run build -- --bundles appimage,deb`

Generated artifacts:
- `desktop/src-tauri/target/release/bundle/appimage/Odoo Rust MCP_0.5.1_amd64.AppImage`
- `desktop/src-tauri/target/release/bundle/deb/Odoo Rust MCP_0.5.1_amd64.deb`

Refreshed the user-local AppDir install from the rebuilt `.deb` because the app menu launches `~/.local/bin/odoo-rust-mcp-desktop`.

Live verification after relaunch:
- `curl http://127.0.0.1:3008/` serves `assets/index-y9mYti0s.js`.
- `curl http://127.0.0.1:3008/assets/AppShellLayout-DA-u314N.js | grep -o 'v0\.5\.[01]'` returns `v0.5.1`.
- Port `3008` is served by `/home/milzam/.local/opt/odoo-rust-mcp-desktop/AppDir/usr/bin/rust-mcp`.
- Runtime catalog reports 23 tools and includes `odoo_stock_inventory_reversal_cleanup`.

### user

Start implementation. the app still v0.5.0 but tools is oke now

### agent

Confirmed task file: `.agentkanban/tasks/task_018_add_stock_inventory_reversal_cleanup_tool.md`.

Implemented the desktop asset-sync fix for the stale `v0.5.0` footer and verified the live app now serves `v0.5.1` while keeping the runtime tool catalog at 23 tools.

Root cause: the app menu launched the user-local AppDir wrapper at `~/.local/bin/odoo-rust-mcp-desktop`, which served static UI assets from `~/.local/opt/odoo-rust-mcp-desktop/AppDir/usr/lib/Odoo Rust MCP/static/dist`. That AppDir copy was stale even after the system `.deb` package resources were rebuilt.

Implementation:
- Added `desktop/scripts/prebuild.mjs` to sync `rust-mcp/static/dist` into `desktop/src-tauri/static/dist` before Tauri packaging.
- Updated `desktop/src-tauri/tauri.conf.json` to run `node scripts/prebuild.mjs` as `beforeBuildCommand`.
- Fixed `desktop/scripts/prebuild.ps1` to target `desktop/src-tauri/static/dist` and remove version-specific stale installer outputs with wildcards.
- Rebuilt the Rust sidecar and Linux `.deb` package.
- Updated the actual user-local AppDir install from the rebuilt package, since the app menu was launching that path.

Verification:
- `curl http://127.0.0.1:3008/` now serves `assets/index-y9mYti0s.js`.
- `curl http://127.0.0.1:3008/assets/AppShellLayout-DA-u314N.js | grep -o 'v0\.5\.[01]'` returns `v0.5.1`.
- Port `3008` is served by `/home/milzam/.local/opt/odoo-rust-mcp-desktop/AppDir/usr/bin/rust-mcp`.
- Runtime catalog `~/.config/odoo-rust-mcp/tools.json` reports 23 tools and includes `odoo_stock_inventory_reversal_cleanup`.

### user

are you add new tools for your dev? i mean for task ### Add Stock Inventory Reversal Cleanup Tool

### agent

Confirmed task file: `.agentkanban/tasks/task_018_add_stock_inventory_reversal_cleanup_tool.md`.

Yes, this task added one new product MCP tool, not a private development tool for the agent environment.

The new tool is `odoo_stock_inventory_reversal_cleanup`. It is registered in `rust-mcp/config/tools.json` and `rust-mcp/config-defaults/tools.json`, routed through `stock_inventory_reversal_cleanup` in `rust-mcp/src/mcp/tools.rs`, and implemented in `rust-mcp/src/cleanup/stock_inventory.rs`.

It is guarded by `ODOO_ENABLE_CLEANUP_TOOLS`; by default it runs as a dry run, and mutation requires `dryRun=false` plus `confirm=true`.

### user

### agent

Confirmed task file: `.agentkanban/tasks/task_018_add_stock_inventory_reversal_cleanup_tool.md`.

Recovered after the transient retry request. The task is already in `done` with implementation, validation, ERP execution evidence, and Definition of Done items recorded. No additional code or production action is pending from the visible task state.

### user

Refine `/home/milzam/Workspace/tools/mcp/odoo-rust-mcp`; previous plan was wrong in another workspace. Make it solve the wrong stock quant adjustment issue using Odoo MCP cleanup operation tooling.

### agent

Confirmed task file: `.agentkanban/tasks/task_018_add_stock_inventory_reversal_cleanup_tool.md`.

Implemented and executed a guarded Odoo stock inventory reversal cleanup capability.

**What was delivered:**

1. **New MCP cleanup tool**
   - Added `odoo_stock_inventory_reversal_cleanup` to the Rust MCP backend.
   - Registered the tool in both runtime and default tool configs:
     - `rust-mcp/config/tools.json`
     - `rust-mcp/config-defaults/tools.json`
   - Tool guard uses `ODOO_ENABLE_CLEANUP_TOOLS`.
   - Mutation requires both `dryRun=false` and `confirm=true`.
   - `allowNegative=false` blocks reversals that would make or keep stock negative.

2. **Odoo-safe stock correction behavior**
   - Implemented `rust-mcp/src/cleanup/stock_inventory.rs`.
   - Aggregates duplicate product/location input lines before applying.
   - Locates untracked `stock.quant` rows by product/location.
   - Plans target `inventory_quantity` values from current quantity minus wrong adjustment quantity.
   - Applies correction by writing `stock.quant.inventory_quantity` and `inventory_quantity_set`, then calling `action_apply_inventory`.
   - Does not delete posted `stock.move.line` records.

3. **Legacy JSON-RPC compatibility fix**
   - Updated `rust-mcp/src/odoo/legacy_client.rs` to treat successful Odoo JSON-RPC responses without a `result` field as JSON `null`.
   - This fixed Odoo 18 button/action methods that return Python `None`, including `stock.quant.action_apply_inventory`.

4. **ERP CA production execution**
   - Created safe reversal payload for `erp-ca-prod`:
     - `reports/stock_quant_repair_2026-07-07/odoo_stock_inventory_reversal_cleanup_safe_payload.json`
   - Dry-run result: 5 quant rows ready, 0 blocked, total safe reversal quantity `1,660,311.5`.
   - Applied safe reversals through the new MCP cleanup tool.
   - First apply attempt partially applied Cranberry, then exposed the JSON-RPC void-response issue.
   - After patching the legacy client, re-ran remaining 4 quant rows successfully.
   - Final execution evidence:
     - `reports/stock_quant_repair_2026-07-07/inventory_reversal_execution_result.csv`
   - Final applied safe reversal total: `1,660,311.5`.

5. **Blocked high-risk rows documented**
   - Refreshed the remaining 3 blocked rows after safe reversal execution.
   - They remain blocked because full reversal would leave `CA-RT/Stock` negative.
   - Current blocked-status evidence:
     - `reports/stock_quant_repair_2026-07-07/inventory_reversal_blocked_current_status.csv`
   - Audit note updated:
     - `reports/stock_quant_repair_2026-07-07/WRONG_INVENTORY_ADJUSTMENT_REVERSAL.md`

**Validation completed:**

- `cargo fmt --manifest-path rust-mcp/Cargo.toml`
- `cargo test --manifest-path rust-mcp/Cargo.toml cleanup::stock_inventory --lib`
- `cargo check --manifest-path rust-mcp/Cargo.toml --all-features`
- JSON config parse validation for `rust-mcp/config/tools.json` and `rust-mcp/config-defaults/tools.json`
- MCP dry-run against `erp-ca-prod`
- MCP apply against `erp-ca-prod`
- Final live quantity validation for corrected quants
- Report CSV validation:
  - `inventory_reversal_execution_result.csv` rows: 5
  - total reversed: `1,660,311.5`
  - all final quantities non-negative: true
  - `inventory_reversal_blocked_current_status.csv` rows: 3
  - still blocked: 3

## Definition of Done

- [x] (agent) Guarded MCP cleanup operation implemented.
- [x] (agent) Tool registered in runtime and default tool configs.
- [x] (agent) Legacy JSON-RPC void-response issue fixed.
- [x] (agent) Rust tests and cargo check passed.
- [x] (agent) Safe ERP CA reversal payload dry-run passed.
- [x] (agent) Approved safe reversal applied to production.
- [x] (agent) Execution and blocked-row evidence recorded.
- [x] (agent) Remaining risky rows left blocked pending physical review.

### user

continue the fixing after updating `odoo-rust-mcp`; apply the remaining blocked rows.

### agent

Confirmed task file: `.agentkanban/tasks/task_018_add_stock_inventory_reversal_cleanup_tool.md`.

Continued the production cleanup after the MCP update and applied the remaining three wrong inventory adjustment reversals with `allowNegative=true`, as explicitly approved.

**Additional execution completed:**

- Dry-ran the 3 previously blocked rows with `allowNegative=true`.
- Dry-run result: 3 ready rows, 0 blocked, total reversal quantity `290,046.2`.
- Applied the three rows through `odoo_stock_inventory_reversal_cleanup`.
- Applied quant IDs: `5012`, `5042`, `6250`.
- Final negative-result evidence recorded in:
  - `reports/stock_quant_repair_2026-07-07/inventory_reversal_negative_execution_result.csv`
- Updated the audit note:
  - `reports/stock_quant_repair_2026-07-07/WRONG_INVENTORY_ADJUSTMENT_REVERSAL.md`

**Final totals:**

- Safe reversal rows: 5 quant rows, total `1,660,311.5`.
- Approved negative-result rows: 3 quant rows, total `290,046.2`.
- Grand total reversed: `1,950,357.7`, matching the original wrong adjustment total.

**Validation completed:**

- Final live quantities were read back through the MCP cleanup dry-run path.
- Combined CSV totals matched the original wrong adjustment total exactly.
- `cargo test --manifest-path rust-mcp/Cargo.toml cleanup::stock_inventory --lib` passed.
- `cargo check --manifest-path rust-mcp/Cargo.toml --all-features` passed.

### user
