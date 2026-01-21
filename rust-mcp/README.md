## rust-mcp (Odoo MCP Server in Rust)

Rust implementation of an Odoo MCP server, using **Odoo 19 JSON-2 External API** (`/json/2/...`) for speed (no XML-RPC), supporting:

- **MCP over stdio** (Claude Desktop style)
- **MCP over WebSocket** (standalone server)
- Multi-instance config via `ODOO_INSTANCES`
- Cleanup tools gated behind `ODOO_ENABLE_CLEANUP_TOOLS=true`

### Requirements

- Rust toolchain (cargo)
- Odoo instance that supports **External JSON-2 API** and **API keys** (Odoo 19+)

### Notes about Odoo editions/plans

Odoo states that access to the JSON-2 external API is only available on **Custom** plans (see Odoo 19 documentation). If your Odoo doesn’t expose `/json/2`, this server won’t work as-is.

### Environment variables

#### Multi-instance (recommended)

Set `ODOO_INSTANCES` to JSON:

```json
{
  "production": {
    "url": "https://mycompany.example.com",
    "db": "mycompany",
    "apiKey": "YOUR_API_KEY"
  }
}
```

Notes:
- `db` is optional (only needed when Host header isn’t enough to select DB).
- Extra fields in the JSON are ignored.

#### Single-instance (fallback)

```bash
export ODOO_URL="https://mycompany.example.com"
export ODOO_API_KEY="YOUR_API_KEY"
export ODOO_DB="mycompany"   # optional
```

### Local example (your setup)

```bash
export ODOO_URL="localhost:8069"
export ODOO_DB="v19_pos"
export ODOO_API_KEY="YOUR_API_KEY"
```

### Tools

Core tools:
- `odoo_search`
- `odoo_search_read`
- `odoo_read`
- `odoo_create`
- `odoo_update`
- `odoo_delete`
- `odoo_execute`
- `odoo_count`
- `odoo_workflow_action`
- `odoo_generate_report` (returns base64 PDF)
- `odoo_get_model_metadata`

Cleanup tools (feature-flag):
- `odoo_database_cleanup`
- `odoo_deep_cleanup`

### Prompts

- `odoo_common_models`
- `odoo_domain_filters`

### Example tool calls

Search and read:

```json
{
  "instance": "default",
  "model": "res.partner",
  "domain": [["is_company", "=", true]],
  "fields": ["name", "email"],
  "limit": 10,
  "order": "name ASC"
}
```

Execute action (button/workflow):

```json
{
  "instance": "default",
  "model": "sale.order",
  "ids": [42],
  "action": "action_confirm"
}
```

### Run (stdio)

```bash
cargo run --release -- --transport stdio
```

Or use the built binary:

```bash
./target/release/rust-mcp --transport stdio
```

### Run (WebSocket / standalone)

```bash
cargo run --release -- --transport ws --listen 0.0.0.0:8787
```

Or use the built binary:

```bash
./target/release/rust-mcp --transport ws --listen 0.0.0.0:8787
```

### Cleanup tools (disabled by default)

Cleanup tools are only listed and callable when enabled:

```bash
export ODOO_ENABLE_CLEANUP_TOOLS=true
```

### Build / test

Build (debug):

```bash
cargo build
```

Build (release):

```bash
cargo build --release
```

Run tests (zero warnings):

```bash
RUSTFLAGS='-Dwarnings' cargo test
```

### Claude Desktop config example

Set your MCP server command to the built binary, e.g.:

```json
{
  "mcpServers": {
    "odoo-rust": {
      "command": "/absolute/path/to/odoo-mcp-rust",
      "args": ["--transport", "stdio"],
      "env": {
        "ODOO_INSTANCES": "{\"production\":{\"url\":\"https://mycompany.example.com\",\"db\":\"mycompany\",\"apiKey\":\"YOUR_API_KEY\"}}"
      }
    }
  }
}
```

### Security

- Do **not** commit `.env` or any file containing API keys/passwords.
- Prefer using **dedicated bot users** with minimal access rights in Odoo for automation.

