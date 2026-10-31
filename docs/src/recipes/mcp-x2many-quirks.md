# MCP x2many quirks — two silent defects that corrupt dashboard builds

`odoo-rust-mcp` 0.6.5, verified on `erp-dev-hksis` (Odoo 18 EE). Both defects are **silent**: every
call returns `success: true` and no error is raised. They were found while building a Dashboard
Ninja board, but they affect **every model with a `many2many` / `one2many` field**, not just
`ks_dashboard_ninja`.

Read this before automating any record that carries an x2many value.

## Defect 1 — `odoo_update` never writes x2many values

`odoo_update` reports `{"success": true, "updated_count": N}` and the x2many value is **unchanged**.

Reproduction on `ks_dashboard_ninja.item` (record 332, created with
`ks_chart_measure_field = [10506]`):

```jsonc
// scalar control — APPLIES
{ "instance": "erp-dev-hksis", "model": "ks_dashboard_ninja.item", "ids": [332],
  "values": { "ks_chart_data_count_type": "average" } }
// -> read back: ks_chart_data_count_type = "average"          ✅

// many2many — SILENTLY DROPPED, all three command forms
{ "values": { "ks_chart_measure_field": [[6, 0, [10504]]] } }   // replace set
{ "values": { "ks_chart_measure_field": [[4, 10505]] } }        // add one
{ "values": { "ks_chart_measure_field": [10505] } }             // bare id list
// -> read back every time: ks_chart_measure_field = [10506]   ❌ unchanged
```

`many2one` writes on the **same record, same call shape** do apply (`ks_sort_by_field: 10482`
took effect immediately), so this is specific to x2many values, not to `odoo_update` as a whole.
`ks_list_view_fields` (another many2many on the same model) is equally unaffected by `odoo_update`.

**Impact.** Any "fix the widget after creating it" step is a no-op. You will believe the change
landed, because the response says so.

**Workaround.** Set every x2many value **at create time** and treat the item as immutable
afterwards. To change one, create a replacement record and add a grid cell for it.

## Defect 2 — multi-id reads attribute x2many values to the last record only

In a multi-record read, an x2many field is returned **only for the last record** of the result;
every other record comes back with `[]`. The values are present in the database — a single-id read
shows them.

Ground truth (three records, all genuinely holding `[10506]`):

```
odoo_read ids=[330]        -> [(330, [10506])]      ✅
odoo_read ids=[331]        -> [(331, [10506])]      ✅
odoo_read ids=[332]        -> [(332, [10506])]      ✅
```

The same three records read together:

```
odoo_read ids=[330, 331, 332] -> [(330, []), (331, []), (332, [10506])]
odoo_read ids=[332, 331, 330] -> [(332, [10506]), (331, []), (330, [])]
odoo_read ids=[330, 331]      -> [(330, []), (331, [10506])]
odoo_read ids=[331, 330]      -> [(331, [10506]), (330, [])]
```

Whichever record is **last in the returned list** is the only one that keeps its x2many value.
`odoo_search_read` behaves the same way (it returns records in id order, so the highest id wins).

**Impact.** This is the dangerous one, because it looks like data loss:

- a batch build appears to have dropped the measure/column fields on every widget but one;
- you then "repair" it with `odoo_update` — which is Defect 1, so nothing happens — and conclude
  the module is broken;
- a pre-flight check that reads several candidate records at once silently under-reports which
  fields are set.

**Workaround.** Never trust a multi-record read for an x2many field. Read **one id at a time** and
build the map yourself.

## Why this matters for Dashboard Ninja specifically

Every non-tile widget carries its configuration in x2many fields:

| Widget | x2many field |
| --- | --- |
| any chart | `ks_chart_measure_field`, `ks_chart_measure_field_2`, `ks_chart_cumulative_field` |
| list view | `ks_list_view_fields`, `ks_list_view_group_fields` |
| KPI | `ks_goal_lines` |

So a chart with an empty `ks_chart_measure_field` computes `ks_chart_data` with
`labels: []` and `datasets: []`, and renders blank. Combined with Defect 2, the failure is easy to
misdiagnose as a bad groupby or a bad measure field.

## Correct build procedure

1. Resolve every `ir.model.fields` id first (see the model reference §5).
2. **Create each item once, with all x2many values present in the create payload.** `odoo_create`
   and `odoo_create_batch` both persist x2many correctly — the create path is sound.
3. Read each item back **one id at a time** and assert on the x2many contents.
4. Write the grid config (a plain Char) — `odoo_update` is fine for scalars.
5. Assert on computed output **by content**, not truthiness — see below.

## Verification trap: `bool()` is not a check

`ks_chart_data` / `ks_list_view_data` are computed JSON strings. On failure they are still
**truthy**:

```json
{"labels": [], "datasets": [], "ks_currency": 0, "ks_field": "", "domains": []}
```

`bool(ks_chart_data)` is `True` for that. Assert on the payload:

```python
j = json.loads(rec["ks_chart_data"] or "{}")
ok = bool(j.get("labels")) and bool(j.get("datasets"))      # charts
ok = bool(json.loads(rec["ks_list_view_data"] or "{}").get("data_rows"))  # lists
ok = bool(rec["ks_record_count"])                            # tiles / KPI
```

## Diagnostic: an empty widget can be a malformed `ks_domain`

Not a server defect, but it presents the same way and cost real time during discovery.

`ks_domain` is a **Python literal in a Char** (`"[[\"state\",\"=\",\"sale\"]]"`). Hand-rolling that
string in a shell one-liner loses commas easily. When the literal is malformed, reading any of the
record's **computed** fields (`ks_chart_data`, `ks_list_view_data`, `ks_record_count`) returns an
HTTP 400, not a value:

```
Odoo API error (status 400): unterminated string literal (detected at line 1)
('', 1, 18, '[[\"state\",\"=\"sale\"]]', 1, 18)
```

Note the tell in that message: the domain is 20 chars where the valid form is 22.

Two consequences:

- **The widget renders blank**, so it looks exactly like Defect 1/2 damage. Check `ks_domain` parses
  before blaming the x2many path: `ast.literal_eval(ks_domain)`.
- **A client that swallows errors hides the cause.** A naive `read_one` that does
  `(response.get("records") or [{}])[0]` turns that HTTP 400 into `{}` — every field `None`, which
  reads as "the record has no data" instead of "the server rejected the read". Surface the `error`
  key instead; `examples/build_ninja_board.py` does.

Always build the domain with `json.dumps`/`repr`, never string concatenation.

## Suggested fixes for the server

Neither defect is in the declarative tool config — `tools.json` maps `values` straight through, and
`rust-mcp/src/odoo/legacy_client.rs` passes `values` verbatim to `execute_kw` for both `create` and
`write`, so the asymmetry between the two paths needs debugging at that boundary. A regression test
per defect:

- **Defect 1**: create a record with an x2many value, `write` a *different* x2many value, read it
  back single-id, assert the value changed.
- **Defect 2**: create ≥3 records each with a distinct x2many value, `read` them in one call, assert
  every record carries its own value.

## Related limits (not defects — by design, but they block rollback)

| Limit | Effect |
| --- | --- |
| `odoo_delete` in per-instance `toolConfig.disabledTools` | no delete at all on that instance |
| `odoo_execute` method allowlist | `unlink` and `write` are rejected: `Method 'unlink' on model '…' is not allowlisted` |
| `odoo_database_cleanup` / `odoo_deep_cleanup` disabled | no bulk cleanup |

With all three closed there is **no MCP path to remove a record you created**. Plan for that: build
on an instance where delete is enabled, or accept that cleanup happens in the Odoo UI.
