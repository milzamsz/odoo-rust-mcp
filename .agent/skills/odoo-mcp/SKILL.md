---
name: Odoo Rust MCP
description: Use the Odoo MCP server to interact with Odoo instances via Model Context Protocol for CRUD operations, workflows, reports, and database management.
---

# Odoo Rust MCP Server Skill

A Rust implementation of an Odoo MCP server (Model Context Protocol) for interacting with Odoo ERP instances.

## Overview

This MCP server provides tools to:
- **Query Data**: Search, read, count, and aggregate Odoo records
- **Modify Data**: Create, update, delete records (when enabled)
- **Execute Workflows**: Confirm orders, post invoices, trigger actions
- **Generate Reports**: Create PDF reports from Odoo
- **Introspect Models**: List models, get field metadata, check access rights
- **Database Cleanup**: Production readiness cleanup tools (when enabled)

## Supported Odoo Versions

| Version | Authentication | API |
|---------|---------------|-----|
| Odoo 19+ | API Key | JSON-2 (`/json/2/...`) |
| Odoo < 19 | Username/Password | JSON-RPC (`/jsonrpc`) |

## Configuration

### Multi-Instance Setup (Recommended)

Create `instances.json`:

```json
{
  "production": {
    "url": "https://odoo.example.com",
    "db": "production",
    "apiKey": "YOUR_API_KEY"
  },
  "development": {
    "url": "http://localhost:8069",
    "db": "dev",
    "version": "18",
    "username": "admin",
    "password": "admin"
  }
}
```

Set environment:
```bash
ODOO_INSTANCES_JSON=/path/to/instances.json
```

### Enable Write/Cleanup Tools

```bash
ODOO_ENABLE_WRITE_TOOLS=true      # create, update, delete, execute
ODOO_ENABLE_CLEANUP_TOOLS=true    # database cleanup operations
```

---

## Available Tools

### Read Operations (Always Available)

| Tool | Description |
|------|-------------|
| `odoo_search` | Search records by domain, returns IDs |
| `odoo_search_read` | Search and read records in one operation |
| `odoo_read` | Read specific records by IDs |
| `odoo_count` | Count records matching domain |
| `odoo_read_group` | Aggregate with GROUP BY (sum, count, avg) |
| `odoo_name_search` | Autocomplete-style name search |
| `odoo_name_get` | Get display names for IDs |
| `odoo_default_get` | Get default values for new records |
| `odoo_list_models` | List accessible models |
| `odoo_get_model_metadata` | Get field definitions and types |
| `odoo_check_access` | Check read/write/unlink permissions |
| `odoo_generate_report` | Generate PDF report (base64) |
| `odoo_onchange` | Simulate form onchange behavior |

### Write Operations (Requires `ODOO_ENABLE_WRITE_TOOLS=true`)

| Tool | Description |
|------|-------------|
| `odoo_create` | Create a new record |
| `odoo_create_batch` | Create multiple records (max 100) |
| `odoo_update` | Update existing records |
| `odoo_delete` | Delete records |
| `odoo_copy` | Duplicate a record |
| `odoo_execute` | Execute arbitrary model method |
| `odoo_workflow_action` | Execute workflow action/button |

### Cleanup Operations (Requires `ODOO_ENABLE_CLEANUP_TOOLS=true`)

| Tool | Description |
|------|-------------|
| `odoo_database_cleanup` | Comprehensive database cleanup |
| `odoo_deep_cleanup` | DESTRUCTIVE: Remove all non-essential data |

---

## Tool Usage Examples

### Search Records

```json
{
  "instance": "production",
  "model": "sale.order",
  "domain": [["state", "=", "sale"], ["amount_total", ">", 1000]],
  "fields": ["name", "partner_id", "amount_total"],
  "limit": 10,
  "order": "date_order desc"
}
```

### Create Record

```json
{
  "instance": "development",
  "model": "res.partner",
  "values": {
    "name": "New Customer",
    "email": "customer@example.com",
    "phone": "+1234567890"
  }
}
```

### Execute Workflow Action

```json
{
  "instance": "production",
  "model": "sale.order",
  "ids": [42],
  "action": "action_confirm"
}
```

### Aggregate Data (read_group)

```json
{
  "instance": "production",
  "model": "sale.order",
  "domain": [["state", "=", "sale"]],
  "fields": ["amount_total:sum"],
  "groupby": ["partner_id"]
}
```

---

## Domain Filter Syntax

```python
# Basic operators
["name", "=", "John"]           # Exact match
["age", ">", 18]                # Greater than
["name", "ilike", "john"]       # Case-insensitive contains

# List operators
["state", "in", ["draft", "posted"]]
["state", "not in", ["cancel"]]

# Logical operators (Polish notation)
["&", ("a", "=", 1), ("b", "=", 2)]    # AND
["|", ("a", "=", 1), ("a", "=", 2)]    # OR
["!", ("state", "=", "cancel")]         # NOT

# Related fields
["partner_id.country_id.code", "=", "US"]
```

---

## Common Models Reference

| Model | Description |
|-------|-------------|
| `res.partner` | Contacts/Customers/Vendors |
| `sale.order` | Sales Orders |
| `purchase.order` | Purchase Orders |
| `account.move` | Invoices & Bills |
| `stock.picking` | Transfers/Deliveries |
| `product.product` | Products (variants) |
| `product.template` | Product Templates |
| `hr.employee` | Employees |
| `project.project` | Projects |
| `project.task` | Tasks |
| `crm.lead` | Leads/Opportunities |
| `pos.order` | POS Orders |

---

## Running the MCP Server

### stdio Transport (Cursor/Claude Desktop)

```bash
rust-mcp --transport stdio
```

### HTTP Transport (Remote)

```bash
rust-mcp --transport http --listen 127.0.0.1:8787
```

Endpoints:
- **MCP**: `http://127.0.0.1:8787/mcp`
- **Health**: `http://127.0.0.1:8787/health`
- **Config UI**: `http://localhost:3008`

### Cursor Configuration

```json
{
  "mcpServers": {
    "odoo": {
      "command": "rust-mcp",
      "args": ["--transport", "stdio"]
    }
  }
}
```

---

## Prompts Available

| Prompt | Description |
|--------|-------------|
| `odoo_common_models` | Common Odoo model reference |
| `odoo_domain_filters` | Domain filter syntax guide |
| `odoo_field_types` | Field types and relationships |
| `odoo_workflow_states` | Document workflow states |
| `odoo_read_group` | Aggregation guide |
| `odoo_context` | Context parameters |
| `odoo_api_tips` | Best practices |

---

## Best Practices

1. **Limit fields** - Only fetch fields you need in `search_read`
2. **Use pagination** - Set `limit` and `offset` for large datasets
3. **Prefer `read_group`** - For aggregations instead of fetching all records
4. **Batch operations** - Use `odoo_create_batch` for multiple records
5. **Always dry-run** - Set `dryRun: true` when using cleanup tools
6. **Check access first** - Use `odoo_check_access` before write operations
