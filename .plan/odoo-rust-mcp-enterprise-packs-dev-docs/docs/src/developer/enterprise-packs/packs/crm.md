# CRM Pack

## Purpose

Lead and opportunity management using structured lifecycle transitions.

## Typical modules

- `crm`

## Primary models

- `crm.lead`
- `crm.stage`
- `crm.lost.reason`
- `res.partner`

Exact fields and methods are compatibility-adapter concerns.

## Recommended tools

### Query

- `crm_lead_search`
- `crm_lead_get`
- `crm_pipeline_summary`
- `crm_stage_list`
- `crm_lost_reason_list`

### Commands

- `crm_lead_create`
- `crm_lead_update`
- `crm_lead_assign`
- `crm_lead_change_stage`
- `crm_lead_mark_won`
- `crm_lead_mark_lost`
- `crm_lead_restore`

### Workflows

- `crm_lead_intake`
- `crm_lead_qualify`
- `crm_pipeline_review`

## Policies

- lost requires a reason;
- merge requires preview;
- bulk stage changes require limits;
- contact creation is separate from internal user creation;
- email and phone output follows data-minimization policy.
