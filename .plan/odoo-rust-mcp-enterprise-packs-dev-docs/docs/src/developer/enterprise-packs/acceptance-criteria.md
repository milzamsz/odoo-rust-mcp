# Acceptance Criteria

## Protocol and registry

- server negotiates the configured supported MCP version correctly;
- advertised capabilities match implementation;
- duplicate tool names fail startup;
- registry revisions increment deterministically;
- list-changed notifications work on supported transports;
- every new domain tool has input and output schemas.

## Capability

- installed module discovery is cached and refreshable;
- missing module, missing model, missing field, and missing access are distinct;
- failed refresh preserves the last valid snapshot as stale;
- write tools are not exposed when write capability is unknown;
- Config UI displays pack and tool skip reasons.

## Policy

- production defaults deny destructive generic tools;
- high-risk commands issue a signed confirmation challenge;
- changed arguments invalidate tokens;
- changed record state invalidates tokens;
- expired and reused tokens are rejected;
- bulk and cross-company limits are enforced before mutation;
- Employee private fields are denied by default.

## Workflow

- dry-run performs no mutation;
- manifests persist after each completed step;
- process restart can resume a safe run;
- completed idempotent steps are not repeated;
- uncertain outcomes trigger reconciliation;
- compensation is explicit and never generic deletion.

## Manufacturing

- pack requires Manufacturing capability;
- MO commands follow standard states;
- completion preview includes quantity variances;
- lot and serial requirements are validated;
- cost and quantity outputs include company, currency, and UoM;
- WIP/accounting operations are separated from operational completion.

## Website

- pack requires explicit website target;
- draft management and publication are separate tools;
- publication requires confirmation;
- output includes resulting URL and publication state;
- HTML sanitization is enforced;
- multi-website isolation is tested;
- view conflict diagnostics are available.

## Spreadsheet/Dashboard

- pack registers only when supported models and features are discovered;
- read tools respect source-model access;
- snapshot export records filters and timestamp;
- live formulas are not evaluated by arbitrary server-side code;
- dashboard changes require group/access validation;
- internal API drift fails safely.

## POS

- pack reports available POS configurations and current sessions;
- paid orders cannot be forged through generic write tools;
- close-session preview includes cash and payment differences;
- close, refund, and payment-impacting commands require confirmation;
- journal and payment method mappings are validated;
- offline POS client behavior is not falsely modeled as MCP transactionality.

## Employee

- ordinary profile returns public work fields only;
- private and sensitive fields require explicit HR profile;
- employee creation does not create an internal user by default;
- creating an internal user requires separate critical confirmation;
- bulk access is limited and audited;
- archive/offboarding uses standard workflow and explicit reason.

## Release

- all CI gates pass;
- compatibility report is published;
- known limitations are documented;
- rollback instructions are tested;
- no secrets or real personal data exist in fixtures.
