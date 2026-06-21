# Kanban prompts

Repo-local stage drivers for `odoo-rust-mcp`. These prompts are intentionally aligned to the active
Lite board profile and the real Rust + React toolchain in this repository.

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

Spec-driven development is still encouraged for non-trivial work, but it happens inside the Lite flow
through `spec.md`, `proposal.md`, `design.md`, and `tasks.md` rather than through Standard-only lanes.

## Prompt set

| Prompt | When |
|---|---|
| [new-task-intake.md](new-task-intake.md) | Turn a raw request into a well-formed task in `backlog` |
| [stage-backlog-to-in-progress.md](stage-backlog-to-in-progress.md) | Clarify a ready backlog task, scaffold spec/change files when useful, and start implementation |
| [stage-in-progress-to-done.md](stage-in-progress-to-done.md) | Finish implementation, verify with real repo commands, update docs, and complete the task |
| [stage-blocked-and-resume.md](stage-blocked-and-resume.md) | Record a real blocker or resume work after the blocker clears |
| [production-readiness-audit.md](production-readiness-audit.md) | Reusable audit before `done`, especially for risky or cross-cutting changes |

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

"Done" means the changed behavior is supported by evidence, not by status alone. Keep the record in the
task file and in the spec/change artifacts when the work is spec-driven.
