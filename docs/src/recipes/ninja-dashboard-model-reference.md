# Dashboard Ninja — model reference

`ks_dashboard_ninja` v18.0.1.0.1 · verified against live instance `erp-dev-hksis` (Odoo 18 EE).

## 1. Models

| Model | Kind | Purpose | Live `ir.model` id (erp-dev-hksis) |
| --- | --- | --- | --- |
| `ks_dashboard_ninja.board` | Model | A dashboard (menu entry + canvas) | 2460 |
| `ks_dashboard_ninja.item` | Model | One widget on a dashboard | 2461 |
| `ks_dashboard_ninja.board_template` | Model | Predefined/custom template | — |
| `ks_dashboard_ninja.board_defined_filters` | Model | Server-side domain filter applied to the whole board | — |
| `ks_dashboard_ninja.board_custom_filters` | Model | Field-picker filter (user picks values at runtime) | — |
| `ks_dashboard_ninja.favourite_filters` | Model | Saved filter presets (`name` is globally unique) | — |
| `ks_dashboard_ninja.child_board` | Model | A secondary dashboard tab; owns its own grid config | — |
| `ks_dashboard_ninja.item_goal` | Model | Per-date target lines for a KPI | — |
| `ks_dashboard_ninja.item_action` | Model | Per-item click/drill-down action config | — |
| `ks_dashboard_item.multiplier` | Model | Per-field multiplier lines | — |
| `ks_dashboard_ninja.kpi_mail` | Model | KPI e-mail recipients | — |
| `ks.dashboard.wizard` | TransientModel | **Creates the board + menu + client action together** | — |
| `ks.dashboard.duplicate.wizard` | TransientModel | Duplicate dashboard | — |
| `ks.dashboard.delete.wizard` | TransientModel | Delete dashboard | — |
| `ks_ninja_dashboard.item_action` | TransientModel | Move/duplicate items between boards | — |
| `ks_dashboard_ninja.import` | Model | Import/export a dashboard as a file | — |
| `ks_dashboard_ninja.arti_int` | Model | AI item generation | — |
| `ks_dashboard_ninja.ai_dashboard` | Model | AI whole-dashboard generation | — |
| `ks_dashboard_ninja.fetch_key` | Model | OpenAI key storage for the AI features | — |
| `ks_to.do.headers` / `ks_to.do.description` | Model | To-Do item widget storage | — |

ACL: all of the above are `base.group_user` r/w/c/u. `ks_dashboard_ninja.import` is
`base.group_system`. `ks_ninja_dashboard.item_action` is read-only for users.

## 2. `ks_dashboard_ninja.board`

### Fields that matter for automation

| Field | Type | Notes |
| --- | --- | --- |
| `name` | Char(35) | Required. Internal name. |
| `ks_dashboard_menu_name` | Char | Menu label shown in the UI |
| `ks_dashboard_active` | Boolean | default `True` |
| `ks_dashboard_menu_sequence` | Integer | default `20` |
| `ks_date_filter_selection` | Selection | Board-level default date filter; default `l_none` |
| `ks_gridstack_config` | Char | **The canvas.** JSON object `{ "<item_id>": {x,y,w,h}, ... }` |
| `ks_dashboard_items_ids` | One2many → `ks_dashboard_ninja.item` | Items on this board |
| `ks_dashboard_group_access` | Many2many → `res.groups` | Who may see it |
| `ks_dashboard_client_action_id` | Many2one → `ir.actions.client` | Created with the board |
| `ks_dashboard_menu_id` | Many2one → `ir.ui.menu` | The board's own menu |
| `ks_dashboard_top_menu_id` | Many2one → `ir.ui.menu` | Parent menu |
| `ks_set_interval` | Selection | Auto-refresh: `15000`…`600000` ms |
| `ks_data_formatting` | Selection | `global` / `indian` / `exact` |
| `ks_dashboard_default_template` | Many2one → `ks_dashboard_ninja.board_template` | |
| `multi_layouts` | Boolean | Enable multi-layout mode |
| `ks_dashboard_defined_filters_ids` | One2many | Predefined (server-side) filters |
| `ks_dashboard_custom_filters_ids` | One2many | Field-picker filters |
| `ks_dashboard_favourite_filters_ids` | One2many | Saved presets |
| `ks_child_dashboard_ids` | One2many → `ks_dashboard_ninja.child_board` | Extra tabs |
| `ks_ai_explain_dash` | Boolean | "Explain this dashboard" AI toggle |

