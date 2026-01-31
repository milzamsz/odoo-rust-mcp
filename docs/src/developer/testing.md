# Testing Guide

How to run and write tests for odoo-rust-mcp.

---

## Running Tests

### Unit Tests

```bash
cd rust-mcp

# Run all tests
cargo test

# Run with output
cargo test -- --nocapture

# Run specific test
cargo test test_search_operation

# Run tests with warnings as errors
RUSTFLAGS='-Dwarnings' cargo test
```

### Integration Tests

```bash
# Run integration tests (requires Odoo instance)
cargo test --test integration_tests
```

---

## Smoke Testing

### WebSocket Smoke Client

End-to-end validation of MCP operations:

```bash
cd rust-mcp
cargo run --release --bin ws_smoke_client -- \
  --url ws://127.0.0.1:8787 \
  --instance default \
  --model res.partner
```

**Expected output:**
```
tools/list: 22 tools
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
  "status": "ok",
  "version": "1.0.0",
  "instance": {"name": "default", "reachable": true}
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

- [ ] **Odoo 19+**: Test API key authentication
- [ ] **Odoo <19**: Test username/password authentication
- [ ] **Multi-instance**: Test switching between instances

### Tools

- [ ] **Read tools**: search, search_read, read, count
- [ ] **Write tools**: create, update, delete
- [ ] **Workflow tools**: execute, workflow_action
- [ ] **Metadata tools**: list_models, get_model_metadata

### Config UI

- [ ] Login with default credentials
- [ ] Change password
- [ ] Edit tools.json
- [ ] Edit instances
- [ ] Enable/disable auth

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

### Mock Testing

```rust
#[test]
fn test_with_mock() {
    let mock_response = json!({
        "records": [{"id": 1, "name": "Test"}]
    });

    let client = MockOdooClient::with_response(mock_response);
    let result = client.search_read("res.partner", &[]).await;
    assert_eq!(result.records.len(), 1);
}
```

---

## Test Coverage

Check test coverage:

```bash
# Install cargo-tarpaulin
cargo install cargo-tarpaulin

# Run coverage
cargo tarpaulin --out Html
```

Open `tarpaulin-report.html` to view results.

---

## CI/CD Testing

GitHub Actions runs on every PR:

```yaml
# .github/workflows/ci.yml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - run: cargo test
      - run: cargo clippy -- -D warnings
      - run: cargo fmt --check
```

---

## Test Configuration

For tests requiring Odoo connection, set environment:

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
