//! End-to-end tests for per-instance tool configuration.

mod common;

use axum::{
    Json, Router,
    extract::State,
    http::{HeaderName, HeaderValue, StatusCode},
    response::IntoResponse,
    routing::{get, post},
};
use axum_test::TestServer;
use common::{MockOdooServer, responses};
use rust_mcp::config_manager::ConfigManager;
use rust_mcp::mcp::McpOdooHandler;
use rust_mcp::mcp::http::{AuthConfig, create_app};
use rust_mcp::mcp::registry::Registry;
use rust_mcp::mcp::tools::OdooClientPool;
use serde_json::{Value, json};
use std::sync::Arc;
use tempfile::TempDir;
use wiremock::matchers::{body_partial_json, method, path_regex};
use wiremock::{Mock, ResponseTemplate};

const MCP_SESSION_HEADER: &str = "mcp-session-id";

struct EnvGuard {
    previous: Vec<(&'static str, Option<String>)>,
}

impl EnvGuard {
    fn set(pairs: &[(&'static str, String)]) -> Self {
        let previous = pairs
            .iter()
            .map(|(key, _)| (*key, std::env::var(key).ok()))
            .collect::<Vec<_>>();

        for (key, value) in pairs {
            // SAFETY: Tests mutate process env to point the app at isolated temp files.
            unsafe {
                std::env::set_var(key, value);
            }
        }

        Self { previous }
    }
}

impl Drop for EnvGuard {
    fn drop(&mut self) {
        for (key, value) in &self.previous {
            // SAFETY: Restoring environment variables to their previous test-process values.
            unsafe {
                if let Some(value) = value {
                    std::env::set_var(key, value);
                } else {
                    std::env::remove_var(key);
                }
            }
        }
    }
}

#[derive(Clone)]
struct ConfigAppState {
    config_manager: ConfigManager,
    pool: OdooClientPool,
}

fn per_instance_tools_json() -> &'static str {
    r#"{
        "tools": [
            {
                "name": "odoo_search_read",
                "description": "Search and read Odoo records in one operation.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "instance": { "type": "string" },
                        "model": { "type": "string" },
                        "domain": { "type": "array", "items": {} },
                        "fields": { "type": "array", "items": { "type": "string" } },
                        "limit": { "type": "integer" },
                        "offset": { "type": "integer" },
                        "order": { "type": "string" },
                        "context": { "type": "object" }
                    },
                    "required": ["instance", "model"],
                    "additionalProperties": false
                },
                "op": {
                    "type": "search_read",
                    "map": {
                        "instance": "/instance",
                        "model": "/model",
                        "domain": "/domain",
                        "fields": "/fields",
                        "limit": "/limit",
                        "offset": "/offset",
                        "order": "/order",
                        "context": "/context"
                    }
                }
            }
        ]
    }"#
}

fn instances_without_overrides(odoo_url: &str) -> Value {
    json!({
        "school-a": {
            "url": odoo_url,
            "db": "school_a",
            "apiKey": "school-a-key",
            "version": "19"
        },
        "school-b": {
            "url": odoo_url,
            "db": "school_b",
            "apiKey": "school-b-key",
            "version": "19"
        }
    })
}

fn instances_with_overrides(odoo_url: &str) -> Value {
    json!({
        "school-a": {
            "url": odoo_url,
            "db": "school_a",
            "apiKey": "school-a-key",
            "version": "19",
            "toolConfig": {
                "disabledTools": ["odoo_search_read"]
            }
        },
        "school-b": {
            "url": odoo_url,
            "db": "school_b",
            "apiKey": "school-b-key",
            "version": "19",
            "toolConfig": {
                "defaults": {
                    "odoo_search_read": {
                        "limit": 20,
                        "context": {
                            "allowed_company_ids": [1],
                            "lang": "en_US"
                        }
                    }
                }
            }
        }
    })
}

