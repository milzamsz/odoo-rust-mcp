# Technical Design

## 1. Rust module design

Recommended interfaces:

```rust
pub trait ToolPack: Send + Sync {
    fn manifest(&self) -> &PackManifest;
    fn register(
        &self,
        registry: &mut ToolRegistry,
        context: &PackRegistrationContext,
    ) -> Result<PackRegistrationReport, PackError>;
}
```

```rust
#[async_trait]
pub trait CapabilityProvider: Send + Sync {
    async fn scan(
        &self,
        instance: &OdooInstance,
        options: CapabilityScanOptions,
    ) -> Result<CapabilitySnapshot, CapabilityError>;
}
```

```rust
#[async_trait]
pub trait PolicyEvaluator: Send + Sync {
    async fn evaluate(
        &self,
        request: &PolicyRequest,
    ) -> Result<PolicyDecision, PolicyError>;
}
```

```rust
#[async_trait]
pub trait WorkflowStore: Send + Sync {
    async fn create_run(&self, manifest: &ExecutionManifest) -> Result<(), StoreError>;
    async fn load_run(&self, run_id: &str) -> Result<ExecutionManifest, StoreError>;
    async fn save_step(&self, run_id: &str, step: &StepRun) -> Result<(), StoreError>;
}
```

## 2. Extended tool metadata

```rust
pub struct ToolDef {
    pub name: String,
    pub title: Option<String>,
    pub description: String,
    pub pack: String,
    pub domain: Option<String>,
    pub input_schema: serde_json::Value,
    pub output_schema: Option<serde_json::Value>,
    pub operation: OperationDef,
    pub requirements: ToolRequirements,
    pub risk: RiskSpec,
    pub annotations: ToolAnnotations,
    pub guards: Vec<GuardDef>,
}
```

```rust
pub struct RiskSpec {
    pub level: RiskLevel,
    pub mutating: bool,
    pub destructive: bool,
    pub financially_material: bool,
    pub personal_data: bool,
    pub idempotency: IdempotencyClass,
    pub requires_confirmation: bool,
    pub supports_dry_run: bool,
    pub maximum_records: Option<u32>,
}
```

## 3. Naming conventions

Tool names:

```text
<domain>_<aggregate>_<verb>
```

Examples:

- `mrp_order_get`
- `mrp_order_confirm`
- `website_page_publish`
- `dashboard_snapshot_export`
- `pos_session_close`
- `employee_directory_search`

Avoid:

- ambiguous verbs such as `process`;
- generic `execute_method` tools in production profiles;
- leaking Odoo model names into every business-facing name;
- version numbers in public tool names.

## 4. Operation abstraction

A domain tool maps to an internal operation key:

```text
manufacturing.order.confirm
website.page.publish
spreadsheet.dashboard.snapshot
pos.session.close
employee.profile.read_public
```

Compatibility adapters resolve the operation key into version-specific calls.

## 5. Input normalization

Before policy evaluation:

- trim strings where semantics allow;
- canonicalize instance ID;
- sort and deduplicate record IDs;
- normalize domains;
- normalize monetary values and currency;
- reject unknown input fields;
- apply explicit defaults;
- calculate stable request hash.

Do not silently coerce invalid states or identifiers.

## 6. Output contract

Each successful tool should return:

```json
{
  "ok": true,
  "data": {},
  "meta": {
    "instance": "production",
    "pack": "manufacturing",
    "tool": "mrp_order_confirm",
    "capability_snapshot": "cap_...",
    "policy_revision": "pol_...",
    "request_id": "req_...",
    "duration_ms": 81
  },
  "warnings": []
}
```

Each failure should return:

```json
{
  "ok": false,
  "error": {
    "code": "POLICY_CONFIRMATION_REQUIRED",
    "message": "Confirmation is required before closing the POS session.",
    "retryable": false,
    "details": {}
  },
  "meta": {}
}
```

MCP `structuredContent` is authoritative. The text content is a concise
human-readable rendering.

## 7. Error taxonomy

- `INPUT_*`
- `AUTH_*`
- `CAPABILITY_*`
- `POLICY_*`
- `CONFIRMATION_*`
- `ODOO_ACCESS_*`
- `ODOO_VALIDATION_*`
- `ODOO_CONCURRENCY_*`
- `ODOO_REMOTE_*`
- `WORKFLOW_*`
- `STORE_*`
- `INTERNAL_*`

Never return raw credentials, request headers, or unredacted Odoo traces.

## 8. Context handling

Every Odoo call must construct context explicitly:

- allowed companies;
- active company;
- language;
- timezone;
- optional test mode;
- pack-specific context flags.

The active company must not be inferred from an arbitrary record when a
financial or stock mutation is involved.

## 9. Pagination

All list and search tools require:

- explicit `limit`;
- server maximum;
- cursor or offset strategy;
- deterministic ordering;
- returned `next_cursor` or completion marker.

Default limit should remain conservative.

## 10. Concurrency

Use optimistic safeguards:

- capture `write_date` or equivalent state fingerprint during preview;
- include it in confirmation token inputs;
- re-read before mutation;
- reject stale confirmation.

## 11. Caching

Cache:

- installed modules;
- model/field metadata;
- capability snapshots;
- pack registration decisions;
- selected read-only reference data.

Do not cache:

- stock availability for mutation decisions;
- payment status;
- employee-sensitive fields;
- current POS session state;
- confirmation decisions.

## 12. Uploads and binary data

- one file per call;
- explicit maximum bytes;
- MIME allowlist;
- filename normalization;
- hash calculation;
- returned stored size;
- no base64 batch aggregation;
- optional malware-scanning integration outside core.

## 13. Tool-list changes

If `listChanged` is advertised:

- increment registry revision;
- emit `notifications/tools/list_changed`;
- debounce multiple config changes;
- log old and new tool counts;
- test each transport.

Otherwise advertise `listChanged: false`.

## 14. MCP tasks

MCP 2025-11-25 introduces experimental durable tasks. Do not make them a hard
dependency in the first implementation. Keep the Workflow Runtime internally
stable, then add an MCP Tasks adapter behind a feature flag after client support
is proven.
