# Dashboard Ninja — Recipes (AI-consumable)

Build **Ksolves Dashboard Ninja** (`ks_dashboard_ninja`, model prefix `ks_dashboard_ninja.*`)
dashboards over the `odoo-rust-mcp` MCP server.

Everything in this section was derived from:

- live metadata on the `erp-dev-hksis` instance (Odoo 18 EE; 25 boards / 244 items at time of
  writing — 32 of those items are the module's built-in templates/library, `board = false`, and the
  totals include the demo boards created while writing this), and
- the module source (`ks_dashboard_ninja` v18.0.1.0.1),
- a real board built end-to-end over MCP and cross-checked against `odoo_count` / `odoo_read_group`
  (see `discovery/erp-dev-hksis.md`).

Every ID, field name, selection value and default quoted here was read back from the live
server — nothing is guessed.

## Files

| File | Use it for |
| --- | --- |
| `mcp-x2many-quirks.md` | **Read first.** Two silent `odoo-rust-mcp` defects that corrupt x2many values |
| `ninja-dashboard-model-reference.md` | Board + item schema, all 18 item types, selections, defaults, relation-ID rules |
| `ninja-dashboard-recipes.md` | Copy-paste recipe set (tile, bar, pie, line, KPI, list, map, board layout, menu, filters) |
| `ninja-dashboard-ai-playbook.md` | Agent workflow: enable writes, resolve IDs, build, verify, roll back |
| `discovery/erp-dev-hksis.md` | Evidence: tool gating, live ids, data validation, defect reproductions |
| `examples/readymix-operations-board.json` | Machine-readable worked example (board + 4 items) |
| `examples/build_ninja_board.py` | Runnable reference implementation — `--dry-run` resolves IDs and dry-runs the aggregates without writing |

## Golden rules

1. **Read-only by default.** A stock `odoo-rust-mcp` server exposes 16 read tools. `odoo_create`,
   `odoo_update`, `odoo_delete`, `odoo_copy`, `odoo_workflow_action`, `odoo_create_batch` appear
   only when the server process has `ODOO_ENABLE_WRITE_TOOLS=true`; `odoo_execute` needs
   `ODOO_ENABLE_EXECUTE_TOOL=true` on top. Verified: 16 tools → 23 tools.
2. **Never hand-write `ir.model.fields` IDs.** Resolve them per instance with `odoo_search_read`
   on `ir.model.fields` filtered by `model`. IDs are database-local.
3. **`ks_model_id` is an `ir.model` id, not a model name string.** Resolve it once per target model.
4. **A dashboard item is inert until it has a grid cell.** The board's `ks_gridstack_config` is a
   JSON object keyed by item id; an item with no entry renders nowhere.
5. **`ks_domain` is a string containing a Python domain literal**, not a JSON array. Doubled
   quotes are the safe form: `"[[\"state\",\"=\",\"sale\"]]"`.
6. **Set every x2many value at create time.** `odoo_update` silently ignores x2many
   (`many2many` / `one2many`) values — it returns `success: true` and changes nothing. This is
   defect 1 in `mcp-x2many-quirks.md`.
7. **Read x2many values one record at a time.** In a multi-id read the server returns an x2many
   value only for the last record in the result; the others come back `[]`. This is defect 2, and it
   makes a correct build look broken.
8. **Verify by reading back and asserting on content**, never on truthiness — a failed chart still
   returns a truthy JSON object with empty `labels`/`datasets`.
9. **Assume you cannot clean up.** On instances where `odoo_delete` is disabled and `odoo_execute`
   is allowlisted, there is no MCP path to delete a record. Check before creating throwaway data.
