# Tools Reference

Complete reference for all 28 tools available in odoo-rust-mcp.

## Version Support

Every tool takes the same arguments on every version; the server translates calls for the Odoo version it talks to. It detects the real version from `/web/webclient/version_info`, and the configured `version` wins if they differ. Tools with a `minVersion` are hidden from `tools/list` on older instances, and calls to them return `version_unsupported`.

| Tool | 16 | 17 | 18 | 19 / saas~19.x | 20 | Notes |
|------|----|----|----|----------------|----|-------|
| `odoo_read_group` | ✓ | ✓ | ✓ | ✓ | ✓ | `having` needs 19+. Older versions get the same input translated to `read_group`. |
| `odoo_name_get` | ✓ | ✓ | ✓ | ✓ | ✓ | Reads `display_name`; Odoo removed `name_get` in 18. |
| `odoo_check_access` | ✓ | ✓ | ✓ | ✓ | ✓ | `has_access` on 18+, `check_access_rights`/`check_access_rule` before. |
| `odoo_web_search_read` | – | ✓ | ✓ | ✓ | ✓ | `minVersion: 17` |
| `odoo_access_rules` | ✓ | ✓ | ✓ | ✓ | ✓ | Reads `ir.access` on saas~19.4+ and 20. |
| `odoo_model_schema` | – | – | – | ✓ | ✓ | `minVersion: 19`; needs the `api_doc` module and an API-key instance. |
| `odoo_generate_report` | ✓ | ✓ | ✓ | password only | password only | Odoo 19+ does not accept API keys on `/report/pdf`. |
| Cleanup tools | ✓ | ✓ | ✓ | ✓ | ✓ | Steps for modules that are not installed are skipped. |

