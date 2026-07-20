# Purchase Pack

## Purpose

Request for quotation and purchase-order lifecycle.

## Typical modules

- `purchase`

## Primary models

- `purchase.order`
- `purchase.order.line`
- `res.partner`
- `product.supplierinfo`

## Recommended tools

### Query

- `purchase_order_search`
- `purchase_order_get`
- `purchase_receipt_status`
- `purchase_bill_status`
- `purchase_vendor_performance`

### Commands

- `purchase_rfq_create`
- `purchase_rfq_update`
- `purchase_rfq_send_preview`
- `purchase_order_confirm`
- `purchase_order_cancel`
- `purchase_order_create_bill`

### Workflows

- `purchase_vendor_bill_intake`
- `purchase_replenishment_review`

## Policies

- vendor and company must be explicit;
- price and currency changes are audited;
- bill creation does not imply posting;
- cancellation checks receipts and bills;
- sending and bulk confirmation require preview.
