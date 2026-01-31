# Odoo Rust MCP Documentation

Welcome to the official documentation for **odoo-rust-mcp**, a high-performance Model Context Protocol (MCP) server for Odoo ERP integration.

## Quick Links

### For Functional Users (End Users / IT Admins)

| Document | Description |
|----------|-------------|
| [Getting Started](./functional/getting-started.md) | Installation and first-time setup |
| [Configuration Guide](./functional/configuration.md) | Configuring instances, authentication, and options |
| [Tools Reference](./functional/tools-reference.md) | Complete reference for all 22 available tools |
| [Prompts Reference](./functional/prompts-reference.md) | Guide to built-in prompts for AI assistants |
| [Use Cases](./functional/use-cases.md) | Real-world examples and workflows |

### For Developers (Contributors)

| Document | Description |
|----------|-------------|
| [Architecture](./developer/architecture.md) | System design and code structure |
| [Building from Source](./developer/building.md) | Compiling and running locally |
| [Contributing Guide](./developer/contributing.md) | How to contribute to the project |
| [API Reference](./developer/api-reference.md) | Internal APIs and types |
| [Testing Guide](./developer/testing.md) | Running and writing tests |

---

## What is odoo-rust-mcp?

A Rust implementation of an MCP server that enables AI assistants (Claude, Cursor, etc.) to interact with Odoo ERP systems through a standardized protocol.

### Key Features

- ✅ **Multi-instance support** - Connect to multiple Odoo servers
- ✅ **Dual authentication** - API Keys (v19+) or Username/Password (< v19)
- ✅ **Multiple transports** - stdio, HTTP, SSE, WebSocket
- ✅ **Web UI** - Visual configuration interface on port 3008
- ✅ **Declarative tools** - Customize via JSON without recompiling
- ✅ **Production-ready** - Docker, Kubernetes, Helm support