### `ks_date_filter_selection` — all 28 values

`l_none` (All Time) · `l_day` Today · `t_week` This Week · `t_month` This Month ·
`t_quarter` This Quarter · `t_year` This Year · `td_week` Week to Date · `td_month` Month to Date ·
`td_quarter` Quarter to Date · `td_year` Year to Date · `n_day` Next Day · `n_week` Next Week ·
`n_month` Next Month · `n_quarter` Next Quarter · `n_year` Next Year · `ls_day` Last Day ·
`ls_week` Last Week · `ls_month` Last Month · `ls_quarter` Last Quarter · `ls_year` Last Year ·
`l_week` Last 7 days · `l_month` Last 30 days · `l_quarter` Last 90 days · `l_year` Last 365 days ·
`ls_past_until_now` Past Till Now · `ls_pastwithout_now` Past Excluding Today ·
`n_future_starting_now` Future Starting Now · `n_futurestarting_tomorrow` Future Starting Tomorrow ·
`l_custom` Custom Filter

### The grid — `ks_gridstack_config`

Gridstack, **12 columns wide**. Live example (board 2 "Readymix"):

```json
{"29": {"x": 0, "y": 3, "w": 6, "h": 7},
 "30": {"x": 6, "y": 3, "w": 6, "h": 7},
 "31": {"x": 0, "y": 0, "w": 2, "h": 3},
 "32": {"x": 2, "y": 0, "w": 2, "h": 3},
 "33": {"x": 4, "y": 0, "w": 2, "h": 3},
 "34": {"x": 6, "y": 0, "w": 3, "h": 3},
 "35": {"x": 9, "y": 0, "w": 3, "h": 3}}
```

`x` 0–11, `w` in columns, `y`/`h` in row units. A 4-KPI strip is `w:2,h:3` × 4; a full-width
chart is `w:12,h:10`.

> **Note:** hand-computing `x`/`w` is only correct for the simple strip/stack patterns below.
> For anything else, let the UI drag-and-drop write the config — it is the source of truth and
> it also de-conflicts overlapping cells.

## 3. `ks_dashboard_ninja.item`

### Required fields (enforced by the model)

`ks_dashboard_item_type` · `ks_date_filter_selection` · `ks_date_filter_selection_2` ·
`ks_layout` · `ks_list_view_type`

`odoo_default_get` on `ks_dashboard_ninja.item` returns the rest:

```json
{"ks_dashboard_item_type": "ks_tile", "ks_layout": "layout5",
 "ks_list_view_type": "ungrouped", "ks_date_filter_selection": "l_none",
 "ks_data_calculation_type": "custom", "ks_dashboard_item_theme": "white",
 "ks_record_count_type": "count", "ks_default_icon": "bar-chart"}
```

### Identity & source

| Field | Type | Notes |
| --- | --- | --- |
| `name` | Char (translatable) | Widget title |
| `ks_info` | Text | Description / tooltip |
| `ks_dashboard_ninja_board_id` | Many2one → board | `false` = **not attached to a board**. This is how the module stores its built-in template/library items (28 on this instance: "Tile (layout 1)", "Bar Chart", …). It is a normal state, **not** an orphan to be cleaned up. |
| `ks_model_id` | Many2one → `ir.model` | Data source model |
| `ks_model_name` | Char (related, stored) | `ks_model_id.model` |
| `ks_domain` | Char | String containing a Python domain literal |
| `ks_domain_temp` | Char | Domain substitute (used by templates) |
| `ks_domain_extension` | Char | Extra conditions appended to the domain |
| `ks_data_calculation_type` | Selection | `custom` Default Query / `query` Custom Query |
| `ks_company_id` | Many2one → `res.company` | default = current company |
| `ks_currency_id` | Many2one → `res.currency` | default IDR on this instance |

