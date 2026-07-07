# Proposal: Runtime Tool Catalog Drift Import

## Problem

Upgrades can add tools to `rust-mcp/config-defaults/tools.json`, but existing users keep a live runtime `tools.json` under `~/.config/odoo-rust-mcp/`. The Config UI currently shows only the runtime catalog, so newly shipped tools can be invisible until a user manually edits or resets runtime config.

This happened with `odoo_stock_inventory_reversal_cleanup`: checked-in catalogs had 23 tools while the live runtime catalog had 22.

## Goal

Expose catalog drift in the Tools UI and provide a safe import action that appends missing shipped tools to the live runtime catalog without overwriting local edits.

## Non-Goals

- Do not automatically mutate runtime config during startup.
- Do not overwrite existing runtime tool definitions.
- Do not merge changed schemas for tools that already exist by name.
- Do not add network-based catalog sources.
