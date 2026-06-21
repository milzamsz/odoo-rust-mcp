---
title: De-bold UI text and soften code identifiers
lane: done
created: 2026-06-20T22:10:00+07:00
updated: 2026-06-20T22:55:00+07:00
description: Remove heavy bold weights across the Config UI and replace monospace "code" identifiers (prompt/model/tool names) with subtle sans-serif chips, while keeping page/section headings legible.
priority: medium
labels: [config-ui, mantine, typography]
---

## Description

User dislikes the heavy bold weights and the monospace "code" look in the Config UI
(flagged on the Prompts table: bold `Name` / `Description` / `Content preview` headers plus
monospace bold identifiers like `odoo_common_models`). De-bold the UI and turn identifiers
into gentle chips for a flatter, calmer typography.

## Context

- Mantine UI app (no Tailwind). Theme: `config-ui/src/theme.ts`. Global CSS: `config-ui/src/index.css`.
- Bold table headers come from Mantine `Table.Th` default weight.
- Monospace identifiers rendered via `<Text ff="monospace" fw={…}>` and `<Code>`.

## Decisions (already clarified with user)

- De-bold all bold text, BUT keep headings (`Title` h1–h4) at weight 600.
- Table headers: lighter, muted, quiet label (not heavy black).
- Inline body labels (`fw={600}` / `fw={700}` `Text` nodes): normal weight 400 — rely on color/spacing for hierarchy.
- Identifiers (prompt/model/tool names): subtle chip — soft pill, sans-serif, no bold (NOT monospace).
- Scope: global (all tables + all identifiers). Exclude SecurityTab `<Code block>` env snippet (genuine code, keep monospace).

## Scope / implementation hints

1. **Quiet table headers** — `config-ui/src/theme.ts`, add `components.Table.styles.th`:
   `fontWeight: 500`, `color: var(--app-text-muted)`, `fontSize: var(--mantine-font-size-sm)`.
   Covers PromptsTab + InstancesTab tables; no per-`Table.Th` edits.

2. **New `config-ui/src/components/NameChip.tsx`** — sans-serif inline-block pill:
   soft bg `var(--app-panel-muted)`, `1px solid var(--app-border)`, radius 6, `fontSize 0.8125rem`,
   `fontWeight 500`, padding `1px 8px`. Replace monospace-identifier sites:
   - `PromptsTab.tsx:165`
   - `InstancesTab.tsx:418, 748`
   - `ToolDetail.tsx:30`
   - `InstanceForm.tsx:426, 461` (`<Code>` → `NameChip`; drop now-unused `Code` import — verify first).

3. **De-bold inline body labels** (remove `fw={600}` / `fw={700}` → default 400):
   `AppShellLayout.tsx:228,378`, `InstanceForm.tsx:324,330,383`, `RuntimeEnvSnapshotCard.tsx:133,144`,
   `SecurityTab.tsx:182,207`, `ToolsTab.tsx:244,277`, `InstancesTab.tsx:831`.
   Soften eyebrow `InstancesTab.tsx:828` `fw={700}` → `fw={600}` (stays uppercase muted label).
   Leave all `Title` components and `SecurityTab.tsx:209` `<Code block>` untouched.

## Verification

- `cd config-ui && npm run typecheck && npm run lint && npm test` — clean; no unused-import errors;
  existing tests pass (none assert font weight).
- `npm run dev` + preview (login admin/changeme, backend on 3008): screenshot **Prompts** and
  **Instances (table view)** — headers quiet/muted, names render as soft sans chips (no monospace),
  inline labels no longer bold.
- Toggle dark mode — confirm chip bg/border + muted headers read correctly on dark surfaces.
- Open Add Instance + Tool detail — tool-name chips consistent; SecurityTab token `<Code block>` still looks like code.

## Conversation

### user

Implement Plan

### agent

Implemented and validated.

What changed:

- added quiet table headers globally via `theme.ts` `components.Table.styles.th` (weight 500, muted, sm)
- added `config-ui/src/components/NameChip.tsx` — sans-serif soft pill (no monospace)
- replaced all monospace identifiers with `NameChip`: PromptsTab, InstancesTab (×2), ToolDetail, InstanceForm (×2, dropped unused `Code` import)
- de-bolded inline body labels (`fw={600}`/`fw={700}` → default 400): AppShellLayout (×2), InstanceForm (×3), RuntimeEnvSnapshotCard (×2), SecurityTab (×2), ToolsTab (×2)
- softened the InstancesTab MetaBlock eyebrow `fw={700}` → `fw={600}`
- left all `Title` headings at weight 600 and the SecurityTab `<Code block>` env snippet untouched

Validation:

- `npm run typecheck` + `npm run lint` clean
- `npm test` — 189 tests pass
- live preview (light + dark), Prompts table: headers weight 500 muted (`rgb(111,111,104)`), names render as sans chips weight 500 (light bg `rgb(249,249,246)` / dark `rgb(38,38,45)`), inline labels no longer bold
