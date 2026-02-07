# Contributing Guide

Thank you for your interest in contributing to odoo-rust-mcp!

---

## Quick Start

1. **Fork** the repository on GitHub
2. **Clone** your fork locally
3. **Create** a feature branch
4. **Make** your changes
5. **Test** your changes
6. **Submit** a pull request

---

## Development Workflow

### 1. Fork and Clone

```bash
git clone https://github.com/YOUR-USERNAME/odoo-rust-mcp.git
cd odoo-rust-mcp
```

### 2. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### 3. Build the Project

The React UI must be built before the Rust binary. See [Building from Source](building.md) for details.

```bash
# Build config UI first
cd config-ui && npm ci && npm run build && cd ..

# Build Rust server
cd rust-mcp && cargo build && cd ..
```

### 4. Make Changes

Follow the [coding standards](#coding-standards) below.

### 5. Test Your Changes

```bash
# Rust tests and linting
cd rust-mcp
cargo test
cargo clippy -- -D warnings
cargo fmt --check

# Config UI tests and linting (if you changed config-ui/)
cd ../config-ui
npm test
npm run typecheck
npm run lint
```

### 6. Commit

```bash
git add .
git commit -m "Add feature: description of what you did"
```

### 7. Push and Create PR

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub.

---

## Coding Standards

### Rust Style

- Follow [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/)
- Use `cargo fmt` for formatting
- Fix all `cargo clippy` warnings (CI runs with `-D warnings`)
- Use `Result<T, E>` for error handling (avoid panics)
- Document public APIs with doc comments
- Edition: Rust 2024 (requires rustc 1.85+)

**Example documentation:**
```rust
/// Brief description.
///
/// Detailed description if needed.
///
/// # Examples
///
/// ```
/// let result = my_function();
/// ```
pub fn my_function() -> Result<()> {
    // ...
}
```

### TypeScript Style (Config UI)

- React 18 with functional components and hooks
- TypeScript strict mode
- Tailwind CSS for styling
- Vitest for tests
- Follow existing patterns in `config-ui/src/`

### Commit Messages

- Start with a verb: "Add", "Fix", "Update", "Remove"
- Keep first line under 72 characters
- Reference issues: "Fixes #123"

**Examples:**
```
Add support for Odoo 19 JSON-2 API

Implements authentication via API keys and uses the new /json/2/ endpoint.
Fixes #42
```

---

## Adding New Tools

Tools are defined declaratively in `tools.json`. No Rust code changes are needed for simple tools.

### 1. Add Tool Definition

Edit `rust-mcp/config/tools.json`:

```json
{
  "name": "odoo_my_new_tool",
  "description": "Description of what the tool does",
  "inputSchema": {
    "type": "object",
    "properties": {
      "instance": { "type": "string" },
      "model": { "type": "string" }
    },
    "required": ["instance", "model"]
  },
  "op": {
    "type": "my_operation_type",
    "map": {
      "instance": "/instance",
      "model": "/model"
    }
  }
}
```

### 2. Implement Operation Handler (if new op type)

If your tool uses an existing `op.type` (e.g., `search_read`, `execute`), no Rust changes are needed.

For a new operation type, add a handler in `rust-mcp/src/mcp/tools.rs`:

1. Add a new `op_my_operation()` async function
2. Add the type to the `execute_op()` match statement
3. Write tests

### 3. Update Seed Defaults

Copy changes to `rust-mcp/config-defaults/tools.json` so new installations get the tool.

### 4. Add Tests

Write tests for the new tool.

### 5. Update Documentation

Update `docs/src/functional/tools-reference.md`.

> **Note:** Avoid `anyOf`, `oneOf`, `allOf`, `$ref` in JSON Schema -- Cursor rejects these.

---

## Adding New Prompts

Edit `rust-mcp/config/prompts.json`:

```json
{
  "name": "my_new_prompt",
  "description": "What this prompt provides",
  "content": "The actual prompt content..."
}
```

Update `config-defaults/prompts.json` and documentation.

---

## Contributing to Config UI

The Config UI is in `config-ui/` and uses React 18 + TypeScript + Vite + Tailwind CSS.

### Development Workflow

```bash
cd config-ui

# Install dependencies
npm ci

# Start development server with HMR
npm run dev
# Access at http://localhost:5173

# In another terminal, start the Rust server
cd rust-mcp && cargo run -- --transport http --listen 127.0.0.1:8787
```

### Project Structure

```
config-ui/src/
+-- App.tsx              # Main app (5-tab layout with auth)
+-- components/tabs/     # InstancesTab, ToolsTab, PromptsTab, ServerTab, SecurityTab
+-- hooks/               # useConfig, useAuth custom hooks
+-- __tests__/           # Vitest tests
+-- types.ts             # TypeScript types mirroring Rust config structs
```

### Adding a New Tab

1. Create `config-ui/src/components/tabs/MyNewTab.tsx`
2. Add the tab to `App.tsx`
3. Create types in `types.ts` if needed
4. Add tests in `__tests__/`

---

## Pull Request Checklist

### Rust Changes

- [ ] Tests pass: `cargo test`
- [ ] Linting passes: `cargo clippy -- -D warnings`
- [ ] Formatting correct: `cargo fmt --check`

### Config UI Changes

- [ ] Tests pass: `npm test`
- [ ] Type checking passes: `npm run typecheck`
- [ ] Linting passes: `npm run lint`
- [ ] Production build succeeds: `npm run build`

### General

- [ ] Documentation updated (if applicable)
- [ ] Commit messages are clear and descriptive
- [ ] PR description explains changes
- [ ] Both `config-defaults/` and `config/` updated (if adding tools/prompts)

---

## Review Process

1. Submit PR with clear description
2. CI must pass (build-ui, tests, clippy, fmt, coverage)
3. Maintainers review code quality and tests
4. Address feedback
5. Merge!

---

## Getting Help

- **Questions:** [GitHub Discussions](https://github.com/rachmataditiya/odoo-rust-mcp/discussions)
- **Bugs:** [Issue Tracker](https://github.com/rachmataditiya/odoo-rust-mcp/issues)
- **Security:** See SECURITY.md

---

## License

By contributing, you agree that your contributions will be licensed under AGPL-3.0.
