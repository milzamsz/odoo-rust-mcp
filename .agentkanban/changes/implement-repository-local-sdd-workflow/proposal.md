# Proposal: Implement Repository-Local Lite SDD Workflow

## Why

The repository already has Agentic Kanban scaffolding, but it is incomplete and internally
inconsistent:

- the board is configured for the Lite profile
- there is no task/spec/change artifact yet
- the prompt pack still assumes Standard-only lanes
- several prompts include unrelated OCloud policy text that does not belong to this repository
- there is no `TECHNICAL.md` carrying the repo-local workflow forward

That leaves contributors with a scaffold that points them into the wrong process.

## What changes

1. Create the missing spec-driven workflow record for this implementation.
2. Add `.agentkanban/memory.md` with stable repo conventions.
3. Replace the prompt pack with Lite-specific prompts that use real `odoo-rust-mcp` commands.
4. Add `TECHNICAL.md` and update developer docs so the workflow is documented outside the current chat.

## Non-goals

- No Rust, React, transport, auth, or runtime config behavior changes.
- No extension-side behavior changes outside this repository workspace.
- No version bump, release, or packaging work.
