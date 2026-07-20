# Spreadsheet and Dashboard Pack

## 1. Purpose

Expose Odoo Spreadsheet and Dashboard capabilities for analysis, controlled
dashboard administration, snapshots, and data-source diagnostics.

Odoo Spreadsheet integrates directly with Odoo data and serves as the basis for
standard and custom Odoo Dashboards. These features are closely tied to
Documents and Enterprise internals, so compatibility must be discovered rather
than assumed.

## 2. Architectural warning

Spreadsheet and Dashboard internal models, JSON payloads, formulas, and
commands may change between Odoo versions.

Therefore:

- never bind public tool contracts directly to raw internal JSON;
- use domain operation keys;
- maintain version adapters;
- capture golden fixtures by version;
- fail closed when internal schema is unknown;
- begin with read and snapshot capabilities.

## 3. Pack boundaries

### Included

- spreadsheet and dashboard discovery;
- metadata and access groups;
- data-source inventory;
- pivot, list, chart, and global-filter metadata where supported;
- snapshot export;
- dashboard health diagnostics;
- controlled template or dashboard creation after adapter maturity.

### Excluded from first release

- arbitrary formula execution outside Odoo;
- unrestricted internal JSON patching;
- automatic dashboard publication;
- bypassing source-model access rights;
- arbitrary external data fetching.

## 4. Typical modules and dependencies

Feature signatures may include:

- Documents;
- Spreadsheet;
- Dashboards;
- Accounting or domain apps that provide data sources.

The Capability Engine must detect actual models and fields.

## 5. Models

Use aliases rather than hard-coded public contracts:

```text
SpreadsheetDocument
SpreadsheetTemplate
Dashboard
DashboardGroup
DashboardDataSource
```

The compatibility adapter maps aliases to version-specific Odoo models and
payload structures.

## 6. Tool catalog

### Query

- `spreadsheet_search`
- `spreadsheet_get_metadata`
- `spreadsheet_template_search`
- `spreadsheet_data_sources_get`
- `spreadsheet_global_filters_get`
- `spreadsheet_health_check`
- `dashboard_search`
- `dashboard_get`
- `dashboard_access_get`
- `dashboard_data_sources_get`
- `dashboard_refresh_status`
- `dashboard_health_check`

### Snapshot and export

- `spreadsheet_snapshot_export`
- `dashboard_snapshot_export`
- `dashboard_kpi_extract`
- `dashboard_chart_data_extract`

### Controlled administration

Deferred until adapters are stable:

- `spreadsheet_create_from_template`
- `spreadsheet_duplicate`
- `spreadsheet_set_access`
- `dashboard_create_from_spreadsheet`
- `dashboard_set_access`
- `dashboard_archive`

### Workflows

- `dashboard_build_snapshot`
- `dashboard_periodic_business_snapshot`
- `dashboard_access_review`
- `dashboard_data_quality_review`

## 7. Snapshot contract

Snapshot output includes:

- source dashboard or spreadsheet;
- instance and company;
- timestamp;
- locale and timezone;
- global filters;
- source models;
- KPI values;
- currency and unit;
- stale-source warnings;
- access context;
- export format and hash.

A snapshot is not presented as live after export.

## 8. Data access

Dashboard access does not automatically grant unrestricted access to every
underlying source model.

The pack must:

- preserve Odoo access evaluation;
- identify data source models;
- avoid leaking hidden rows;
- treat externally shared snapshots as a separate high-risk operation;
- minimize personal and financial detail.

## 9. Formula safety

- formula text is data, not executable server code;
- no `eval`;
- no arbitrary Python or JavaScript;
- Odoo evaluates native spreadsheet behavior;
- MCP only requests supported operations or reads stored results;
- unknown formula or command types produce compatibility errors.

## 10. Policies

- metadata read: R0;
- snapshot export: R1-R2 depending on data;
- access change: R3;
- external snapshot sharing: R3-R4;
- dashboard creation: R2-R3;
- dashboard deletion replaced by archive where supported;
- financial KPI aggregates group by company and currency;
- Employee-related sources apply personal-data policy.

## 11. Recommended release sequence

### Release A

- discovery;
- metadata;
- health check;
- snapshot export.

### Release B

- KPI and chart extraction;
- access review;
- template discovery.

### Release C

- create from template;
- dashboard conversion;
- access administration.

Raw internal spreadsheet editing should remain out of scope until compatibility
coverage is strong.

## 12. Acceptance tests

- pack skips safely when Spreadsheet/Dashboard is unavailable;
- internal schema drift produces explicit compatibility error;
- snapshot stores filters and timestamp;
- financial values preserve currency;
- personal-data sources are redacted;
- access change requires confirmation;
- source-model record rules remain effective;
- no arbitrary formula execution occurs.
