---
title: Refine instances card and table views
lane: done
created: 2026-06-20T13:14:35+07:00
updated: 2026-06-21T00:00:00+07:00
description: Refine the Config UI instances experience so operators can switch between card and table views, filter data more precisely, and manage larger instance lists without losing the current card-based workflow.
priority: medium
labels: [config-ui, instances, ux, sdd]
change: .agentkanban/changes/refine-instances-card-and-table-views
spec: .agentkanban/specs/instance-list-views/spec.md
---

## Conversation

### user

adjust task swith instance view position button table & card, make table is default view

### agent

Confirmed task file: `.agentkanban/tasks/task_002_refine_instances_card_and_table_views.md`.

Adjusted the planning contract for the instances view switch without starting new product
development.

What changed in the planning artifacts:

- updated the shared capability spec so `Table` is now the default desktop view
- added an explicit requirement that the `Card/Table` switch lives in the top action area
- aligned the change proposal and design notes with the new default-view and control-placement
  decision

Decision now locked for future implementation work:

- desktop default: `Table`
- narrow-screen fallback: `Card`
- switch position: top action area, not below the search and filter stack

### user

now create dev task refine UI instance into have 2 view card & table every coloumn have search
use related skills, enhance this prompt ask me comprehensive question

### agent

Confirmed task file: `.agentkanban/tasks/task_002_refine_instances_card_and_table_views.md`.

This task captures the requested Config UI refinement as a spec-driven backlog item for the
instances screen in `config-ui/src/components/tabs/InstancesTab.tsx`.

Intake summary captured for implementation:

- add two operator-facing views for instances: `Card` and `Table`
- keep cards as the default desktop presentation and persist the chosen desktop view in local storage
- automatically fall back to cards on narrow screens without overwriting the desktop preference
- preserve the current global search, tag chips, status actions, import/export, test-all, refresh, and add-instance flows
- add column-aware filtering in the table view so each data column has its own search or typed filter control
- support sorting on each data column except actions
- keep filtering behavior AND-combined across global search, selected tags, and table column filters

Implementation decisions already clarified with the user:

- table columns: Name, URL, Database, Authentication, Version, Tags, Tools, Status, Actions
- filters on all data columns; no filtering for Actions
- sortable headers on all data columns; no sort on Actions
- no pagination for now
- keep shared global search and tag chips in both views
- add active-filter count, removable filter chips, and clear-all behavior
- use text filters for Name, URL, Database, and Tags
- use select filters for Authentication, Version, and Status
- use a compact semantic filter for Tools

Context:

- current UI implementation: `config-ui/src/components/tabs/InstancesTab.tsx`
- existing tests: `config-ui/src/__tests__/instances-tab.test.tsx`
- shared instance shape: `config-ui/src/types.ts`
- existing simple table pattern to reuse where helpful: `config-ui/src/components/tabs/PromptsTab.tsx`

Scope hints:

- preserve the existing visual language from the current instances screen rather than redesigning the product
- use native React/Tailwind patterns already present in the repo; do not add a new table dependency
- include responsive and accessibility behavior in scope because the new controls change interaction patterns
- docs are only needed if the UX contract or contributor workflow meaningfully changes

Open questions:

- none blocking for the first implementation pass; the captured choices are sufficient to start

### agent

Confirmed task file: `.agentkanban/tasks/task_002_refine_instances_card_and_table_views.md`.

The spec, proposal, design, and implementation checklist for this refinement have been created and
linked in frontmatter. The task remains in `backlog` so the implementation can begin cleanly when
you want this work moved into `in-progress`.

### user

start comprehensive

### agent

Confirmed task file: `.agentkanban/tasks/task_002_refine_instances_card_and_table_views.md`.

Implementation has started and the task is now in `in-progress`.

Execution focus for this pass:

- add shared row normalization, filtering, and sorting so card and table views stay aligned
- introduce a persisted desktop `Card/Table` toggle with automatic narrow-screen card fallback
- implement per-column filters, active-filter visibility, and sortable table headers
- preserve the existing card workflow, actions, and empty-state behavior
- expand tests and run the Config UI validation suite before considering `done`

### user

### agent

Confirmed task file: `.agentkanban/tasks/task_002_refine_instances_card_and_table_views.md`.

The instances refinement has been implemented and verified, and the task is moving to `done`.

Completed behavior:

- added persisted desktop `Card/Table` view selection with automatic narrow-screen card fallback
- introduced shared row normalization so cards and table use the same global search, tag filtering, and result counts
- added table columns for Name, URL, Database, Authentication, Version, Tags, Tools, Status, and Actions
- added typed per-column filters and sortable data headers for all non-action columns
- added active-filter count, removable filter chips, and clear-all behavior
- preserved existing card actions, status badges, import/export, refresh, test-all, and add-instance flows

Verification completed:

- `cd config-ui && npm run lint`
- `cd config-ui && npm run typecheck`
- `cd config-ui && npm test -- --run`
- `cd config-ui && npm run build`

Notes:

- the UI build refreshed embedded assets under `rust-mcp/static/dist/`
- Vitest emitted unrelated local certificate warnings from the environment, but the suite passed

### user
