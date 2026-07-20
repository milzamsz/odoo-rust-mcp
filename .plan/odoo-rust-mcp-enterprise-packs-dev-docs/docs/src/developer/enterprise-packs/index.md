# Enterprise Packs

## Purpose

Enterprise Packs extend `odoo-rust-mcp` with domain-oriented tools and workflows
without weakening the generic MCP core.

The architecture separates five concerns:

1. **Protocol and transport**  
   MCP lifecycle, request routing, sessions, authentication, and notifications.

2. **Odoo connectivity**  
   JSON-2 for Odoo 19+, legacy JSON-RPC for supported earlier versions, timeout,
   retry, context, and error normalization.

3. **Capability and compatibility**  
   Installed modules, available models and fields, Odoo edition, user access,
   deployment restrictions, and version-specific adapters.

4. **Policy and execution safety**  
   Read/write boundaries, record limits, confirmation tokens, dry-run,
   idempotency, financial and personal-data safeguards.

5. **Domain packs and workflows**  
   Business-intent tools for CRM, Sales, Purchase, Inventory, Accounting,
   Project, Manufacturing, Website, Spreadsheet/Dashboard, POS, and Employee.

## Non-goals

This initiative does not:

- embed an LLM, vector database, or agent runtime inside the MCP server;
- replace Odoo access rights, record rules, or standard business workflows;
- implement client-specific tax, payroll, HR, or approval policies in core;
- expose every Odoo model method as a first-class production tool;
- make cross-call Odoo workflows magically atomic;
- guarantee that internal Enterprise models remain stable across versions.

## Key decision

The MCP server remains a deterministic gateway. Intelligence stays in the
calling agent. The server owns contracts, validation, policy, execution,
auditability, and recovery metadata.

## Documentation map

- [Product Scope](product-scope.md)
- [Architecture](architecture.md)
- [Domain Model](domain-model.md)
- [Technical Design](technical-design.md)
- [Tool Pack Framework](tool-pack-framework.md)
- [Capability Engine](capability-engine.md)
- [Policy and Security](policy-security.md)
- [Workflow Runtime](workflow-runtime.md)
- [API Contracts](api-contracts.md)
- [Configuration](configuration.md)
- [Observability](observability.md)
- [Testing Strategy](testing-strategy.md)
- [Migration Plan](migration-plan.md)
- [Implementation Plan](implementation-plan.md)
- [Acceptance Criteria](acceptance-criteria.md)
- [Agent Development Guide](agents.md)
