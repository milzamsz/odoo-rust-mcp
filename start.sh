#!/bin/sh
REPO_ROOT=$(cd "$(dirname "$0")" && pwd)
export ODOO_INSTANCES_JSON="$1"
cd "$REPO_ROOT/rust-mcp"
mkdir -p ../.codex-run
./target/release/rust-mcp.exe --transport http --listen 0.0.0.0:8787 --config-server-port 3008 > ../.codex-run/wsl-server.out.log 2> ../.codex-run/wsl-server.err.log