async fn get_instances(State(state): State<ConfigAppState>) -> impl IntoResponse {
    match state.config_manager.load_instances().await {
        Ok(config) => (StatusCode::OK, Json(config)).into_response(),
        Err(error) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": error.to_string() })),
        )
            .into_response(),
    }
}

async fn update_instances(
    State(state): State<ConfigAppState>,
    Json(payload): Json<Value>,
) -> impl IntoResponse {
    match state.config_manager.save_instances(payload).await {
        Ok(result) if result.success => {
            state.pool.reload().await;
            (StatusCode::OK, Json(json!({ "status": "saved" }))).into_response()
        }
        Ok(result) => (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": result.message })),
        )
            .into_response(),
        Err(error) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": error.to_string() })),
        )
            .into_response(),
    }
}

async fn initialize_mcp_session(server: &TestServer) -> String {
    let response = server
        .post("/mcp")
        .json(&json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {}
        }))
        .await;

    response.assert_status_ok();
    response
        .headers()
        .get(MCP_SESSION_HEADER)
        .unwrap()
        .to_str()
        .unwrap()
        .to_string()
}

async fn tools_list(server: &TestServer, session_id: &str) -> Value {
    let response = server
        .post("/mcp")
        .add_header(
            HeaderName::from_static(MCP_SESSION_HEADER),
            HeaderValue::from_str(session_id).unwrap(),
        )
        .json(&json!({
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/list",
            "params": {}
        }))
        .await;

    response.assert_status_ok();
    response.json::<Value>()
}

async fn tools_call(server: &TestServer, session_id: &str, id: i64, params: Value) -> Value {
    let response = server
        .post("/mcp")
        .add_header(
            HeaderName::from_static(MCP_SESSION_HEADER),
            HeaderValue::from_str(session_id).unwrap(),
        )
        .json(&json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": "tools/call",
            "params": params
        }))
        .await;

    response.assert_status_ok();
    response.json::<Value>()
}

async fn setup_servers() -> (TestServer, TestServer, MockOdooServer, TempDir, EnvGuard) {
    let temp_dir = TempDir::new().unwrap();
    let mock_odoo = MockOdooServer::start().await;

    let instances_path = temp_dir.path().join("instances.json");
    let tools_path = temp_dir.path().join("tools.json");
    let prompts_path = temp_dir.path().join("prompts.json");
    let server_path = temp_dir.path().join("server.json");

    std::fs::write(
        &instances_path,
        serde_json::to_string_pretty(&instances_without_overrides(&mock_odoo.uri())).unwrap(),
    )
    .unwrap();
    std::fs::write(&tools_path, per_instance_tools_json()).unwrap();
    std::fs::write(&prompts_path, common::minimal_prompts_json()).unwrap();
    std::fs::write(&server_path, common::minimal_server_json()).unwrap();

    let env_guard = EnvGuard::set(&[
        (
            "ODOO_INSTANCES_JSON",
            instances_path.to_string_lossy().to_string(),
        ),
        ("MCP_TOOLS_JSON", tools_path.to_string_lossy().to_string()),
        (
            "MCP_PROMPTS_JSON",
            prompts_path.to_string_lossy().to_string(),
        ),
        ("MCP_SERVER_JSON", server_path.to_string_lossy().to_string()),
    ]);

    let pool = OdooClientPool::from_env().unwrap();
    let registry = Arc::new(Registry::from_env());
    registry.initial_load().await.unwrap();

    let handler = Arc::new(McpOdooHandler::new(pool.clone(), registry));
    let mcp_server =
        TestServer::new(create_app(handler, AuthConfig::disabled()).into_make_service()).unwrap();

    let config_app = Router::new()
        .route("/api/config/instances", get(get_instances))
        .route("/api/config/instances", post(update_instances))
        .with_state(ConfigAppState {
            config_manager: ConfigManager::new(temp_dir.path().to_path_buf()),
            pool,
        });
    let config_server = TestServer::new(config_app).unwrap();

    (mcp_server, config_server, mock_odoo, temp_dir, env_guard)
}

