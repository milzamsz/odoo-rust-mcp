# ADR-001: Domain Packs Over Tool Count

## Status

Accepted.

## Context

A large Odoo integration can contain hundreds of possible operations. Exposing
all operations as tools increases maintenance and agent-selection cost.

## Decision

Organize tools into capability-gated domain packs and exposure profiles. Tool
count is not a product objective.

## Consequences

- smaller default catalogs;
- clearer ownership;
- conditional registration;
- more profile and compatibility work;
- better production safety.
