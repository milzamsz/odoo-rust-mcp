## odoo-rust-mcp

Rust implementation of an Odoo MCP server (Model Context Protocol), using **Odoo 19 JSON-2 External API** (`/json/2/...`) for fast HTTP-based access (no XML-RPC).

### What’s inside

- `rust-mcp/`: the Rust MCP server implementation

### Quick start

Build:

```bash
cd rust-mcp
cargo build --release
```

Run (stdio, for Claude Desktop):

```bash
cd rust-mcp
ODOO_URL="localhost:8069" ODOO_DB="v19_pos" ODOO_API_KEY="YOUR_API_KEY" \
./target/release/rust-mcp --transport stdio
```

Run (WebSocket, standalone server):

```bash
cd rust-mcp
ODOO_URL="localhost:8069" ODOO_DB="v19_pos" ODOO_API_KEY="YOUR_API_KEY" \
./target/release/rust-mcp --transport ws --listen 0.0.0.0:8787
```

For full documentation (tools, prompts, multi-instance config), see `rust-mcp/README.md`.
