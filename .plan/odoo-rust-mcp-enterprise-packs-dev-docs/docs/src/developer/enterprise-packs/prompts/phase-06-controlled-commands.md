# Phase 06 Prompt: Controlled Commands

Implement signed confirmation tokens and selected domain commands:

- Manufacturing confirm/reserve/complete;
- Website publish/unpublish;
- POS open/close and refund;
- Employee create/update/archive.

Requirements:

- impact providers;
- state fingerprints;
- replay protection;
- policy thresholds;
- standard Odoo lifecycle actions;
- idempotency or reconciliation;
- audit events;
- end-to-end tests.

Block any command whose standard lifecycle behavior is not verified.
