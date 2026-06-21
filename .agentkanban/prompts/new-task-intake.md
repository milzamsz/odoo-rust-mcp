# Prompt - new task intake

Turn a raw idea, feature request, or bug into a well-formed task in `backlog`.

---

```markdown
# NEW TASK INTAKE

## Input
`<idea / feature request / bug report, as-is>`

## Steps
1. Create the task with a concise imperative title.
2. Fill the task file:
   - **Description**: 1-3 sentences describing the outcome, not the implementation.
   - **Context**: affected area and useful code references such as `rust-mcp/src/main.rs` or `config-ui/src/types.ts`.
   - **Bug details** when relevant: repro steps, expected behavior, actual behavior, environment.
   - **Scope hints**: obvious in/out boundaries, known constraints, likely docs/tests impact.
   - **Open questions** only when they are truly blocking.
3. Add frontmatter for `priority`, `labels`, and `dependsOn` when another task must finish first.
4. If the change is non-trivial, make it spec-driven:
   - create or link `.agentkanban/specs/<capability>/spec.md`
   - create `.agentkanban/changes/<task-slug>/proposal.md`, `design.md`, and `tasks.md`
   - add `spec:` and `change:` frontmatter to the task file
5. Leave the task in `backlog` until the implementation path is clear.

## Definition of ready

- The outcome is concrete enough to test or verify.
- The touched area is identified: Rust, Config UI, config JSON, docs, or a mix.
- Any dependency task is called out with `dependsOn` and `blocked-by:<slug>`.
- If the task is large or cross-cutting, the spec/change artifacts are present before work starts.

## Discovered mid-work

If new work is discovered while implementing something else, create a separate backlog task with the
label `discovered` and a note linking back to the originating task. Do not silently expand the current task.

## Next

Move to [stage-backlog-to-in-progress.md](stage-backlog-to-in-progress.md) when the task is ready to start.
```
