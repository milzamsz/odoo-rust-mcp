# ADR-005: Spreadsheet Internal APIs Behind Adapter

## Status

Accepted.

## Context

Odoo Spreadsheet and Dashboard internals can vary across versions and editions.

## Decision

Public tools use stable domain contracts. Version-specific models, JSON
structures, and commands remain behind compatibility adapters. The first
release is read and snapshot oriented.

## Consequences

- safer upgrades;
- more fixture work;
- raw spreadsheet editing is delayed;
- unsupported internals fail closed.
