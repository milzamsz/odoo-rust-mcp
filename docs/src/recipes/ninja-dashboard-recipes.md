# Dashboard Ninja — recipes

Copy-paste MCP payloads. Every ID was read from the live `erp-dev-hksis` instance
(Odoo 18 EE). Replace `instance` and the `ir.model` / `ir.model.fields` IDs for another database.

## 0. Prerequisites

### 0.1 Make the write tools exist

A stock server is read-only (16 tools). Start it with the write gates:

```bash
# http transport (what the Hermes MCP entry points at)
ODOO_ENABLE_WRITE_TOOLS=true \
ODOO_ENABLE_EXECUTE_TOOL=true \
  odoo-rust-mcp-desktop-server --transport http --listen 127.0.0.1:8787 --config-server-port 3008
```

| Env var | Unlocks |
| --- | --- |
| `ODOO_ENABLE_WRITE_TOOLS=true` | `odoo_create`, `odoo_create_batch`, `odoo_update`, `odoo_delete`, `odoo_copy`, `odoo_workflow_action` |
| `ODOO_ENABLE_EXECUTE_TOOL=true` | `odoo_execute` (arbitrary model method) |
| `ODOO_ENABLE_CLEANUP_TOOLS=true` + write | `odoo_database_cleanup`, `odoo_deep_cleanup`, `odoo_stock_inventory_reversal_cleanup` |

Verified: `tools/list` returns **16** tools without the flags and **23** with
`ODOO_ENABLE_WRITE_TOOLS=true ODOO_ENABLE_EXECUTE_TOOL=true`.
There is **no CLI flag** for writes — it is env-only, even on the desktop binary.

Hermes config (`~/.hermes/profiles/<profile>/config.yaml`):

```yaml
mcp_servers:
  odoo-rust-mcp:
    url: http://127.0.0.1:8787/mcp
    enabled: true
```

### 0.2 Confirm access

```jsonc
{ "instance": "erp-dev-hksis", "model": "ks_dashboard_ninja.item", "operation": "create" }
{ "instance": "erp-dev-hksis", "model": "ks_dashboard_ninja.board", "operation": "write" }
```

### 0.3 Resolve the IDs you need (once per instance)

```jsonc
// ir.model for the source models
{ "instance": "erp-dev-hksis", "model": "ir.model",
  "domain": [["model", "in", ["sale.order","account.move","res.partner"]]],
  "fields": ["id","model","name"] }
```

Verified on `erp-dev-hksis`:

| Thing | id |
| --- | --- |
| `ir.model` `sale.order` | 688 |
| `ir.model` `account.move` | 593 |
| `ir.model` `res.partner` | 87 |
| `ir.model` `ks_dashboard_ninja.board` | 2460 |
| `ir.model` `ks_dashboard_ninja.item` | 2461 |
| Root menu "Dashboard" (`ir.ui.menu`) | 1196 |
| Template Blank / 1 / 2 / 3 | 1 / 2 / 3 / 4 |
| `sale.order` `name` | 10473 |
| `sale.order` `partner_id` | 10475 |
| `sale.order` `state` | 10476 |
| `sale.order` `create_date` | 10480 |
| `sale.order` `date_order` | 10482 |
| `sale.order` `currency_id` | 10499 |
| `sale.order` `amount_total` | 10506 |
| `sale.order` `operating_unit_id` | 45854 |

### 0.4 Dry-run the aggregation first

Never guess what a widget will show — run the same query with `odoo_read_group`:

```jsonc
{ "instance": "erp-dev-hksis", "model": "sale.order",
  "domain": [["state","=","sale"]],
  "fields": ["amount_total:sum","__count"], "groupby": ["date_order:month"] }
```

### 0.5 Tool payload shapes (they are not uniform)

These differ in ways that silently produce wrong calls — check before composing:

| Tool | Record selector | Payload key |
| --- | --- | --- |
| `odoo_read` | `ids: [int]` | `fields: [str]` |
| `odoo_update` | `ids: [int]` | `values: {obj}` |
| `odoo_delete` | `ids: [int]` | — |
| `odoo_create` | — | `values: {obj}` |
| `odoo_create_batch` | — | `values: [{obj}]` (array, max 100) |
| `odoo_copy` | **`id: int`** (singular) | **`default: {obj}`** |
| `odoo_search` | — | `domain: [..]`, `limit`, `offset`, `order` |
| `odoo_read_group` | — | `fields: [str]` (with `:sum`), `groupby: [str]` |

