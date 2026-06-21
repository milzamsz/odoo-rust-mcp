# Instance List Views

## Purpose

Define the expected behavior for the Config UI instances list so operators can manage Odoo
connections effectively in either a compact table workflow or the existing card-oriented workflow.

## Requirements

### View modes

1. The instances screen must offer two explicit views: `Card` and `Table`.
2. Card view must remain the default desktop presentation.
3. The chosen desktop view must persist across reloads in local storage.
4. Narrow screens must automatically render cards even if the persisted desktop preference is table.
5. Auto-switching to cards on narrow screens must not overwrite the stored desktop preference.

### Shared discovery controls

1. The existing global search must remain available in both views.
2. Existing tag chips and tag-based filtering must remain available in both views.
3. Global search, tag filters, and table column filters must combine with AND semantics.
4. The UI must expose a clear indication of active filters, including:
   - active filter count
   - removable filter chips or equivalent visible state
   - clear-all behavior

### Table view behavior

1. Table view must present the following columns:
   - Selection
   - Name
   - URL
   - Database
   - Authentication
   - Version
   - Tags
   - Tools
   - Status
   - Actions
2. Every data column except `Selection` and `Actions` must support sorting.
3. Every data column except `Selection` and `Actions` must provide a column-specific filter control.
4. Filter control types must match the data shape:
   - text filters for Name, URL, Database, and Tags
   - select filters for Authentication, Version, and Status
   - a compact semantic filter for Tools
5. Table view must support row selection through checkboxes, including a select-all control for the
   currently visible rows.
6. When one or more rows are selected, the UI must expose a bulk delete action for the selected
   instances.
7. The UI must expose a dedicated `Remove error instances` action that targets only rows whose
   current connection status is `Error`.
8. `Not checked`, `Checking`, and healthy rows must never be treated as error-cleanup candidates.
9. Both bulk delete flows must use a destructive confirmation modal that:
   - lists the candidate instances before deletion
   - allows users to unselect instances inside the modal
   - requires the exact validation text `DELETE` before confirmation is enabled
10. Pagination is out of scope for this capability.

### Card view continuity

1. Card view must preserve the current operator actions and information hierarchy:
   - instance identity
   - URL
   - database
   - authentication mode
   - version
   - tool availability
   - connection status
   - test, edit, and delete actions
2. Existing page-level actions must remain available:
   - import
   - export
   - add instance
   - test all
   - refresh

### Accessibility and responsiveness

1. View-switch controls must be keyboard reachable and have accessible labels.
2. Sortable headers must expose their current sort state.
3. Filters and status indicators must not rely on color alone.
4. The desktop table must remain usable without introducing horizontal overflow traps beyond the
   existing responsive container patterns already used in the repo.

## Acceptance Criteria

- Operators can switch between Card and Table views on desktop.
- Reloading preserves the chosen desktop view.
- Mobile or narrow layouts still render cards regardless of the stored desktop view.
- Table view supports per-column filtering and sorting for every data column except Actions.
- Table view supports checkbox selection and bulk deletion without breaking existing per-row actions.
- The `Remove error instances` action includes only rows with current `Error` status.
- Global search, tags, and column filters work together instead of replacing one another.
- All existing instances actions remain available after the refinement.

## Verification

1. Run `cd config-ui && npm run lint`.
2. Run `cd config-ui && npm run typecheck`.
3. Run `cd config-ui && npm test`.
4. Run `cd config-ui && npm run build`.
5. Confirm tests cover:
   - view switching
   - persisted desktop preference
   - narrow-screen card fallback
   - combined global, tag, and column filtering
   - column sorting behavior
   - visible-row row-selection behavior
   - typed `DELETE` confirmation for destructive actions
   - exclusion of healthy and not-checked rows from error cleanup
   - preservation of existing actions and status rendering
