# Prompt - backlog -> in-progress

Clarify one ready backlog task, scaffold spec-driven artifacts when useful, and begin implementation
under the Lite profile.

---

```markdown
# BACKLOG -> IN-PROGRESS

Read first: `AGENTS.md`, `TECHNICAL.md`, `.agentkanban/INSTRUCTION.md`, `.agentkanban/memory.md`, and
the selected task file.

## Scope
- Lane: `backlog`
- Process only ready tasks:
  - no unresolved blocker labels
  - every `dependsOn` task is already `done`

## Per ready task
1. Re-state the desired outcome in concrete, testable terms.
2. Identify the touched area:
   - Rust server in `rust-mcp/`
   - Config UI in `config-ui/`
   - config JSON in `rust-mcp/config/` or `rust-mcp/config-defaults/`
   - docs in `README.md`, `TECHNICAL.md`, or `docs/src/`
3. Decide whether the task should be spec-driven.
   - Use SDD for cross-cutting, risky, or likely-to-be-resumed work.
   - If yes, ensure the task has:
     - `spec:` pointing to `.agentkanban/specs/<capability>/spec.md`
     - `change:` pointing to `.agentkanban/changes/<task-slug>`
     - `proposal.md`, `design.md`, and `tasks.md`
4. Write or refine the implementation plan in the task and change files.
5. Move the task to `in-progress` explicitly once the implementation path is clear.
6. Start from the checklist in `changes/<task-slug>/tasks.md` when spec-driven, otherwise create or
   update the task-local TODO artifact.

## Verify path to plan up front

Pick the real repo checks before coding:

- Rust-only change: `cargo fmt`, `cargo clippy`, `cargo test`
- Config UI-only change: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`
- Cross-cutting change: run both sets
- Auth/transport/config-manager changes: add local `/health`, `/mcp`, and Config UI smoke checks

## If the task is not actually ready

Leave it in `backlog`, note the missing information or dependency, and add `blocked` or
`blocked-by:<slug>` when appropriate.
```
