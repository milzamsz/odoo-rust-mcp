# ADR-004: No Embedded LLM in MCP Core

## Status

Accepted.

## Context

Domain workflows require orchestration but not model inference inside the
gateway.

## Decision

Keep the MCP server deterministic. The calling agent owns reasoning. Workflows
compose declared operations and policies only.

## Consequences

- easier testing and audit;
- no model runtime dependency;
- prompts and agent behavior remain external;
- workflow definitions must be explicit.
