# Prompts Reference

Built-in prompts provide context and guidance to AI assistants when working with Odoo data, workflows, and addon development.

Prompts are defined in `prompts.json` and support hot-reload -- changes take effect immediately without restarting the server.

---

## Available Prompts

### odoo_common_models

**Description:** List of commonly used Odoo models across different modules.

**Contents:**
- Sales & CRM: `sale.order`, `crm.lead`, `crm.team`
- Accounting: `account.move`, `account.payment`, `account.journal`
- Inventory: `stock.picking`, `stock.move`, `stock.warehouse`, `stock.quant`
- Products: `product.product`, `product.template`, `product.category`
- Partners: `res.partner`, `res.company`, `res.users`
- HR: `hr.employee`, `hr.department`, `hr.leave`
- Projects: `project.project`, `project.task`
- Purchase: `purchase.order`
- POS: `pos.order`, `pos.session`, `pos.config`

---

### odoo_domain_filters

**Description:** Complete guide for Odoo domain filter syntax.

**Covers:**
- Basic operators: `=`, `!=`, `>`, `>=`, `<`, `<=`
- String operators: `like`, `ilike`, `=like`, `=ilike`
- List operators: `in`, `not in`
- Logical operators: `&` (AND), `|` (OR), `!` (NOT)
- Related field traversal: `partner_id.country_id.code`
- Complex examples

---

### odoo_field_types

**Description:** Odoo field types and relational fields explained.

**Covers:**
- Basic fields: Char, Text, Integer, Float, Monetary, Boolean, Date, Datetime
- Selection fields
- Binary and Html fields
- Relational fields:
  - Many2one (N:1)
  - One2many (1:N)
  - Many2many (N:N)
- Computed and related fields
- Naming conventions (`_id`, `_ids`, `_count`)

---

### odoo_workflow_states

**Description:** Common workflow states for Odoo documents.

**Documents covered:**
| Document | States |
|----------|--------|
| Sale Order | draft → sent → sale → done / cancel |
| Purchase Order | draft → sent → to approve → purchase → done |
| Invoice | draft → posted → cancel |
| Stock Picking | draft → waiting → confirmed → assigned → done |
| CRM Lead | lead / opportunity (type) |
| POS Order | draft → paid → done → invoiced |

---

### odoo_read_group

**Description:** How to use `read_group` for aggregation and reporting.

**Covers:**
- Syntax and parameters
- Aggregation functions: `sum`, `count`, `avg`, `min`, `max`
- Time grouping: `day`, `week`, `month`, `quarter`, `year`
- Practical examples:
  - Count orders by state
  - Sum sales by customer
  - Monthly revenue analysis

---

### odoo_context

**Description:** Odoo context parameters and their usage.

**Covers:**
- Session keys: `uid`, `lang`, `tz`, `allowed_company_ids`
- Active record keys: `active_id`, `active_ids`, `active_model`
- Behavior modifiers: `default_*`, `search_default_*`
- Skip validations: `tracking_disable`, `mail_create_nosubscribe`
- Import mode

---

### odoo_api_tips

**Description:** Best practices for Odoo API usage.

**Topics:**
- Performance tips:
  - Limit fields in `search_read`
  - Use pagination
  - Use `read_group` for aggregation
  - Avoid search in loops
- Field selection tips
- Common patterns
- Error handling

---

### odoo_owl_components

**Description:** Owl component structure and debugging patterns for Odoo addons.

**Covers:**
- Standard `static/src` JS/XML/SCSS component layout
- `/** @odoo-module **/` usage
- `setup()` over constructors
- Template naming with `addon_name.ComponentName`
- When to use `useService()`
- First-pass debugging checks for assets, template names, imports, and mounting

---

### odoo_assets_and_bundles

**Description:** Asset bundle choices and module wiring for Odoo frontend code.

**Covers:**
- `web.assets_backend`
- `web.assets_frontend`
- `web.assets_unit_tests`
- Manifest `assets` wiring for JS/XML/SCSS files
- `@web/...` imports vs addon-local relative imports
- Bundle-loading and module-header debugging checks

---

### odoo_frontend_contexts

**Description:** How to choose between backend, client action, standalone Owl, and website contexts.

**Covers:**
- Existing backend screen extensions
- Client actions for navigable backend features
- Standalone Owl apps with their own mount target
- Portal and website runtime separation
- Practical rules for staying close to the addon's existing structure

---

### odoo_qweb_and_templates

**Description:** QWeb and Owl template rules, directives, and version-sensitive notes.

**Covers:**
- XML templates for production components
- `xml:space="preserve"` and template naming alignment
- `t-if`, `t-elif`, `t-foreach`, `t-key`, and event bindings
- Dynamic attributes with `t-att-*` and `t-attf-*`
- Odoo 18 `t-esc` vs Odoo 19 `t-out` guidance
- Common template mismatches and naming mistakes

---

## Using Prompts

In your AI client, you can reference prompts to get context:

**Cursor/Claude:**
```
Show me the odoo_domain_filters prompt, then help me write a domain
to find all unpaid invoices from this year.
```

**Programmatic access:**
```json
{
  "method": "prompts/get",
  "params": {
    "name": "odoo_common_models"
  }
}
```
