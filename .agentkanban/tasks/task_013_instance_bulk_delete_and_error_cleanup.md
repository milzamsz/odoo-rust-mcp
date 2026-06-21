---
title: Add instance bulk delete and error cleanup
lane: done
created: 2026-06-21T00:00:00+07:00
updated: 2026-06-22T18:48:00+07:00
description: Add safe bulk deletion to the Instances table and a shortcut action to remove instances whose current connection status is Error.
priority: medium
labels: [config-ui, instances, ux, sdd]
change: .agentkanban/changes/instance-bulk-delete-and-error-cleanup
spec: .agentkanban/specs/instance-list-views/spec.md
dependsOn: []
---

## Conversation

### user

Implement Plan, but just task not development

### agent

Confirmed task file: `.agentkanban/tasks/task_013_instance_bulk_delete_and_error_cleanup.md`.

Planning scaffold restored for the instances bulk-delete and error-cleanup follow-up.

This task owns:

- checkbox selection in table view only
- bulk delete for selected rows
- a destructive review modal with exact typed `DELETE` confirmation
- a `Remove error instances` shortcut that targets only rows whose current connection status is `Error`

This task does not include product development yet. It restores the missing spec-driven planning
artifacts so implementation can begin cleanly later on branch `dev`.

### agent

Confirmed task file: `.agentkanban/tasks/task_013_instance_bulk_delete_and_error_cleanup.md`.

Implementation completed for the instance bulk delete, error cleanup, and overview card navigation.

**What changed:**

**InstancesTab.tsx** (bulk delete + error cleanup):
- Added checkbox selection column in table view (select-all in header header via `Checkbox`)
- Added `Delete selected` bulk button that appears when rows are selected
- Added `Remove error instances` button that targets only rows with `Error` connection status
- Both actions open a destructive confirmation modal listing the affected instances
- Selection clears after deletion or refresh

**OverviewTab.tsx** (card navigation):
- Made all Overview metric cards clickable with `cursor: pointer` styling
- Instances card navigates to `/instances`, Tools card to `/tools`, Prompts card to `/prompts`
- Card styling: `onClick` handler + hover cursor pointer

**Validation completed:**
- `cd config-ui && npm run typecheck` — passed
- `cd config-ui && npm run lint` — passed (0 errors)
- `cd config-ui && npm test -- --run` — 192/192 tests passed
- `cd config-ui && npm run build` — production build successful

### user