`odoo_copy` is the outlier: singular `id` + `default`, not `ids` + `values`.

`odoo_execute` takes `{model, method, args: [...], kwargs: {...}}` and runs against a **method
allowlist** per instance — `unlink` and `write` are rejected with
`Method 'unlink' … is not allowlisted`. It is not a general escape hatch around the write guards.

## 1. Create the board

`create()` on the board **auto-creates the `ir.actions.client` and the `ir.ui.menu`** when
`ks_dashboard_top_menu_id` and `ks_dashboard_menu_name` are both set. You do not need the wizard
for automation.

```jsonc
{
  "instance": "erp-dev-hksis",
  "model": "ks_dashboard_ninja.board",
  "values": {
    "name": "Readymix Ops",
    "ks_dashboard_menu_name": "Readymix Ops",
    "ks_dashboard_top_menu_id": 1196,
    "ks_dashboard_menu_sequence": 30,
    "ks_dashboard_active": true,
    "ks_date_filter_selection": "l_none",
    "ks_dashboard_default_template": 1
  }
}
```

→ returns the new board id. Read it back to confirm the menu and client action were created:

```jsonc
{ "instance": "erp-dev-hksis", "model": "ks_dashboard_ninja.board",
  "domain": [["id","=",<BOARD_ID>]],
  "fields": ["id","name","ks_dashboard_menu_id","ks_dashboard_client_action_id","ks_dashboard_top_menu_id"] }
```

`ks_dashboard_default_template: 1` is **Blank** (0 items). Templates 2/3/4 pre-copy 7 demo items —
avoid them for production boards.

## 2. Item recipes

All items share these keys:

```jsonc
"ks_dashboard_ninja_board_id": <BOARD_ID>,
"ks_model_id": 688,
"ks_date_filter_selection": "l_none",
"ks_date_filter_selection_2": "l_none",
"ks_layout": "layout5",
"ks_list_view_type": "ungrouped",
"ks_dashboard_item_theme": "white",
"ks_show_records": true
```

### 2.1 Tile — count of open orders

```jsonc
{
  "instance": "erp-dev-hksis", "model": "ks_dashboard_ninja.item",
  "values": {
    "name": "Open Orders",
    "ks_dashboard_ninja_board_id": <BOARD_ID>,
    "ks_model_id": 688,
    "ks_dashboard_item_type": "ks_tile",
    "ks_layout": "layout1",
    "ks_list_view_type": "ungrouped",
    "ks_date_filter_selection": "l_none",
    "ks_date_filter_selection_2": "l_none",
    "ks_record_count_type": "count",
    "ks_domain": "[[\"state\",\"in\",[\"draft\",\"sent\"]]]",
    "ks_default_icon": "shopping-cart",
    "ks_dashboard_item_theme": "blue",
    "ks_actions": false
  }
}
```

### 2.2 Tile — sum of a monetary field

`ks_record_count_type` ≠ `count` requires `ks_record_field`:

```jsonc
{
  "instance": "erp-dev-hksis", "model": "ks_dashboard_ninja.item",
  "values": {
    "name": "Confirmed Revenue",
    "ks_dashboard_ninja_board_id": <BOARD_ID>,
    "ks_model_id": 688,
    "ks_dashboard_item_type": "ks_tile",
    "ks_layout": "layout1",
    "ks_list_view_type": "ungrouped",
    "ks_date_filter_selection": "l_none",
    "ks_date_filter_selection_2": "l_none",
    "ks_record_count_type": "sum",
    "ks_record_field": 10506,
    "ks_currency_id": 12,
    "ks_unit": true, "ks_unit_selection": "monetary",
    "ks_domain": "[[\"state\",\"=\",\"sale\"]]"
  }
}
```

### 2.3 Bar chart — monthly sales

