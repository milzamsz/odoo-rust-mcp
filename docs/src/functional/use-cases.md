# Use Cases & Examples

Real-world examples of using odoo-rust-mcp with AI assistants.

---

## Sales & CRM

### Find Top Customers by Revenue

```
Search for sale orders with state 'sale' from this year,
group by partner and sum the amount_total.
Show me the top 10 customers.
```

**Tool used:** `odoo_read_group`

---

### Create a Quotation

```
Create a new sale order for partner ID 42 with 3 lines:
- Product ID 10, qty 5
- Product ID 15, qty 2
- Product ID 20, qty 10
```

**Tools used:** `odoo_create` (sale.order), `odoo_create_batch` (sale.order.line)

---

### Confirm Pending Orders

```
Find all draft sale orders older than 7 days and confirm them.
```

**Tools used:** `odoo_search`, `odoo_workflow_action` (action_confirm)

---

## Inventory

### Check Stock Levels

```
List all products where qty_available is less than 10.
Include product name, quantity on hand, and category.
```

**Tool used:** `odoo_search_read` on `product.product`

---

### Process Pending Deliveries

```
Find all stock pickings in 'assigned' state for today and validate them.
```

**Tools used:** `odoo_search`, `odoo_workflow_action` (button_validate)

---

## Accounting

### Unpaid Invoice Analysis

```
Show me all unpaid customer invoices grouped by partner,
with total amount and count.
```

**Tool used:** `odoo_read_group` on `account.move`

```json
{
  "instance": "production",
  "model": "account.move",
  "domain": [
    ["state", "=", "posted"],
    ["move_type", "=", "out_invoice"],
    ["payment_state", "!=", "paid"]
  ],
  "fields": ["amount_residual:sum", "id:count"],
  "groupby": ["partner_id"]
}
```

---

### Post Draft Invoices

```
Find all draft invoices for this month and post them.
```

**Tools used:** `odoo_search`, `odoo_workflow_action` (action_post)

---

## Contacts

### Bulk Update Partners

```
Find all partners in category 'Prospects' and add them to the
'Newsletter' mailing list.
```

**Tools used:** `odoo_search`, `odoo_update`

---

### Find Duplicate Contacts

```
Search for partners with duplicate email addresses.
```

**Tool used:** `odoo_search_read` with `odoo_read_group`

---

## Reports

### Generate Sales Report

```
Generate a PDF sales report for order ID 42.
```

**Tool used:** `odoo_generate_report`

```json
{
  "instance": "production",
  "reportName": "sale.report_saleorder",
  "ids": [42]
}
```

---

### Monthly Revenue Dashboard

```
Show me total revenue by month for the current year.
```

**Tool used:** `odoo_read_group`

```json
{
  "instance": "production",
  "model": "account.move",
  "domain": [
    ["state", "=", "posted"],
    ["move_type", "=", "out_invoice"],
    ["invoice_date", ">=", "2026-01-01"]
  ],
  "fields": ["amount_untaxed_signed:sum"],
  "groupby": ["invoice_date:month"]
}
```

---

## Model Discovery

### Explore Available Models

```
List all non-transient models in my Odoo instance.
```

**Tool used:** `odoo_list_models`

---

### Understand a Model

```
Show me the fields and their types for the sale.order model.
```

**Tool used:** `odoo_get_model_metadata`

---

## Best Practices

### 1. Always specify fields

```
# Good - only requested fields
"fields": ["name", "email", "phone"]

# Avoid - fetches everything
"fields": []
```

### 2. Use pagination for large datasets

```json
{
  "limit": 100,
  "offset": 0
}
```

### 3. Check access before writing

```
Before updating those records, check if I have write access.
```

**Tool used:** `odoo_check_access`

### 4. Use dry run for cleanup

```
Run a dry run of database cleanup first to see what would be affected.
```

```json
{
  "dryRun": true
}
```
