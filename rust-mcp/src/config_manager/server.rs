use axum::{
    Json, Router,
    extract::State,
    http::{HeaderMap, StatusCode},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{get, post},
};
use rand::Rng;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use tower_http::{cors::CorsLayer, services::ServeDir};
use tracing::{error, info, warn};

use super::{ConfigManager, ConfigWatcher};
use crate::mcp::http::AuthConfig as HttpAuthConfig;

/// Session info stored in memory
#[derive(Clone)]
struct SessionInfo {
    username: String,
    expires_at: Instant,
}

/// Auth configuration loaded from environment
#[derive(Clone)]
struct AuthConfig {
    username: String,
    password: String,
    enabled: bool,
}

impl AuthConfig {
    fn from_env() -> Self {
        let username = std::env::var("CONFIG_UI_USERNAME").unwrap_or_default();
        let password = std::env::var("CONFIG_UI_PASSWORD").unwrap_or_default();
        let enabled = !username.is_empty() && !password.is_empty();

        if enabled {
            info!("Config UI authentication enabled for user: {}", username);
        } else {
            warn!("Config UI authentication disabled (CONFIG_UI_USERNAME/PASSWORD not set)");
        }

        Self {
            username,
            password,
            enabled,
        }
    }

    fn verify(&self, username: &str, password: &str) -> bool {
        self.enabled && self.username == username && self.password == password
    }
}

#[derive(Clone)]
struct AppState {
    config_manager: ConfigManager,
    config_watcher: Arc<ConfigWatcher>,
    sessions: Arc<RwLock<HashMap<String, SessionInfo>>>,
    auth_config: AuthConfig,
    env_file_path: PathBuf,
    /// HTTP auth config for hot-reload (optional - only when HTTP transport is used)
    http_auth_config: Option<HttpAuthConfig>,
}

// Session token validity duration (24 hours)
const SESSION_DURATION: Duration = Duration::from_secs(24 * 60 * 60);

/// Generate a random session token
fn generate_session_token() -> String {
    let mut rng = rand::rng();
    let bytes: [u8; 32] = rng.random();
    hex::encode(bytes)
}

/// Generate a random MCP auth token
fn generate_mcp_token() -> String {
    let mut rng = rand::rng();
    let bytes: [u8; 32] = rng.random();
    hex::encode(bytes)
}

/// Extract session token from Authorization header
fn extract_token(headers: &HeaderMap) -> Option<String> {
    headers
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.strip_prefix("Bearer "))
        .map(|s| s.to_string())
}

/// Auth middleware - checks session token for protected routes
async fn auth_middleware(
    State(state): State<AppState>,
    headers: HeaderMap,
    request: axum::extract::Request,
    next: Next,
) -> Response {
    // If auth is disabled, allow all requests
    if !state.auth_config.enabled {
        return next.run(request).await;
    }

    // Check for valid session token
    if let Some(token) = extract_token(&headers) {
        let sessions = state.sessions.read().await;
        if let Some(session) = sessions.get(&token)
            && session.expires_at > Instant::now()
        {
            return next.run(request).await;
        }
    }

    // Unauthorized
    (
        StatusCode::UNAUTHORIZED,
        Json(json!({ "error": "Unauthorized" })),
    )
        .into_response()
}

