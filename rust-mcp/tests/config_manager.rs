//! Integration tests for Config Manager API endpoints.

mod common;

use axum_test::TestServer;
use rust_mcp::config_manager::{ConfigManager, ConfigWatcher};
use serde_json::{Value, json};
use std::sync::Arc;
use tempfile::TempDir;

/// Create a test config server
async fn setup_test_server() -> (TestServer, TempDir) {
    let temp_dir = TempDir::new().unwrap();
    let config_dir = temp_dir.path().to_path_buf();

    // Create test config files
    std::fs::write(
        config_dir.join("instances.json"),
        r#"{"default": {"url": "http://localhost:8069", "db": "test_db", "apiKey": "test_key"}}"#,
    )
    .unwrap();

    std::fs::write(
        config_dir.join("tools.json"),
        r#"{"tools": [{"name": "test_tool", "description": "Test tool"}]}"#,
    )
    .unwrap();

    std::fs::write(
        config_dir.join("prompts.json"),
        r#"{"prompts": [{"name": "test_prompt", "content": "Test content"}]}"#,
    )
    .unwrap();

    std::fs::write(
        config_dir.join("server.json"),
        r#"{"serverName": "test-server", "instructions": "Test"}"#,
    )
    .unwrap();

    // Create a test router manually (since start_config_server binds to a port)
    use axum::{
        Json, Router,
        extract::State,
        http::StatusCode,
        response::IntoResponse,
        routing::{get, post},
    };
    use tower_http::cors::CorsLayer;

    #[derive(Clone)]
    struct AppState {
        config_manager: ConfigManager,
        #[allow(dead_code)]
        config_watcher: Arc<ConfigWatcher>,
    }

    let config_manager = ConfigManager::new(config_dir.clone());
    let config_watcher = Arc::new(ConfigWatcher::new(config_dir).unwrap());

    let state = AppState {
        config_manager,
        config_watcher,
    };

    async fn health_check() -> impl IntoResponse {
        Json(json!({
            "status": "ok",
            "service": "odoo-rust-mcp-config"
        }))
    }

    async fn get_instances(State(state): State<AppState>) -> impl IntoResponse {
        match state.config_manager.load_instances().await {
            Ok(config) => (StatusCode::OK, Json(config)).into_response(),
            Err(e) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": e.to_string() })),
            )
                .into_response(),
        }
    }

    async fn update_instances(
        State(state): State<AppState>,
        Json(payload): Json<Value>,
    ) -> impl IntoResponse {
        match state.config_manager.save_instances(payload).await {
            Ok(_) => {
                state.config_watcher.notify("instances.json");
                (StatusCode::OK, Json(json!({ "status": "saved" }))).into_response()
            }
            Err(e) => (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": e.to_string() })),
            )
                .into_response(),
        }
    }

    async fn get_tools(State(state): State<AppState>) -> impl IntoResponse {
        match state.config_manager.load_tools().await {
            Ok(config) => (StatusCode::OK, Json(config)).into_response(),
            Err(e) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": e.to_string() })),
            )
                .into_response(),
        }
    }

    async fn update_tools(
        State(state): State<AppState>,
        Json(payload): Json<Value>,
    ) -> impl IntoResponse {
        match state.config_manager.save_tools(payload).await {
            Ok(_) => {
                state.config_watcher.notify("tools.json");
                (StatusCode::OK, Json(json!({ "status": "saved" }))).into_response()
            }
            Err(e) => (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": e.to_string() })),
            )
                .into_response(),
        }
    }

    async fn get_prompts(State(state): State<AppState>) -> impl IntoResponse {
        match state.config_manager.load_prompts().await {
            Ok(config) => (StatusCode::OK, Json(config)).into_response(),
            Err(e) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": e.to_string() })),
            )
                .into_response(),
        }
    }

    async fn update_prompts(
        State(state): State<AppState>,
        Json(payload): Json<Value>,
    ) -> impl IntoResponse {
        match state.config_manager.save_prompts(payload).await {
            Ok(_) => {
                state.config_watcher.notify("prompts.json");
                (StatusCode::OK, Json(json!({ "status": "saved" }))).into_response()
            }
            Err(e) => (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": e.to_string() })),
            )
                .into_response(),
        }
    }

    async fn get_server(State(state): State<AppState>) -> impl IntoResponse {
        match state.config_manager.load_server().await {
            Ok(config) => (StatusCode::OK, Json(config)).into_response(),
            Err(e) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": e.to_string() })),
            )
                .into_response(),
        }
    }

    async fn update_server(
        State(state): State<AppState>,
        Json(payload): Json<Value>,
    ) -> impl IntoResponse {
        match state.config_manager.save_server(payload).await {
            Ok(_) => {
                state.config_watcher.notify("server.json");
                (StatusCode::OK, Json(json!({ "status": "saved" }))).into_response()
            }
            Err(e) => (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": e.to_string() })),
            )
                .into_response(),
        }
    }

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/api/config/instances", get(get_instances))
        .route("/api/config/instances", post(update_instances))
        .route("/api/config/tools", get(get_tools))
        .route("/api/config/tools", post(update_tools))
        .route("/api/config/prompts", get(get_prompts))
        .route("/api/config/prompts", post(update_prompts))
        .route("/api/config/server", get(get_server))
        .route("/api/config/server", post(update_server))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let server = TestServer::new(app).unwrap();

    (server, temp_dir)
}

