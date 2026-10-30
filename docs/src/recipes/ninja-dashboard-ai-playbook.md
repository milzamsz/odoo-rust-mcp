# Dashboard Ninja — AI agent playbook

Operating procedure for an LLM agent building Dashboard Ninja dashboards through
`odoo-rust-mcp`. Read `ninja-dashboard-model-reference.md` for the schema and
`ninja-dashboard-recipes.md` for the payloads; this file is the *order of operations* and the
*traps*.

## Phase 0 — Establish the environment

```
1. tools/list                                  → is the write toolset present?
2. odoo_check_access(item, "create")           → do I actually have rights?
3. odoo_check_access(board, "write")
4. odoo_search_read(ir.model, ...)             → resolve source models
5. odoo_search_read(ks_dashboard_ninja.board)  → read an existing board as a template
```

If step 1 shows 16 tools, stop and tell the operator to restart the server with
`ODOO_ENABLE_WRITE_TOOLS=true`. Do not attempt to work around it — the guard is intentional and
there is no CLI flag.

Never guess a credential or an instance name. `instance` is a configured label
(e.g. `erp-dev-hksis`), not a URL.

## Phase 1 — Choose the target and the source

Ask, in this order:

1. **Which business question?** → picks the model (`sale.order`, `account.move`, `stock.picking`, …)
2. **Which widget?** → picks `ks_dashboard_item_type` (see the type table)
3. **Which number?** → picks `ks_record_count_type` (+ `ks_record_field` when not `count`)
4. **Which breakdown?** → picks `ks_chart_relation_groupby` (+ `ks_chart_date_groupby` for time)
5. **Which slice?** → picks `ks_domain` and/or a board filter

**Validate the question against real data before you build anything.** Run the equivalent
`odoo_read_group` call. If it returns nothing, the widget will render empty and you have wasted the
write. This is the single highest-value step.

```jsonc
{ "instance": "erp-dev-hksis", "model": "sale.order",
  "domain": [["state","=","sale"]],
  "fields": ["amount_total:sum","__count"],
  "groupby": ["date_order:month"], "limit": 6, "orderby": "date_order:month" }
```

## Phase 2 — Resolve IDs

Every relational picker needs an `ir.model` or `ir.model.fields` id from *this* database. Batch
them:

```jsonc
{ "instance": "erp-dev-hksis", "model": "ir.model.fields",
  "domain": [["model","=","sale.order"],
             ["name","in",["name","date_order","state","amount_total","partner_id"]]],
  "fields": ["id","name","field_description","ttype","store","relation"], "limit": 50 }
```

Then **filter in Python against the picker's constraint table** (model-reference §5) before using
them. Two failure modes that do not raise an error but render an empty widget:

- a **non-stored** field used as a groupby (e.g. `sale.order.state2`, `store=false`);
- a **char/selection** field passed to `ks_chart_measure_field` or `ks_list_view_group_fields`,
  which accept only integer/float/monetary.

## Phase 3 — Build

Order matters. Items first, then the grid, then the board metadata — because
`ks_gridstack_config` is keyed by item id.

```
1. odoo_create(ks_dashboard_ninja.board, {name, ks_dashboard_menu_name,
                                          ks_dashboard_top_menu_id, ...})   → BOARD_ID
2. odoo_create(ks_dashboard_ninja.item, {...})  → ITEM_ID, one call per item,
                                          with ALL x2many values in the payload
3. odoo_update(ks_dashboard_ninja.board, [BOARD_ID],
               {ks_gridstack_config: "{ITEM_ID: {x,y,w,h}, ...}"})
4. odoo_update(ks_dashboard_ninja.board, [BOARD_ID], {ks_date_filter_selection: ...})  # optional
```

Do **not** set `ks_dashboard_default_template` to 2/3/4 — those pre-copy 7 demo items
(`res.country` based) into your board. Use template `1` (Blank).

> **The x2many rule.** `ks_chart_measure_field`, `ks_chart_measure_field_2`,
> `ks_list_view_fields` and `ks_list_view_group_fields` are `many2many`. Put them in the **create**
> payload — `odoo_create` and `odoo_create_batch` both persist them correctly. `odoo_update`
> silently drops x2many values, so there is no "fix it afterwards" step. See
> `mcp-x2many-quirks.md`.
>
> Creating items one at a time with `odoo_create` is the safer default: a batch tells you only the
> ids, and the read-back that would confirm the payload is itself unreliable in bulk (defect 2).

## Phase 4 — Verify

Self-reported success from a create call is not evidence. Re-read:

```
1. odoo_read(board, [BOARD_ID], [ks_dashboard_menu_id, ks_dashboard_client_action_id,
                                 ks_gridstack_config, ks_dashboard_active])
2. for each ITEM_ID (ONE id per call — see defect 2):
     odoo_read(ks_dashboard_ninja.item, [ITEM_ID],
               [name, ks_dashboard_item_type, ks_record_count, ks_chart_measure_field,
                ks_list_view_fields, ks_chart_data, ks_list_view_data])
3. odoo_read(ir.ui.menu, [menu_id], [name, action, groups_id, active])
```

**Assert on content, never on truthiness.** `ks_chart_data` / `ks_list_view_data` are computed JSON
strings that stay *truthy* when the widget failed:

```json
{"labels": [], "datasets": [], "ks_currency": 0, "ks_field": "", "domains": []}
```

So check the payload, not the value:

