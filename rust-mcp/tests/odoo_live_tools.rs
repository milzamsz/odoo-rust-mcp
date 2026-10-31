//! Runs the read tools against a real Odoo started by `scripts/odoo-test-db.sh`. Ignored by default.
//!
//! set -a; . <(scripts/odoo-test-db.sh 20.0 28069); set +a
//! cargo test --manifest-path rust-mcp/Cargo.toml --test odoo_live_tools -- --ignored --nocapture

use rust_mcp::mcp::registry::OpSpec;
use rust_mcp::mcp::tools::{OdooClientPool, execute_op};
use rust_mcp::odoo::version::{OdooVersion, fetch_version_info};
use serde_json::{Value, json};
use url::Url;

fn env(key: &str) -> Option<String> {
    std::env::var(key).ok().filter(|v| !v.is_empty())
}

fn op_for(tool: &str) -> OpSpec {
    let raw = include_str!("../config-defaults/tools.json");
    let tools: Value = serde_json::from_str(raw).unwrap();
    let def = tools["tools"]
        .as_array()
        .unwrap()
        .iter()
        .find(|t| t["name"] == tool)
        .unwrap_or_else(|| panic!("{tool} missing from config-defaults/tools.json"));
    serde_json::from_value(def["op"].clone()).unwrap()
}

async fn call(pool: &OdooClientPool, tool: &str, args: Value) -> Value {
    let mut args = args;
    args["instance"] = json!("live");
    let result = execute_op(pool, &op_for(tool), args)
        .await
        .unwrap_or_else(|e| panic!("{tool}: {e}"));
    let text = result["content"][0]["text"].as_str().unwrap();
    let body: Value = serde_json::from_str(text).unwrap_or(json!(text));
    println!(
        "{tool}: {}",
        &body.to_string()[..body.to_string().len().min(200)]
    );
    body
}

#[tokio::test]
#[ignore = "requires a live Odoo from scripts/odoo-test-db.sh"]
async fn test_should_run_read_tools_on_live_odoo() {
    let url = env("ODOO_LIVE_URL").expect("set ODOO_LIVE_URL");
    let major: u32 = env("ODOO_LIVE_VERSION").unwrap().parse().unwrap();

    let info = fetch_version_info(&reqwest::Client::new(), &Url::parse(&url).unwrap())
        .await
        .unwrap();
    assert_eq!(
        OdooVersion::parse(&info.server_version).unwrap().major,
        major
    );

    let instances = json!({"live": {
        "url": url, "db": env("ODOO_LIVE_DB"), "apiKey": env("ODOO_LIVE_API_KEY"),
        "username": env("ODOO_LIVE_USERNAME"), "password": env("ODOO_LIVE_PASSWORD"),
        "version": major.to_string(), "timeout_ms": 30_000, "max_retries": 1,
    }});
    let temp = tempfile::tempdir().unwrap();
    let path = temp.path().join("instances.json");
    std::fs::write(&path, instances.to_string()).unwrap();
    // SAFETY: single ignored test; nothing else reads the environment concurrently.
    unsafe { std::env::set_var("ODOO_INSTANCES_JSON", &path) };
    let pool = OdooClientPool::from_env().unwrap();

    let groups = call(
        &pool,
        "odoo_read_group",
        json!({"model": "res.partner", "domain": [], "groupby": ["is_company"],
               "aggregates": ["__count", "id:max"], "order": "id:max desc"}),
    )
    .await;
    let first = &groups["groups"][0];
    assert!(first["__count"].as_i64().unwrap() > 0 && first.get("id:max").is_some());

    let names = call(
        &pool,
        "odoo_name_get",
        json!({"model": "res.partner", "ids": [1]}),
    )
    .await;
    assert_eq!(names["names"][0][0], 1);

    let access = call(
        &pool,
        "odoo_check_access",
        json!({"model": "res.partner", "operation": "write"}),
    )
    .await;
    assert_eq!(access["has_access"], true);

    let rules = call(
        &pool,
        "odoo_access_rules",
        json!({"model": "res.partner", "operation": "read"}),
    )
    .await;
    let expected = if major >= 20 {
        "ir.access"
    } else {
        "ir.model.access+ir.rule"
    };
    assert_eq!(rules["source"], expected);

    // Binary fields come back as base64 strings (or false) on every version.
    let partner = call(
        &pool,
        "odoo_search_read",
        json!({"model": "res.partner", "domain": [["id", "=", 1]], "fields": ["image_128"]}),
    )
    .await;
    let records = partner.get("records").unwrap_or(&partner);
    assert!(!records[0]["image_128"].is_object(), "{partner}");

    if major >= 17 {
        let read = call(
            &pool,
            "odoo_web_search_read",
            json!({"model": "res.partner", "specification": {"name": {}, "country_id": {"fields": {"display_name": {}}}}, "limit": 1}),
        )
        .await;
        assert!(read["length"].as_i64().unwrap() > 0);
    }

    let cleanup = call(
        &pool,
        "odoo_database_cleanup",
        json!({"dryRun": true, "daysThreshold": 30}),
    )
    .await;
    assert_eq!(cleanup["errors"], json!([]), "{cleanup}");
}