#[tokio::test]
async fn test_health_check() {
    let (server, _temp_dir) = setup_test_server().await;

    let response = server.get("/health").await;
    response.assert_status_ok();
    response.assert_json(&json!({
        "status": "ok",
        "service": "odoo-rust-mcp-config"
    }));
}

#[tokio::test]
async fn test_get_instances() {
    let (server, _temp_dir) = setup_test_server().await;

    let response = server.get("/api/config/instances").await;
    response.assert_status_ok();
    let data: Value = response.json();
    assert!(data.is_object());
    assert!(data.get("default").is_some());
}

#[tokio::test]
async fn test_update_instances() {
    let (server, _temp_dir) = setup_test_server().await;

    let new_config = json!({
        "production": {
            "url": "http://prod.example.com:8069",
            "db": "prod_db",
            "apiKey": "prod_key"
        }
    });

    let response = server.post("/api/config/instances").json(&new_config).await;
    response.assert_status_ok();
    response.assert_json(&json!({ "status": "saved" }));

    // Verify it was saved
    let get_response = server.get("/api/config/instances").await;
    get_response.assert_status_ok();
    let data: Value = get_response.json();
    assert!(data.get("production").is_some());
    assert_eq!(data["production"]["url"], "http://prod.example.com:8069");
}

#[tokio::test]
async fn test_update_instances_invalid_json() {
    let (server, _temp_dir) = setup_test_server().await;

    // Try to save invalid JSON (not an object)
    let invalid_config = json!(["not", "an", "object"]);

    let response = server
        .post("/api/config/instances")
        .json(&invalid_config)
        .await;
    response.assert_status_bad_request();
    let data: Value = response.json();
    assert!(data.get("error").is_some());
}

#[tokio::test]
async fn test_get_tools() {
    let (server, _temp_dir) = setup_test_server().await;

    let response = server.get("/api/config/tools").await;
    response.assert_status_ok();
    let data: Value = response.json();
    assert!(data.is_array());
    assert_eq!(data.as_array().unwrap().len(), 1);
    assert_eq!(data[0]["name"], "test_tool");
}

#[tokio::test]
async fn test_update_tools() {
    let (server, _temp_dir) = setup_test_server().await;

    let new_tools = json!([
        {"name": "tool1", "description": "Tool 1"},
        {"name": "tool2", "description": "Tool 2"}
    ]);

    let response = server.post("/api/config/tools").json(&new_tools).await;
    response.assert_status_ok();
    response.assert_json(&json!({ "status": "saved" }));

    // Verify it was saved
    let get_response = server.get("/api/config/tools").await;
    get_response.assert_status_ok();
    let data: Value = get_response.json();
    assert!(data.is_array());
    assert_eq!(data.as_array().unwrap().len(), 2);
}

#[tokio::test]
async fn test_update_tools_with_object_format() {
    let (server, _temp_dir) = setup_test_server().await;

    // Test that it accepts object with tools array
    let tools_object = json!({
        "tools": [
            {"name": "tool1", "description": "Tool 1"}
        ]
    });

    let response = server.post("/api/config/tools").json(&tools_object).await;
    response.assert_status_ok();
}

