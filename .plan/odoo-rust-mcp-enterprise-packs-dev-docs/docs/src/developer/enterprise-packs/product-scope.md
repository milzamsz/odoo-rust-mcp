# Product Scope

## 1. Product vision

Make `odoo-rust-mcp` the safest practical MCP gateway for AI agents and
automation systems that need to inspect and operate Odoo across multiple
versions and instances.

The product should expose business capabilities, not merely remote procedure
calls.

## 2. Business problem

The existing generic MCP tools are useful for development and administration,
but production agents need stronger guarantees:

- a tool must not appear when its Odoo app is absent;
- a write must be rejected when the user or instance cannot safely perform it;
- destructive or financially material actions require explicit impact review;
- multi-step work must support dry-run, retry, and resumability;
- tool outputs must be structured and predictable;
- large tool catalogs must be scoped to the current instance, role, and task.

Without these controls, a capable agent becomes a fast way to create
inconsistent stock, accounting, website, POS, or employee data.

## 3. Users

### 3.1 Platform operator

Configures Odoo instances, authentication, enabled packs, policies, and
exposure profiles.

### 3.2 Solution architect

Defines domain pack boundaries, compatibility rules, and deployment profiles.

### 3.3 Agent developer

Consumes tools, resources, prompts, confirmation flows, and workflow manifests.

### 3.4 Functional consultant

Validates that domain tools follow standard Odoo lifecycle transitions.

### 3.5 Security or compliance reviewer

Reviews access, personal-data controls, audit events, and high-risk policies.

## 4. Product tiers

### MVP

- protocol alignment;
- extended tool metadata;
- capability snapshots;
- policy engine;
- signed confirmation tokens;
- Core plus one pilot domain pack;
- instance-scoped exposure;
- JSON file manifests.

### Production Lite

- multiple domain packs;
- Config UI support;
- structured output schemas;
- audit events and metrics;
- capability refresh;
- dry-run and idempotency;
- local manifest persistence.

### Production Standard

- all documented packs;
- compatibility matrix for Odoo 16-19;
- policy bundles;
- SQLite workflow and audit storage;
- profile-scoped tool exposure;
- end-to-end tests against Odoo fixtures.

### Enterprise Scale

Only when justified:

- distributed state storage;
- tenant-isolated workers;
- external secrets manager;
- centralized policy distribution;
- high availability;
- cross-region recovery;
- managed approval integration.

## 5. Scope

### In scope

- MCP tools, resources, and prompts;
- per-instance capability discovery;
- per-version compatibility adapters;
- domain pack registration;
- risk policy evaluation;
- confirmation-token flow;
- deterministic workflows;
- execution manifests;
- audit and metrics;
- Config UI enhancements;
- developer documentation and testing.

### Out of scope

- autonomous business decision making;
- Indonesian tax interpretation in MCP core;
- payroll calculations outside standard Odoo behavior;
- browser automation of Odoo UI;
- direct database access that bypasses Odoo ORM;
- replacement of Odoo module development;
- arbitrary Python code execution;
- generic server-action code execution.

## 6. Success metrics

Do not measure success by tool count.

Use:

- percentage of tool calls with validated structured outputs;
- denied unsafe calls before Odoo mutation;
- capability accuracy per supported instance;
- workflow resume success rate;
- number of production incidents caused by MCP writes;
- mean time to diagnose failed calls;
- compatibility test pass rate;
- median tools exposed per client profile;
- percentage of domain tools using standard Odoo transitions.

## 7. Product principles

1. Standard Odoo workflow before custom behavior.
2. Capability detection before tool registration.
3. Deny by default for high-risk operations.
4. Business-intent tools before arbitrary method calls.
5. One transaction boundary per remote Odoo call.
6. Idempotency and compensation before distributed-transaction fantasies.
7. Structured output before human-readable prose.
8. Personal and financial data receive stronger defaults.
9. Pack code can ship while runtime exposure remains conditional.
10. The generic tools remain available only through controlled profiles.
