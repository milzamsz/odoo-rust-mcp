# Iteration 1

- [x] Inspect existing cleanup modules and MCP tool dispatch.
- [x] Add stock inventory reversal cleanup module.
- [x] Register `odoo_stock_inventory_reversal_cleanup` in tool configs.
- [x] Validate Rust implementation with focused tests and cargo check.
- [x] Create ERP CA safe reversal payload.
- [x] Dry-run safe reversal against `erp-ca-prod`.
- [x] Apply safe reversal through MCP cleanup tool.
- [x] Fix legacy JSON-RPC void action response handling.
- [x] Re-apply remaining safe reversal rows.
- [x] Record final execution result CSV.
- [x] Refresh and document blocked high-risk rows.
- [x] Dry-run approved negative-result reversals with `allowNegative=true`.
- [x] Apply remaining three wrong adjustment reversals.
- [x] Record negative-result execution CSV and final grand total.
