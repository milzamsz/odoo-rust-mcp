# Windows GitHub distribution spec

## Intent

Define how the Windows Tauri desktop app is published through GitHub Releases without disrupting
the current ZIP-based Windows installation path.

## Required behavior

1. Windows desktop distribution is triggered from the repository's `v*` release flow.
2. The GitHub release publishes the Windows Tauri installer artifact produced by the desktop build.
3. The GitHub release also publishes the updater assets required by the Tauri desktop app, including
   signatures and `latest.json`.
4. The updater signing path is mandatory for desktop auto-update verification.
5. The first rollout remains Authenticode-unsigned, and release docs acknowledge possible Windows
   SmartScreen friction.
6. The current Windows ZIP + shortcut distribution path remains published in parallel during the
   rollout.
7. Release validation covers version alignment, artifact presence, checksum generation, and updater
   signature integrity.
8. No MCP API, config schema, auth semantics, or Odoo behavior changes are introduced by this
   distribution slice.

## Visual and delivery direction

- Keep the release surface clear for both manual installers and power users
- Treat desktop installer delivery as additive, not disruptive
- Reuse the Rust Hexagon identity across release assets where branding is visible

## Acceptance criteria

- a dedicated planning task exists for Windows desktop GitHub distribution
- the task links to a shared spec and a change folder with `proposal.md`, `design.md`, and `tasks.md`
- the planning artifacts define the release contract for installer, updater metadata, signatures,
  checksums, and the parallel ZIP path
- the planning artifacts explicitly record the unsigned-first/Authenticode-later rollout decision
- the umbrella Tauri planning task references this distribution slice
- the Tauri packaging planning task clearly stops at artifact production and leaves GitHub
  publication to this dedicated follow-up task

## Verification

- verify `.agentkanban/tasks/task_015_deploy_windows_tauri_app_to_github.md` links to the new
  change folder and shared spec
- verify `.agentkanban/changes/deploy-windows-tauri-app-to-github/` contains `proposal.md`,
  `design.md`, and `tasks.md`
- verify `.agentkanban/tasks/task_014_windows_tauri_desktop_app_program.md` references the GitHub
  distribution slice
- verify `.agentkanban/changes/windows-tauri-release-packaging/*` no longer implies updater
  publication is handled inside the packaging slice
- run a dangling-reference audit across `.agentkanban/tasks/*.md`