| Widget | Passes when |
| --- | --- |
| tile / KPI | `ks_record_count` is non-zero |
| chart | `labels` and `datasets` are both non-empty |
| list view | `data_rows` is non-empty |

An empty result means a bad groupby/measure field or a domain matching nothing — not a bad payload.

Cross-check the numbers against the Phase 1 aggregation (`odoo_count` / `odoo_read_group`). The
computed value is only evidence that *something* resolved; matching the independent aggregate is
evidence that it resolved *correctly*.

Do **not** "sweep orphans" with `ks_dashboard_ninja_board_id = false`: those are the module's
built-in template items, not leftovers from your run. To find your own items, filter by the board
id you created.

Finally, open the board in the UI. Grid coordinates and chart rendering are only truly verified
visually; say so rather than claiming a rendered dashboard.

## Phase 5 — Roll back or hand off

- Hide: `odoo_update(board, [id], {"ks_dashboard_active": false})` — a scalar, so it works.
- Delete: `odoo_delete(board, [id])` — cascades to the menu, client action, child boards and items.
- The default "My Dashboard" board cannot be deleted (model constraint) — do not try.
- **Check whether delete exists before you build anything.** `odoo_delete` is frequently disabled
  per instance (`toolConfig.disabledTools`), and the fallbacks are also closed: `odoo_execute`
  runs against a **method allowlist** (`unlink` and `write` are rejected with
  `Method 'unlink' … is not allowlisted`), and the cleanup tools need their own env gate. On
  `erp-dev-hksis` all three are unavailable, so a record created there can only be removed in the
  Odoo UI. If there is no delete path, either do not create throwaway data, or get sign-off for the
  manual cleanup first.

## Safety gates

| Gate | Rule |
| --- | --- |
| Production | Never create/update/delete on a `-prod` instance without explicit human sign-off |
| Blast radius | State the exact record count before any `odoo_update`/`odoo_delete` |
| Cleanup tools | `odoo_database_cleanup` / `odoo_deep_cleanup` — always `dryRun: true` first, never without sign-off |
| Credentials | Never request, echo, or infer them; `instance` labels only |
| Deletion residue | If `odoo_delete` is disabled for the instance, do not create throwaway test records — you cannot remove them |

## Failure modes

| Symptom | Cause | Fix |
| --- | --- | --- |
| Item created, renders nowhere | no entry in `ks_gridstack_config` | add the grid cell |
| `Invalid response: Missing required argument 'operation' (map)` | `odoo_check_access` needs `operation` | pass `"read"`/`"write"`/`"create"`/`"unlink"` |
| Create fails on `ks_dashboard_item_type` / `ks_layout` / `ks_list_view_type` / `ks_date_filter_selection` / `ks_date_filter_selection_2` | these five are **required** | always send them |
| Widget shows 0 | domain matches nothing, or the date filter excludes everything | re-run the `odoo_read_group` check |
| Chart empty, no error | non-stored groupby, or non-numeric measure field | pick a stored / numeric field |
| Chart/list empty although the payload set the measure or column fields | **defect 1**: `odoo_update` dropped the x2many — or **defect 2** made the read-back report `[]` | set x2many at create; read one id at a time (`mcp-x2many-quirks.md`) |
| `odoo_update` returns `success: true` but nothing changed | the value is x2many — the server silently ignores it | recreate the record with the value; x2many cannot be updated |
| Several items report empty measure/column fields, one does not | **defect 2**: a multi-id read attributes the x2many to the last record only | read each id in its own call |
| `Method 'unlink' … is not allowlisted` | `odoo_execute` is allowlist-gated | use `odoo_delete` (if enabled) or clean up in the UI |
| `ks_domain` rejected | sent as a JSON array instead of a Python-literal **string** | `"[[\"state\",\"=\",\"sale\"]]"` |
| Board visible but menu missing | `ks_dashboard_top_menu_id` or `ks_dashboard_menu_name` omitted | both are needed for auto menu creation |
| Duplicate widget names | `name` is translatable, not unique | give each item a distinct name |
| `favourite_filters` create fails | `name` is globally unique | namespace the label |
| `odoo_copy` rejected or copies nothing | used the `odoo_update` shape (`ids` + `values`) | `odoo_copy` takes singular `id` + `default` |

## Instance-specific notes (`erp-dev-hksis`)

- `sale.order.state` has **custom** values beyond Odoo standard: `draft`, `confirm`, `hod`,
  `sale`, `cancel`. There is **no `sent`** state. A domain of `state in ["draft","sent"]` returns
  the `draft` count only (23 at time of writing). Confirm states per instance with
  `odoo_read_group(groupby=["state"])`.
- `sale.order.state2` exists and looks like a status field but is **`store=false`** — unusable as a
  groupby.
- `operating_unit_id` is used by the existing boards to partition data (`not in [4]`). Reuse that
  convention rather than inventing a new one.
- **Delete is unavailable here, verified live.** `odoo_delete` is in `disabledTools` for this
  instance and returns `Tool 'odoo_delete' is disabled for instance 'erp-dev-hksis'`. The
  fallbacks are closed too: `odoo_execute` rejects `unlink` and `write` (`not allowlisted`), and
  the cleanup tools are disabled. A record created here can only be removed in the Odoo UI, so do
  not create throwaway data without agreeing the manual cleanup first.
- Item ids created during the build exercise are listed in `discovery/erp-dev-hksis.md` for that
  cleanup.
- `ks_dashboard_ninja_board_id = false` on 28 items is the module's built-in template library, not
  orphaned data. Do not delete it.
