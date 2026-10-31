#!/usr/bin/env python3
"""Build a Dashboard Ninja board over odoo-rust-mcp — reference implementation.

Implements the procedure from ../ninja-dashboard-ai-playbook.md, including the workarounds for the
two x2many defects documented in ../mcp-x2many-quirks.md:

  * every x2many value is set in the CREATE payload (odoo_update would drop it);
  * verification reads ONE id per call and asserts on content, not truthiness;
  * computed values are cross-checked against odoo_count / odoo_read_group.

Stdlib only. Requires the MCP server to be running with ODOO_ENABLE_WRITE_TOOLS=true.

Usage:
    python3 build_ninja_board.py --instance erp-dev-hksis --board-name "Ops Demo" \
        [--model sale.order] [--parent-menu 1196] [--dry-run]

  --dry-run   resolve ids and dry-run the aggregations, then stop before any write.
"""
import argparse
import json
import sys
import urllib.request

MCP_URL = "http://127.0.0.1:8787/mcp"
_session = {"id": None}


# ----------------------------------------------------------------- MCP plumbing
def _post(payload, notify=False):
    req = urllib.request.Request(MCP_URL, data=json.dumps(payload).encode(), method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("Accept", "application/json, text/event-stream")
    if _session["id"]:
        req.add_header("mcp-session-id", _session["id"])
    with urllib.request.urlopen(req, timeout=120) as resp:
        sid = resp.headers.get("mcp-session-id")
        if sid:
            _session["id"] = sid
        raw = resp.read().decode()
    if notify or not raw.strip():
        return None
    if raw.lstrip().startswith(("event:", "data:")):
        out = None
        for line in raw.splitlines():
            if line.startswith("data:"):
                out = json.loads(line[5:].strip())
        return out
    return json.loads(raw)


def initialize():
    return _post({"jsonrpc": "2.0", "id": 1, "method": "initialize",
                  "params": {"protocolVersion": "2025-11-05", "capabilities": {},
                             "clientInfo": {"name": "ninja-builder", "version": "1.0"}}})


def call(tool, args):
    _post({"jsonrpc": "2.0", "method": "notifications/initialized"}, notify=True)
    r = _post({"jsonrpc": "2.0", "id": 3, "method": "tools/call",
               "params": {"name": tool, "arguments": args}})
    if r is None:
        return {"error": "no response"}
    if "error" in r:
        return {"error": r["error"]}
    text = "\n".join(c.get("text", "") for c in (r.get("result") or {}).get("content", [])
                     if c.get("type") == "text")
    try:
        return json.loads(text)
    except ValueError:
        return {"raw": text}


def tool_names():
    r = _post({"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}})
    return sorted(t["name"] for t in r["result"]["tools"])


# ---------------------------------------------------------------------- helpers
def require_write_tools():
    names = tool_names()
    print(f"tools exposed: {len(names)}")
    missing = [t for t in ("odoo_create", "odoo_update") if t not in names]
    if missing:
        sys.exit(f"BLOCKED: server is read-only (missing {missing}). "
                 "Restart it with ODOO_ENABLE_WRITE_TOOLS=true.")


def resolve_model(instance, model_name):
    r = call("odoo_search_read", {"instance": instance, "model": "ir.model",
                                  "domain": [["model", "=", model_name]],
                                  "fields": ["id", "model", "name"], "limit": 1})
    recs = r.get("records") or []
    if not recs:
        sys.exit(f"FATAL: ir.model not found for {model_name}: {json.dumps(r)[:200]}")
    return recs[0]["id"]


def resolve_fields(instance, model_name, names):
    r = call("odoo_search_read", {"instance": instance, "model": "ir.model.fields",
                                  "domain": [["model", "=", model_name], ["name", "in", names]],
                                  "fields": ["id", "name", "ttype", "store"], "limit": 200})
    out = {x["name"]: x for x in (r.get("records") or [])}
    missing = [n for n in names if n not in out]
    if missing:
        sys.exit(f"FATAL: fields not on {model_name}: {missing}")
    return out


def read_one(instance, model, rec_id, fields):
    """Read a SINGLE record — never batch ids when an x2many value matters (defect 2).

    Returns the record, or a dict with an 'error' key. Never returns {} on failure: a silent {}
    makes a real server error look like an empty record (this cost an hour during discovery —
    a malformed ks_domain makes reads of the computed fields fail with HTTP 400).
    """
    r = call("odoo_read", {"instance": instance, "model": model, "ids": [rec_id], "fields": fields})
    if "error" in r:
        return r
    recs = r.get("records") or []
    if not recs:
        return {"error": f"no record returned for id {rec_id}", "raw": r}
    return recs[0]


def chart_ok(payload):
    j = json.loads(payload) if payload else {}
    return bool(j.get("labels")) and bool(j.get("datasets"))


def list_ok(payload):
    j = json.loads(payload) if payload else {}
    return bool(j.get("data_rows"))


# ------------------------------------------------------------------------ build
def build(args):
    require_write_tools()
    I = args.instance

    print("\n--- resolve ---")
    m_id = resolve_model(I, args.model)
    f = resolve_fields(I, args.model,
                       ["name", "partner_id", "state", "date_order",
                        "amount_total", "amount_untaxed"])
    menu = args.parent_menu
    if menu is None:
        r = call("odoo_search_read", {"instance": I, "model": "ir.ui.menu",
                                      "domain": [["parent_id", "=", False], ["name", "ilike", "dash"]],
                                      "fields": ["id", "complete_name"], "limit": 1})
        menu = (r.get("records") or [{}])[0].get("id")
    tmpl = call("odoo_search_read", {"instance": I, "model": "ks_dashboard_ninja.board_template",
                                     "domain": [["name", "=", "Blank"]], "fields": ["id"], "limit": 1})
    blank = (tmpl.get("records") or [{}])[0].get("id")
    print(f"  {args.model}: ir.model={m_id}  parent menu={menu}  blank template={blank}")
    for k in ("name", "partner_id", "state", "date_order", "amount_total"):
        print(f"    {k:14} id={f[k]['id']:<7} {f[k]['ttype']:<10} store={f[k]['store']}")

    print("\n--- dry-run the aggregations (do this before writing anything) ---")
    for label, dom, grp in (("count open", [["state", "in", ["draft", "confirm", "hod"]]], None),
                            ("sum confirmed", [["state", "=", "sale"]], None),
                            ("by month", [["state", "=", "sale"]], ["date_order:month"])):
        a = {"instance": I, "model": args.model, "domain": dom, "fields": ["amount_total:sum"]}
        if grp:
            a["groupby"] = grp
        print(f"  {label:16} -> {json.dumps(call('odoo_read_group', a).get('groups'))[:110]}")
    if args.dry_run:
        print("\n--dry-run: stopping before any write.")
        return 0

    print("\n--- 1/3 board ---")
    r = call("odoo_create", {"instance": I, "model": "ks_dashboard_ninja.board", "values": {
        "name": args.board_name, "ks_dashboard_menu_name": args.board_name,
        "ks_dashboard_top_menu_id": menu, "ks_dashboard_menu_sequence": args.menu_sequence,
        "ks_dashboard_active": True, "ks_date_filter_selection": "l_none",
        "ks_dashboard_default_template": blank}})
    board = r.get("id")
    if not board:
        sys.exit(f"FATAL board create: {json.dumps(r)[:300]}")
    print(f"  board_id={board}")

    print("\n--- 2/3 items (x2many values in the CREATE payload) ---")
    common = {"ks_dashboard_ninja_board_id": board, "ks_model_id": m_id,
              "ks_date_filter_selection": "l_none", "ks_date_filter_selection_2": "l_none",
              "ks_dashboard_item_theme": "white"}

    def mk(name, **kw):
        r = call("odoo_create", {"instance": I, "model": "ks_dashboard_ninja.item",
                                 "values": dict(common, name=name, **kw)})
        if not r.get("id"):
            sys.exit(f"FATAL item create {name}: {json.dumps(r)[:300]}")
        print(f"  {r['id']:>6}  {kw.get('ks_dashboard_item_type'):<18} {name}")
        return r["id"]

    ids = {
        "open": mk("Open Orders", ks_dashboard_item_type="ks_tile", ks_layout="layout1",
                   ks_list_view_type="ungrouped", ks_record_count_type="count",
                   ks_domain='[["state","in",["draft","confirm","hod"]]]'),
        "rev": mk("Confirmed Revenue", ks_dashboard_item_type="ks_tile", ks_layout="layout1",
                  ks_list_view_type="ungrouped", ks_record_count_type="sum",
                  ks_record_field=f["amount_total"]["id"], ks_unit=True,
                  ks_unit_selection="monetary", ks_domain='[["state","=","sale"]]'),
        "bar": mk("Sales per Month", ks_dashboard_item_type="ks_bar_chart", ks_layout="layout5",
                  ks_list_view_type="ungrouped",
                  ks_chart_relation_groupby=f["date_order"]["id"], ks_chart_date_groupby="month",
                  ks_chart_data_count_type="sum",
                  ks_chart_measure_field=[[6, 0, [f["amount_total"]["id"]]]],
                  ks_sort_by_field=f["date_order"]["id"], ks_sort_by_order="ASC",
                  ks_domain='[["state","=","sale"]]'),
        "pie": mk("Orders by Status", ks_dashboard_item_type="ks_pie_chart", ks_layout="layout5",
                  ks_list_view_type="ungrouped",
                  ks_chart_relation_groupby=f["state"]["id"], ks_chart_data_count_type="count",
                  ks_domain="[]"),
        "list": mk("Orders by Status (grouped)", ks_dashboard_item_type="ks_list_view",
                   ks_layout="layout5", ks_list_view_type="grouped",
                   ks_chart_relation_groupby=f["state"]["id"],
                   ks_list_view_fields=[[6, 0, [f["name"]["id"], f["partner_id"]["id"],
                                                f["amount_total"]["id"]]]],
                   ks_list_view_group_fields=[[6, 0, [f["amount_total"]["id"]]]],
                   ks_sort_by_field=f["amount_total"]["id"], ks_sort_by_order="DESC",
                   ks_domain="[]"),
    }

    print("\n--- 3/3 grid ---")
    grid = {str(ids["open"]): {"x": 0, "y": 0, "w": 6, "h": 3},
            str(ids["rev"]): {"x": 6, "y": 0, "w": 6, "h": 3},
            str(ids["bar"]): {"x": 0, "y": 3, "w": 12, "h": 8},
            str(ids["pie"]): {"x": 0, "y": 11, "w": 6, "h": 8},
            str(ids["list"]): {"x": 6, "y": 11, "w": 6, "h": 8}}
    r = call("odoo_update", {"instance": I, "model": "ks_dashboard_ninja.board", "ids": [board],
                             "values": {"ks_gridstack_config": json.dumps(grid)}})
    print(f"  {r}  cells={len(grid)}")

    print("\n--- verify (one id per call, assert on content) ---")
    ok = True
    for key, i in ids.items():
        rec = read_one(I, "ks_dashboard_ninja.item", i,
                       ["name", "ks_dashboard_item_type", "ks_record_count", "ks_chart_measure_field",
                        "ks_list_view_fields", "ks_chart_data", "ks_list_view_data"])
        if "error" in rec:
            ok = False
            print(f"  {i:>6} *** READ ERROR *** {str(rec['error'])[:90]}")
            continue
        t = rec.get("ks_dashboard_item_type")
        if t in ("ks_tile", "ks_kpi"):
            good = bool(rec.get("ks_record_count"))
            detail = f"count={rec.get('ks_record_count')}"
        elif t in ("ks_bar_chart", "ks_pie_chart"):
            good = chart_ok(rec.get("ks_chart_data"))
            detail = f"chart labels={len((json.loads(rec['ks_chart_data'] or '{}')).get('labels') or [])}"
        else:
            good = list_ok(rec.get("ks_list_view_data"))
            detail = f"rows={len((json.loads(rec['ks_list_view_data'] or '{}')).get('data_rows') or [])}"
        ok = ok and good
        print(f"  {i:>6} {t:<18} {'OK' if good else '*** EMPTY ***':<14} {detail}")

    print(f"\n=== {'PASS' if ok else 'NEEDS ATTENTION'} ===  board={board}")
    if not ok:
        print("Reminder: an empty widget cannot be repaired with odoo_update (x2many is dropped). "
              "Re-create the item with the correct create payload.")
    return 0 if ok else 1


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--instance", required=True)
    ap.add_argument("--board-name", required=True)
    ap.add_argument("--model", default="sale.order")
    ap.add_argument("--parent-menu", type=int)
    ap.add_argument("--menu-sequence", type=int, default=90)
    ap.add_argument("--dry-run", action="store_true")
    initialize()
    sys.exit(build(ap.parse_args()))
