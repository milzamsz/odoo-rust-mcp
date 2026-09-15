---
title: Support Odoo 18 Web Session Authentication Fallback
lane: done
created: 2026-09-14T23:30:00+07:00
updated: 2026-09-14T23:43:49+07:00
description: Allow the legacy Odoo client to authenticate when a custom res.users override requires an active HTTP request context.
priority: medium
labels: [mcp, rust, odoo]
evidence:
  lint: {ran: true, passed: true}
  test: {ran: true, passed: true}
  build: {ran: true, passed: true}
  behavior: {ran: true, passed: true}
---

## Conversation

### user

### agent

Built the optimized release, refreshed the repository's Linux sidecar binary, restarted the active service from the new build, and verified both HTTP endpoints. `/health` now reports `erp-dev-hksis` as reachable. The system-installed `/usr/bin` copy remains unchanged because replacing it requires interactive sudo authentication.

### user

Oke lakukan rebuild dan restart.

### agent

Task dibuka kembali ke `in-progress` untuk membangun sidecar terbaru, me-restart proses aktif, dan memverifikasi endpoint serta koneksi instance.

### user

### agent

Implemented a minimal fallback from legacy `common.authenticate` failures to `/web/session/authenticate`, preserving the existing JSON-RPC path for normal Odoo installations.

Evidence: regression test passed, Clippy passed with warnings denied, formatting passed, and the live module-capability smoke test connected successfully to `erp-dev-hksis` in 2.16 seconds.

### user

Sesuaikan odoo-rust-mcp agar dapat terhubung ke Odoo 18 yang gagal pada common.authenticate karena modul kustom mengakses request.env.

### agent

Confirmed task file: `.agentkanban/tasks/task_021_support_odoo_18_web_session_authentication_fallback.md`.

Task dibuat dan dipindahkan ke `in-progress`. Implementasi akan memakai fallback autentikasi web-session yang minimal, dengan pengujian regresi dan probe langsung terhadap instance `hksis_dev`.

### user