pub async fn start_config_server(
    port: u16,
    config_dir: std::path::PathBuf,
    http_auth_config: Option<HttpAuthConfig>,
) -> anyhow::Result<()> {
    let config_manager = ConfigManager::new(config_dir.clone());
    let config_watcher = Arc::new(ConfigWatcher::new(config_dir.clone())?);
    let auth_config = AuthConfig::from_env();

    // Determine env file path
    let env_file_path = if let Some(home) = dirs::home_dir() {
        home.join(".config/odoo-rust-mcp/env")
    } else {
        config_dir.join("env")
    };

    let state = AppState {
        config_manager,
        config_watcher,
        sessions: Arc::new(RwLock::new(HashMap::new())),
        auth_config,
        env_file_path,
        http_auth_config,
    };

    // Serve static files from dist directory (React app)
    let static_dir_final = find_static_dir();

    if static_dir_final.exists() && static_dir_final.is_dir() {
        info!("Serving static files from: {:?}", static_dir_final);
    } else {
        warn!(
            "static/dist directory not found at {:?}. Please build the React UI first with: cd config-ui && npm run build",
            static_dir_final
        );
    }

    // Protected routes (require auth)
    let protected_routes = Router::new()
        // Config endpoints
        .route("/api/config/instances", get(get_instances))
        .route("/api/config/instances", post(update_instances))
        .route("/api/config/tools", get(get_tools))
        .route("/api/config/tools", post(update_tools))
        .route("/api/config/prompts", get(get_prompts))
        .route("/api/config/prompts", post(update_prompts))
        .route("/api/config/server", get(get_server))
        .route("/api/config/server", post(update_server))
        // Auth management endpoints (protected)
        .route("/api/auth/change-password", post(change_password))
        .route("/api/auth/mcp-auth-status", get(mcp_token_status))
        .route("/api/auth/mcp-auth-enabled", post(set_mcp_auth_enabled))
        .route(
            "/api/auth/generate-mcp-token",
            post(generate_mcp_token_endpoint),
        )
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware,
        ));

    // Public routes (no auth required)
    let public_routes = Router::new()
        .route("/health", get(health_check))
        .route("/api/auth/status", get(auth_status))
        .route("/api/auth/login", post(login))
        .route("/api/auth/logout", post(logout));

    let app = Router::new()
        .merge(public_routes)
        .merge(protected_routes)
        // Serve static files (React app) - use fallback_service for root path
        .fallback_service(ServeDir::new(&static_dir_final))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port)).await?;
    info!("Config server listening on http://0.0.0.0:{}", port);

    axum::serve(listener, app).await?;

    Ok(())
}

/// Find static files directory
fn find_static_dir() -> PathBuf {
    let mut static_dir_abs = None;

    // Try 1: Relative to current working directory
    let static_dir = std::path::Path::new("static/dist");
    if static_dir.exists()
        && static_dir.is_dir()
        && let Ok(canonical) = static_dir.canonicalize()
    {
        static_dir_abs = Some(canonical);
    }

    // Try 2: Relative to executable location (for installed binaries)
    if static_dir_abs.is_none()
        && let Ok(exe_path) = std::env::current_exe()
        && let Some(exe_dir) = exe_path.parent()
    {
        let candidate = exe_dir.join("static/dist");
        if candidate.exists()
            && candidate.is_dir()
            && let Ok(canonical) = candidate.canonicalize()
        {
            static_dir_abs = Some(canonical);
        }
    }

    // Try 3: Homebrew/system share directory
    if static_dir_abs.is_none() {
        let candidates = [
            "/opt/homebrew/share/odoo-rust-mcp/static/dist",
            "/usr/local/share/odoo-rust-mcp/static/dist",
            "/usr/share/rust-mcp/static/dist",
        ];
        for candidate_str in &candidates {
            let candidate = std::path::Path::new(candidate_str);
            if candidate.exists() && candidate.is_dir() {
                static_dir_abs = Some(candidate.to_path_buf());
                break;
            }
        }
    }

    // Try 4: Relative to project root (for development)
    if static_dir_abs.is_none()
        && let Ok(current_dir) = std::env::current_dir()
    {
        let candidate = current_dir.join("rust-mcp/static/dist");
        if candidate.exists()
            && candidate.is_dir()
            && let Ok(canonical) = candidate.canonicalize()
        {
            static_dir_abs = Some(canonical);
        }
    }

    static_dir_abs.unwrap_or_else(|| {
        warn!("static/dist directory not found in any location. Please build the React UI first with: cd config-ui && npm run build");
        std::path::PathBuf::from("static/dist")
    })
}

// =============================================================================
// Health Check
// =============================================================================

async fn health_check() -> impl IntoResponse {
    Json(json!({
        "status": "ok",
        "service": "odoo-rust-mcp-config"
    }))
}

// =============================================================================
// Auth Endpoints
// =============================================================================

#[derive(Serialize)]
struct AuthStatusResponse {
    authenticated: bool,
    auth_enabled: bool,
    username: Option<String>,
}

