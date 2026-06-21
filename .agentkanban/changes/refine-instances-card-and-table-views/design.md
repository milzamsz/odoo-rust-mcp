# Design: Refine Instances Card and Table Views

## Current state

`config-ui/src/components/tabs/InstancesTab.tsx` already provides:

- global search across key instance fields
- tag chip filtering
- status badges
- instance cards with test, edit, and delete actions
- page-level actions for import, export, test-all, refresh, and add-instance

The main gap is density and precision. The cards are readable, but operators cannot quickly compare
many rows or filter individual fields independently.

## Chosen approach

### 1. Keep one data pipeline, two renderers

The list should derive from one normalized set of row metadata and one shared filter/sort pipeline.
That avoids drift where card view and table view start behaving differently.

Recommended implementation shape:

- normalize instance data into row objects with display and filter-friendly values
- apply global search and tag filtering first
- apply column filters next with AND semantics
- apply sorting last
- render either cards or a semantic table from the same processed rows

### 2. Preserve the current card workflow

Cards should not become a second-class fallback. They remain the default desktop view and the
mandatory narrow-screen rendering. The current visual hierarchy should stay intact so the refinement
feels like an extension of the existing screen, not a redesign.

### 3. Use typed filters that match the data

The table should not use one generic text box for every field. Matching control type to data keeps
the screen faster to scan and lowers filter mistakes:

- text inputs for Name, URL, Database, and Tags
- selects for Authentication, Version, and Status
- a compact semantic filter for Tools, such as enabled/partial/none or a threshold-based choice

### 4. Persist view preference defensively

Desktop view preference should be stored in local storage and restored on mount. Invalid or missing
values should gracefully fall back to `card`.

Responsive behavior should compute an effective view:

- desktop: use persisted preference
- narrow screen: force effective `card`

The stored preference should remain untouched when the layout auto-falls back to cards.

## Testing strategy

Update `config-ui/src/__tests__/instances-tab.test.tsx` to cover:

- card/table toggle behavior
- persisted preference restore and fallback
- narrow-screen effective card rendering
- combined filter behavior across global search, tags, and columns
- sorting by representative column types
- unchanged availability of instance actions

## Risks and mitigations

- Risk: duplicated filter logic across views causes inconsistent results.
  Mitigation: centralize normalization, filtering, and sorting helpers.
- Risk: the table introduces a cramped or inaccessible control strip.
  Mitigation: use compact typed controls, visible labels, and the repo's existing responsive layout patterns.
- Risk: local storage or viewport logic causes hydration-like state glitches in tests.
  Mitigation: isolate preference and media-query behavior behind simple helpers that are easy to test.
