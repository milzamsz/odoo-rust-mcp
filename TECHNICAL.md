# TECHNICAL.md

## Purpose

This file is the durable implementation note for contributors and coding agents working inside
`odoo-rust-mcp`. It complements `AGENTS.md` by documenting repo-local workflow details that should
survive individual sessions, especially around Agentic Kanban and spec-driven development.

When this file disagrees with code or checked-in config, prefer the implementation and update this
document.

## Repository shape

- Backend: `rust-mcp/`
- Config UI: `config-ui/`
- Docs: `docs/src/`
- Repo-local workflow record: `.agentkanban/`

The React UI builds into `rust-mcp/static/dist/` and is embedded into the Rust binary, so changes
that touch UI behavior often need both frontend checks and a Rust build path review.

## Config UI stack

The current Config UI stack is:

- React 19
- Vite
- Mantine 9 for the application shell, forms, modals, and notifications
- React Router with hash routes for embedded-server compatibility
- TanStack Table for instances table state

Implementation notes:

- `auto` is the default color-scheme preference for new sessions; explicit `light` and `dark`
  selections remain available and persisted by Mantine
- the authenticated landing route is the Operations Overview page
- the desktop shell supports a persisted collapsible sidebar that shrinks to an icon rail
- desktop instances can switch between card and table views
- instance and prompt editing use right-side drawers with sticky actions
- destructive actions should use in-app confirmation UI instead of browser-native dialogs
- Tailwind is no longer part of the active runtime UI stack
- the bundled UI fonts are Geist Sans and Geist Mono, and the primary icon set is Phosphor
- typography is intentionally quieter: page titles, section titles, badges, chips, and table labels
  target `400` to `500` weight instead of heavy emphasis
- the Rust Hexagon app mark is the shared identity for the shell, login screen, favicon, mdBook,
  and Windows shortcuts; the vector source lives in `config-ui/public/app-icon.svg`
- the Documentation sidebar action opens `/docs/` in a new tab

## Agentic Kanban in this repo

### Active profile

The live board config is `.agentkanban/board.yaml`, and it currently sets:

- `profile: lite`
- lane flow: `backlog -> in-progress -> done`
- `enforcement.mode: warn`

Do not write prompts or task guidance that assumes `planning` or `review` lanes unless the board
profile is intentionally changed first.

### Workflow record

Agentic Kanban artifacts live under `.agentkanban/`:

```text
.agentkanban/
  board.yaml
  INSTRUCTION.md
  memory.md
  prompts/
  specs/
  changes/
  tasks/
```

Use them this way:

- `tasks/` stores the conversational task record and lane state
- `specs/` stores one durable capability contract per workflow or feature area
- `changes/<task-slug>/proposal.md` explains why the task exists
- `changes/<task-slug>/design.md` captures implementation choices and risks
- `changes/<task-slug>/tasks.md` is the authoritative checklist for spec-driven work
- `memory.md` stores stable repo conventions that should persist across tasks

### Lite profile with SDD

Lite does not remove spec-driven development. In this repo, use SDD on Lite for any change that is:

- cross-cutting across Rust, UI, config, and docs
- likely to be resumed later
- risky enough to benefit from explicit acceptance criteria
- large enough that a durable checklist helps

Recommended flow:

1. Create or select a task in `backlog`.
2. If the change is non-trivial, add `spec:` and `change:` frontmatter and scaffold the spec/change files.
3. Move the task to `in-progress` only when the implementation path is clear.
4. Implement against `changes/<task-slug>/tasks.md`, checking items off as evidence accumulates.
5. Run the repo validation gate.
6. Update docs and task notes with honest status.
7. Move the task to `done`.

## Prompt pack contract

The repo-local prompts in `.agentkanban/prompts/` are intentionally tailored to the Lite board. The
expected files are:

- `new-task-intake.md`
- `stage-backlog-to-in-progress.md`
- `stage-in-progress-to-done.md`
- `stage-blocked-and-resume.md`
- `production-readiness-audit.md`

These prompts must:

- use the real repo stack and paths
- use the real validation commands from this repository
- avoid unrelated OCloud or multi-tenant policy text
- match the current board profile

If the board later moves to the Standard profile, the prompt pack should be revised in the same change.

## Validation gate

Use the smallest relevant subset for the touched area, and expand to the full gate for cross-cutting work.