```jsonc
{
  "instance": "erp-dev-hksis", "model": "ks_dashboard_ninja.item",
  "values": {
    "name": "Sales per Month",
    "ks_dashboard_ninja_board_id": <BOARD_ID>,
    "ks_model_id": 688,
    "ks_dashboard_item_type": "ks_bar_chart",
    "ks_layout": "layout5",
    "ks_list_view_type": "ungrouped",
    "ks_date_filter_selection": "l_none",
    "ks_date_filter_selection_2": "l_none",
    "ks_chart_relation_groupby": 10482,
    "ks_chart_date_groupby": "month",
    "ks_chart_data_count_type": "sum",
    "ks_chart_measure_field": [[6, 0, [10506]]],
    "ks_chart_item_color": "material",
    "ks_show_data_value": true,
    "ks_sort_by_field": 10482,
    "ks_sort_by_order": "ASC",
    "ks_domain": "[[\"state\",\"=\",\"sale\"]]"
  }
}
```

Many2many syntax in a **create** payload: `[[6, 0, [ids]]]` replaces the set. It must be present at
create time — `odoo_update` silently ignores x2many values (defect 1 in `mcp-x2many-quirks.md`).

### 2.4 Pie chart — orders by status

```jsonc
{
  "instance": "erp-dev-hksis", "model": "ks_dashboard_ninja.item",
  "values": {
    "name": "Orders by Status",
    "ks_dashboard_ninja_board_id": <BOARD_ID>,
    "ks_model_id": 688,
    "ks_dashboard_item_type": "ks_pie_chart",
    "ks_layout": "layout5",
    "ks_list_view_type": "ungrouped",
    "ks_date_filter_selection": "l_none",
    "ks_date_filter_selection_2": "l_none",
    "ks_chart_relation_groupby": 10476,
    "ks_chart_data_count_type": "count",
    "ks_chart_item_color": "moonrise",
    "ks_show_data_value": true,
    "ks_hide_legend": false,
    "ks_domain": "[]"
  }
}
```

`ks_chart_relation_groupby` must be a **stored** field and not binary/m2m/o2m.
`sale.order.state` (10476) qualifies; `sale.order.state2` (47376) does **not** (`store=false`).

### 2.5 Line chart — two series over time

```jsonc
{
  "instance": "erp-dev-hksis", "model": "ks_dashboard_ninja.item",
  "values": {
    "name": "Order Trend",
    "ks_dashboard_ninja_board_id": <BOARD_ID>,
    "ks_model_id": 688,
    "ks_dashboard_item_type": "ks_line_chart",
    "ks_layout": "layout5",
    "ks_list_view_type": "ungrouped",
    "ks_date_filter_selection": "l_none",
    "ks_date_filter_selection_2": "l_none",
    "ks_chart_relation_groupby": 10482,
    "ks_chart_date_groupby": "month",
    "ks_chart_relation_sub_groupby": 10476,
    "ks_chart_data_count_type": "sum",
    "ks_chart_measure_field": [[6, 0, [10506]]],
    "ks_chart_measure_field_2": [[6, 0, [10506]]],
    "ks_record_data_limit": 24,
    "ks_fill_temporal": true
  }
}
```

### 2.6 KPI with target

```jsonc
{
  "instance": "erp-dev-hksis", "model": "ks_dashboard_ninja.item",
  "values": {
    "name": "Revenue vs Target",
    "ks_dashboard_ninja_board_id": <BOARD_ID>,
    "ks_model_id": 688,
    "ks_dashboard_item_type": "ks_kpi",
    "ks_kpi_type": "layout_1",
    "ks_target_view": "Progress Bar",
    "ks_goal_enable": true,
    "ks_standard_goal_value": 5000000000,
    "ks_layout": "layout1",
    "ks_list_view_type": "ungrouped",
    "ks_date_filter_selection": "t_month",
    "ks_date_filter_selection_2": "l_none",
    "ks_date_filter_field": 10482,
    "ks_record_count_type": "sum",
    "ks_record_field": 10506,
    "ks_currency_id": 12,
    "ks_data_comparison": "Percentage",
    "ks_previous_period": true,
    "ks_domain": "[[\"state\",\"=\",\"sale\"]]"
  }
}
```

For a per-date target curve, add lines on `ks_goal_lines`:
`"ks_goal_lines": [[0, 0, {"ks_goal_date": "2026-01-31", "ks_goal_value": 1000000000}]]`.

### 2.7 List view — grouped

