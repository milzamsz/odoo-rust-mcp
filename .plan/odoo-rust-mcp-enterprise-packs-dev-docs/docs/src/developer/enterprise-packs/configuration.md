# Configuration

## 1. Configuration principles

- checked-in defaults are safe;
- production writes are opt-in;
- pack activation is per instance;
- profiles limit tool exposure;
- policy overrides are explicit and auditable;
- secrets remain outside ordinary config files.

## 2. Instance example

```json
{
  "id": "production",
  "url": "https://erp.example.com",
  "database": "production",
  "version": 19,
  "edition": "enterprise",
  "auth_mode": "api_key",
  "enabled": true,
  "read_only": false,
  "default_company_id": 1,
  "allowed_company_ids": [1],
  "default_profile": "operator",
  "capability_ttl_seconds": 3600,
  "packs": {
    "core": true,
    "crm": true,
    "sales": true,
    "purchase": true,
    "inventory": true,
    "accounting": true,
    "project": true,
    "manufacturing": true,
    "website": false,
    "spreadsheet_dashboard": true,
    "pos": true,
    "employee": false
  }
}
```

## 3. Exposure profile example

```yaml
id: mrp-planner
packs:
  include:
    - core
    - inventory
    - manufacturing
tools:
  include_patterns:
    - "odoo_instance_*"
    - "inventory_*_get"
    - "inventory_*_search"
    - "mrp_*_get"
    - "mrp_*_search"
    - "mrp_plan_*"
  exclude:
    - "mrp_order_complete"
    - "mrp_order_cancel"
    - "odoo_execute"
    - "odoo_delete"
```

## 4. Policy bundle example

```yaml
id: production-standard
version: 1
defaults:
  unknown_write_capability: deny
  cross_company_write: deny
  maximum_records_per_write: 100
  maximum_response_bytes: 2097152
  confirmation_ttl_seconds: 300
rules: []
```

## 5. Pack override

```yaml
instances:
  production:
    packs:
      manufacturing:
        enabled: true
        settings:
          allow_scrap: false
          completion_variance_threshold_percent: 2
      website:
        enabled: true
        settings:
          allowed_website_ids: [1]
          allow_script_fields: false
      employee:
        enabled: true
        settings:
          public_fields:
            - name
            - work_email
            - work_phone
            - department_id
            - job_id
```

## 6. Environment variables

Environment variables should enable deployment-level protections, not replace
fine-grained policy.

Examples:

```text
ODOO_MCP_ENVIRONMENT=production
ODOO_MCP_ENABLE_WRITES=false
ODOO_MCP_ENABLE_DESTRUCTIVE=false
ODOO_MCP_POLICY_BUNDLE=production-standard
ODOO_MCP_WORKFLOW_STORE=file
ODOO_MCP_WORKFLOW_DIR=/var/lib/odoo-rust-mcp/workflows
```

## 7. Config UI changes

Add:

- capability scan status;
- pack availability and skip reason;
- exposure-profile editor;
- policy bundle viewer;
- confirmation-event viewer;
- workflow-run list;
- registry revision;
- tool count by profile;
- personal-data warning for Employee pack;
- accounting and stock warning for POS and Manufacturing.