#[tokio::test]
async fn test_get_prompts() {
    let (server, _temp_dir) = setup_test_server().await;

    let response = server.get("/api/config/prompts").await;
    response.assert_status_ok();
    let data: Value = response.json();
    assert!(data.is_array());
    assert_eq!(data.as_array().unwrap().len(), 1);
    assert_eq!(data[0]["name"], "test_prompt");
}

#[tokio::test]
async fn test_update_prompts() {
    let (server, _temp_dir) = setup_test_server().await;

    let new_prompts = json!([
        {"name": "prompt1", "content": "Content 1"},
        {"name": "prompt2", "content": "Content 2"}
    ]);

    let response = server.post("/api/config/prompts").json(&new_prompts).await;
    response.assert_status_ok();
    response.assert_json(&json!({ "status": "saved" }));

    // Verify it was saved
    let get_response = server.get("/api/config/prompts").await;
    get_response.assert_status_ok();
    let data: Value = get_response.json();
    assert!(data.is_array());
    assert_eq!(data.as_array().unwrap().len(), 2);
}

#[tokio::test]
async fn test_get_server() {
    let (server, _temp_dir) = setup_test_server().await;

    let response = server.get("/api/config/server").await;
    response.assert_status_ok();
    let data: Value = response.json();
    assert!(data.is_object());
    assert_eq!(data["serverName"], "test-server");
}

#[tokio::test]
async fn test_update_server() {
    let (server, _temp_dir) = setup_test_server().await;

    let new_config = json!({
        "serverName": "updated-server",
        "instructions": "Updated instructions",
        "protocolVersionDefault": "2025-11-05"
    });

    let response = server.post("/api/config/server").json(&new_config).await;
    response.assert_status_ok();
    response.assert_json(&json!({ "status": "saved" }));

    // Verify it was saved
    let get_response = server.get("/api/config/server").await;
    get_response.assert_status_ok();
    let data: Value = get_response.json();
    assert_eq!(data["serverName"], "updated-server");
}

#[tokio::test]
async fn test_update_server_invalid_json() {
    let (server, _temp_dir) = setup_test_server().await;

    // Try to save invalid JSON (not an object)
    let invalid_config = json!(["not", "an", "object"]);

    let response = server
        .post("/api/config/server")
        .json(&invalid_config)
        .await;
    response.assert_status_bad_request();
    let data: Value = response.json();
    assert!(data.get("error").is_some());
}

#[tokio::test]
async fn test_get_nonexistent_config() {
    let temp_dir = TempDir::new().unwrap();
    let config_dir = temp_dir.path().to_path_buf();

    // Don't create any config files - test that it returns empty/default values

    use axum::{
        Json, Router, extract::State, http::StatusCode, response::IntoResponse, routing::get,
    };
    use tower_http::cors::CorsLayer;

    #[derive(Clone)]
    struct AppState {
        config_manager: ConfigManager,
        #[allow(dead_code)]
        config_watcher: Arc<ConfigWatcher>,
    }

    let config_manager = ConfigManager::new(config_dir.clone());
    let config_watcher = Arc::new(ConfigWatcher::new(config_dir).unwrap());

    let state = AppState {
        config_manager,
        config_watcher,
    };

    async fn get_instances(State(state): State<AppState>) -> impl IntoResponse {
        match state.config_manager.load_instances().await {
            Ok(config) => (StatusCode::OK, Json(config)).into_response(),
            Err(e) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": e.to_string() })),
            )
                .into_response(),
        }
    }

    async fn get_tools(State(state): State<AppState>) -> impl IntoResponse {
        match state.config_manager.load_tools().await {
            Ok(config) => (StatusCode::OK, Json(config)).into_response(),
            Err(e) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": e.to_string() })),
            )
                .into_response(),
        }
    }

    let app = Router::new()
        .route("/api/config/instances", get(get_instances))
        .route("/api/config/tools", get(get_tools))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let server = TestServer::new(app).unwrap();

    // Should return empty object for instances
    let response = server.get("/api/config/instances").await;
    response.assert_status_ok();
    let data: Value = response.json();
    assert!(data.is_object());
    assert!(data.as_object().unwrap().is_empty());

    // Should return empty array for tools
    let response = server.get("/api/config/tools").await;
    response.assert_status_ok();
    let data: Value = response.json();
    assert!(data.is_array());
    assert!(data.as_array().unwrap().is_empty());
}
