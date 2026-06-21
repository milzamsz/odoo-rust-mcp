# Design: Repository-Local Lite SDD Workflow

## Current mismatch

The workflow source of truth is split across `AGENTS.md`, `.agentkanban/board.yaml`, and the prompt
files under `.agentkanban/prompts/`.

Observed state:

- `AGENTS.md` tells agents to use `.agentkanban/INSTRUCTION.md` and `.agentkanban/memory.md`
- `.agentkanban/board.yaml` sets `profile: lite`
- `.agentkanban/prompts/README.md` and stage prompts still describe Standard lanes and autonomous
  `planning -> review`
- multiple prompt files mention OCloud-specific policies that are not part of this repo
- `TECHNICAL.md` is missing entirely

## Chosen approach

### 1. Treat this as a spec-driven repo-workflow change

Even though the board is Lite, the change itself benefits from durable SDD artifacts because it is a
cross-cutting workflow and documentation change. The implementation therefore adds:

- one shared capability spec under `.agentkanban/specs/`
- one task-local change folder under `.agentkanban/changes/`
- one task file under `.agentkanban/tasks/`

### 2. Replace prompt content, not just references

Instead of leaving Standard prompts in place with warning banners, rewrite the prompt pack so the
default files match the active profile. This reduces ambiguity for the next contributor who opens the
workspace and starts from `.agentkanban/prompts/README.md`.

### 3. Keep the Lite flow simple but still spec-friendly

The prompts document:

- `new-task-intake` for creating clear backlog tasks
- `stage-backlog-to-in-progress` for turning a ready task into an implementation-ready, optionally
  spec-driven task
- `stage-in-progress-to-done` for implementation, verification, documentation, and explicit lane
  completion
- `stage-blocked-and-resume` for blocker handling
- `production-readiness-audit` as a reusable final check

Spec-driven work remains available through `spec.md`, `proposal.md`, `design.md`, and `tasks.md`,
but without introducing `planning` or `review` as required lanes.

### 4. Document once at the repo level

Add `TECHNICAL.md` as the durable implementation note and add a developer-doc page so contributors
can discover the workflow from the mdBook docs, not only from local agent instructions.

## Risks and mitigations

- Risk: contributors still follow stale Standard prompt filenames from old screenshots or memory.
  Mitigation: replace the prompt README and remove the unused Standard stage files entirely.
- Risk: docs drift from board profile later.
  Mitigation: store the active Lite flow in both `.agentkanban/memory.md` and `TECHNICAL.md`.
- Risk: workflow docs become too generic and lose repo utility.
  Mitigation: embed the real build, lint, test, and smoke commands used by this repo.