async fn auth_status(State(state): State<AppState>, headers: HeaderMap) -> impl IntoResponse {
    // If auth is disabled, always return authenticated
    if !state.auth_config.enabled {
        return Json(AuthStatusResponse {
            authenticated: true,
            auth_enabled: false,
            username: None,
        });
    }

    // Check if user has valid session
    if let Some(token) = extract_token(&headers) {
        let sessions = state.sessions.read().await;
        if let Some(session) = sessions.get(&token)
            && session.expires_at > Instant::now()
        {
            return Json(AuthStatusResponse {
                authenticated: true,
                auth_enabled: true,
                username: Some(session.username.clone()),
            });
        }
    }

    Json(AuthStatusResponse {
        authenticated: false,
        auth_enabled: true,
        username: None,
    })
}

#[derive(Deserialize)]
struct LoginRequest {
    username: String,
    password: String,
}

#[derive(Serialize)]
struct LoginResponse {
    token: String,
    username: String,
}

async fn login(
    State(state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> impl IntoResponse {
    // If auth is disabled, return error
    if !state.auth_config.enabled {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Authentication is not configured" })),
        )
            .into_response();
    }

    // Verify credentials
    if !state
        .auth_config
        .verify(&payload.username, &payload.password)
    {
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({ "error": "Invalid username or password" })),
        )
            .into_response();
    }

    // Create session
    let token = generate_session_token();
    let session = SessionInfo {
        username: payload.username.clone(),
        expires_at: Instant::now() + SESSION_DURATION,
    };

    state.sessions.write().await.insert(token.clone(), session);

    info!("User '{}' logged in", payload.username);

    (
        StatusCode::OK,
        Json(LoginResponse {
            token,
            username: payload.username,
        }),
    )
        .into_response()
}

async fn logout(State(state): State<AppState>, headers: HeaderMap) -> impl IntoResponse {
    if let Some(token) = extract_token(&headers) {
        let mut sessions = state.sessions.write().await;
        if sessions.remove(&token).is_some() {
            info!("Session logged out");
        }
    }

    Json(json!({ "status": "logged_out" }))
}

#[derive(Deserialize)]
struct ChangePasswordRequest {
    new_password: String,
}

async fn change_password(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<ChangePasswordRequest>,
) -> impl IntoResponse {
    // Get current username from session
    let username = if let Some(token) = extract_token(&headers) {
        let sessions = state.sessions.read().await;
        sessions.get(&token).map(|s| s.username.clone())
    } else {
        None
    };

    let username = match username {
        Some(u) => u,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({ "error": "Not authenticated" })),
            )
                .into_response();
        }
    };

    // Validate new password
    if payload.new_password.len() < 4 {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Password must be at least 4 characters" })),
        )
            .into_response();
    }

    // Update password in env file
    if let Err(e) = update_env_var(
        &state.env_file_path,
        "CONFIG_UI_PASSWORD",
        &payload.new_password,
    ) {
        error!("Failed to update password: {}", e);
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Failed to update password: {}", e) })),
        )
            .into_response();
    }

    info!("Password changed for user '{}'", username);

    (
        StatusCode::OK,
        Json(json!({ "status": "password_changed" })),
    )
        .into_response()
}

#[derive(Serialize)]
struct McpAuthStatusResponse {
    enabled: bool,
    token_configured: bool,
}

async fn mcp_token_status() -> impl IntoResponse {
    let enabled = std::env::var("MCP_AUTH_ENABLED")
        .map(|v| v.to_lowercase() == "true" || v == "1")
        .unwrap_or(false);

    let token_configured = std::env::var("MCP_AUTH_TOKEN")
        .map(|v| !v.trim().is_empty())
        .unwrap_or(false);

    Json(McpAuthStatusResponse {
        enabled,
        token_configured,
    })
}

#[derive(Deserialize)]
struct SetMcpAuthEnabledRequest {
    enabled: bool,
}

