# Introduction

## What is the Model Context Protocol (MCP)?

The [Model Context Protocol](https://modelcontextprotocol.io/) is an open standard that enables AI assistants to interact with external tools and data sources through a unified interface. Instead of building custom integrations for each AI platform, MCP provides a single protocol that works across clients like Cursor, Claude Desktop, Claude Code, Windsurf, and others.

## What is odoo-rust-mcp?

**odoo-rust-mcp** is a high-performance MCP server written in Rust that bridges AI assistants with [Odoo ERP](https://www.odoo.com/) systems. It translates natural language requests from AI tools into Odoo API calls, enabling you to query, create, update, and manage Odoo data through conversational AI.

### Key Capabilities

- **24 tools** covering CRUD operations, workflow actions, reports, model discovery, and database cleanup
- **7 built-in prompts** providing Odoo domain knowledge (models, filters, field types, workflows)
- **Multi-instance support** connecting to multiple Odoo servers (production, staging, development) simultaneously
- **Dual authentication** supporting API keys (Odoo 19+ JSON-2 API) and username/password (Odoo <19 JSON-RPC)
- **Multiple transports** including stdio (for AI clients), HTTP (for remote access), WebSocket, and SSE
- **Web-based Config UI** on port 3008 for visual configuration without editing JSON files
- **Fully declarative tools** defined in JSON, customizable without recompiling
- **Hot-reload** configuration changes apply instantly without restarting the server
- **Production-ready** with Docker, Kubernetes, Helm, systemd, and Windows service support

### Who Is This For?

| Audience | Use Case |
|----------|----------|
| **Odoo users & IT admins** | Query data, generate reports, and automate workflows through AI assistants |
| **Developers** | Build AI-powered Odoo integrations, extend the tool set, contribute to the project |
| **DevOps engineers** | Deploy and manage the MCP server in production environments |

### Technical Details

- **Language**: Rust (2024 edition)
- **License**: AGPL-3.0
- **Version**: 0.3.30
- **Repository**: [github.com/rachmataditiya/odoo-rust-mcp](https://github.com/rachmataditiya/odoo-rust-mcp)

## Documentation Structure

This documentation is organized into two sections:

### Functional Documentation (Users & Admins)

- [Getting Started](./functional/getting-started.md) - Installation and first-time setup
- [Configuration](./functional/configuration.md) - Instances, authentication, environment variables, CLI options
- [Tools Reference](./functional/tools-reference.md) - Complete reference for all 24 tools
- [Prompts Reference](./functional/prompts-reference.md) - Built-in prompts for Odoo domain knowledge
- [Use Cases](./functional/use-cases.md) - Real-world examples and workflows
- [Deployment](./functional/deployment.md) - Docker, Kubernetes, Helm, systemd, Windows service

### Developer Documentation (Contributors)

- [Building from Source](./developer/building.md) - Prerequisites, build order, development setup
- [Architecture](./developer/architecture.md) - System design, code structure, data flows
- [API Reference](./developer/api-reference.md) - MCP protocol, HTTP endpoints, Config UI API
- [Testing](./developer/testing.md) - Running and writing tests, CI pipeline
- [Contributing](./developer/contributing.md) - How to contribute tools, prompts, and features