`ks_model_id` domain excludes: transient models, `base_import%`, `ir.%`, `web_editor.%`,
`web_tour.%`, `mail.thread`, `ks_dash%`, `ks_to%`.

### Aggregation

| Field | Type | Notes |
| --- | --- | --- |
| `ks_record_count_type` | Selection | `count` / `sum` / `average` |
| `ks_record_field` | Many2one → `ir.model.fields` | Required when type ≠ `count`. Must be integer/float/monetary |
| `ks_record_count` | Float (computed) | Result |
| `ks_multiplier_active` / `ks_multiplier` | Boolean / Float | Multiply the result |
| `ks_multiplier_lines` | One2many → `ks_dashboard_item.multiplier` | Per-field multipliers |

### Charts

| Field | Type | Notes |
| --- | --- | --- |
| `ks_chart_relation_groupby` | Many2one → `ir.model.fields` | X axis. Excludes binary/m2m/o2m |
| `ks_chart_date_groupby` | Selection | `minute hour day week month quarter year month_year` |
| `ks_chart_relation_sub_groupby` | Many2one → `ir.model.fields` | Second dimension |
| `ks_chart_date_sub_groupby` | Selection | Same as above, minus `month_year` |
| `ks_chart_measure_field` | Many2many → `ir.model.fields` | Y series. Integer/float/monetary only |
| `ks_chart_measure_field_2` | Many2many → `ir.model.fields` | Second series |
| `ks_chart_data_count_type` | Selection | `count` / `sum` / `average` |
| `ks_chart_item_color` | Selection | `default` / `dark` / `material` / `moonrise` |
| `ks_bar_chart_stacked` | Boolean | Stacked bars |
| `ks_semi_circle_chart` | Boolean | Doughnut semi-circle |
| `ks_show_data_value` | Boolean | Print values on the chart |
| `ks_data_label_type` | Selection | `percent` / `value` |
| `ks_hide_legend` / `ks_radial_legend` | Boolean | Legend visibility |
| `ks_sort_by_field` | Many2one → `ir.model.fields` | Sort axis |
| `ks_sort_by_order` | Selection | `ASC` / `DESC` |
| `ks_record_data_limit` | Integer | Rows to plot |
| `ks_chart_is_cumulative` / `ks_chart_cumulative` | Boolean | Cumulative series |
| `ks_as_of_now` | Boolean | Data till now |
| `ks_fill_temporal` | Boolean | Fill empty time buckets |
| `ks_precision_digits` | Integer (computed, stored) | Decimal places |

Chart-type-specific extras:

| Item type | Extra fields |
| --- | --- |
| `ks_scatter_chart` | `ks_scatter_measure_x_id`, `ks_scatter_measure_y_id`, `ks_scatter_field_id`, `ks_is_scatter_group` |
| `ks_map_view` | `ks_map_record_field`, `ks_map_chart_relation_groupby`, `ks_country_id` (+ related stored `ks_country_code`), `ks_partners_map` |
| `ks_funnel_chart` | `ks_funnel_record_field`, `ks_funnel_preview` |
| `ks_bullet_chart` | `ks_bullet_preview` |
| `ks_radialBar_chart` | `ks_radial_preview`, `ks_radial_legend` |
| `ks_flower_view` | `ks_flower_view_preview` |

### KPI

| Field | Type | Notes |
| --- | --- | --- |
| `ks_kpi_type` | Selection | `layout_1` KPI With Target / `layout_2` Data Comparison |
| `ks_target_view` | Selection | `Number` / `Progress Bar` |
| `ks_goal_enable` | Boolean | Show target |
| `ks_standard_goal_value` | Float | Static target value |
| `ks_goal_lines` | One2many → `ks_dashboard_ninja.item_goal` | Per-date targets |
| `ks_goal_bar_line` | Boolean | Target as a line |
| `ks_data_comparison` | Selection | `None` / `Sum` / `Ratio` / `Percentage` |
| `ks_previous_period` | Boolean | Compare with previous period |
| `ks_compare_period` / `ks_year_period` | Integer | Include period / same period previous years |

### List view

