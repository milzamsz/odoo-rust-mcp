# ADR-003: Signed Confirmation Tokens

## Status

Accepted.

## Context

A boolean confirmation can be supplied without proving that a human or client
reviewed the exact current impact.

## Decision

Use short-lived, single-use, signed tokens bound to actor, instance, normalized
request, record state, and policy revision.

## Consequences

- protection against payload escalation and stale approval;
- extra round trip;
- requires impact providers and token storage or replay protection.
