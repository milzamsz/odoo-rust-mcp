# Odoo Rust MCP Enterprise Packs Development Documentation

This repository overlay contains the development specification for evolving
`odoo-rust-mcp` from a generic Odoo MCP gateway into a capability-aware,
policy-aware, modular execution platform.

The design is inspired by the architectural lessons described in Purple Crib's
375-tool Odoo MCP case study, but it deliberately avoids using raw tool count as
a success metric. The target is a controlled Odoo execution gateway whose
exposed tools are:

- available on the selected Odoo instance;
- compatible with the detected Odoo version and edition;
- permitted for the authenticated Odoo user;
- constrained by explicit risk policies;
- observable, testable, and recoverable;
- small enough for MCP clients and agents to reason about reliably.

## Included domain packs

Baseline packs:

- Core
- CRM
- Sales
- Purchase
- Inventory
- Accounting
- Project

Additional enterprise packs:

- Manufacturing
- Website
- Spreadsheet and Dashboard
- Point of Sale
- Employee

## Recommended repository placement

Copy the contents under:

```text
docs/src/developer/enterprise-packs/
```

Then merge `SUMMARY-snippet.md` into `docs/src/SUMMARY.md`.

Root-level planning artifacts are included under:

```text
repo-overlay/
```

They are intended as implementation planning inputs, not replacements for the
existing canonical repository files.

## Source-of-truth hierarchy

When documents disagree, use this priority:

1. running implementation and checked-in configuration;
2. automated tests;
3. architecture decision records;
4. this documentation set;
5. examples and implementation prompts.

## Status

This document set is a design and implementation baseline. Model names,
methods, fields, and feature availability must be confirmed through the
Capability Engine for each supported Odoo version and deployment type.

## External references

- Purple Crib architecture case study:
  https://www.purplecrib.ng/blog/ai-seo-strategy-5/how-i-built-a-375-tool-enterprise-mcp-server-for-odoo-architecture-deep-dive-345
- MCP specification 2025-11-25:
  https://modelcontextprotocol.io/specification/2025-11-25
- MCP tools specification:
  https://modelcontextprotocol.io/specification/2025-11-25/server/tools
- Odoo 19 External JSON-2 API:
  https://www.odoo.com/documentation/19.0/developer/reference/external_api.html
- Odoo 19 External RPC API:
  https://www.odoo.com/documentation/19.0/developer/reference/external_rpc_api.html
