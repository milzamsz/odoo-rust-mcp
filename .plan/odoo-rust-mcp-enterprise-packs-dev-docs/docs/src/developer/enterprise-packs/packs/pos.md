# Point of Sale Pack

## 1. Purpose

Provide POS configuration, session, order, payment, refund, cash-control, and
reporting capabilities without pretending that an MCP call is an offline POS
frontend.

Odoo POS is browser based and can continue through temporary network outages.
That offline frontend behavior is outside the MCP server's transaction model.

## 2. Pack boundaries

### Included

- POS configuration discovery;
- session and order reporting;
- payment method and journal diagnostics;
- cash-control preview;
- controlled session lifecycle;
- controlled refunds;
- employee login metadata where enabled;
- business snapshots.

### Excluded from base pack

- replacing the POS frontend;
- offline cart synchronization;
- payment-terminal device control;
- raw card data;
- forging paid orders using generic model writes;
- hardware drivers;
- IoT Box command control.

A separate O-POS or middleware product may use this pack, but must own offline
queueing and device behavior.

## 3. Typical modules

Required:

- `point_of_sale`

Optional:

- stock;
- account;
- employee login;
- loyalty;
- restaurant;
- IoT;
- payment terminal integrations.

## 4. Primary models

Typical models:

- `pos.config`
- `pos.session`
- `pos.order`
- `pos.order.line`
- `pos.payment`
- `pos.payment.method`
- `account.journal`
- `hr.employee` for employee login features

## 5. Tool catalog

### Query and reporting

- `pos_config_search`
- `pos_config_get`
- `pos_session_search`
- `pos_session_get`
- `pos_session_cash_summary`
- `pos_session_payment_summary`
- `pos_order_search`
- `pos_order_get`
- `pos_sales_summary`
- `pos_refund_summary`
- `pos_payment_method_health`
- `pos_journal_mapping_health`
- `pos_employee_access_summary`

### Session commands

- `pos_session_open_preview`
- `pos_session_open`
- `pos_session_close_preview`
- `pos_session_close`

### Refund commands

- `pos_refund_preview`
- `pos_refund_create`

### Controlled order intake

Only after a dedicated integration contract is proven:

- `pos_order_intake_preview`
- `pos_order_intake`

This is not a generic `pos.order.create`. It must validate taxes, pricelist,
customer, stock, payment, session, fiscal position, and idempotency.

### Workflows

- `pos_daily_close`
- `pos_cash_difference_review`
- `pos_refund_workflow`
- `pos_daily_business_snapshot`

## 6. Session close preview

Return:

- POS configuration;
- session;
- opening and closing operator;
- order count;
- gross and net sales;
- taxes;
- payment totals by method;
- expected cash;
- counted cash;
- difference;
- draft or problematic orders;
- accounting journal readiness;
- stock or invoice warnings;
- target closing action.

## 7. Accounting design

A POS operation can create or aggregate accounting and payment effects.

The pack must:

- separate operational POS order from resulting accounting moves;
- preserve payment method and journal mapping;
- return company and currency;
- never sum multiple currencies;
- avoid direct posted-entry mutation;
- route accounting reversal to Accounting pack;
- explain posting timing in command output.

## 8. Refund design

Preferred:

- original order reference;
- selected original lines and quantities;
- refund reason;
- payment or settlement plan;
- stock return behavior;
- invoice and accounting impact.

Standalone refunds are disabled by default.

## 9. Employee login

Employee access in POS is not equivalent to Odoo internal user creation.

- expose employee POS authorization metadata only when enabled;
- do not return private employee fields;
- changes require HR/POS admin policy;
- PIN or credential material is secret and never returned.

## 10. Policies

- reporting: R0-R1;
- open session: R2;
- close session: R3;
- cash difference over threshold: R4;
- refund: R3-R4;
- external payment or terminal action: out of scope by default;
- order intake: R3 and idempotency mandatory;
- no raw payment-card data;
- one active session rule follows Odoo configuration.

## 11. Idempotency

- session open: reconcile current state;
- session close: reconcile state and accounting results;
- refund: idempotency key mandatory;
- order intake: external order ID unique per instance/POS;
- payment action: provider idempotency key mandatory if ever enabled.

## 12. Acceptance tests

- paid order cannot be created through generic tools in production profile;
- close preview matches Odoo payment totals;
- stale token rejected after new POS order;
- cash difference threshold enforced;
- refund quantity cannot exceed allowed quantity;
- original order linkage maintained;
- payment credentials never logged;
- Employee private data is not exposed.
