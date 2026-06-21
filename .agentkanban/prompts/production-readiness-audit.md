# Prompt - production-readiness audit

Reusable gate before moving a Lite task to `done`. The point is evidence, not optimism.

---

```markdown
# PRODUCTION READINESS AUDIT

## Target
- Task: `<name>`
- Capability spec: `.agentkanban/specs/<capability>/spec.md` when present
- Environment exercised: `<local / test / prod-like>`

## Audit

Mark each line `PASS`, `FAIL`, or `NOT RUN`, with evidence.

### Correctness
- [ ] `changes/<task-slug>/tasks.md` is complete when the task is spec-driven
- [ ] Acceptance criteria from `spec.md` are met when a spec exists
- [ ] Relevant Rust checks passed:
  - `cargo fmt --all --check --manifest-path rust-mcp/Cargo.toml`
  - `cargo clippy --all-features --manifest-path rust-mcp/Cargo.toml -- -D warnings`
  - `cargo test --all-features --manifest-path rust-mcp/Cargo.toml`
- [ ] Relevant Config UI checks passed:
  - `cd config-ui && npm run lint`
  - `cd config-ui && npm run typecheck`
  - `cd config-ui && npm test`
  - `cd config-ui && npm run build`
- [ ] If auth, transport, config-manager, or embedded UI behavior changed, smoke tests against `/health`, `/mcp`, and the Config UI passed

### Repo-specific integrity
- [ ] Prompt and doc text matches the active Lite board profile
- [ ] `rust-mcp/config/*` and `rust-mcp/config-defaults/*` were updated together only when bootstrap defaults truly changed
- [ ] Guard names use real repo values only: `ODOO_ENABLE_WRITE_TOOLS` and `ODOO_ENABLE_CLEANUP_TOOLS`
- [ ] `rust-mcp/Cargo.toml` and `config-ui/package.json` stayed in sync if a version bump was part of the task
- [ ] Release/install docs still match the actual Windows shortcut, packaged docs, and distribution flow when those areas changed

### Documentation
- [ ] `AGENTS.md`, `TECHNICAL.md`, and mdBook docs reflect the shipped workflow or behavior where relevant
- [ ] The task file records what was verified and what was intentionally not run

## Output

Write a short PASS/FAIL summary in the task file. Any unresolved FAIL that affects correctness,
safety, or the repo's documented workflow blocks `done`.
```
