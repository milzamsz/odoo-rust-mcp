# Agentic Kanban Memory

## Repo workflow

- This repository uses the Agentic Kanban `lite` profile from `.agentkanban/board.yaml`.
- The active lane flow is `backlog -> in-progress -> done`.
- Spec-driven work is still encouraged for non-trivial changes even on Lite. Use:
  - `.agentkanban/specs/<capability>/spec.md` for the durable capability contract
  - `.agentkanban/changes/<task-slug>/{proposal.md,design.md,tasks.md}` for task-local planning and execution
- For spec-driven tasks, `changes/<task-slug>/tasks.md` is the authoritative checklist instead of `todo_*.md`.

## Validation defaults

- Rust quality gate:
  - `cargo fmt --all --check --manifest-path rust-mcp/Cargo.toml`
  - `cargo clippy --all-features --manifest-path rust-mcp/Cargo.toml -- -D warnings`
  - `cargo test --all-features --manifest-path rust-mcp/Cargo.toml`
- Config UI quality gate:
  - `cd config-ui && npm run lint`
  - `cd config-ui && npm run typecheck`
  - `cd config-ui && npm test`
  - `cd config-ui && npm run build`
- If MCP HTTP/auth/config-manager behavior changes, also run a local smoke test against `/health` and `/mcp`.

## Documentation rules

- `AGENTS.md` is the repo-operator guide and should stay aligned with implementation truth.
- `TECHNICAL.md` is the durable implementation note for both humans and agents and must be updated when workflow rules or repo conventions change.
- Keep Agentic Kanban prompts repo-local. Do not carry over OCloud-, org-scoping-, or unrelated policy text into this repository.

## Repo-specific reminders

- `rust-mcp/config/*` is the checked-in runtime-editable config; `rust-mcp/config-defaults/*` is only for bootstrap defaults.
- Use real guard names only: `ODOO_ENABLE_WRITE_TOOLS` and `ODOO_ENABLE_CLEANUP_TOOLS`.
- If a release version changes, keep `rust-mcp/Cargo.toml` and `config-ui/package.json` in sync.
- The current Config UI visual system is light-first and minimalist, with a persisted collapsible desktop sidebar, right-side editing drawers, Geist fonts, Phosphor icons, quieter `400-500` typography weights, and a Mantine-managed `Light / Dark / Auto` theme selector that defaults to `Auto`.
- The Windows shortcut launcher should preflight an already healthy UI before rebuilding and should serialize rebuilds with `.codex-run/shortcut-build.lock` to avoid concurrent `cargo build` lock contention.
- The desktop `Odoo MCP Server.lnk` should target Windows PowerShell directly with the repo `Start-MCP-Server.ps1`; keep `Start-MCP-Server.bat` only as a compatibility wrapper, not the preferred `.lnk` target.
- The Windows release ZIP must ship the installer plus shortcut launcher files, and `install.ps1` must copy them into `C:\Program Files\odoo-rust-mcp` so the desktop shortcut keeps working outside the extracted ZIP folder.
- `README.md` is now intentionally Windows-first and short; prioritize install, shortcut launch, Config UI usage, and an AI-assisted install prompt there, while linking out for deeper transport or deployment detail.
- Public README screenshots should show authenticated main pages only, force dark mode, and write the final PNGs to `docs/src/images/config-ui/`.
- The Rust Hexagon app mark is the shared product identity across the Config UI, favicon, mdBook, and Windows shortcuts. Keep `config-ui/public/app-icon.svg`, `docs/src/images/brand/app-icon.svg`, and `assets/odoo-rust-mcp.ico` visually aligned; regenerate the ICO with `scripts/New-AppIcon.ps1`.
- Built mdBook output is a release dependency. Packages install it as `docs/book`, and the Config UI sidebar opens the canonical `/docs/` route in a new tab.
- Per-instance module capability snapshots live beside runtime `tools.json`; tool definitions use optional `pack` and `requiredModules`, while per-instance pack suppression stays in `toolConfig.disabledPacks` without a separate pack resolver.
- Windows Tauri rollout planning is split deliberately: `task_011_windows_tauri_release_packaging.md` owns artifact production, while `task_015_deploy_windows_tauri_app_to_github.md` owns GitHub Release publication, updater metadata, and the unsigned-first rollout contract.
- For the first Windows desktop GitHub rollout, Authenticode signing is deferred, but Tauri updater signing remains mandatory and release notes should acknowledge possible SmartScreen prompts.
- The desktop Tauri app should keep its splash page local and let Rust wait for the Config UI before navigating to `http://127.0.0.1:3008`; do not depend on splash-page JavaScript redirects alone for packaged startup.
- Linux desktop package assets live under `/usr/lib/Odoo Rust MCP/static/dist` rather than beside `usr/bin/rust-mcp`, so packaged static-file discovery must probe that lib directory.
