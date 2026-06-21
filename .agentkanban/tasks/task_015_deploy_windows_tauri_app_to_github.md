---
title: Deploy Windows Tauri app to GitHub
lane: done
created: 2026-06-21T00:00:00+07:00
updated: 2026-06-22T02:53:53+07:00
description: Plan the GitHub release distribution path for the Windows Tauri app, including updater artifacts, signing inputs, and release validation.
priority: high
labels:
  - windows
  - tauri
  - github
  - release
  - updater
  - sdd
sortOrder: 1
slug: windows_tauri_app_to_github
dependsOn:
  - windows-tauri-release-packaging
change: .agentkanban/changes/deploy-windows-tauri-app-to-github
spec: .agentkanban/specs/windows-github-distribution/spec.md
---

## Conversation

### user

now create task dev for deploying the windows app to github

### agent

Confirmed task file: `.agentkanban/tasks/task_015_deploy_windows_tauri_app_to_github.md`.

Created a dedicated planning task for shipping the Windows Tauri app through GitHub releases.

This task owns:

- tag-driven GitHub release publication for the Windows Tauri app
- updater-ready release artifacts such as installer packages, signatures, and `latest.json`
- release-secret and signing contracts for Tauri updater delivery
- preserving the current ZIP release path while the desktop installer is added
- the initial unsigned-first rollout, including documented SmartScreen expectations

This task is planning-only for now and does not include product development yet.

### user

oke done, now start Deploy Windows Tauri app to GitHub see .agentkanban

### agent

Confirmed task file: `task_015_deploy_windows_tauri_app_to_github.md`.

We have successfully implemented the Windows Tauri desktop app deployment pipeline to GitHub Releases!

**What was delivered:**

1. **Tauri Updater Configuration**:
   - Added `tauri-plugin-updater = "2"` to [Cargo.toml](file:///c:/Workspace/tools/mcp/odoo-rust-mcp/desktop/src-tauri/Cargo.toml) and registered the plugin in [lib.rs](file:///c:/Workspace/tools/mcp/odoo-rust-mcp/desktop/src-tauri/src/lib.rs).
   - Configured `"createUpdaterArtifacts": true` and configured the `"updater"` plugin in [tauri.conf.json](file:///c:/Workspace/tools/mcp/odoo-rust-mcp/desktop/src-tauri/tauri.conf.json) with target updater endpoints pointing to GitHub Releases.
   - Updated frontend capabilities in [default.json](file:///c:/Workspace/tools/mcp/odoo-rust-mcp/desktop/src-tauri/capabilities/default.json) to grant `"updater:default"`.

2. **GitHub Actions Workflow Jobs**:
   - Integrated the `build-desktop` job into [.github/workflows/release.yml](file:///c:/Workspace/tools/mcp/odoo-rust-mcp/.github/workflows/release.yml) running on `windows-latest`. This job builds the core `rust-mcp` sidecar binary, copies UI static assets/documentation books, and calls `tauri-apps/tauri-action@v0` with `TAURI_SIGNING_PRIVATE_KEY` secrets.
   - Modified the checksum generation step to include `.msi` and `.exe` installers.
   - Added a dynamic `latest.json` updater manifest generator step in the unified release job that extracts signature metadata from `.sig` files and constructs the correct JSON manifest file dynamically before uploading it as a release asset.

3. **Production Signing Keypair**:
   - Generated the official update signing keypair. The public key is securely checked into `tauri.conf.json`, and the private key is provided below to be configured as a repository secret.

**Tauri Private Key (Repository Secret):**
```text
dW50cnVzdGVkIGNvbW1lbnQ6IHJzaWduIGVuY3J5cHRlZCBzZWNyZXQga2V5ClJXUlRZMEl5VGYvWWNVMGNDVzNwWUYrV2w1T2FZVDNodlNaRHdVTWZEY0lvRS9HTnFKMEFBQkFBQUFBQUFBQUFBQUlBQUFBQVRyYTR1ZmJPd2JTazB0SVMvVXBmTVU3bjFCazV0ZThMb0NYL0tldTd5eUNTN21FbXczSDZ0UXRJSDJ0cWlFRjV5R2RJd0UvUmovUUc2SDFibkxGMkxwZDFBWnhyZ3dUY2EzNXk5aEw1VUpQUFdlTmwzQWgrTzNDMU1aeHpFQ2VIbjVXZ3NXRVJ6ZDQ9Cg==
```

**Tauri Public Key (Checked into config):**
```text
dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IEUwQ0QyNEU4RjM1QzQ5NjUKUldSbFNWeno2Q1RONFBDSWdKaW4yVW5pa1pvTUg1Z3BCdVFnNkZuSkxLeTJwWmZDTXNSRnh0WGoK
```

**Validation completed:**
- Verified that all unit tests, typechecks, lints, and cargo checks pass with 0 errors.

### user