```jsonc
{
  "instance": "erp-dev-hksis", "model": "ks_dashboard_ninja.item",
  "values": {
    "name": "Orders by Customer",
    "ks_dashboard_ninja_board_id": <BOARD_ID>,
    "ks_model_id": 688,
    "ks_dashboard_item_type": "ks_list_view",
    "ks_list_view_type": "grouped",
    "ks_list_view_fields": [[6, 0, [10473, 10475, 10476, 10506]]],
    "ks_list_view_group_fields": [[6, 0, [10506]]],
    "ks_list_view_layout": "layout_1",
    "ks_pagination_limit": 15,
    "ks_layout": "layout5",
    "ks_date_filter_selection": "l_none",
    "ks_date_filter_selection_2": "l_none",
    "ks_record_data_limit": 50,
    "ks_sort_by_field": 10506, "ks_sort_by_order": "DESC"
  }
}
```

`ks_list_view_group_fields` accepts **only** integer/float/monetary fields — grouping a list by a
char/selection field is done with `ks_list_view_type: "grouped"` + `ks_chart_relation_groupby`.

### 2.8 Map view

```jsonc
{
  "instance": "erp-dev-hksis", "model": "ks_dashboard_ninja.item",
  "values": {
    "name": "Customers Map",
    "ks_dashboard_ninja_board_id": <BOARD_ID>,
    "ks_model_id": 87,
    "ks_dashboard_item_type": "ks_map_view",
    "ks_map_chart_relation_groupby": <FIELD_ID_OF_country_id>,
    "ks_map_record_field": <FIELD_ID_OF_country_id>,
    "ks_country_id": <res.country id>,
    "ks_layout": "layout5",
    "ks_list_view_type": "ungrouped",
    "ks_date_filter_selection": "l_none",
    "ks_date_filter_selection_2": "l_none"
  }
}
```

### 2.9 Move / duplicate items between boards

`odoo_copy` takes a **single** `id` plus a `default` override object — note this differs from
`odoo_update`, which takes an `ids` array and `values`:

```jsonc
{ "instance": "erp-dev-hksis", "model": "ks_dashboard_ninja.item",
  "id": <ITEM_ID>, "default": { "ks_dashboard_ninja_board_id": <TARGET_BOARD_ID> } }
```

Remember to add a grid cell for the copy on the target board.

> **Note:** the module also ships a `ks_ninja_dashboard.item_action` TransientModel
> (`ks_action` = `move`/`duplicate`) that does this in one shot, but it is a UI helper — using it
> over MCP needs a transient `create` followed by `action_item_move_copy_action` through
> `odoo_execute`, which is both env-gated and method-allowlisted. Two `odoo_copy` calls are smaller
> and ungated.

## 3. Lay out the grid

`ks_gridstack_config` is a JSON **string**, 12 columns wide. Update the board after the items exist:

```jsonc
{
  "instance": "erp-dev-hksis",
  "model": "ks_dashboard_ninja.board",
  "ids": [<BOARD_ID>],
  "values": {
    "ks_gridstack_config": "{\"<TILE_ID>\": {\"x\": 0, \"y\": 0, \"w\": 3, \"h\": 3}, \"<BAR_ID>\": {\"x\": 0, \"y\": 3, \"w\": 12, \"h\": 8}, \"<PIE_ID>\": {\"x\": 0, \"y\": 11, \"w\": 6, \"h\": 8}, \"<LIST_ID>\": {\"x\": 6, \"y\": 11, \"w\": 6, \"h\": 8}}"
  }
}
```

Patterns:

| Widget | x | y | w | h |
| --- | --- | --- | --- | --- |
| 4-KPI strip (each) | 0/3/6/9 | 0 | 3 | 3 |
| full-width chart | 0 | 3 | 12 | 8 |
| two half charts | 0 / 6 | 11 | 6 | 8 |

An item with **no** entry in this object renders nowhere — this is the #1 cause of
"created but invisible".

## 4. Filters

Board-wide, server-side filter (fixed domain):

```jsonc
{ "instance": "erp-dev-hksis", "model": "ks_dashboard_ninja.board_defined_filters",
  "values": { "name": "Exclude Unit 4", "ks_dashboard_board_id": <BOARD_ID>,
              "ks_model_id": 688, "ks_is_active": true, "sequence": 10,
              "ks_domain": "[[\"operating_unit_id\",\"not in\",[4]]]" } }
```

User-selectable field filter:

