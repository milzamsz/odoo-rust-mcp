# Accounting Pack

## Purpose

Financial document visibility and controlled accounting lifecycle operations.

## Typical modules

- `account`

## Primary models

- `account.move`
- `account.move.line`
- `account.payment`
- `account.journal`
- `account.account`
- version-specific reversal wizards

## Recommended tools

### Query

- `accounting_move_search`
- `accounting_move_get`
- `accounting_trial_balance_summary`
- `accounting_receivable_aging`
- `accounting_payable_aging`
- `accounting_reconciliation_status`

### Commands

- `accounting_invoice_post`
- `accounting_bill_post`
- `accounting_move_reverse_preview`
- `accounting_move_reverse`
- `accounting_payment_register_preview`

### Workflows

- `accounting_month_close_readiness`
- `accounting_dunning_preview`

## Policies

- posted entries cannot be directly updated or unlinked;
- reversal uses standard Odoo flow;
- financial mutation requires company and journal context;
- aggregates group by company and currency;
- payment execution is R4 and may remain out of scope;
- operational documents and journal postings are reported separately.
