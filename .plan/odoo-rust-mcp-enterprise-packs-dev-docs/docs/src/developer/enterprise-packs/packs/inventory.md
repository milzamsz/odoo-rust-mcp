# Inventory Pack

## Purpose

Stock visibility and controlled warehouse operations.

## Typical modules

- `stock`

## Primary models

- `stock.picking`
- `stock.move`
- `stock.move.line`
- `stock.quant`
- `stock.location`
- `stock.lot`
- `stock.scrap`

## Recommended tools

### Query

- `inventory_availability_get`
- `inventory_location_stock_get`
- `inventory_transfer_search`
- `inventory_transfer_get`
- `inventory_traceability_get`
- `inventory_replenishment_get`

### Commands

- `inventory_transfer_confirm`
- `inventory_transfer_assign`
- `inventory_transfer_validate`
- `inventory_transfer_cancel`
- `inventory_scrap_preview`
- `inventory_scrap_create`

### Workflows

- `inventory_transfer_execute`
- `inventory_replenishment_review`

## Policies

- no direct stock-quant write;
- lot and serial validation;
- source and destination locations explicit;
- quantities include UoM;
- negative stock follows instance policy;
- validation and scrap are high risk;
- uncertain timeouts require state reconciliation.
