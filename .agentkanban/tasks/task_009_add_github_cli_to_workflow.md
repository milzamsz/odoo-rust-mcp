---
title: Add GitHub CLI (gh) to Development Workflow
lane: done
created: 2026-06-21T23:59:00+07:00
updated: 2026-06-21T23:59:00+07:00
description: Document and integrate GitHub CLI into the project's development workflow for PR management, CI monitoring, and release automation.
priority: low
labels: [dev-tools, workflow, docs]
---

## Conversation

### user

Add GitHub CLI (gh) to the development workflow documentation. Include:
1. Installation instructions for Windows/macOS/Linux
2. Common commands used in this repo
3. Authentication setup
4. Integration with existing scripts (release.sh, etc.)
5. Update AGENTS.md or TECHNICAL.md with gh references

### agent

Implementation started for GitHub CLI (gh) integration into the project workflow.

**Changes made:**

1. **`TECHNICAL.md`** — Added a full "GitHub CLI (gh)" section covering:
   - Installation instructions for Windows, macOS, and Linux
   - Authentication setup (`gh auth login`)
   - Common commands for PRs, workflows, releases, issues, and repo info
   - PR workflow quick reference (branch → commit → push → PR → merge)
   - Release workflow integration with `scripts/release.sh`
   - Agent reference for using `gh` in CI checks

2. **`AGENTS.md`** — Added `gh` reference to the "Shell and CI Conventions" section, noting `gh pr checks`, `gh run view`, `gh workflow run`, and `gh release create` as key commands.

**No script file created** — `gh` is a standalone CLI that needs no wrapper script. All commands are documented in `TECHNICAL.md`.