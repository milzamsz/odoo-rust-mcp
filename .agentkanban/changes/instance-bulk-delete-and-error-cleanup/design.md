# Design: Instance Bulk Delete and Error Cleanup

## Current state

`config-ui/src/components/tabs/InstancesTab.tsx` already has:

- a table view and card view driven by shared row metadata
- row-level `Test`, `Edit`, and `Delete` actions
- transient connection state derived from `connStatuses`
- existing page-level actions for import, export, test-all, refresh, and add-instance

The gap is that cleanup remains one-row-at-a-time even though the table is already positioned as
the denser operator workflow.

## Chosen approach

### 1. Keep row selection table-only

Checkbox selection belongs only to the table renderer. Card view keeps the current lighter
interaction model and existing single-row delete flow.

### 2. Drive cleanup from current runtime status

The dedicated cleanup shortcut should use the same runtime status source that powers the status
badges. A row qualifies only when its current status is exactly `error`.

That means:

- `idle` (`Not checked`) is excluded
- `checking` is excluded
- healthy rows are excluded

### 3. Use one shared destructive modal

Both entry points should converge on one review modal:

- bulk delete for currently selected rows
- `Remove error instances`

The modal should show enough metadata to prevent mistakes:

- instance name
- URL
- database when available
- current status label

Users can narrow the final delete set inside the modal before confirming. Confirmation stays
disabled until at least one candidate remains selected and the validation input exactly matches
`DELETE`.

### 4. Keep selection transient

Selection should clear after any meaningful row-set change, including delete, refresh, import,
save, or leaving the table workflow. This avoids stale bulk selections across config reloads.

## Testing strategy

Update `config-ui/src/__tests__/instances-tab.test.tsx` to cover:

- row checkbox selection and visible-row select-all
- appearance of the bulk delete action only when rows are selected
- modal candidate listing and in-modal deselection
- typed `DELETE` confirmation gating
- `Remove error instances` behavior with mixed `idle`, healthy, and `error` states
- selection clearing after deletion or refresh-driven state changes

## Risks and mitigations

- Risk: users confuse `Not checked` with `Error`.
  Mitigation: label the shortcut explicitly as `Remove error instances` and exclude idle rows.
- Risk: bulk delete is too easy to trigger by mistake.
  Mitigation: require modal review and exact typed confirmation.
- Risk: selection drifts after filters or refreshes.
  Mitigation: scope select-all to visible rows and clear invalid selections when the backing row set changes.
