# Proposal: Deploy Windows Tauri app to GitHub

## Why

Building a Windows Tauri installer is only part of the rollout. The repo also needs an explicit,
auditable plan for how that installer reaches GitHub Releases, how updater metadata is published,
and how secrets and signatures are handled without breaking the current ZIP-based install path.

The existing Tauri packaging task intentionally stops at artifact production. A separate deployment
task keeps GitHub distribution, updater publication, and release governance visible as its own
delivery slice.

## What changes

1. Add a dedicated planning record for Windows Tauri distribution through GitHub Releases.
2. Define the release contract for:
   - tag-triggered publication
   - Windows installer and updater artifacts
   - `latest.json` and signature assets
   - checksum generation
3. Define the secret and signing expectations for Tauri updater delivery while keeping the first
   rollout Authenticode-unsigned.
4. Preserve the current ZIP release flow as a parallel distribution path during rollout.

## Non-goals

- No desktop product implementation in this task.
- No removal of the current ZIP + shortcut distribution path.
- No Authenticode code-signing rollout in this first slice.
- No cross-platform desktop GitHub distribution beyond Windows in this pass.
