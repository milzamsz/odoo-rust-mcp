# Dashboard Ninja — discovery evidence

Reconnaissance of the live `erp-dev-hksis` instance and the `ks_dashboard_ninja` module source,
recorded so the recipes in `../` are traceable.

Sections 1–3 are read-only reconnaissance. Sections 4–6 record a **real board built over MCP** and
the two MCP defects found while building it.

## 1. Environment

| Item | Value |
| --- | --- |
| MCP server | `odoo-rust-mcp` 0.6.5, HTTP transport `http://127.0.0.1:8787/mcp` |
| Protocol | `2025-11-05`, session-less POST, no bearer token (`MCP_AUTH_ENABLED=false`) |
| Instance | `erp-dev-hksis` — `http://hksis-dev.matrica.co.id`, db `hksis_dev`, Odoo 18, **enterprise** |
| Auth mode | JSON-RPC username/password (Odoo < 19) |
| Module | `ks_dashboard_ninja` v18.0.1.0.1, license OPL-1, installed |
| Nature | **client SIT environment**, not a scratch database — writes here need a cleanup plan |

## 2. Tool inventory and write gating

`tools/list` on the running server (port 8787) → **16 tools, all read-only**:

```
odoo_search  odoo_search_read  odoo_read  odoo_count  odoo_read_group
odoo_name_search  odoo_name_get  odoo_get_model_metadata  odoo_list_models
odoo_check_access  odoo_default_get  odoo_onchange  odoo_generate_report
odoo_refresh_capabilities  odoo_stock_inventory_reversal_cleanup
odoo_execute_capability
```

`tools/list` after restarting the server with `ODOO_ENABLE_WRITE_TOOLS=true
ODOO_ENABLE_EXECUTE_TOOL=true` → **23 tools**, adding:

```
odoo_create  odoo_create_batch  odoo_update  odoo_delete  odoo_copy
odoo_workflow_action  odoo_execute
```

Gates, from `rust-mcp/config/tools.json`:

| Env var | Tools |
| --- | --- |
| `ODOO_ENABLE_WRITE_TOOLS` | `odoo_create`, `odoo_create_batch`, `odoo_update`, `odoo_delete`, `odoo_copy`, `odoo_workflow_action` |
| `ODOO_ENABLE_EXECUTE_TOOL` | `odoo_execute` |
| `ODOO_ENABLE_WRITE_TOOLS` + `ODOO_ENABLE_CLEANUP_TOOLS` | `odoo_database_cleanup`, `odoo_deep_cleanup`, `odoo_stock_inventory_reversal_cleanup` |
| `ODOO_CAPABILITY_CONTROLLED_MODE` | `odoo_execute_capability` |

`odoo-rust-mcp-desktop-server --help` exposes only `--enable-cleanup-tools`; there is **no write
flag** — write access is env-only, and the vars must be on the process that binds the port. The
desktop app spawns its server as a **sidecar**; restarting the app does not restart that sidecar, so
restarting the UI alone will not pick up the env vars.

### Closed cleanup paths on this instance (verified)

| Path | Result |
| --- | --- |
| `odoo_delete` | `Tool 'odoo_delete' is disabled for instance 'erp-dev-hksis'` (per-instance `toolConfig.disabledTools`) |
| `odoo_execute` + `unlink` | `Method 'unlink' on model 'ks_dashboard_ninja.item' is not allowlisted` |
| `odoo_execute` + `write` | `Method 'write' … is not allowlisted` |
| `odoo_database_cleanup` / `odoo_deep_cleanup` | in `disabledTools` |

There is **no MCP path to delete a record** on this instance. Records created during the build
exercise are listed in §6 for manual UI cleanup.

## 3. Data volume

| Metric | Value |
| --- | --- |
| `ks_dashboard_ninja.board` records | 25 (24 pre-existing + the demo board in §5) |
| `ks_dashboard_ninja.item` records | 244 (225 pre-existing + 19 from the build exercise) |
| items with `ks_dashboard_ninja_board_id = false` | 32 (28 pre-existing **template/library** items + 4 probe items) |

