# Testing Strategy

## 1. Test pyramid

### Unit tests

- schema validation;
- tool naming;
- duplicate detection;
- policy matching;
- token signing and verification;
- request hashing;
- output redaction;
- version adapter mapping;
- workflow state transitions.

### Contract tests

- MCP initialize and capability negotiation;
- tools/list;
- list-changed notification;
- tools/call structured output;
- error envelope;
- resource contracts.

### Integration tests

Run against controlled Odoo instances or fixtures:

- Odoo 16 Community;
- Odoo 18 Community;
- Odoo 18 Enterprise where licensed;
- Odoo 19 Community;
- Odoo 19 Enterprise where licensed.

### End-to-end tests

- MCP client to server to Odoo;
- Config UI to registry refresh;
- confirmation round trip;
- workflow failure and resume;
- profile-scoped tool exposure.

## 2. Golden capability fixtures

Store sanitized capability snapshots for each tested version and edition.

Tests verify:

- pack availability;
- tool registration count;
- skipped-tool reasons;
- adapter selection;
- unsupported feature behavior.

## 3. Policy tests

Every high-risk tool requires tests for:

- default denial;
- permitted profile;
- confirmation challenge;
- token success;
- expired token;
- modified payload;
- changed record state;
- record-count limit;
- cross-company denial.

## 4. Domain invariants

### Manufacturing

- completing an MO uses standard transition;
- component and finished quantities preserve units;
- lot/serial requirements are validated;
- cancellation requires reason when policy says so;
- uncertain timeout triggers reconciliation.

### Website

- publish requires explicit website;
- HTML sanitization applies;
- preview shows target URL;
- multi-website isolation works;
- scripts are denied by default.

### Spreadsheet/Dashboard

- read operations preserve access controls;
- formulas or dynamic data are not executed outside Odoo;
- snapshot export records timestamp and filters;
- dashboard access groups are enforced;
- internal model drift produces capability failure, not silent corruption.

### POS

- session open/close state is checked;
- refund links to original order when required;
- cash difference preview is accurate;
- journal and payment method mappings are validated;
- direct generic writes cannot forge paid orders.

### Employee

- public profile excludes private fields;
- sensitive fields require HR profile;
- employee creation does not create an internal user by default;
- bulk export is limited and audited;
- company and department access rules are respected.

## 5. Fault injection

Test:

- network timeout before response;
- timeout after probable Odoo commit;
- Odoo validation fault;
- expired authentication;
- record rule denial;
- capability snapshot expiry;
- manifest write failure;
- process restart during workflow;
- duplicate tool registration;
- invalid output schema.

## 6. Test data

Use synthetic data only.

Never commit:

- production database dumps;
- real employee information;
- real customer payment data;
- credentials;
- private website content;
- production API keys.

## 7. CI gates

Required:

```text
cargo fmt --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test --all-features
config-ui lint
config-ui typecheck
config-ui tests
config-ui build
documentation link check
pack manifest validation
policy fixture validation
```

## 8. Release matrix

A release must publish:

- core protocol test result;
- supported Odoo versions;
- tested editions;
- pack compatibility status;
- known limitations;
- migration notes;
- registry count by profile, not only total ceiling.
