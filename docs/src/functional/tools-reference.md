# Tools Reference

Complete reference for all 22 tools available in odoo-rust-mcp.

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

Aggregate records with GROUP BY.

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

Check user permissions on a model.

```json
{
  "instance": "production",
  "model": "res.partner",
  "operation": "write",
  "ids": [1, 2, 3]
}
```

---

### odoo_generate_report

Generate PDF report (returns base64).

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
