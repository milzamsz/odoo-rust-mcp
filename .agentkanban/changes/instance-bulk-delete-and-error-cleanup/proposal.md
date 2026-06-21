# Proposal: Instance Bulk Delete and Error Cleanup

## Why

The instances table is now dense enough for larger fleets, but destructive cleanup is still limited
to one row at a time. That makes cleanup slower after a test pass surfaces several broken
connections.

The missing planning artifact needs to be restored because the shared instances capability spec and
the existing audit trail already describe this follow-up work, but the dedicated task files are not
present on branch `dev`.

## What changes

1. Add table-row checkbox selection with a visible selected-state workflow.
2. Add a bulk delete action for selected rows in table view.
3. Add a `Remove error instances` shortcut that targets only rows whose current connection status is
   `Error`.
4. Reuse one destructive confirmation modal that lists candidates, allows final deselection, and
   requires typing `DELETE`.

## Non-goals

- No card-view bulk selection in this pass.
- No backend, config schema, MCP API, or Odoo client changes.
- No automatic cleanup for `Not checked`, `Checking`, or healthy rows.
- No soft delete, archive, or background remediation workflow.
