# Prompt - block / unblock

Block a task that hits a real blocker, or resume it after the blocker clears.

---

```markdown
# BLOCK / UNBLOCK

A real blocker is something you cannot safely resolve with the repo, tools, and context already
available: an unfinished dependency task, a missing environment, an upstream defect, or a decision
only the user can make.

## Action: `block`
1. Read the current task state and confirm which lane it is in.
2. Under `### agent`, record:
   - what is blocked
   - why it is blocked
   - what was tried
   - what would clear it
3. If another task must finish first, set `dependsOn` and add `blocked-by:<slug>`.
4. For an external blocker, add the `blocked` label and keep the task in its current lane.

## Action: `unblock`
1. Confirm the recorded blocker is actually cleared.
2. Remove or update the relevant blocker label.
3. Under `### agent`, note what changed and which prompt should continue the work.
4. Resume through the matching Lite flow stage:
   - `backlog` work -> `stage-backlog-to-in-progress.md`
   - `in-progress` work -> `stage-in-progress-to-done.md`

## Common repo-local blockers

- waiting on another task to finish
- missing Node or Rust dependencies needed for validation
- config-manager or HTTP smoke tests cannot run because the local environment is unavailable
- a design decision would widen scope beyond the approved task
```