| Field | Type | Notes |
| --- | --- | --- |
| `ks_list_view_type` | Selection | `ungrouped` / `grouped` |
| `ks_list_view_fields` | Many2many → `ir.model.fields` | Columns. Excludes o2m/m2m/binary |
| `ks_list_view_group_fields` | Many2many → `ir.model.fields` | Group-by columns. Integer/float/monetary only |
| `ks_list_view_layout` | Selection | `layout_1` Default / `layout_2` / `layout_3` / `layout_4` |
| `ks_pagination_limit` | Integer | default 15 |
| `ks_export_all_records` | Boolean | default True |
| `ks_list_target_deviation_field` | Many2one → `ir.model.fields` | Deviation column |

### Dates

`ks_date_filter_selection` + `ks_date_filter_field` (Many2one → `ir.model.fields`, date/datetime,
stored only) drive the item's own date filter. The `_2` variants
(`ks_date_filter_selection_2`, `ks_date_filter_field_2`, `ks_domain_2`, `ks_item_start_date_2`,
`ks_item_end_date_2`, `ks_record_count_type_2`, `ks_record_field_2`, `ks_model_id_2`) belong to the
KPI comparison metric.

`ks_isDateFilterApplied` (Boolean, default False) — set it when the item carries a fixed
`ks_item_start_date`/`ks_item_end_date` instead of using the board filter.

### Appearance

