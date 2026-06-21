# Proposal: Refine Instances Card and Table Views

## Why

The current instances screen is optimized for card-based browsing, which works well for a small set
of Odoo connections but becomes slower to scan and compare when operators manage larger fleets.

The requested refinement adds a denser table workflow without throwing away the strengths of the
current cards view:

- cards remain familiar and useful for quick visual scanning
- tables improve side-by-side comparison and precision filtering
- shared filters keep the two views part of one mental model instead of separate screens

## What changes

1. Add a desktop view toggle for `Card` and `Table`.
2. Preserve cards as the default and persist the chosen desktop view.
3. Add table columns for the operational instance fields and actions.
4. Add per-column filters and sortable headers in table view.
5. Keep global search, tag chips, and existing instance actions working across both views.
6. Add visible active-filter state and clear-all behavior.

## Non-goals

- No backend, config schema, or API contract changes.
- No pagination, virtualization, or bulk actions in this pass.
- No new third-party data table dependency.
- No redesign of the overall Config UI visual language beyond what is needed for the new controls.
