# Repo-Local Agentic Kanban SDD

## Purpose

Define a repository-local Agentic Kanban workflow for `odoo-rust-mcp` that matches the active Lite
board profile, uses this repository's real build and validation commands, and keeps workflow prompts
and docs aligned with the Rust backend, React Config UI, and checked-in documentation.

## Requirements

### Workflow shape

1. The documented lane flow must match `.agentkanban/board.yaml`: `backlog -> in-progress -> done`.
2. The workflow must support spec-driven development on Lite without requiring Standard-only lanes.
3. The workflow record must live in `.agentkanban/` using:
   - task files under `.agentkanban/tasks/`
   - shared capability specs under `.agentkanban/specs/`
   - per-task change folders under `.agentkanban/changes/`
4. Prompt templates must guide task intake, implementation start, blocker handling, and done/audit flow for Lite.

### Repo-local constraints

1. Prompt and doc text must use the real repo stack:
   - Rust backend in `rust-mcp/`
   - React 18 + TypeScript Config UI in `config-ui/`
   - mdBook docs in `docs/src/`
2. Prompt and doc text must use real repo validation commands, not placeholders.
3. Prompt and doc text must not include unrelated OCloud, multi-tenant, quota, or secret-policy requirements unless they are actually part of this repository.
4. Documentation must clearly distinguish checked-in runtime config from bootstrap seed defaults.

### Persistent docs

1. `TECHNICAL.md` must explain the repo-local Agentic Kanban workflow and SDD artifact layout.
2. Developer-facing docs must point contributors to the workflow so it can be followed after this task is complete.
3. `.agentkanban/memory.md` must capture stable workflow and validation conventions for later tasks.

## Acceptance Criteria

- A contributor can open `.agentkanban/prompts/README.md` and see a Lite-specific flow that matches the board.
- A contributor can start spec-driven work in this repo without encountering Standard-only lane instructions.
- The repo contains a durable technical explanation of how Agentic Kanban and SDD are applied here.
- The workflow docs and prompts use real repo commands and avoid unrelated policy language.

## Verification

1. Confirm `.agentkanban/board.yaml` still declares `profile: lite`.
2. Confirm `.agentkanban/prompts/README.md` references Lite flow and only existing prompt files.
3. Confirm no prompt file in `.agentkanban/prompts/` contains stale `OCloud` text.
4. Confirm no prompt file in `.agentkanban/prompts/` instructs contributors to use `planning` or `review` lanes for this repo-local Lite flow.
5. Confirm `TECHNICAL.md` and developer docs describe the new workflow and artifact locations.
