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

### 3. Make Changes

Follow the [coding standards](#coding-standards) below.

### 4. Test Your Changes

```bash
cd rust-mcp
cargo test
cargo clippy
cargo fmt --check
```

### 5. Commit

```bash
git add .
git commit -m "Add feature: description of what you did"
```

### 6. Push and Create PR

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub.

---

## Coding Standards

### Rust Style

- Follow [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/)
- Use `cargo fmt` for formatting
- Fix all `cargo clippy` warnings
- Use `Result<T, E>` for error handling (avoid panics)
- Document public APIs with doc comments

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

Tools are defined in `tools.json`:

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

### 2. Implement Operation

Add handler in `rust-mcp/src/odoo/operations.rs`.

### 3. Update Seed Defaults

Copy changes to `rust-mcp/config-defaults/tools.json`.

### 4. Add Tests

Write tests for the new tool.

### 5. Update Documentation

Update `docs/functional/tools-reference.md`.

> **Note:** Avoid `anyOf`, `oneOf`, `allOf`, `$ref` in JSON Schema (Cursor compatibility).

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

## Pull Request Checklist

- [ ] Code follows project style
- [ ] Tests pass: `cargo test`
- [ ] Linting passes: `cargo clippy`
- [ ] Formatting correct: `cargo fmt --check`
- [ ] Documentation updated
- [ ] Commit messages are clear
- [ ] PR description explains changes

---

## Review Process

1. Submit PR with clear description
2. Maintainers review code quality and tests
3. Address feedback
4. Ensure CI passes
5. Merge!

---

## Getting Help

- **Questions:** [GitHub Discussions](https://github.com/rachmataditiya/odoo-rust-mcp/discussions)
- **Bugs:** [Issue Tracker](https://github.com/rachmataditiya/odoo-rust-mcp/issues)
- **Security:** See SECURITY.md

---

## License

By contributing, you agree that your contributions will be licensed under AGPL-3.0.

Thank you for contributing! 🚗