`ks_layout` (`layout1`…`layout6`) · `ks_dashboard_item_theme` (colour key, default `white`;
live values in use: `white`, `blue`, `red`) · `ks_default_icon` (default `bar-chart`;
live values in use: `bar-chart`, `user`, `users`, `paper-plane`) ·
`ks_default_icon_color` / `ks_font_color` (format `"#RRGGBB,opacity"`) ·
`ks_icon_select` `Default`/`Custom` · `ks_icon` (Binary, `attachment=True`) ·
`ks_button_color` · `ks_show_records` (default True) · `ks_unit` / `ks_unit_selection`
(`monetary`/`custom`) / `ks_chart_unit` · `ks_data_format`
(`global`/`indian`/`colombian`/`exact`) · `ks_many2many_field_ordering` (Char, JSON — stores the
user's chosen order for the Many2many field pickers).

### Navigation & actions

`ks_actions` (Many2one → `ir.actions.act_window`, domain on `ks_model_name`) ·
`ks_is_client_action` + `ks_client_action` (Many2one → `ir.actions.client`) ·
`ks_action_lines` (One2many → `ks_dashboard_ninja.item_action`) for multi-action drill-down.

### Other data sources

`data_source` = `odoo` (default) / `excel` / `csv` / `external_api`.
Non-Odoo sources additionally use `ks_external_db_type` (`ks_postgres` / `ks_sql`), the
`ks.dashboard.new`, `ks.dashboard.group.by`, `ks.dashboard.csv.new`,
`ks.dashboard.csv.group.by` helper models, and require `pandas`, `xlrd`, `openpyxl`,
`SQLAlchemy` (declared in `external_dependencies`). `gTTS` is used by the AI voice feature.

## 4. The 18 item types

| Key | Label | Notes |
| --- | --- | --- |
| `ks_tile` | Tile | Single number. 77 items live — the workhorse |
| `ks_kpi` | KPI | Tile + target / comparison |
| `ks_bar_chart` | Bar Chart | |
| `ks_horizontalBar_chart` | Horizontal Bar Chart | |
| `ks_line_chart` | Line Chart | |
| `ks_area_chart` | Area Chart | |
| `ks_pie_chart` | Pie Chart | |
| `ks_doughnut_chart` | Doughnut Chart | `ks_semi_circle_chart` for half |
| `ks_polarArea_chart` | Polar Area Chart | |
| `ks_radialBar_chart` | Radial Bar Chart | |
| `ks_scatter_chart` | Scatter Chart | needs x/y measure fields |
| `ks_list_view` | List View | grouped / ungrouped |
| `ks_radar_view` | Radar View | |
| `ks_flower_view` | Flower View | |
| `ks_map_view` | Map View | needs a country field |
| `ks_funnel_chart` | Funnel Chart | |
| `ks_bullet_chart` | Bullet Chart | |
| `ks_to_do` | To Do | task list widget |

## 5. Relation-ID resolution (the part that breaks automation)

`ks_model_id` is an `ir.model` id. Every field picker is an `ir.model.fields` id that **must**
belong to that model and pass the picker's own domain. Resolve them per instance:

```jsonc
// step 1 — the model
{ "instance": "erp-dev-hksis", "model": "ir.model",
  "domain": [["model", "=", "sale.order"]], "fields": ["id", "model", "name"] }
// → 688

// step 2 — the fields (one call, filtered by the picker's constraints)
{ "instance": "erp-dev-hksis", "model": "ir.model.fields",
  "domain": [["model", "=", "sale.order"],
             ["name", "in", ["date_order", "amount_total", "state", "partner_id"]]],
  "fields": ["id", "name", "field_description", "ttype", "store", "relation"] }
```

Verified on `erp-dev-hksis` for `sale.order` (ir.model 688):

| Field | `ir.model.fields` id | ttype |
| --- | --- | --- |
| `name` (Order Reference) | 10473 | char |
| `partner_id` (Customer) | 10475 | many2one |
| `state` (Status) | 10476 | selection |
| `create_date` (Creation Date) | 10480 | datetime |
| `date_order` (Order Date) | 10482 | datetime |
| `currency_id` (Currency) | 10499 | many2one |
| `amount_total` (Total) | 10506 | monetary |
| `operating_unit_id` (Operating Unit) | 45854 | many2one |
| `state2` (Status) | 47376 | selection, **store=false** |

Picker constraints to respect:

| Picker | Allowed `ttype` |
| --- | --- |
| `ks_chart_relation_groupby` | not binary / m2m / o2m |
| `ks_chart_measure_field` (+`_2`) | integer, float, monetary |
| `ks_record_field` | integer, float, monetary |
| `ks_list_view_group_fields` | integer, float, monetary |
| `ks_date_filter_field` (+`_2`) | date, datetime |
| `ks_list_view_fields` | not o2m / m2m / binary |
| `ks_sort_by_field` | not o2m / binary |

All of them additionally require `store = true` (except `ks_list_view_fields`, which has no
`store` filter). Non-stored fields are silently unusable — e.g. `sale.order.state2` looks like a
status field but will not group.

## 6. Domains — string, not JSON

`ks_domain`, `ks_domain_2`, `ks_domain_extension`, and the filter models all store a **Python
literal** evaluated with `safe_eval`. Write it as a string with escaped double quotes:

```json
{"ks_domain": "[[\"state\",\"=\",\"sale\"],[\"amount_total\",\">\",1000000]]"}
```

Substitution tokens understood by the filter models:

| Token | Replaced with |
| --- | --- |
| `%UID` | current user id |
| `%MYCOMPANY` | current company id |

Live examples:

```
[("operating_unit_id", "not in", [4])]
["&", ("state2", "in", ["draft", "sent", "confirm"]), ("operating_unit_id", "not in", [4])]
[("is_tender", "=", True)]
```

## 7. Filters

| Model | Server-side? | Key fields |
| --- | --- | --- |
| `ks_dashboard_ninja.board_defined_filters` | yes — a fixed domain | `name`, `ks_model_id`, `ks_domain`, `ks_is_active`, `ks_dashboard_board_id`, `sequence` |
| `ks_dashboard_ninja.board_custom_filters` | no — user picks a value at runtime | `name`, `ks_model_id`, `ks_domain_field_id` |
| `ks_dashboard_ninja.favourite_filters` | saved preset | `name` (globally unique), `ks_filter` (Char), `ks_access_id` (Integer), `ks_filter_type` (default `favourite`) |

`ks_domain` on a defined filter may not be empty when `ks_model_id` is set (constraint).
`ks_domain_field_id` accepts boolean/char/date/datetime/float/integer/html/m2m/m2o/monetary/o2m/text/selection.

## 8. Child dashboards

`ks_dashboard_ninja.child_board`: `name`, `ks_dashboard_ninja_id` (parent board),
`ks_gridstack_config` (its own canvas), `ks_active` ("Is Selected"),
`board_type` = `default` / `child`, `company_id` (required),
`ks_computed_group_access` (computed from the parent's `ks_dashboard_group_access`).
A board with child dashboards uses `multi_layouts = true` and renders tabs.
