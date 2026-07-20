# Sales Pack

## Purpose

Quotation and sales-order lifecycle.

## Typical modules

- `sale_management`

## Primary models

- `sale.order`
- `sale.order.line`
- `res.partner`
- `product.product`
- `product.pricelist`

## Recommended tools

### Query

- `sales_order_search`
- `sales_order_get`
- `sales_order_margin_summary`
- `sales_order_delivery_status`
- `sales_order_invoice_status`

### Commands

- `sales_quotation_create`
- `sales_quotation_update`
- `sales_quotation_send_preview`
- `sales_order_confirm`
- `sales_order_cancel`
- `sales_order_create_invoice`

### Workflows

- `sales_quote_to_order`
- `sales_order_fulfillment_snapshot`

## Policies

- confirmation checks price, currency, company, customer, and availability;
- sending requires audience preview;
- cancellation requires reason when downstream documents exist;
- invoice creation remains separate from invoice posting;
- money aggregates never cross-sum currencies.