async fn set_mcp_auth_enabled(
    State(state): State<AppState>,
    Json(payload): Json<SetMcpAuthEnabledRequest>,
) -> impl IntoResponse {
    let value = if payload.enabled { "true" } else { "false" };

    if let Err(e) = update_env_var(&state.env_file_path, "MCP_AUTH_ENABLED", value) {
        error!("Failed to update MCP_AUTH_ENABLED: {}", e);
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Failed to update setting: {}", e) })),
        )
            .into_response();
    }

    // Also update the environment variable in memory for hot-reload
    // SAFETY: Called from async context, but we're the only writer at this point
    unsafe {
        std::env::set_var("MCP_AUTH_ENABLED", value);
    }

    // Trigger hot-reload of HTTP auth config if available
    if let Some(ref http_auth) = state.http_auth_config {
        http_auth.reload().await;
    }

    info!("MCP HTTP auth set to: {} (hot-reloaded)", payload.enabled);

    (
        StatusCode::OK,
        Json(json!({ "status": "updated", "enabled": payload.enabled })),
    )
        .into_response()
}

#[derive(Serialize)]
struct GenerateMcpTokenResponse {
    token: String,
}

async fn generate_mcp_token_endpoint(State(state): State<AppState>) -> impl IntoResponse {
    let new_token = generate_mcp_token();

    // Update MCP_AUTH_TOKEN in env file
    if let Err(e) = update_env_var(&state.env_file_path, "MCP_AUTH_TOKEN", &new_token) {
        error!("Failed to update MCP_AUTH_TOKEN: {}", e);
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Failed to update token: {}", e) })),
        )
            .into_response();
    }

    // Also update the environment variable in memory for hot-reload
    // SAFETY: Called from async context, but we're the only writer at this point
    unsafe {
        std::env::set_var("MCP_AUTH_TOKEN", &new_token);
    }

    // Trigger hot-reload of HTTP auth config if available
    if let Some(ref http_auth) = state.http_auth_config {
        http_auth.reload().await;
    }

    info!("Generated new MCP_AUTH_TOKEN (hot-reloaded)");

    (
        StatusCode::OK,
        Json(GenerateMcpTokenResponse { token: new_token }),
    )
        .into_response()
}

/// Update or add an environment variable in the env file
fn update_env_var(env_file_path: &PathBuf, key: &str, value: &str) -> anyhow::Result<()> {
    // Read existing content or create empty
    let content = std::fs::read_to_string(env_file_path).unwrap_or_default();

    let mut lines: Vec<String> = content.lines().map(|s| s.to_string()).collect();
    let mut found = false;

    // Update existing line or add new
    for line in &mut lines {
        let trimmed = line.trim();
        if trimmed.starts_with(&format!("{}=", key)) || trimmed.starts_with(&format!("{}=", key)) {
            *line = format!("{}={}", key, value);
            found = true;
            break;
        }
        // Also check for commented version
        if trimmed.starts_with(&format!("# {}=", key)) || trimmed.starts_with(&format!("#{}=", key))
        {
            *line = format!("{}={}", key, value);
            found = true;
            break;
        }
    }

    if !found {
        // Add to end of file
        lines.push(format!("{}={}", key, value));
    }

    // Ensure parent directory exists
    if let Some(parent) = env_file_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    // Write back
    std::fs::write(env_file_path, lines.join("\n") + "\n")?;

    // Set restrictive permissions on env file (Unix only)
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(env_file_path, std::fs::Permissions::from_mode(0o600));
    }

    Ok(())
}

// =============================================================================
// Config Endpoints
// =============================================================================

async fn get_instances(State(state): State<AppState>) -> impl IntoResponse {
    match state.config_manager.load_instances().await {
        Ok(config) => (StatusCode::OK, Json(config)).into_response(),
        Err(e) => {
            error!("Failed to load instances: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": e.to_string() })),
            )
                .into_response()
        }
    }
}

async fn update_instances(
    State(state): State<AppState>,
    Json(payload): Json<Value>,
) -> impl IntoResponse {
    match state.config_manager.save_instances(payload).await {
        Ok(result) => {
            if result.success {
                state.config_watcher.notify("instances.json");
                let mut response = json!({
                    "status": "saved",
                    "message": result.message
                });
                if let Some(warning) = result.warning {
                    response["warning"] = json!(warning);
                }
                (StatusCode::OK, Json(response)).into_response()
            } else {
                let mut response = json!({
                    "error": result.message,
                    "rollback": result.rollback_performed
                });
                if let Some(warning) = result.warning {
                    response["warning"] = json!(warning);
                }
                error!("Failed to save instances: {}", result.message);
                (StatusCode::BAD_REQUEST, Json(response)).into_response()
            }
        }
        Err(e) => {
            error!("Unexpected error saving instances: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("Unexpected error: {}", e) })),
            )
                .into_response()
        }
    }
}

