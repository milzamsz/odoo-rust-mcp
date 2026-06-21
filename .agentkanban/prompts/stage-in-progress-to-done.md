# Prompt - in-progress -> done

Finish one active Lite-profile task, verify it with real repo commands, update the workflow record,
and move it to `done`.

---

```markdown
# IN-PROGRESS -> DONE

Read first: `AGENTS.md`, `TECHNICAL.md`, `.agentkanban/INSTRUCTION.md`, `.agentkanban/memory.md`,
the current task file, and any referenced `spec.md` / `proposal.md` / `design.md` / `tasks.md`.

## Scope
- Lane: `in-progress`
- Process one active task at a time unless the board policy changes

## Steps
1. Implement against the authoritative checklist:
   - spec-driven task -> `.agentkanban/changes/<task-slug>/tasks.md`
   - non-spec task -> the corresponding `todo_*.md`
2. Keep task notes honest:
   - record important decisions in the task file
   - update `design.md` if the chosen approach changes materially
   - create a new backlog task for discovered work instead of silently expanding scope
3. Run the smallest relevant repo validation gate:
   - Rust: `cargo fmt --all --check --manifest-path rust-mcp/Cargo.toml`, `cargo clippy --all-features --manifest-path rust-mcp/Cargo.toml -- -D warnings`, `cargo test --all-features --manifest-path rust-mcp/Cargo.toml`
   - Config UI: `cd config-ui && npm run lint && npm run typecheck && npm test && npm run build`
   - cross-cutting work: run both
4. If auth, transport, config-manager behavior, or embedded UI delivery changed, run a local smoke test:
   - start the server in HTTP mode
   - verify `/health`
   - verify `/mcp`
   - verify the Config UI loads on port `3008`
5. Update docs that are now affected:
   - `TECHNICAL.md`
   - relevant mdBook docs in `docs/src/`
   - `AGENTS.md` when repo-operator guidance changed
   - `README.md` when install, shortcut, release, or UI usage guidance changed
6. Run [production-readiness-audit.md](production-readiness-audit.md) for risky or cross-cutting work.
7. Record verification evidence in the task file, then explicitly move the task to `done`.

## Repo-local reminders

- UI-only work should usually still run `npm run build`, not just tests
- embedded UI or config-manager changes should be checked through the Rust-served app, not only Vite
- release, installer, or shortcut work should verify shipped paths and artifacts, not only source files
- workflow-only changes should verify prompt/doc consistency even when app tests are intentionally skipped

## Do not finish as done when

- checklist items are still open
- verification was required but not run
- a blocker remains unresolved
- the docs now misrepresent the shipped behavior
```
