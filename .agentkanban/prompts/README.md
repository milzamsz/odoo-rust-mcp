# Kanban prompts

Lean prompt pack for developing `odoo-rust-mcp` under the active Lite board profile. These files
should help contributors move real repo work forward without drifting into Standard-lane workflow
or generic process text.

Read first:

- `AGENTS.md`
- `TECHNICAL.md`
- `.agentkanban/INSTRUCTION.md`
- `.agentkanban/memory.md`
- any referenced `.agentkanban/specs/<capability>/spec.md`

## Flow

This repo currently uses the Lite profile from `.agentkanban/board.yaml`:

```text
backlog -> in-progress -> done
```

Spec-driven development is still encouraged for non-trivial work, but it stays inside the Lite flow
through `spec.md`, `proposal.md`, `design.md`, and `tasks.md`.

## Prompt set

- [new-task-intake.md](new-task-intake.md): turn a raw request into a clean backlog task
- [stage-backlog-to-in-progress.md](stage-backlog-to-in-progress.md): tighten scope, wire in spec-driven artifacts when needed, and start work the right way
- [stage-in-progress-to-done.md](stage-in-progress-to-done.md): finish implementation, verify with real repo commands, update docs, and close cleanly
- [stage-blocked-and-resume.md](stage-blocked-and-resume.md): record a real blocker or resume after it clears
- [production-readiness-audit.md](production-readiness-audit.md): reusable audit before `done`, especially for risky or cross-cutting changes

Removed from the pack:

- any `planning` or `review` lane prompt
- any sweep-style prompt for processing many tasks at once
- any generic policy text that does not match this Rust + Mantine + mdBook repo

## Repo validation gate

Use the smallest relevant subset for the touched area, and expand to the full gate for cross-cutting
changes:

```bash
cargo fmt --all --check --manifest-path rust-mcp/Cargo.toml
cargo clippy --all-features --manifest-path rust-mcp/Cargo.toml -- -D warnings
cargo test --all-features --manifest-path rust-mcp/Cargo.toml
cd config-ui && npm run lint && npm run typecheck && npm test && npm run build
```

If the change affects auth, transport, config-manager behavior, or embedded UI delivery, also run a
local HTTP smoke test against `/health`, `/mcp`, and the Config UI.

## Best practice for this app

- use spec-driven tasks for cross-cutting work touching `rust-mcp/`, `config-ui/`, release scripts, or docs
- keep version changes synchronized between `rust-mcp/Cargo.toml` and `config-ui/package.json`
- treat `rust-mcp/config/*` as checked-in runtime config and `rust-mcp/config-defaults/*` as bootstrap defaults
- when UI behavior changes, prefer validating both `npm test` and `npm run build`
- when auth, transport, or config-manager behavior changes, include a local smoke test against the embedded UI

`done` means the changed behavior is supported by evidence, not by status alone. Keep the record in
the task file and in the spec/change artifacts when the work is spec-driven.
