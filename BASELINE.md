# BASELINE — odoo-rust-mcp (Phase 0 audit, 2026-07-19)

Live, mature repo at **v0.5.2** (git 848a349). This baseline records the Phase 0
inventory for the Odoo Agent Platform; no changes were made to this repo besides this file.

## Inventory

- Rust MCP server in `rust-mcp/` (edition 2024, version 0.5.2); React Config UI in
  `config-ui/`; Tauri desktop app in `desktop/`; deploy assets in `docker-compose.yml`,
  `helm/`, `k8s/`, `apt-repo/`, `homebrew/`.
- Transports: stdio / http / ws. Odoo 19+ JSON-2 API plus legacy JSON-RPC.
- Safety switches (env): `ODOO_ENABLE_WRITE_TOOLS`, `ODOO_ENABLE_CLEANUP_TOOLS`.
- Tool contract: `rust-mcp/config/tools.json` — 23 tools (13 read/metadata, 7
  write-gated, 3 cleanup-gated). Pinned copy lives in
  `odoo-rust-mcp-agent/tests/fixtures/mcp-tools-manifest-v0.5.2.json`.
- CI: `.github/workflows/{ci,release,deploy-image,deploy-docs}.yml`.

## Reproducible checks (run from `rust-mcp/`)

```bash
cargo fmt --check        # verified green 2026-07-19
cargo clippy -- -D warnings
cargo test
# Config UI: (cd ../config-ui && npm test / npm run build) per its package.json
```

## Platform boundary (ADR-001 in odoo-rust-mcp-agent)

This repo owns protocol/tools/transports/generic safety switches only. No Hermes UX,
no OCloud business policy, no n8n logic, no Indonesian tax rules may be added here.

## Phase 0 findings

None blocking. Uncommitted local changes exist in `desktop/` (package.json, tauri.conf,
binary) — unrelated to the agent platform; owner: this repo's maintainer.
