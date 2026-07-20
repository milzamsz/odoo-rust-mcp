# ADR-002: Instance-Scoped Production Servers

## Status

Accepted as recommended default.

## Context

Tool availability differs by Odoo instance, version, edition, modules, access,
and policies. Shared tool lists become ambiguous.

## Decision

Recommend one MCP server process or logical endpoint per production Odoo
instance and exposure profile. Keep shared multi-instance mode for development
and administration.

## Consequences

- accurate tools/list;
- simpler tenant isolation;
- more deployment units;
- shared control-plane tooling may be needed later.