`ks_dashboard_ninja_board_id = false` is **not** an orphan state: the module stores its built-in
template item library that way ("Tile (layout 1)" … "Kpi (previous)", "list view (grouped)").
Do not treat those 28 records as leftover data.

Item type distribution, pre-existing data:

| Type | Count |
| --- | --- |
| `ks_tile` | 77 |
| `ks_list_view` | 34 |
| `ks_pie_chart` | 34 |
| `ks_bar_chart` | 27 |
| `ks_horizontalBar_chart` | 24 |
| `ks_kpi` | 9 |
| `ks_doughnut_chart` | 6 |
| `ks_line_chart` | 6 |
| `ks_area_chart` | 4 |
| `ks_map_view` | 1 |
| `ks_polarArea_chart` | 1 |

Source models in use (top): `res.country` 31 (demo), `esop.file` 21, `sale.order` 16,
`maintenance.equipment` 15, `hr.employee` 13, `res.partner` 13, `account.move` 11,
`account.move.line` 10, `brt.tiket` 10, `mrp.production` 9.

Boards (24 pre-existing): My Dashboard, Readymix, Equipment, AKMR, Human Capital, Procurement, VMS,
Precast, Testing, Dashboard E-SOP, Dashboard, Dashboard, Equipment, Monitoring Input Data - Golive,
Dashboard Attendance, Eproc, Monitoring Pilot Project, PENERIMAAN, General Affair, Asset Data,
Asset Transfer, Maintenance Request, Purchase, Testing Dashboard.

## 4. Two silent MCP defects

Full detail and reproductions: [`../mcp-x2many-quirks.md`](../mcp-x2many-quirks.md).

| # | Defect | Evidence |
| --- | --- | --- |
| 1 | `odoo_update` silently ignores **x2many** values; returns `success: true` | on record 332, `ks_chart_measure_field` stayed `[10506]` under `[[6,0,[10504]]]`, `[[4,10505]]` and `[10505]`; `ks_sort_by_field` (many2one) applied immediately on the same record |
| 2 | a multi-id read returns an x2many value only for the **last** record | `ids=[330,331,332]` → `[[], [], [10506]]`; `ids=[332,331,330]` → `[[10506], [], []]`; single-id reads show all three hold `[10506]` |

Both are silent, so the natural recovery move — "the item looks wrong, patch it with
`odoo_update`" — is a no-op, and the read-back that would have exposed the mistake is itself
unreliable in bulk. Together they make a **correct** build look broken.

Consequence for build order: every x2many value must be present in the **create** payload
(`odoo_create` and `odoo_create_batch` persist them correctly), and verification must read one id
per call and assert on content.

## 5. The demo board that was built

Board **26 "AI Demo Ops"** on `erp-dev-hksis`: menu `2128` (`Dashboard/AI Demo Ops`, sequence 90),
client action `3423`, 6 grid cells.

| Item | Type | Configuration | Verified computed value | Independent cross-check |
| --- | --- | --- | --- | --- |
| 334 Open Orders | `ks_tile` | count, `state in [draft,confirm,hod]` | `32.0` | `odoo_count` = 32 |
| 335 Confirmed Revenue | `ks_tile` | sum `amount_total`, `state = sale` | `2 715 658 350 476.34` | `odoo_read_group` sum = same |
| 336 Sales per Month | `ks_bar_chart` | `date_order:month`, sum `amount_total` | 7 labels / 1 dataset | matches `read_group` bucket-for-bucket |
| 337 Orders by Status | `ks_pie_chart` | groupby `state`, count | 5 labels / 1 dataset, total 172 | `read_group` groupby `state` |
| 338 Orders by Status (grouped) | `ks_list_view` | grouped by `state`, columns name/customer/total | 5 `data_rows` | — |
| 339 Avg Order Value | `ks_kpi` | average `amount_total`, `state = sale` | `21 051 615 119.97` | `odoo_read_group` avg = same |

Bar buckets (chart vs `read_group`, identical):

```
Januari 2026   2 128 887 051 966.8     Mei 2026      67 565 700.0
Februari 2026    270 543 608 881.14    Juni 2026    306 343 904 480.0
Maret 2026         7 324 149 890.3     Juli 2026     25 419 555.0
April 2026         2 466 650 003.1
```

