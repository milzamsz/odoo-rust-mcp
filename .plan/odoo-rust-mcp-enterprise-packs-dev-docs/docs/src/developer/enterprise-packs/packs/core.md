# Core Pack

## Purpose

Provide instance, metadata, safe generic read, capability, and diagnostics tools
used by all other packs.

## Required capability

- authenticated Odoo connection;
- model metadata read where allowed.

## Recommended tools

### Instance and capability

- `odoo_instance_get`
- `odoo_instance_test`
- `odoo_instance_capabilities_get`
- `odoo_instance_capabilities_refresh`
- `odoo_instance_pack_availability`
- `odoo_compatibility_report`

### Metadata

- `odoo_model_search`
- `odoo_model_get`
- `odoo_model_fields_get`
- `odoo_record_display_name_get`

### Controlled generic read

- `odoo_record_get`
- `odoo_record_search`
- `odoo_record_count`
- `odoo_group_aggregate`

### Diagnostics

- `odoo_access_explain`
- `odoo_registry_get`
- `odoo_policy_explain`

## Generic mutation tools

Existing generic create, update, delete, execute, and workflow action tools
should remain only in `developer` or `full-admin` profiles.

Production domain packs must not depend on generic delete or arbitrary execute.

## Invariants

- field allowlists apply;
- limits are mandatory;
- domain syntax is validated;
- aggregates group money by company and currency;
- metadata output redacts sensitive technical fields where necessary.