On Odoo 20, binary fields read back as base64 strings as before (the server flattens Odoo's new `{content, size}` shape), and `datas` on `ir.attachment` is sent as `raw`.

---

---

## Read Operations (Always Available)

### odoo_search

Search for records matching domain filters. Returns **IDs only**.

```json
{
  "instance": "production",
  "model": "res.partner",
  "domain": [["is_company", "=", true]],
  "limit": 10,
  "offset": 0,
  "order": "name ASC"
}
```

**Response:**
```json
{ "ids": [1, 2, 3], "count": 3 }
```

---

### odoo_search_read

Search and read records in one operation. Returns **full record data**.

```json
{
  "instance": "production",
  "model": "res.partner",
  "domain": [["is_company", "=", true]],
  "fields": ["name", "email", "phone"],
  "limit": 10,
  "order": "name ASC"
}
```

**Response:**
```json
{
  "records": [
    {"id": 1, "name": "Acme Corp", "email": "info@acme.com", "phone": "+1234567890"}
  ],
  "count": 1
}
```

---

### odoo_read

Read specific records by IDs.

```json
{
  "instance": "production",
  "model": "res.partner",
  "ids": [1, 2, 3],
  "fields": ["name", "email"]
}
```

---

### odoo_count

Count records matching domain.

```json
{
  "instance": "production",
  "model": "sale.order",
  "domain": [["state", "=", "sale"]]
}
```

**Response:**
```json
{ "count": 42 }
```

---

### odoo_read_group

Aggregate records with GROUP BY. Same input on every version (`formatted_read_group` on 19+, translated `read_group` before).

```json
{
  "instance": "production",
  "model": "sale.order",
  "domain": [["state", "=", "sale"]],
  "groupby": ["partner_id"],
  "aggregates": ["amount_total:sum", "__count"],
  "order": "amount_total:sum desc",
  "limit": 10
}
```

**Response:** each group has the `groupby` keys and one key per aggregate spec.
```json
{ "groups": [{ "partner_id": [7, "Azure Interior"], "amount_total:sum": 4250.0, "__count": 3 }] }
```

| Argument | Notes |
|----------|-------|
| `groupby` | Required. Fields, or `date_field:day/week/month/quarter/year`. |
| `aggregates` | `field:sum/avg/min/max/count/count_distinct/array_agg/bool_and/bool_or`, or `__count`. |
| `having` | Odoo 19+ only, e.g. `[["amount_total:sum", ">", 1000]]`. |
| `offset`, `limit`, `order` | `order` may use aggregate specs. |

> **Changed in 0.7.0:** `fields`, `orderby` and `lazy` are deprecated. They still work in 0.7 and add a `deprecation` note to the result; they will be removed in 0.8. The result is always the shape above, with `lazy` ignored.

---

### odoo_name_search

Autocomplete-style name search.

```json
{
  "instance": "production",
  "model": "res.partner",
  "name": "Acme",
  "limit": 10
}
```

---

### odoo_name_get

Get display names for record IDs.

```json
{
  "instance": "production",
  "model": "res.partner",
  "ids": [1, 2, 3]
}
```

---

### odoo_default_get

Get default values for new record creation.

```json
{
  "instance": "production",
  "model": "sale.order",
  "fields": ["partner_id", "date_order"]
}
```

---

### odoo_list_models

List available Odoo models.

```json
{
  "instance": "production",
  "domain": [["transient", "=", false]],
  "limit": 50
}
```

---

### odoo_get_model_metadata

Get field definitions and types for a model.

```json
{
  "instance": "production",
  "model": "sale.order"
}
```

---

### odoo_check_access

Check whether the API user may `read`, `write`, `create` or `unlink` on a model, or on specific records when `ids` is given. Returns `{ "has_access": bool, ... }`.

```json
{
  "instance": "production",
  "model": "res.partner",
  "operation": "write",
  "ids": [1, 2, 3]
}
```

---

### odoo_access_rules

List the access rights and record rules that apply to a model, optionally for one operation. Archived entries are included with their `active` flag.

```json
{ "instance": "production", "model": "res.partner", "operation": "write" }
```

**Response:** `source` says which models were read.
- Odoo saas~19.4+ and 20: `{ "source": "ir.access", "access": [...] }`. Each entry has `group_id`, `operation`, `domain`, `kind` and `for_read`/`for_write`/`for_create`/`for_unlink`.
- Older: `{ "source": "ir.model.access+ir.rule", "access": [...], "rules": [...] }`.

---

### odoo_model_schema

Full schema of a model from Odoo's API documentation: fields (an enriched `fields_get`) and public methods with parameters and docstrings.

```json
{ "instance": "production", "model": "sale.order" }
```

Requires Odoo 19+, the `api_doc` module, an API-key instance, and an API user in the *Allow API documentation* group.

---

### odoo_web_search_read

Search and read records with a field specification, including nested relational fields, in one call (Odoo 17+).

```json
{
  "instance": "production",
  "model": "sale.order",
  "domain": [["state", "=", "sale"]],
  "specification": {
    "name": {},
    "partner_id": { "fields": { "display_name": {}, "email": {} } },
    "order_line": { "fields": { "product_id": { "fields": { "display_name": {} } } }, "limit": 5 }
  },
  "limit": 20,
  "order": "date_order desc"
}
```

**Response:** `{ "length": 42, "records": [{ "id": 1, "name": "S00001", "partner_id": { "id": 7, "display_name": "...", "email": "..." }, ... }] }`

---

### odoo_refresh_capabilities

Refresh the installed-module and version snapshot for an instance now, instead of waiting for the cache TTL. The snapshot drives `requiredModules` and `minVersion` gating and shows the detected version in the Config UI.

```json
{ "instance": "production" }
```

---

### odoo_generate_report

Generate PDF report (returns base64). On Odoo 19+ this needs a username/password instance, because Odoo does not accept API keys on `/report/pdf`.

```json
{
  "instance": "production",
  "reportName": "sale.report_saleorder",
  "ids": [42]
}
```

---

### odoo_onchange

Simulate form onchange behavior.

```json
{
  "instance": "production",
  "model": "sale.order",
  "ids": [],
  "values": {"partner_id": 42}
}
```

---

## Write Operations

> **Requires:** `ODOO_ENABLE_WRITE_TOOLS=true`

### odoo_create

Create a new record.

```json
{
  "instance": "production",
  "model": "res.partner",
  "values": {
    "name": "New Customer",
    "email": "customer@example.com"
  }
}
```

**Response:**
```json
{ "id": 123, "success": true }
```

---

### odoo_create_batch

Create multiple records (max 100).

```json
{
  "instance": "production",
  "model": "res.partner",
  "values": [
    {"name": "Partner 1", "email": "p1@example.com"},
    {"name": "Partner 2", "email": "p2@example.com"}
  ]
}
```

---

### odoo_update

Update existing records.

```json
{
  "instance": "production",
  "model": "res.partner",
  "ids": [123],
  "values": {
    "email": "updated@example.com"
  }
}
```

---

### odoo_delete

Delete records.

```json
{
  "instance": "production",
  "model": "res.partner",
  "ids": [123]
}
```

---

### odoo_copy

Duplicate a record.

```json
{
  "instance": "production",
  "model": "sale.order",
  "id": 42,
  "default": {"name": "Copy of SO042"}
}
```

---

### odoo_execute

Execute arbitrary model method.

```json
{
  "instance": "production",
  "model": "sale.order",
  "method": "action_confirm",
  "args": [[42]]
}
```

---

### odoo_workflow_action

Execute workflow action button.

```json
{
  "instance": "production",
  "model": "sale.order",
  "ids": [42],
  "action": "action_confirm"
}
```

---

## Cleanup Operations

> **Requires:** `ODOO_ENABLE_CLEANUP_TOOLS=true`
> ⚠️ **Use with caution!**

### odoo_database_cleanup

Comprehensive database cleanup.

```json
{
  "instance": "staging",
  "removeTestData": true,
  "cleanupDrafts": true,
  "dryRun": true
}
```

---

### odoo_deep_cleanup

**DESTRUCTIVE**: Remove all non-essential data.

```json
{
  "instance": "staging",
  "dryRun": true,
  "keepCompanyDefaults": true,
  "keepUserAccounts": true
}
```

---

### odoo_stock_inventory_reversal_cleanup

Plan or apply an inventory adjustment that undoes wrong stock quantities. Needs the `stock` module. It runs as a dry run unless `dryRun: false` **and** `confirm: true` are both set. Lines that would make stock negative are blocked unless `allowNegative` is true.

```json
{
  "instance": "staging",
  "lines": [{ "productId": 12, "locationId": 8, "wrongAdjustmentQty": 5 }],
  "dryRun": true
}
```

---

## Controlled Mutations

### odoo_execute_capability

> **Requires:** `ODOO_CAPABILITY_CONTROLLED_MODE=true` plus a signed capability registry (see [Configuration](configuration.md)).

Run one approved, named mutation (for example `create_quotation_draft.v1`) against an exact registry target. Each call needs an HMAC-signed approval envelope and an idempotency key. The server refuses the call when the version or edition that Odoo reports differs from the approved target. In controlled mode, the generic write and cleanup tools are hidden.

---

## Domain Filter Syntax

```python
# Basic
["name", "=", "John"]
["age", ">", 18]
["name", "ilike", "john"]

# List
["state", "in", ["draft", "posted"]]

# Logical (Polish notation)
["&", ("a", "=", 1), ("b", "=", 2)]    # AND
["|", ("a", "=", 1), ("a", "=", 2)]    # OR
["!", ("state", "=", "cancel")]        # NOT

# Related fields
["partner_id.country_id.code", "=", "US"]
```

---

## Common Models

| Model | Description |
|-------|-------------|
| `res.partner` | Contacts/Customers |
| `sale.order` | Sales Orders |
| `purchase.order` | Purchase Orders |
| `account.move` | Invoices/Bills |
| `stock.picking` | Transfers |
| `product.product` | Products |
| `hr.employee` | Employees |
| `project.task` | Tasks |
