---
title: Implement repository-local SDD workflow
lane: done
created: 2026-06-20T00:00:00+07:00
updated: 2026-06-20T00:45:00+07:00
description: Align the workspace Agentic Kanban setup with the active Lite board profile and document a repo-local spec-driven workflow for contributors.
priority: medium
labels: [workflow, docs, sdd]
change: .agentkanban/changes/implement-repository-local-sdd-workflow
spec: .agentkanban/specs/repo-local-agentic-kanban-sdd/spec.md
---

## Conversation

### user

learn & analyze all this repo implement SDD Framework & docs this agentickanban,
i use Lite Profile,
Enhance this prompt before start

### agent

Confirmed task file: `.agentkanban/tasks/task_001_implement_repository_local_sdd_workflow.md`.

The repo analysis showed a clear mismatch: the board is Lite, but the prompt pack still assumes
Standard lanes and carries unrelated OCloud policy text. This task is being implemented as a
spec-driven repo-workflow change with a shared capability spec, a task-local change folder, and
repo-local docs so the process stays usable after this session.

### user

Implement plan

### agent

Confirmed task file: `.agentkanban/tasks/task_001_implement_repository_local_sdd_workflow.md`.

Implementation is in progress. The work covers:

- creating the missing task/spec/change artifacts under `.agentkanban/`
- replacing the prompt pack with Lite-profile instructions for this Rust + React repo
- adding persistent workflow documentation in `TECHNICAL.md` and the developer docs

### agent

Confirmed task file: `.agentkanban/tasks/task_001_implement_repository_local_sdd_workflow.md`.

The repo-local Lite SDD workflow has been implemented and the task is moving to `done`.

Completed artifacts:

- `.agentkanban/memory.md`
- `.agentkanban/specs/repo-local-agentic-kanban-sdd/spec.md`
- `.agentkanban/changes/implement-repository-local-sdd-workflow/`
- `.agentkanban/prompts/` rewritten for Lite flow
- `TECHNICAL.md`
- `docs/src/developer/agentic-kanban.md`
- contributor docs and mdBook summary updated

Verification recorded for this documentation-only workflow change:

- `.agentkanban/prompts/` contains no stale `OCloud`, `planning`, or `review` guidance
- prompt README references only the Lite prompt files that now exist
- `git diff --check` reported only pre-existing line-ending warnings, no patch-format errors

### user

Refine/Adjust the README

### agent

Confirmed task file: `.agentkanban/tasks/task_001_implement_repository_local_sdd_workflow.md`.

The README was refined to better match the repo-local workflow and current implementation guidance.

Changes:

- added a `Development Workflow` section near the top of `README.md`
- linked contributors to `AGENTS.md`, `TECHNICAL.md`, and `docs/src/developer/agentic-kanban.md`
- documented the active Lite flow and the spec-driven artifact layout under `.agentkanban/`
- fixed the stale write-tool guard example from `ODOO_ENABLE_WRITE_OPERATIONS` to `ODOO_ENABLE_WRITE_TOOLS`

Verification for this README-only pass:

- confirmed the new `Development Workflow` section appears in the table of contents and body
- confirmed all updated guard examples in `README.md` now use `ODOO_ENABLE_WRITE_TOOLS`
- no code paths or runtime behavior changed

### user