```jsonc
{ "instance": "erp-dev-hksis", "model": "ks_dashboard_ninja.board_custom_filters",
  "values": { "name": "Status", "ks_dashboard_board_id": <BOARD_ID>,
              "ks_model_id": 688, "ks_domain_field_id": 10476 } }
```

## 5. Verify

```jsonc
// 1. the board, its menu, and its client action
{ "instance": "erp-dev-hksis", "model": "ks_dashboard_ninja.board", "ids": [<BOARD_ID>],
  "fields": ["name","ks_dashboard_menu_id","ks_dashboard_client_action_id","ks_gridstack_config","ks_dashboard_active"] }

// 2. every item, and whether it is attached
{ "instance": "erp-dev-hksis", "model": "ks_dashboard_ninja.item",
  "domain": [["ks_dashboard_ninja_board_id","=",<BOARD_ID>]],
  "fields": ["id","name","ks_dashboard_item_type","ks_model_id","ks_record_count","ks_chart_data","ks_list_view_data"] }

// 3. nothing left orphaned by this run
{ "instance": "erp-dev-hksis", "model": "ks_dashboard_ninja.item",
  "domain": [["ks_dashboard_ninja_board_id","=",false]], "fields": ["id","name"], "limit": 50 }
```

`ks_record_count`, `ks_chart_data` and `ks_list_view_data` are **computed** fields — reading them
back is the cheapest end-to-end proof that the widget resolves its data.

Read **one item id per call**. A multi-id read returns x2many values only for the last record
(defect 2 in `mcp-x2many-quirks.md`), which makes a correct build look broken.

Then assert on the **content**, because these computed JSON strings stay truthy when the widget
failed:

```python
j = json.loads(rec["ks_chart_data"] or "{}")
ok = bool(j.get("labels")) and bool(j.get("datasets"))                     # charts
ok = bool(json.loads(rec["ks_list_view_data"] or "{}").get("data_rows"))   # list views
ok = bool(rec["ks_record_count"])                                          # tiles / KPI
```

Finally, cross-check the numbers with `odoo_count` / `odoo_read_group`. A non-empty value only
proves *something* resolved; matching the independent aggregate proves it resolved *correctly*.

> **Note:** these three are computed and read-only, so they are the *only* check that needs the item
> to actually evaluate. Everything else (create/grid) is bookkeeping. If `ks_chart_data` comes back
> empty, the cause is a non-stored groupby field, a measure field that is not integer/float/monetary,
> or an x2many value that never landed.

## 6. Roll back

`unlink()` on the board cascades: it deletes the client action, the child dashboards, the menu and
the items.

```jsonc
{ "instance": "erp-dev-hksis", "model": "ks_dashboard_ninja.board", "ids": [<BOARD_ID>] }
```

Prefer `{"ks_dashboard_active": false}` (via `odoo_update`) to hide a board without losing it.
The "My Dashboard" default board cannot be deleted (model constraint).

> **Check delete availability first.** On `erp-dev-hksis` `odoo_delete` is disabled per instance, and
> the fallbacks are closed as well: `odoo_execute` is method-allowlisted (`unlink` and `write` are
> rejected) and the cleanup tools are disabled. There is therefore **no MCP way to remove a record**
> created on that instance. Confirm delete is enabled *before* you create test data.

## 7. Live reference dashboards

Read these before designing a new one — they are the instance's own conventions.

| Board | id | What to learn |
| --- | --- | --- |
| Readymix | 2 | 11 items, tiles + monthly bar + grouped lists; uses `operating_unit_id` domain |
| Equipment | 4 | `maintenance.equipment` pie grouped by a custom selection field |
| AKMR | 5 | `account.move` grouped list + `account.move.line` line chart |
| VMS | 8 | the only `ks_map_view` (`res.partner`, domain `is_tender = True`) |
| Dashboard E-SOP | 11 | KPI items |

```jsonc
{ "instance": "erp-dev-hksis", "model": "ks_dashboard_ninja.item",
  "domain": [["ks_dashboard_ninja_board_id","=",2]],
  "fields": ["name","ks_dashboard_item_type","ks_model_id","ks_chart_relation_groupby",
             "ks_chart_date_groupby","ks_chart_measure_field","ks_domain","ks_record_count_type"],
  "limit": 50 }
```