#[tokio::test]
async fn test_per_instance_tool_config_hot_reloads_end_to_end() {
    let (mcp_server, config_server, mock_odoo, _temp_dir, _env_guard) = setup_servers().await;

    Mock::given(method("POST"))
        .and(path_regex(r"/json/2/res\.partner/search_read"))
        .and(body_partial_json(json!({
            "limit": 20,
            "fields": ["name"],
            "context": {
                "allowed_company_ids": [1],
                "lang": "id_ID"
            }
        })))
        .respond_with(ResponseTemplate::new(200).set_body_json(responses::partners()))
        .mount(&mock_odoo.server)
        .await;

    let session_id = initialize_mcp_session(&mcp_server).await;

    let tools_before = tools_list(&mcp_server, &session_id).await;
    let tool_names_before = tools_before["result"]["tools"]
        .as_array()
        .unwrap()
        .iter()
        .filter_map(|tool| tool.get("name").and_then(|value| value.as_str()))
        .collect::<Vec<_>>();
    assert!(tool_names_before.contains(&"odoo_search_read"));

    let update_response = config_server
        .post("/api/config/instances")
        .json(&instances_with_overrides(&mock_odoo.uri()))
        .await;
    update_response.assert_status_ok();
    update_response.assert_json(&json!({ "status": "saved" }));

    let instances_response = config_server.get("/api/config/instances").await;
    instances_response.assert_status_ok();
    let saved_instances = instances_response.json::<Value>();
    assert_eq!(
        saved_instances["school-a"]["toolConfig"]["disabledTools"],
        json!(["odoo_search_read"])
    );
    assert_eq!(
        saved_instances["school-b"]["toolConfig"]["defaults"]["odoo_search_read"]["limit"],
        json!(20)
    );

    let tools_after = tools_list(&mcp_server, &session_id).await;
    let tool_names_after = tools_after["result"]["tools"]
        .as_array()
        .unwrap()
        .iter()
        .filter_map(|tool| tool.get("name").and_then(|value| value.as_str()))
        .collect::<Vec<_>>();
    assert!(tool_names_after.contains(&"odoo_search_read"));

    let disabled_call = tools_call(
        &mcp_server,
        &session_id,
        3,
        json!({
            "name": "odoo_search_read",
            "arguments": {
                "instance": "school-a",
                "model": "res.partner"
            }
        }),
    )
    .await;
    assert_eq!(disabled_call["result"]["isError"], json!(true));
    let disabled_payload: Value = serde_json::from_str(
        disabled_call["result"]["content"][0]["text"]
            .as_str()
            .unwrap(),
    )
    .unwrap();
    assert_eq!(disabled_payload["tool"], json!("odoo_search_read"));
    assert_eq!(disabled_payload["instance"], json!("school-a"));
    assert!(
        disabled_payload["error"]
            .as_str()
            .unwrap()
            .contains("disabled for instance 'school-a'")
    );

    let enabled_call = tools_call(
        &mcp_server,
        &session_id,
        4,
        json!({
            "name": "odoo_search_read",
            "arguments": {
                "instance": "school-b",
                "model": "res.partner",
                "fields": ["name"],
                "context": {
                    "lang": "id_ID"
                }
            }
        }),
    )
    .await;
    assert!(enabled_call["result"]["isError"].is_null());
    let success_payload: Value = serde_json::from_str(
        enabled_call["result"]["content"][0]["text"]
            .as_str()
            .unwrap(),
    )
    .unwrap();
    assert_eq!(success_payload["count"], json!(3));

    let received_requests = mock_odoo.server.received_requests().await.unwrap();
    assert_eq!(received_requests.len(), 1);
    let request_body: Value = received_requests[0].body_json().unwrap();
    assert_eq!(request_body["limit"], json!(20));
    assert_eq!(request_body["fields"], json!(["name"]));
    assert_eq!(request_body["context"]["allowed_company_ids"], json!([1]));
    assert_eq!(request_body["context"]["lang"], json!("id_ID"));
}