async fn get_tools(State(state): State<AppState>) -> impl IntoResponse {
    match state.config_manager.load_tools().await {
        Ok(config) => (StatusCode::OK, Json(config)).into_response(),
        Err(e) => {
            error!("Failed to load tools: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": e.to_string() })),
            )
                .into_response()
        }
    }
}

async fn update_tools(
    State(state): State<AppState>,
    Json(payload): Json<Value>,
) -> impl IntoResponse {
    match state.config_manager.save_tools(payload).await {
        Ok(result) => {
            if result.success {
                state.config_watcher.notify("tools.json");
                let mut response = json!({
                    "status": "saved",
                    "message": result.message
                });
                if let Some(warning) = result.warning {
                    response["warning"] = json!(warning);
                }
                (StatusCode::OK, Json(response)).into_response()
            } else {
                let mut response = json!({
                    "error": result.message,
                    "rollback": result.rollback_performed
                });
                if let Some(warning) = result.warning {
                    response["warning"] = json!(warning);
                }
                error!("Failed to save tools: {}", result.message);
                (StatusCode::BAD_REQUEST, Json(response)).into_response()
            }
        }
        Err(e) => {
            error!("Unexpected error saving tools: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("Unexpected error: {}", e) })),
            )
                .into_response()
        }
    }
}

async fn get_prompts(State(state): State<AppState>) -> impl IntoResponse {
    match state.config_manager.load_prompts().await {
        Ok(config) => (StatusCode::OK, Json(config)).into_response(),
        Err(e) => {
            error!("Failed to load prompts: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": e.to_string() })),
            )
                .into_response()
        }
    }
}

async fn update_prompts(
    State(state): State<AppState>,
    Json(payload): Json<Value>,
) -> impl IntoResponse {
    match state.config_manager.save_prompts(payload).await {
        Ok(result) => {
            if result.success {
                state.config_watcher.notify("prompts.json");
                let mut response = json!({
                    "status": "saved",
                    "message": result.message
                });
                if let Some(warning) = result.warning {
                    response["warning"] = json!(warning);
                }
                (StatusCode::OK, Json(response)).into_response()
            } else {
                let mut response = json!({
                    "error": result.message,
                    "rollback": result.rollback_performed
                });
                if let Some(warning) = result.warning {
                    response["warning"] = json!(warning);
                }
                error!("Failed to save prompts: {}", result.message);
                (StatusCode::BAD_REQUEST, Json(response)).into_response()
            }
        }
        Err(e) => {
            error!("Unexpected error saving prompts: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("Unexpected error: {}", e) })),
            )
                .into_response()
        }
    }
}

async fn get_server(State(state): State<AppState>) -> impl IntoResponse {
    match state.config_manager.load_server().await {
        Ok(config) => (StatusCode::OK, Json(config)).into_response(),
        Err(e) => {
            error!("Failed to load server: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": e.to_string() })),
            )
                .into_response()
        }
    }
}

async fn update_server(
    State(state): State<AppState>,
    Json(payload): Json<Value>,
) -> impl IntoResponse {
    match state.config_manager.save_server(payload).await {
        Ok(result) => {
            if result.success {
                state.config_watcher.notify("server.json");
                let mut response = json!({
                    "status": "saved",
                    "message": result.message
                });
                if let Some(warning) = result.warning {
                    response["warning"] = json!(warning);
                }
                (StatusCode::OK, Json(response)).into_response()
            } else {
                let mut response = json!({
                    "error": result.message,
                    "rollback": result.rollback_performed
                });
                if let Some(warning) = result.warning {
                    response["warning"] = json!(warning);
                }
                error!("Failed to save server: {}", result.message);
                (StatusCode::BAD_REQUEST, Json(response)).into_response()
            }
        }
        Err(e) => {
            error!("Unexpected error saving server: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("Unexpected error: {}", e) })),
            )
                .into_response()
        }
    }
}
