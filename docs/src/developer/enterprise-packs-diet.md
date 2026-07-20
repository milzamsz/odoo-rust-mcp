# Enterprise Pack Metadata and Capability Snapshots

The v0.6 scope deliberately adds only the part of enterprise packs that the current server needs: tools may declare an optional `pack` and `requiredModules`, and the server maintains a per-instance snapshot of installed Odoo modules. Instance-scoped `tools/list` responses hide tools whose pack is disabled or whose required modules are absent. Standard unscoped `tools/list` responses advertise a gated tool only when every configured instance can use it. The call path repeats the per-instance check so a stale client catalog cannot bypass it.

Snapshots are stored as `module-snapshots.json` beside the active `tools.json`. `ODOO_MODULE_SNAPSHOT_TTL_SECS` controls the refresh interval and defaults to 300 seconds. `odoo_refresh_capabilities` forces a refresh. A failed refresh marks the snapshot stale and records the error while preserving the last successful module list.

Per-instance pack suppression reuses `toolConfig`:

```json
{
  "toolConfig": {
    "disabledPacks": ["inventory"]
  }
}
```

Policy denials emit a metadata-only `tool_policy_decision` event with the instance, tool, pack, and reason code. Arguments and results are not logged in that event.

## Behavior notes

The unscoped rule is intentionally conservative. An unscoped `tools/call` (no `instance` argument) runs against the default instance and does not re-run the per-instance capability check, so advertising a gated tool only when every instance supports it keeps that default-instance call safe. Clients that want a tool available on just one instance should pass that `instance` to both `tools/list` and `tools/call`.

A failed refresh advances the snapshot's `checkedAt`, so an unreachable instance is treated as fresh for one TTL window rather than re-scanned on every `tools/list`. The last successful module list is retained, so gating stays stable while an instance is briefly down.

## Deliberate deferrals

This is metadata and filtering, not a pack framework. There are no YAML manifests, resolver traits, exposure profiles, workflow runtime, compatibility adapter matrix, new confirmation-token service, or generated domain tool suites. Existing declarative tools, environment guards, read-only instances, execute allowlists, and the controlled mutation capability remain the enforcement primitives.

The larger `.plan/odoo-rust-mcp-enterprise-packs-dev-docs` tree is a non-canonical historical brainstorm. Add any deferred subsystem only after a concrete use case demonstrates that these small primitives are insufficient.

## Live smoke check

The regular suite tests filtering and stale preservation without Odoo. A live cell can be checked explicitly:

```bash
ODOO_INSTANCES_JSON=/absolute/path/instances.json \
ODOO_E2E_INSTANCE=odoo18ce \
cargo test --manifest-path rust-mcp/Cargo.toml \
  --test module_capabilities_live -- --ignored --nocapture
```

The smoke test refreshes the selected instance and proves that the stock-gated tool is visible exactly when `stock` is installed.
For an isolated inline definition, pass the same JSON through `ODOO_E2E_INSTANCES`; the test writes it only to its temporary directory and gives it precedence over the operator's default runtime config.
