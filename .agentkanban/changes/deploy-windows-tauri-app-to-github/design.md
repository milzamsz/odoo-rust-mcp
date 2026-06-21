# Design: Deploy Windows Tauri app to GitHub

## Scope boundary

This slice begins after the packaging task can reliably produce Windows Tauri artifacts. It covers
how those artifacts are published, validated, and consumed from GitHub Releases.

Packaging remains responsible for producing the Windows desktop build output. This task owns the
GitHub-facing release contract on top of that output.

## Chosen approach

### 1. Keep release publication tag-driven

The Windows desktop app should publish on the existing `v*` GitHub tag flow so versioning remains
aligned with the rest of the repository release process.

### 2. Publish updater-ready artifacts explicitly

The GitHub release should carry the full Windows desktop update surface, including:

- installer package
- updater package when required by Tauri
- signature files
- `latest.json`
- checksums

That keeps the release page usable both for manual installs and for desktop auto-update flows.

### 3. Separate updater signing from Authenticode signing

The first rollout stays Authenticode-unsigned, so Windows may still show SmartScreen friction.
That tradeoff should be documented rather than hidden.

Updater signing is still mandatory because Tauri update verification depends on signed update
metadata and artifacts.

### 4. Preserve the ZIP release path

The current Windows ZIP, shortcut launcher, docs bundle, and install-script flow remain part of the
release output. The desktop installer is additive in this phase, not a replacement.

### 5. Validate release integrity end-to-end

The planning contract should require checks for:

- version alignment across Rust, UI, and desktop manifests
- required GitHub secrets availability
- updater signature generation
- presence of release assets after publication
- refusal or failure behavior for unsigned or mismatched updater metadata

## Risks and mitigations

- Risk: packaging and publication responsibilities get blurred.
  Mitigation: keep artifact production in `windows-tauri-release-packaging` and GitHub publication
  in this dedicated task.
- Risk: Windows installer appears official but still triggers SmartScreen.
  Mitigation: document the unsigned-first rollout clearly and keep Authenticode as a future slice.
- Risk: updater assets publish incompletely and break auto-update.
  Mitigation: require explicit validation for signatures, `latest.json`, and release asset presence.
