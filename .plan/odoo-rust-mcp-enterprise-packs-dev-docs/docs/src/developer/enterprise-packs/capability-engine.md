# Capability Engine

## 1. Objective

Determine what the configured Odoo instance can actually support before tools
are exposed or executed.

## 2. Discovery stages

### Stage A: Identity

- Odoo version;
- database;
- deployment type;
- edition where detectable;
- authenticated user;
- active and allowed companies.

### Stage B: Installed modules

Query installed modules once per scan. Cache the result.

Do not assume an application's marketing name equals one technical module.
Packs may require multiple alternative module signatures.

### Stage C: Model and field metadata

Verify:

- model existence;
- field existence and type;
- required selection values;
- relation targets;
- method availability where discoverable.

### Stage D: Access

Use Odoo access checks and controlled metadata calls.

Distinguish:

- no access;
- record rule limitation;
- unsupported operation;
- network or authentication failure;
- unknown because discovery itself is forbidden.

### Stage E: Safe empirical probes

Only for explicitly approved probe targets.

Never perform generic create/delete probes on:

- accounting entries;
- payments;
- stock moves;
- manufacturing orders;
- POS orders or sessions;
- employee records;
- published website records;
- payroll records.

## 3. Snapshot example

```json
{
  "snapshot_id": "cap_01J...",
  "instance": "production",
  "odoo_version": "19.0",
  "edition": "enterprise",
  "deployment_type": "on_premise",
  "user": {
    "id": 7,
    "allowed_company_ids": [1, 3]
  },
  "modules": {
    "mrp": "installed",
    "point_of_sale": "installed",
    "website": "installed",
    "hr": "installed"
  },
  "models": {
    "mrp.production": {
      "available": true,
      "read": true,
      "create": true,
      "write": true,
      "unlink": false,
      "evidence": "access_checked"
    }
  },
  "errors": [],
  "created_at": "2026-07-20T15:00:00+07:00",
  "expires_at": "2026-07-20T16:00:00+07:00"
}
```

## 4. Capability requirements

A tool may declare:

```yaml
requirements:
  modules:
    all_of: [mrp]
    any_of: [mrp_workorder, mrp]
  models:
    - name: mrp.production
      access: [read, write]
  fields:
    - model: mrp.production
      name: state
      type: selection
  features:
    - standard_mo_confirm
```

## 5. Feature flags

Feature flags abstract version differences.

Examples:

- `external_api_json2`
- `legacy_rpc`
- `manufacturing_work_orders`
- `manufacturing_mps`
- `website_multi_site`
- `spreadsheet_dashboards`
- `pos_employee_login`
- `employee_contracts`

Tools depend on feature flags rather than scattered version conditions.

## 6. Refresh policy

Refresh when:

- instance configuration changes;
- authentication changes;
- Odoo version changes;
- modules are installed or removed;
- pack configuration changes;
- operator requests refresh;
- snapshot expires.

A failed refresh must not silently replace a valid snapshot with empty
capabilities. Mark the last valid snapshot stale and expose the scan error.

## 7. Capability resources

Recommended MCP resources:

```text
odoo://instances/{instance}/capabilities
odoo://instances/{instance}/modules
odoo://instances/{instance}/models/{model}
odoo://instances/{instance}/packs
odoo://instances/{instance}/compatibility
```

## 8. Capability tools

- `odoo_instance_capabilities_get`
- `odoo_instance_capabilities_refresh`
- `odoo_instance_pack_availability`
- `odoo_model_capability_get`
- `odoo_compatibility_report`

Refresh is an administrative action and should be rate limited.

## 9. Registration behavior under uncertainty

Production default:

- read tool may register when read capability is verified;
- write tool must not register when write capability is unknown;
- a pack may register partially;
- the UI must show skipped tools and exact reasons;
- an operator override requires a documented policy exception.
