# Agentic Kanban Workflow

This repository includes a repo-local Agentic Kanban workspace in `.agentkanban/`. The goal is to
keep task state, specs, and implementation notes inside the repository instead of scattering them
across transient chat history.

## Active profile

The current board lives in `.agentkanban/board.yaml` and uses the `lite` profile:

```text
backlog -> in-progress -> done
```

That matters because the bundled prompts and task guidance should match the board. In this repo, do
not assume `planning` or `review` lanes unless the board profile changes first.

## Artifact layout

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

Use the directories like this:

- `tasks/`: conversational task files and lane state
- `specs/`: durable capability contracts
- `changes/<task-slug>/proposal.md`: why the task exists
- `changes/<task-slug>/design.md`: implementation decisions and risks
- `changes/<task-slug>/tasks.md`: authoritative checklist for spec-driven work
- `memory.md`: stable repo conventions worth carrying between tasks

## Spec-driven development on Lite

Lite keeps the lane model small, but it still works well with SDD for larger or cross-cutting
changes.

Use a spec-driven task when the work:

- spans Rust, UI, config, and docs
- has meaningful acceptance criteria
- is risky enough to need a written verify path
- is likely to be resumed or reviewed later

Recommended flow:

1. Capture the task in `backlog`.
2. Add `spec:` and `change:` frontmatter when the work needs durable planning.
3. Move the task to `in-progress` once the implementation path is clear.
4. Implement against `changes/<task-slug>/tasks.md`.
5. Run the repo validation gate and update docs.
6. Move the task to `done`.

## Prompt pack

The repo-local prompts under `.agentkanban/prompts/` are tailored to this project and should remain
in sync with the board profile. The core files are:

- `new-task-intake.md`
- `stage-backlog-to-in-progress.md`
- `stage-in-progress-to-done.md`
- `stage-blocked-and-resume.md`
- `production-readiness-audit.md`

They use the real build and validation commands from this repository and intentionally avoid policy
text copied from unrelated projects.

## Validation gate

For workflow and documentation changes, verify consistency at minimum. For code changes, use the real
repo gate from `AGENTS.md`:

```bash
cargo fmt --all --check --manifest-path rust-mcp/Cargo.toml
cargo clippy --all-features --manifest-path rust-mcp/Cargo.toml -- -D warnings
cargo test --all-features --manifest-path rust-mcp/Cargo.toml
cd config-ui && npm run lint && npm run typecheck && npm test && npm run build
```

If auth, transport, or config-manager behavior changes, also run a local smoke test against
`/health`, `/mcp`, and the Config UI.
