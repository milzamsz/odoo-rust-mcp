# Migration Plan

## 1. Objective

Introduce Enterprise Packs without breaking existing generic tools or current
Config UI users.

## 2. Migration principles

- move before rewrite;
- preserve current behavior behind compatibility mode;
- add metadata before changing execution;
- add policy in audit-only mode before enforcement;
- migrate one domain pack at a time;
- verify tool counts and contracts after every step.

## 3. Phases

### Phase 0: Baseline freeze

- record current tool list;
- record input schemas;
- record output behavior;
- record protocol versions;
- capture integration tests;
- document current security guards.

### Phase 1: Registry metadata

- extend ToolDef;
- keep existing config format compatible;
- add pack ID `core-legacy` to current tools;
- add output schema gradually;
- add registry revision.

### Phase 2: Capability Engine

- scan identity and modules;
- add model metadata;
- expose reports without changing tool list;
- compare capability result with actual calls.

### Phase 3: Policy audit mode

- evaluate policies;
- log decisions;
- do not block except existing hard guards;
- tune false positives.

### Phase 4: Enforcement

- enforce generic destructive restrictions;
- add confirmation tokens;
- restrict arbitrary workflow actions;
- protect posted accounting and sensitive Employee data.

### Phase 5: Pilot pack

Recommended pilot: Manufacturing read and planning subset, or Sales read subset.

Do not pilot first with POS closing, website publication, or employee-sensitive
writes.

### Phase 6: Requested enterprise packs

Order:

1. Manufacturing query and planning;
2. Spreadsheet/Dashboard read and snapshot;
3. Website draft management;
4. Employee public directory;
5. POS reporting;
6. controlled Manufacturing commands;
7. Website publish;
8. POS command flows;
9. restricted Employee administration.

## 4. Compatibility mode

Configuration:

```yaml
compatibility:
  legacy_generic_tools: true
  legacy_output_text: true
  policy_mode: audit
```

Deprecation path:

1. legacy tool retained;
2. domain replacement documented;
3. warnings emitted;
4. removed from default production profile;
5. removal only in major release.

## 5. Data migration

New persisted data:

- capability snapshots;
- policy revisions;
- confirmation records;
- workflow manifests;
- audit events.

All stores require schema version and migration strategy.

## 6. Rollback

Rollback must support:

- disable all new packs;
- restore previous exposure profile;
- set policy to audit-only;
- stop workflow scheduling;
- preserve existing manifests and audit;
- continue legacy generic read tools.

Do not delete manifests during rollback.