The grouped list view is the one non-obvious case: with `ks_list_view_type = "grouped"` the widget
needs **both** `ks_list_view_fields` **and** `ks_chart_relation_groupby`. Without the groupby the
compute returns `False` and the widget renders empty with no error.

## 6. Records created — manual cleanup list

`odoo_delete` is unavailable (§2), so these must be removed in the Odoo UI. Every id below was
read back live, not recalled.

| Ids | Board | What | Action |
| --- | --- | --- | --- |
| 319–323 | 26 | first build attempt (2 tiles, bar, pie, list) | delete |
| 324–329 | 26 | probe / experiment items | delete |
| 330–333 | `false` | probe items created with no board | delete |
| 334–339 | 26 | the 6 items of the finished demo board | **keep** |
| 340 | `false` | m2m-drop verification record (§4) | delete |
| 26 | — | board "AI Demo Ops" + menu 2128 + action 3423 | keep, or delete to remove the demo entirely |

Only 334–339 appear in board 26's `ks_gridstack_config`; the rest are attached to the board but
have no grid cell, so they never render on it. Deleting the board cascades to its menu, client
action and all its items.

## 7. Verified ids on `erp-dev-hksis`

| Thing | id |
| --- | --- |
| `ir.model` `sale.order` | 688 |
| `ir.model` `account.move` | 593 |
| `ir.model` `res.partner` | 87 |
| `ir.model` `ks_dashboard_ninja.board` | 2460 |
| `ir.model` `ks_dashboard_ninja.item` | 2461 |
| `ir.ui.menu` root "Dashboard" | 1196 |
| `board_template` Blank / Template 1 / 2 / 3 | 1 / 2 / 3 / 4 (1 has 0 items, the others 7) |
| `res.currency` IDR | 12 |
| `sale.order.name` | 10473 |
| `sale.order.partner_id` | 10475 |
| `sale.order.state` | 10476 |
| `sale.order.create_date` | 10480 |
| `sale.order.date_order` | 10482 |
| `sale.order.currency_id` | 10499 |
| `sale.order.amount_total` | 10506 |
| `sale.order.amount_untaxed` | 10504 |
| `sale.order.amount_tax` | 10505 |
| `sale.order.operating_unit_id` | 45854 |
| `sale.order.state2` | 47376 (`store = false` — unusable as a groupby) |

`odoo_default_get` on `ks_dashboard_ninja.item`:

```json
{"ks_dashboard_item_type": "ks_tile", "ks_layout": "layout5",
 "ks_list_view_type": "ungrouped", "ks_date_filter_selection": "l_none",
 "ks_data_calculation_type": "custom", "ks_dashboard_item_theme": "white",
 "ks_record_count_type": "count", "ks_default_icon": "bar-chart"}
```

Required fields (from live metadata, 167 fields total):
`ks_dashboard_item_type`, `ks_date_filter_selection`, `ks_date_filter_selection_2`, `ks_layout`,
`ks_list_view_type`.

Finding: `sale.order.state` on this instance carries **custom** values — `draft`, `confirm`, `hod`,
`sale`, `cancel` — and has **no `sent`** state. State values must be confirmed per instance with
`odoo_read_group(groupby=["state"])`.

## 8. Source-of-truth references

- Module source: `ks_dashboard_ninja/` (manifest, `models/`, `security/ir.model.access.csv`,
  `wizard/`, `data/`).
- Board creation side effects: `models/ks_dashboard_ninja.py` → `create()` creates
  `ir.actions.client` + `ir.ui.menu`; `unlink()` cascades.
- Chart compute: `models/ks_dashboard_ninja_items.py` → `ks_get_chart_data` (line 2261) and
  `ks_list_view_data` (line 2908); the list-view compute requires
  `ks_list_view_type == 'ks_list_view' and ks_model_id` and, when grouped,
  `ks_list_view_group_fields and ks_chart_relation_groupby`.
- Grid format: `ks_gridstack_config` on board 2 — `{"29": {"x":0,"y":3,"w":6,"h":7}, ...}`.
- Wizard: `wizard/ks_create_dashboard_wiz.py` (`ks.dashboard.wizard.ks_create_record`).
