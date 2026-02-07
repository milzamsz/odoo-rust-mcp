# Testing Guide

How to run and write tests for odoo-rust-mcp.

---

## Rust Tests

### Unit Tests

```bash
cd rust-mcp

# Run all tests
cargo test

# Run with output
cargo test -- --nocapture

# Run specific test
cargo test test_search_operation

# Run tests with warnings as errors (same as CI)
RUSTFLAGS='-Dwarnings' cargo test
```

### Config Manager Tests

The config manager has dedicated unit and integration tests that run with sequential threading to avoid port conflicts:

```bash
cd rust-mcp

# Unit tests (in-process)
cargo test --lib config_manager -- --nocapture --test-threads=1

# Integration tests (spawns actual HTTP server)
cargo test --test config_manager -- --nocapture
```

### Cross-Platform Tests

Tests run on Linux, macOS, and Windows in CI:

```bash
# Run all tests with all features enabled (same as CI matrix)
cargo test --all-features
```

---

## Config UI Tests

The React Config UI uses Vitest with Istanbul coverage:

```bash
cd config-ui

# Run tests
npm test

# Run tests with coverage report
npm run test:coverage

# Type checking (not tests, but catches errors)
npm run typecheck

# Linting
npm run lint
```

Coverage output is written to `config-ui/coverage/` in Cobertura XML format.

---

## Smoke Testing

### WebSocket Smoke Client

End-to-end validation of MCP operations against a running server:

```bash
cd rust-mcp
cargo run --release --bin ws_smoke_client -- \
  --url ws://127.0.0.1:8787 \
  --instance default \
  --model res.partner
```

**Expected output:**
```
tools/list: 24 tools
- odoo_search
- odoo_search_read
- odoo_read
- ...
odoo_count result: {"count":18}
odoo_search_read count: 2
prompts/list: odoo_common_models, odoo_domain_filters
```

### HTTP Health Check

```bash
curl http://127.0.0.1:8787/health
```

**Expected:**
```json
{
  "service": "odoo-rust-mcp",
  "status": "ok"
}
```

### Config UI Health Check

```bash
curl http://127.0.0.1:3008/health
```

**Expected:**
```json
{
  "service": "odoo-rust-mcp-config",
  "status": "ok"
}
```

---

## Manual Testing Checklist

### Transport Modes

- [ ] **stdio**: Test with Cursor or Claude Desktop
- [ ] **HTTP**: Test with curl or Postman
- [ ] **WebSocket**: Test with ws_smoke_client
- [ ] **SSE**: Test streaming responses

### Authentication

- [ ] **Odoo 19+**: Test API key authentication (JSON-2 client)
- [ ] **Odoo <19**: Test username/password authentication (JSON-RPC client)
- [ ] **Multi-instance**: Test switching between instances
- [ ] **MCP HTTP auth**: Test Bearer token authentication

### Tools

- [ ] **Read tools**: search, search_read, read, count, name_search, name_get
- [ ] **Write tools**: create, create_batch, update, delete, copy
- [ ] **Workflow tools**: execute, workflow_action
- [ ] **Metadata tools**: list_models, get_model_metadata, default_get, check_access
- [ ] **Advanced tools**: read_group, onchange, generate_report
- [ ] **Cleanup tools**: database_cleanup, deep_cleanup (requires `ODOO_ENABLE_CLEANUP_TOOLS=true`)

### Config UI

- [ ] Login with default credentials
- [ ] Change password
- [ ] Edit instances (add, modify, remove)
- [ ] Edit tools (enable/disable)
- [ ] Edit prompts
- [ ] Edit server metadata
- [ ] Enable/disable MCP HTTP auth
- [ ] Generate MCP auth token

---

## Writing Tests

### Unit Test Example

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_domain() {
        let domain = r#"[["name", "=", "Test"]]"#;
        let result = parse_domain(domain);
        assert!(result.is_ok());
    }

    #[test]
    fn test_invalid_domain() {
        let domain = "invalid";
        let result = parse_domain(domain);
        assert!(result.is_err());
    }
}
```

### Async Test Example

```rust
#[tokio::test]
async fn test_odoo_client() {
    let client = OdooClient::new(config).await.unwrap();
    let result = client.search("res.partner", &[]).await;
    assert!(result.is_ok());
}
```

---

## Test Coverage

### Rust Coverage (cargo-tarpaulin)

```bash
cd rust-mcp

# Install tarpaulin
cargo install cargo-tarpaulin

# Generate HTML report
cargo tarpaulin --all-targets --all-features --out Html

# Generate Cobertura XML (for CI upload)
cargo tarpaulin --all-targets --all-features --out xml --output-dir coverage
```

### TypeScript Coverage (Istanbul via Vitest)

```bash
cd config-ui
npm run test:coverage
```

Coverage reports are uploaded to Codecov in CI.

---

## CI/CD Pipeline

GitHub Actions runs on every push to `main` and on pull requests. The pipeline has 4 stages:

### Stage 1: Build UI

Builds the React Config UI first (required dependency for all other jobs):

```
build-ui
  -> npm ci
  -> npm run build
  -> Upload artifact: config-ui-dist
```

### Stage 2: Parallel Quality Checks

All run in parallel after `build-ui` completes:

| Job | Description |
|-----|-------------|
| **check** | `cargo check --all-features` |
| **fmt** | `cargo fmt --all --check` |
| **clippy** | `cargo clippy -- -D warnings` |
| **test** | `cargo test` on Linux, macOS, Windows |
| **ui-tests** | `npm test` (Vitest) |
| **coverage** | Rust (tarpaulin) + TypeScript (Istanbul), uploaded to Codecov |
| **security** | `cargo audit` |
| **config-tests** | Config manager unit + integration tests |
| **config-integration** | Builds release binary, starts HTTP server, tests endpoints |
| **helm-validation** | `helm lint` + `helm template` validation |
| **docker-test** | Docker image build test |

### Stage 3: Build Release Binary

Runs after quality checks pass:

```
build-release (needs: build-ui, check, fmt, clippy, ui-tests)
  -> Download config-ui-dist artifact
  -> cargo build --release
```

### Stage 4: Service Integration Tests

Tests real deployment scenarios:

| Job | Description |
|-----|-------------|
| **test-systemd-service** | Installs binary + systemd unit, tests lifecycle (start/restart/stop), tests HTTP + MCP endpoints |
| **test-macos-service** | Builds and runs binary on macOS, tests HTTP + MCP endpoints |

### Pipeline Diagram

```
build-ui
    |
    +---> check --------+
    +---> fmt ----------+
    +---> clippy -------+---> build-release ---> test-systemd-service
    +---> ui-tests -----+
    +---> test (matrix)
    +---> coverage
    +---> security
    +---> config-tests
    +---> config-integration
    +---> helm-validation
    +---> docker-test
    +---> test-macos-service
```

---

## Test Configuration

For tests requiring an Odoo connection, set environment variables:

```bash
export TEST_ODOO_URL=http://localhost:8069
export TEST_ODOO_DB=test_db
export TEST_ODOO_API_KEY=test_key
```

Or use `.env.test`:

```bash
TEST_ODOO_URL=http://localhost:8069
TEST_ODOO_DB=test_db
TEST_ODOO_VERSION=18
TEST_ODOO_USERNAME=admin
TEST_ODOO_PASSWORD=admin
```

---

## Debugging Tests

```bash
# Run with debug output
RUST_LOG=debug cargo test -- --nocapture

# Run single test with backtrace
RUST_BACKTRACE=1 cargo test test_name -- --nocapture
```
