# Observability

## 1. Goals

Operators must answer:

- which actor called which tool;
- on which Odoo instance and company;
- which policy allowed or denied it;
- which records were affected;
- whether Odoo may have committed before a timeout;
- which workflow step failed;
- which capability snapshot was used.

## 2. Structured log fields

- timestamp
- level
- request_id
- trace_id
- client_id
- actor_id
- transport
- instance_id
- company_id
- profile_id
- pack_id
- tool_name
- operation_key
- risk_level
- dry_run
- policy_decision
- confirmation_challenge_id
- record_count
- model
- duration_ms
- outcome
- error_code
- capability_snapshot_id
- registry_revision

Do not log record bodies by default.

## 3. Metrics

Counters:

- `mcp_tool_calls_total`
- `mcp_tool_errors_total`
- `mcp_policy_denials_total`
- `mcp_confirmations_issued_total`
- `mcp_confirmations_used_total`
- `mcp_capability_scans_total`
- `mcp_workflow_runs_total`
- `mcp_workflow_resumes_total`

Histograms:

- `mcp_tool_duration_seconds`
- `mcp_odoo_call_duration_seconds`
- `mcp_capability_scan_duration_seconds`
- `mcp_workflow_step_duration_seconds`
- `mcp_response_bytes`

Gauges:

- `mcp_registry_tools`
- `mcp_registry_revision`
- `mcp_active_workflows`
- `mcp_stale_capability_snapshots`
- `mcp_enabled_packs`

## 4. Tracing

Recommended spans:

```text
mcp.request
  registry.resolve
  input.validate
  capability.validate
  policy.evaluate
  confirmation.verify
  workflow.step
  odoo.call
  output.redact
  audit.emit
```

## 5. Audit events

Audit is append-only.

Event types:

- `tool.requested`
- `tool.denied`
- `confirmation.issued`
- `confirmation.used`
- `tool.executed`
- `tool.failed`
- `capability.scanned`
- `registry.changed`
- `workflow.created`
- `workflow.step_completed`
- `workflow.failed`
- `workflow.resumed`

## 6. Sensitive data

Audit stores identifiers and classifications, not sensitive values.

Examples:

- store employee ID, not private address;
- store amount and currency only when required by financial audit policy;
- hash uploaded file content;
- redact API keys, passwords, cookies, authorization headers, and tokens.

## 7. Alerts

Recommended alerts:

- repeated authentication failures;
- repeated policy denials from one client;
- stale capability snapshots;
- workflow stuck in running state;
- high uncertain-outcome timeout rate;
- registry change in production;
- bulk Employee data access;
- large website publication;
- POS close failure;
- Manufacturing completion failure after stock mutation.
