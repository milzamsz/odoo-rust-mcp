//! Optional live smoke test.
//!
//! Run with a configured instances file and instance name:
//! ODOO_INSTANCES_JSON=/abs/instances.json ODOO_E2E_INSTANCE=odoo18ce \
//!   cargo test --manifest-path rust-mcp/Cargo.toml --test module_capabilities_live -- --ignored --nocapture

use mcp_rust_sdk::server::ServerHandler;
use rust_mcp::mcp::McpOdooHandler;
use rust_mcp::mcp::registry::Registry;
use rust_mcp::mcp::tools::OdooClientPool;
use serde_json::json;
use std::sync::Arc;

#[tokio::test]
#[ignore = "requires a live Odoo instance"]
async fn module_gated_tool_matches_live_installed_modules() {
    let instance = std::env::var("ODOO_E2E_INSTANCE").expect("set ODOO_E2E_INSTANCE");
    let temp = tempfile::tempdir().unwrap();
    let manifest = std::path::Path::new(env!("CARGO_MANIFEST_DIR"));
    for name in ["tools.json", "prompts.json", "server.json"] {
        std::fs::copy(manifest.join("config").join(name), temp.path().join(name)).unwrap();
    }
    if let Ok(raw) = std::env::var("ODOO_E2E_INSTANCES") {
        std::fs::write(temp.path().join("instances.json"), raw).unwrap();
    }
    // SAFETY: this ignored test is a single-process smoke check and does not spawn competing tests.
    unsafe {
        std::env::set_var("MCP_TOOLS_JSON", temp.path().join("tools.json"));
        std::env::set_var("MCP_PROMPTS_JSON", temp.path().join("prompts.json"));
        std::env::set_var("MCP_SERVER_JSON", temp.path().join("server.json"));
        if temp.path().join("instances.json").exists() {
            std::env::set_var("ODOO_INSTANCES_JSON", temp.path().join("instances.json"));
        }
        std::env::set_var("ODOO_ENABLE_WRITE_TOOLS", "true");
        std::env::set_var("ODOO_ENABLE_CLEANUP_TOOLS", "true");
    }

    let pool = OdooClientPool::from_env().unwrap();
    let snapshot = pool.refresh_module_snapshot(&instance).await.unwrap();
    let registry = Arc::new(Registry::from_env());
    registry.initial_load().await.unwrap();
    let handler = McpOdooHandler::new(pool, registry);
    let response = handler
        .handle_method("tools/list", Some(json!({})))
        .await
        .unwrap();
    let names: Vec<_> = response["tools"]
        .as_array()
        .unwrap()
        .iter()
        .filter_map(|tool| tool["name"].as_str())
        .collect();

    assert_eq!(
        names.contains(&"odoo_stock_inventory_reversal_cleanup"),
        snapshot.modules.contains("stock"),
        "stock-gated tool visibility must match the live module snapshot"
    );
    println!(
        "{} {} {} modules; stock tool visible={}",
        snapshot.instance,
        snapshot.version.as_deref().unwrap_or("unknown"),
        snapshot.modules.len(),
        names.contains(&"odoo_stock_inventory_reversal_cleanup")
    );
}