### Rust

```bash
cargo fmt --all --check --manifest-path rust-mcp/Cargo.toml
cargo clippy --all-features --manifest-path rust-mcp/Cargo.toml -- -D warnings
cargo test --all-features --manifest-path rust-mcp/Cargo.toml
```

### Config UI

```bash
cd config-ui
npm run lint
npm run typecheck
npm test
npm run build
cd ..
```

### Smoke checks when behavior changes

Use these when the change touches auth, transport, config-manager behavior, or embedded UI delivery:

```bash
cargo run --manifest-path rust-mcp/Cargo.toml -- --transport http --listen 127.0.0.1:8787 --config-server-port 3008
```

Then verify:

- MCP endpoint: `http://127.0.0.1:8787/mcp`
- Health endpoint: `http://127.0.0.1:8787/health`
- Config UI: `http://127.0.0.1:3008`

## Windows desktop launcher

The Windows desktop shortcut path is:

- `Create-Shortcut.ps1` creates the `.lnk`
- the desktop `.lnk` targets Windows PowerShell directly
- `Start-MCP-Server.bat` is the compatibility wrapper target for manual `.bat` launches
- `Start-MCP-Server.ps1` performs rebuild, restart, readiness checks, and browser launch

Current desktop shortcut shape:

- `Create-Shortcut.ps1` now points the `.lnk` directly at Windows PowerShell with `-NoProfile
  -ExecutionPolicy Bypass -File ...\Start-MCP-Server.ps1`
- `Start-MCP-Server.bat` remains as a compatibility wrapper and now uses the explicit
  `%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe` path

Current launcher behavior:

- prefers the release binary at `rust-mcp/target/release/rust-mcp.exe`
- falls back to an installed-layout binary at `<install-dir>\rust-mcp.exe` when the launcher is run
  from a release install directory instead of a source checkout
- checks for an already healthy Config UI before attempting any rebuild
- rebuilds with `cargo build --release --manifest-path rust-mcp/Cargo.toml` when inputs are newer
- serializes shortcut-triggered rebuilds with `.codex-run/shortcut-build.lock` so repeated launches do
  not stack competing `cargo build` processes
- waits for the Config UI on `127.0.0.1:3008` before opening the browser
- short-circuits if a healthy Config UI is already running
- writes build and server logs to `.codex-run/shortcut-*.log`

Windows release packaging notes:

- the Windows release ZIP must include `install.ps1`, `Start-MCP-Server.ps1`,
  `Start-MCP-Server.bat`, `Create-Shortcut.ps1`, and the WSL shortcut companions when the installer
  is expected to create desktop launchers
- `install.ps1` copies those launcher files into `C:\Program Files\odoo-rust-mcp` so the desktop
  shortcut keeps working after the extracted release directory is deleted
- release archives ship `assets/odoo-rust-mcp.ico` and `docs/book`; the Windows installer copies
  both beside the executable and shortcut scripts use the packaged `.ico`
- `find_docs_dir()` supports repo, executable-relative, Homebrew, Debian, and container layouts so
  the sidebar route remains available after installation
- the short README is intentionally Windows-first and should prioritize install, shortcut creation,
  and Config UI first use over deep transport or deployment detail

If a user reports that `http://localhost:3008` cannot be reached from the shortcut, validate the launcher with:

```powershell
$env:MCP_NO_BROWSER='1'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Start-MCP-Server.ps1
curl.exe -I http://127.0.0.1:3008
```

## Documentation maintenance

When workflow rules or implementation conventions change, update:

- `AGENTS.md` for the repo-operator guide
- `TECHNICAL.md` for durable implementation notes
- relevant mdBook docs in `docs/src/`
- `.agentkanban/memory.md` for stable task-to-task conventions

Keep workflow docs aligned with checked-in truth:

- `rust-mcp/config/*` is the checked-in runtime-editable config
- `rust-mcp/config-defaults/*` is only for bootstrap seed defaults
- real guard names are `ODOO_ENABLE_WRITE_TOOLS` and `ODOO_ENABLE_CLEANUP_TOOLS`
- release version changes must keep `rust-mcp/Cargo.toml` and `config-ui/package.json` synchronized
- README screenshots should use authenticated UI pages only and force dark mode before saving
  assets under `docs/src/images/config-ui/`
