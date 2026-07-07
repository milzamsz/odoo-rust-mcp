use axum::{
    Json, Router,
    extract::{Path, State},
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
use tower_http::{
    cors::CorsLayer,
    services::{ServeDir, ServeFile},
};
use tracing::{error, info, warn};

use super::{ConfigManager, ConfigWatcher};
use crate::mcp::http::AuthConfig as HttpAuthConfig;
use crate::mcp::tools::OdooClientPool;
use crate::odoo::config::{
    OdooInstanceConfig, RuntimeInstancesSourceKind, detect_runtime_instances_source,
};
use crate::odoo::unified_client::OdooClient;

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

/// Wrapper for dynamic auth config with hot-reload support
#[derive(Clone)]
struct DynamicAuthConfig {
    config: Arc<RwLock<AuthConfig>>,
}

impl DynamicAuthConfig {
    fn new(config: AuthConfig) -> Self {
        Self {
            config: Arc::new(RwLock::new(config)),
        }
    }

    async fn reload(&self) {
        let new_config = AuthConfig::from_env();
        *self.config.write().await = new_config;
    }

    async fn verify(&self, username: &str, password: &str) -> bool {
        let config = self.config.read().await;
        config.verify(username, password)
    }

    async fn is_enabled(&self) -> bool {
        let config = self.config.read().await;
        config.enabled
    }
}

#[derive(Clone)]
struct AppState {
    config_manager: ConfigManager,
    config_watcher: Arc<ConfigWatcher>,
    sessions: Arc<RwLock<HashMap<String, SessionInfo>>>,
    auth_config: DynamicAuthConfig,
    env_file_path: PathBuf,
    /// HTTP auth config for hot-reload (optional - only when HTTP transport is used)
    http_auth_config: Option<HttpAuthConfig>,
    /// MCP client pool for hot-reload when instances.json changes (optional)
    pool: Option<OdooClientPool>,
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
    if !state.auth_config.is_enabled().await {
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
    pool: Option<OdooClientPool>,
) -> anyhow::Result<()> {
    let config_manager = ConfigManager::new(config_dir.clone());
    let config_watcher = Arc::new(ConfigWatcher::new(config_dir.clone())?);
    let auth_config = DynamicAuthConfig::new(AuthConfig::from_env());

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
        pool,
    };

    // Serve static files from dist directory (React app)
    let static_dir_final = find_static_dir();
    let static_index_final = static_dir_final.join("index.html");

    if static_dir_final.exists() && static_dir_final.is_dir() {
        info!("Serving static files from: {:?}", static_dir_final);
    } else {
        warn!(
            "static/dist directory not found at {:?}. Please build the React UI first with: cd config-ui && npm run build",
            static_dir_final
        );
    }

    // Serve built mdBook documentation at /docs/ (optional — no error if not found)
    let docs_dir = find_docs_dir();
    if let Some(ref d) = docs_dir {
        info!("Serving documentation from: {:?}", d);
    }

    // Protected routes (require auth)
    let protected_routes = Router::new()
        // Config endpoints
        .route("/api/config/instances", get(get_instances))
        .route("/api/config/instances", post(update_instances))
        .route(
            "/api/config/instances/sync-status",
            get(get_instances_sync_status),
        )
        .route(
            "/api/config/instances/sync-env",
            post(sync_instances_to_env),
        )
        .route(
            "/api/config/instances/{name}/test",
            post(test_instance_connection),
        )
        .route("/api/config/tools", get(get_tools))
        .route("/api/config/tools", post(update_tools))
        .route("/api/config/tools/drift", get(get_tools_drift))
        .route(
            "/api/config/tools/import-missing",
            post(import_missing_tools),
        )
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

    let mut app = Router::new().merge(public_routes).merge(protected_routes);

    // Mount docs at /docs/ when the built book directory is available
    if let Some(ref docs_path) = docs_dir {
        app = app.nest_service("/docs", ServeDir::new(docs_path));
    }

    let static_service = ServeDir::new(&static_dir_final);

    let app = if static_index_final.exists() {
        app.route_service("/", ServeFile::new(&static_index_final))
            .fallback_service(static_service)
    } else {
        // Keep the existing asset fallback when the built index is missing so startup can still warn.
        app.fallback_service(static_service)
    }
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

    // Try 1: Relative to project root (development from repo root)
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

    // Try 2: Relative to current working directory (running from rust-mcp/)
    if static_dir_abs.is_none() {
        let static_dir = std::path::Path::new("static/dist");
        if static_dir.exists()
            && static_dir.is_dir()
            && let Ok(canonical) = static_dir.canonicalize()
        {
            static_dir_abs = Some(canonical);
        }
    }

    // Try 3: Relative to executable location or parent (for sidecars/installed binaries)
    if static_dir_abs.is_none()
        && let Ok(exe_path) = std::env::current_exe()
        && let Some(exe_dir) = exe_path.parent()
    {
        let candidates = [
            exe_dir.join("static/dist"),
            exe_dir.join("../static/dist"),
            exe_dir.join("../lib/Odoo Rust MCP/static/dist"),
            exe_dir.join("../../lib/Odoo Rust MCP/static/dist"),
        ];
        for candidate in candidates {
            if candidate.exists()
                && candidate.is_dir()
                && let Ok(canonical) = candidate.canonicalize()
            {
                static_dir_abs = Some(canonical);
                break;
            }
        }
    }

    // Try 4: Homebrew/system share directory
    if static_dir_abs.is_none() {
        let candidates = [
            "/usr/lib/Odoo Rust MCP/static/dist",
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

    static_dir_abs.unwrap_or_else(|| {
        warn!("static/dist directory not found in any location. Please build the React UI first with: cd config-ui && npm run build");
        std::path::PathBuf::from("static/dist")
    })
}

/// Find the built mdBook documentation directory (docs/book/).
/// Returns None when the docs haven't been built yet — the /docs route is simply
/// not mounted in that case, so the server still starts cleanly.
fn find_docs_dir() -> Option<PathBuf> {
    let cwd = std::env::current_dir().ok();
    let executable_dir = std::env::current_exe()
        .ok()
        .and_then(|path| path.parent().map(std::path::Path::to_path_buf));

    find_docs_dir_from(cwd.as_deref(), executable_dir.as_deref())
}

fn find_docs_dir_from(
    current_dir: Option<&std::path::Path>,
    executable_dir: Option<&std::path::Path>,
) -> Option<PathBuf> {
    let candidates = current_dir
        .into_iter()
        .flat_map(|root| [root.join("docs/book"), root.join("../docs/book")])
        .chain(
            executable_dir
                .into_iter()
                .flat_map(|root| [root.join("docs/book"), root.join("../docs/book")]),
        )
        .chain(
            [
                "/opt/homebrew/share/odoo-rust-mcp/docs/book",
                "/usr/local/share/odoo-rust-mcp/docs/book",
                "/usr/share/rust-mcp/docs/book",
            ]
            .into_iter()
            .map(PathBuf::from),
        );

    candidates
        .filter(|candidate| candidate.is_dir())
        .find_map(|candidate| candidate.canonicalize().ok())
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
    if !state.auth_config.is_enabled().await {
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
    if !state.auth_config.is_enabled().await {
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
        .await
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

    // Reload auth config to apply the new password immediately
    state.auth_config.reload().await;

    info!("Password changed for user '{}' (hot-reloaded)", username);

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
    exe_path: Option<String>,
}

async fn mcp_token_status() -> impl IntoResponse {
    let enabled = std::env::var("MCP_AUTH_ENABLED")
        .map(|v| v.to_lowercase() == "true" || v == "1")
        .unwrap_or(false);

    let token_configured = std::env::var("MCP_AUTH_TOKEN")
        .map(|v| !v.trim().is_empty())
        .unwrap_or(false);

    let exe_path = std::env::current_exe()
        .ok()
        .map(|p| p.to_string_lossy().to_string());

    Json(McpAuthStatusResponse {
        enabled,
        token_configured,
        exe_path,
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

// =============================================================================
// Instance Env Sync
// =============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
enum InstanceEnvSyncState {
    Synced,
    OutOfSync,
    NotSynced,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
enum AlternateSourceState {
    MatchesRuntime,
    Stale,
    Unreadable,
}

#[derive(Debug, Clone, Serialize)]
struct AlternateInstancesSource {
    path: String,
    status: AlternateSourceState,
}

#[derive(Debug, Clone, Serialize)]
struct InstancesSyncStatusResponse {
    configured: bool,
    synced_count: usize,
    total_count: usize,
    instances: HashMap<String, InstanceEnvSyncState>,
    extra_env_instances: Vec<String>,
    runtime_source_kind: String,
    instances_source_path: Option<String>,
    env_file_path: String,
    alternate_sources: Vec<AlternateInstancesSource>,
}

#[derive(Debug, Clone, Serialize)]
struct SyncInstancesEnvResponse {
    status: String,
    message: String,
    restart_required: bool,
    instances_synced: usize,
    #[serde(flatten)]
    sync_status: InstancesSyncStatusResponse,
}

async fn get_instances_sync_status(State(state): State<AppState>) -> impl IntoResponse {
    match build_instances_sync_status(&state.config_manager, &state.env_file_path).await {
        Ok(sync_status) => (StatusCode::OK, Json(sync_status)).into_response(),
        Err(e) => {
            error!("Failed to build instances sync status: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("Failed to read sync status: {e}") })),
            )
                .into_response()
        }
    }
}

async fn sync_instances_to_env(State(state): State<AppState>) -> impl IntoResponse {
    let instances = match state.config_manager.load_instances().await {
        Ok(config) => config,
        Err(e) => {
            error!("Failed to load instances for env sync: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("Failed to load instances: {e}") })),
            )
                .into_response();
        }
    };

    if !instances.is_object() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Instances config must be a JSON object" })),
        )
            .into_response();
    }

    let normalized_instances = match state
        .config_manager
        .normalize_instances_config(instances.clone())
        .await
    {
        Ok(value) => value,
        Err(e) => {
            error!("Failed to normalize instances for env sync: {}", e);
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": format!("Invalid instances config: {e}") })),
            )
                .into_response();
        }
    };

    if normalized_instances != instances {
        match state.config_manager.save_instances(instances).await {
            Ok(result) if result.success => {}
            Ok(result) => {
                error!(
                    "Failed to normalize instances file during env sync: {}",
                    result.message
                );
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": result.message })),
                )
                    .into_response();
            }
            Err(e) => {
                error!(
                    "Failed to rewrite normalized instances file during env sync: {}",
                    e
                );
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": format!("Failed to normalize instances file: {e}") })),
                )
                    .into_response();
            }
        }
    }

    let serialized_instances = match serde_json::to_string(&normalized_instances) {
        Ok(value) => value,
        Err(e) => {
            error!("Failed to serialize instances for env sync: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("Failed to serialize instances: {e}") })),
            )
                .into_response();
        }
    };

    if let Err(e) = update_env_var(
        &state.env_file_path,
        "ODOO_INSTANCES",
        &serialized_instances,
    ) {
        error!("Failed to update ODOO_INSTANCES: {}", e);
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Failed to update env file: {e}") })),
        )
            .into_response();
    }

    let sync_status =
        match build_instances_sync_status(&state.config_manager, &state.env_file_path).await {
            Ok(sync_status) => sync_status,
            Err(e) => {
                error!("Failed to refresh sync status after env sync: {}", e);
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": format!("Failed to refresh sync status: {e}") })),
                )
                    .into_response();
            }
        };

    let instances_synced = sync_status.synced_count;
    let response = SyncInstancesEnvResponse {
        status: "synced".to_string(),
        message: format!(
            "Synced {} instance(s) to ODOO_INSTANCES in the env file. Env-based launches may require a restart to pick up the snapshot.",
            sync_status.total_count
        ),
        restart_required: true,
        instances_synced,
        sync_status,
    };

    info!(
        "Synced {} instance(s) from the Config UI into ODOO_INSTANCES",
        response.instances_synced
    );

    (StatusCode::OK, Json(response)).into_response()
}

// =============================================================================
// Instance Connection Test
// =============================================================================

async fn test_instance_connection(
    State(state): State<AppState>,
    Path(name): Path<String>,
) -> impl IntoResponse {
    let instances_json = match state.config_manager.load_instances().await {
        Ok(v) => v,
        Err(e) => {
            error!("Failed to load instances for test: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "ok": false, "error": format!("Failed to load instances: {e}") })),
            )
                .into_response();
        }
    };

    let instance_value = match instances_json.get(&name) {
        Some(v) => v.clone(),
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({ "ok": false, "error": format!("Instance '{name}' not found") })),
            )
                .into_response();
        }
    };

    let cfg: OdooInstanceConfig = match serde_json::from_value(instance_value) {
        Ok(v) => v,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "ok": false, "error": format!("Invalid instance config: {e}") })),
            )
                .into_response();
        }
    };

    if cfg.auth_mode() == crate::odoo::config::OdooAuthMode::Password
        && cfg.username_looks_like_url()
    {
        return (
            StatusCode::OK,
            Json(json!({
                "ok": false,
                "error": "The saved Username currently looks like the instance URL. For Odoo 18 and earlier, enter the Odoo login name or email in Username and keep the site address only in URL.",
            })),
        )
            .into_response();
    }

    let client = match OdooClient::new(&cfg) {
        Ok(c) => c,
        Err(e) => {
            return (
                StatusCode::OK,
                Json(json!({ "ok": false, "error": format!("Failed to create client: {e}") })),
            )
                .into_response();
        }
    };

    let start = Instant::now();
    let probe = client.health_probe().await;
    let latency_ms = start.elapsed().as_millis() as u64;

    match probe {
        Ok(()) => {
            info!(
                "Connection test for '{}': ok=true, latency={}ms",
                name, latency_ms
            );
            (
                StatusCode::OK,
                Json(json!({ "ok": true, "latency_ms": latency_ms })),
            )
                .into_response()
        }
        Err(e) => {
            let error_message = e.to_string();
            info!(
                "Connection test for '{}': ok=false, latency={}ms, error={}",
                name, latency_ms, error_message
            );
            (
                StatusCode::OK,
                Json(json!({
                    "ok": false,
                    "latency_ms": latency_ms,
                    "error": error_message,
                })),
            )
                .into_response()
        }
    }
}

fn read_env_file_lines(env_file_path: &PathBuf) -> Vec<String> {
    std::fs::read_to_string(env_file_path)
        .unwrap_or_default()
        .lines()
        .map(|line| line.to_string())
        .collect()
}

fn write_env_file_lines(env_file_path: &PathBuf, lines: &[String]) -> anyhow::Result<()> {
    if let Some(parent) = env_file_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let content = if lines.is_empty() {
        String::new()
    } else {
        format!("{}\n", lines.join("\n"))
    };
    std::fs::write(env_file_path, content)?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(env_file_path, std::fs::Permissions::from_mode(0o600));
    }

    Ok(())
}

fn read_active_env_vars(env_file_path: &PathBuf) -> HashMap<String, String> {
    let mut vars = HashMap::new();

    for line in read_env_file_lines(env_file_path) {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        if let Some((key, value)) = trimmed.split_once('=') {
            vars.insert(key.trim().to_string(), value.trim().to_string());
        }
    }

    vars
}

/// Update or add an environment variable in the env file.
fn update_env_var(env_file_path: &PathBuf, key: &str, value: &str) -> anyhow::Result<()> {
    let mut lines = read_env_file_lines(env_file_path);
    let mut found = false;

    for line in &mut lines {
        let trimmed = line.trim();
        if trimmed.starts_with(&format!("{key}=")) {
            *line = format!("{key}={value}");
            found = true;
            break;
        }

        if trimmed.starts_with(&format!("# {key}=")) || trimmed.starts_with(&format!("#{key}=")) {
            *line = format!("{key}={value}");
            found = true;
            break;
        }
    }

    if !found {
        lines.push(format!("{key}={value}"));
    }

    write_env_file_lines(env_file_path, &lines)
}

#[cfg(test)]
fn deactivate_env_var(env_file_path: &PathBuf, key: &str) -> anyhow::Result<()> {
    let mut lines = read_env_file_lines(env_file_path);
    let mut changed = false;

    for line in &mut lines {
        let trimmed = line.trim_start();
        if trimmed.starts_with(&format!("{key}=")) {
            *line = format!("# {}", trimmed);
            changed = true;
            break;
        }
    }

    if changed {
        write_env_file_lines(env_file_path, &lines)?;
    }

    Ok(())
}

fn parse_env_instances_value(raw: &str) -> anyhow::Result<HashMap<String, Value>> {
    let raw = raw.trim();
    if raw.is_empty() {
        return Ok(HashMap::new());
    }

    if raw.starts_with('{') || raw.starts_with('[') {
        return serde_json::from_str(raw)
            .map_err(|e| anyhow::anyhow!("Failed to parse ODOO_INSTANCES JSON: {e}"));
    }

    let content = std::fs::read_to_string(raw)
        .map_err(|e| anyhow::anyhow!("Failed to read ODOO_INSTANCES file '{raw}': {e}"))?;

    serde_json::from_str(&content)
        .map_err(|e| anyhow::anyhow!("Failed to parse ODOO_INSTANCES file '{raw}': {e}"))
}

fn canonicalize_lossy(path: &std::path::Path) -> PathBuf {
    path.canonicalize().unwrap_or_else(|_| path.to_path_buf())
}

fn candidate_alternate_instance_paths(active_path: &std::path::Path) -> Vec<PathBuf> {
    let active_canonical = canonicalize_lossy(active_path);
    let mut candidates = Vec::new();

    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(cwd.join("instances.json"));
        if let Some(parent) = cwd.parent() {
            candidates.push(parent.join("instances.json"));
        }
    }

    if let Ok(exe_path) = std::env::current_exe()
        && let Some(exe_dir) = exe_path.parent()
    {
        candidates.push(exe_dir.join("instances.json"));
        candidates.push(exe_dir.join("../instances.json"));
        candidates.push(exe_dir.join("../../instances.json"));
        candidates.push(exe_dir.join("../../../instances.json"));
    }

    candidates.sort();
    candidates.dedup();
    candidates
        .into_iter()
        .filter(|candidate| candidate.exists())
        .filter(|candidate| canonicalize_lossy(candidate) != active_canonical)
        .collect()
}

fn compare_instance_file_to_runtime(
    runtime_instances: &Value,
    candidate_path: &PathBuf,
) -> AlternateSourceState {
    let Ok(content) = std::fs::read_to_string(candidate_path) else {
        return AlternateSourceState::Unreadable;
    };

    match serde_json::from_str::<Value>(&content) {
        Ok(candidate_value) if candidate_value == *runtime_instances => {
            AlternateSourceState::MatchesRuntime
        }
        Ok(_) => AlternateSourceState::Stale,
        Err(_) => AlternateSourceState::Unreadable,
    }
}

async fn build_instances_sync_status(
    config_manager: &ConfigManager,
    env_file_path: &PathBuf,
) -> anyhow::Result<InstancesSyncStatusResponse> {
    let instances = config_manager.load_instances().await?;
    let Some(instances_obj) = instances.as_object() else {
        anyhow::bail!("Instances config must be a JSON object");
    };

    let active_env_vars = read_active_env_vars(env_file_path);
    let (configured, env_instances) = match active_env_vars.get("ODOO_INSTANCES") {
        Some(raw) => match parse_env_instances_value(raw) {
            Ok(parsed) => (true, parsed),
            Err(e) => {
                warn!("Failed to parse ODOO_INSTANCES from env file: {}", e);
                (false, HashMap::new())
            }
        },
        None => (false, HashMap::new()),
    };

    let mut instances_status = HashMap::new();
    let mut synced_count = 0usize;

    for (name, instance) in instances_obj {
        let status = match env_instances.get(name) {
            Some(env_instance) if env_instance == instance => {
                synced_count += 1;
                InstanceEnvSyncState::Synced
            }
            Some(_) => InstanceEnvSyncState::OutOfSync,
            None => InstanceEnvSyncState::NotSynced,
        };
        instances_status.insert(name.clone(), status);
    }

    let mut extra_env_instances: Vec<String> = env_instances
        .keys()
        .filter(|name| !instances_obj.contains_key(*name))
        .cloned()
        .collect();
    extra_env_instances.sort();

    let runtime_source = detect_runtime_instances_source();
    let instances_source_path = runtime_source.path.clone();
    let alternate_sources = instances_source_path
        .as_ref()
        .map(|active_path| {
            candidate_alternate_instance_paths(active_path)
                .into_iter()
                .map(|path| AlternateInstancesSource {
                    path: path.display().to_string(),
                    status: compare_instance_file_to_runtime(&instances, &path),
                })
                .collect()
        })
        .unwrap_or_default();

    Ok(InstancesSyncStatusResponse {
        configured,
        synced_count,
        total_count: instances_obj.len(),
        instances: instances_status,
        extra_env_instances,
        runtime_source_kind: runtime_source.kind.as_str().to_string(),
        instances_source_path: match runtime_source.kind {
            RuntimeInstancesSourceKind::InstancesJson => {
                instances_source_path.map(|path| path.display().to_string())
            }
            RuntimeInstancesSourceKind::InlineEnv | RuntimeInstancesSourceKind::SingleInstance => {
                None
            }
        },
        env_file_path: env_file_path.display().to_string(),
        alternate_sources,
    })
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
                // Hot-reload the MCP client pool so tool calls use the new instances immediately
                if let Some(ref pool) = state.pool {
                    pool.reload().await;
                }
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

async fn get_tools_drift(State(state): State<AppState>) -> impl IntoResponse {
    match state.config_manager.tools_drift().await {
        Ok(drift) => (StatusCode::OK, Json(json!(drift))).into_response(),
        Err(e) => {
            error!("Failed to compare tools catalog drift: {}", e);
            (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": e.to_string() })),
            )
                .into_response()
        }
    }
}

async fn import_missing_tools(State(state): State<AppState>) -> impl IntoResponse {
    match state.config_manager.import_missing_tools().await {
        Ok(result) => {
            state.config_watcher.notify("tools.json");
            (StatusCode::OK, Json(json!(result))).into_response()
        }
        Err(e) => {
            error!("Failed to import missing tools: {}", e);
            (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": e.to_string() })),
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

#[cfg(test)]
mod tests {
    use super::{
        AppState, AuthConfig, DynamicAuthConfig, InstanceEnvSyncState, build_instances_sync_status,
        deactivate_env_var, find_docs_dir_from, read_active_env_vars, sync_instances_to_env,
        test_instance_connection, update_env_var,
    };
    use crate::{
        TEST_ENV_MUTEX,
        config_manager::{ConfigManager, ConfigWatcher},
    };
    use axum::{
        body::to_bytes,
        extract::{Path, State},
        http::StatusCode,
        response::IntoResponse,
    };
    use serde_json::json;
    use std::{collections::HashMap, path::Path as StdPath, sync::Arc};
    use tempfile::TempDir;
    use tokio::sync::RwLock;
    use wiremock::{
        Mock, MockServer, ResponseTemplate,
        matchers::{method, path},
    };

    struct EnvGuard {
        key: &'static str,
        original: Option<String>,
    }

    #[test]
    fn finds_packaged_docs_beside_the_executable() {
        let temp_dir = TempDir::new().unwrap();
        let executable_dir = temp_dir.path().join("install");
        let docs_dir = executable_dir.join("docs/book");
        std::fs::create_dir_all(&docs_dir).unwrap();

        assert_eq!(
            find_docs_dir_from(None, Some(&executable_dir)),
            Some(docs_dir.canonicalize().unwrap())
        );
    }

    impl EnvGuard {
        fn set(key: &'static str, value: Option<&str>) -> Self {
            let original = std::env::var(key).ok();
            match value {
                Some(value) => {
                    // SAFETY: Tests in this module manipulate env vars in a controlled scope.
                    unsafe { std::env::set_var(key, value) };
                }
                None => {
                    // SAFETY: Tests in this module manipulate env vars in a controlled scope.
                    unsafe { std::env::remove_var(key) };
                }
            }
            Self { key, original }
        }
    }

    impl Drop for EnvGuard {
        fn drop(&mut self) {
            match &self.original {
                Some(value) => {
                    // SAFETY: Tests in this module manipulate env vars in a controlled scope.
                    unsafe { std::env::set_var(self.key, value) };
                }
                None => {
                    // SAFETY: Tests in this module manipulate env vars in a controlled scope.
                    unsafe { std::env::remove_var(self.key) };
                }
            }
        }
    }

    fn write_json(path: &StdPath, value: &serde_json::Value) {
        std::fs::write(path, serde_json::to_string_pretty(value).unwrap()).unwrap();
    }

    fn make_test_state(config_dir: &StdPath, env_file: &StdPath) -> AppState {
        AppState {
            config_manager: ConfigManager::new(config_dir.to_path_buf()),
            config_watcher: Arc::new(ConfigWatcher::new(config_dir.to_path_buf()).unwrap()),
            sessions: Arc::new(RwLock::new(HashMap::new())),
            auth_config: DynamicAuthConfig::new(AuthConfig {
                username: String::new(),
                password: String::new(),
                enabled: false,
            }),
            env_file_path: env_file.to_path_buf(),
            http_auth_config: None,
            pool: None,
        }
    }

    #[test]
    fn update_and_deactivate_env_vars_round_trip() {
        let _env_lock = TEST_ENV_MUTEX.lock().unwrap();
        let temp_dir = TempDir::new().unwrap();
        let env_file = temp_dir.path().join("env");

        std::fs::write(
            &env_file,
            "ODOO_INSTANCES_JSON=/tmp/instances.json\nCONFIG_UI_USERNAME=admin\n",
        )
        .unwrap();

        update_env_var(
            &env_file,
            "ODOO_INSTANCES",
            r#"{"prod":{"url":"http://localhost:8069","db":"prod"}}"#,
        )
        .unwrap();
        deactivate_env_var(&env_file, "ODOO_INSTANCES_JSON").unwrap();

        let env_vars = read_active_env_vars(&env_file);
        let env_text = std::fs::read_to_string(&env_file).unwrap();

        assert_eq!(
            env_vars.get("ODOO_INSTANCES").map(String::as_str),
            Some(r#"{"prod":{"url":"http://localhost:8069","db":"prod"}}"#)
        );
        assert!(!env_vars.contains_key("ODOO_INSTANCES_JSON"));
        assert_eq!(
            env_vars.get("CONFIG_UI_USERNAME").map(String::as_str),
            Some("admin")
        );
        assert!(env_text.contains("# ODOO_INSTANCES_JSON=/tmp/instances.json"));
    }

    #[tokio::test]
    async fn build_instances_sync_status_reports_exact_match_and_extra_entries() {
        let _env_lock = TEST_ENV_MUTEX.lock().unwrap();
        let temp_dir = TempDir::new().unwrap();
        let config_manager = ConfigManager::new(temp_dir.path().to_path_buf());
        let env_file = temp_dir.path().join("env");
        let instances_file = temp_dir.path().join("instances.json");
        let _instances_json = EnvGuard::set(
            "ODOO_INSTANCES_JSON",
            Some(instances_file.to_string_lossy().as_ref()),
        );

        write_json(
            &instances_file,
            &json!({
                "prod": {
                    "url": "http://localhost:8069",
                    "db": "prod",
                    "apiKey": "secret"
                },
                "staging": {
                    "url": "http://localhost:8070",
                    "db": "staging"
                }
            }),
        );

        std::fs::write(
            &env_file,
            format!(
                "ODOO_INSTANCES={}\n",
                serde_json::to_string(&json!({
                    "prod": {
                        "url": "http://localhost:8069",
                        "db": "prod",
                        "apiKey": "secret"
                    },
                    "staging": {
                        "url": "http://localhost:8070",
                        "db": "staging-copy"
                    },
                    "extra": {
                        "url": "http://localhost:9999",
                        "db": "extra"
                    }
                }))
                .unwrap()
            ),
        )
        .unwrap();

        let status = build_instances_sync_status(&config_manager, &env_file)
            .await
            .unwrap();

        assert!(status.configured);
        assert_eq!(status.synced_count, 1);
        assert_eq!(status.total_count, 2);
        assert_eq!(
            status.instances.get("prod"),
            Some(&InstanceEnvSyncState::Synced)
        );
        assert_eq!(
            status.instances.get("staging"),
            Some(&InstanceEnvSyncState::OutOfSync)
        );
        assert_eq!(status.extra_env_instances, vec!["extra".to_string()]);
        assert_eq!(status.runtime_source_kind, "instances_json");
        assert_eq!(
            status.instances_source_path.as_deref(),
            Some(instances_file.to_string_lossy().as_ref())
        );
        assert_eq!(status.env_file_path, env_file.to_string_lossy());
    }

    #[tokio::test]
    async fn build_instances_sync_status_marks_missing_entries_as_not_synced() {
        let _env_lock = TEST_ENV_MUTEX.lock().unwrap();
        let temp_dir = TempDir::new().unwrap();
        let config_manager = ConfigManager::new(temp_dir.path().to_path_buf());
        let env_file = temp_dir.path().join("env");
        let instances_file = temp_dir.path().join("instances.json");
        let _instances_json = EnvGuard::set(
            "ODOO_INSTANCES_JSON",
            Some(instances_file.to_string_lossy().as_ref()),
        );

        write_json(
            &instances_file,
            &json!({
                "prod": {
                    "url": "http://localhost:8069",
                    "db": "prod"
                }
            }),
        );

        std::fs::write(&env_file, "").unwrap();

        let status = build_instances_sync_status(&config_manager, &env_file)
            .await
            .unwrap();

        assert!(!status.configured);
        assert_eq!(status.synced_count, 0);
        assert_eq!(status.total_count, 1);
        assert_eq!(
            status.instances.get("prod"),
            Some(&InstanceEnvSyncState::NotSynced)
        );
        assert!(status.extra_env_instances.is_empty());
        assert_eq!(status.runtime_source_kind, "instances_json");
        assert_eq!(
            status.instances_source_path.as_deref(),
            Some(instances_file.to_string_lossy().as_ref())
        );
    }

    #[tokio::test]
    async fn test_instance_connection_returns_error_details_for_failed_probe() {
        let _env_lock = TEST_ENV_MUTEX.lock().unwrap();
        let temp_dir = TempDir::new().unwrap();
        let env_file = temp_dir.path().join("env");
        let instances_file = temp_dir.path().join("instances.json");
        let _instances_json = EnvGuard::set(
            "ODOO_INSTANCES_JSON",
            Some(instances_file.to_string_lossy().as_ref()),
        );
        let mock_server = MockServer::start().await;

        Mock::given(method("POST"))
            .and(path("/json/2/ir.model/search_count"))
            .respond_with(ResponseTemplate::new(404))
            .mount(&mock_server)
            .await;

        write_json(
            &instances_file,
            &json!({
                "broken": {
                    "url": mock_server.uri(),
                    "db": "wrong-db",
                    "apiKey": "secret",
                    "version": "19"
                }
            }),
        );

        let response = test_instance_connection(
            State(make_test_state(temp_dir.path(), &env_file)),
            Path("broken".to_string()),
        )
        .await
        .into_response();
        assert_eq!(response.status(), StatusCode::OK);

        let body: serde_json::Value =
            serde_json::from_slice(&to_bytes(response.into_body(), usize::MAX).await.unwrap())
                .unwrap();
        assert_eq!(body["ok"], json!(false));
        assert!(body["latency_ms"].as_u64().is_some());
        let error = body["error"].as_str().unwrap();
        assert!(error.contains("wrong-db"));
        assert!(error.contains("HTTP 404"));
        assert!(error.contains("does not exactly match the database name"));
    }

    #[tokio::test]
    async fn test_instance_connection_returns_latency_for_successful_probe() {
        let _env_lock = TEST_ENV_MUTEX.lock().unwrap();
        let temp_dir = TempDir::new().unwrap();
        let env_file = temp_dir.path().join("env");
        let instances_file = temp_dir.path().join("instances.json");
        let _instances_json = EnvGuard::set(
            "ODOO_INSTANCES_JSON",
            Some(instances_file.to_string_lossy().as_ref()),
        );
        let mock_server = MockServer::start().await;

        Mock::given(method("POST"))
            .and(path("/json/2/ir.model/search_count"))
            .respond_with(ResponseTemplate::new(200).set_body_raw("662", "application/json"))
            .mount(&mock_server)
            .await;

        write_json(
            &instances_file,
            &json!({
                "healthy": {
                    "url": mock_server.uri(),
                    "db": "agrinas_live",
                    "apiKey": "secret",
                    "version": "19"
                }
            }),
        );

        let response = test_instance_connection(
            State(make_test_state(temp_dir.path(), &env_file)),
            Path("healthy".to_string()),
        )
        .await
        .into_response();
        assert_eq!(response.status(), StatusCode::OK);

        let body: serde_json::Value =
            serde_json::from_slice(&to_bytes(response.into_body(), usize::MAX).await.unwrap())
                .unwrap();
        assert_eq!(body["ok"], json!(true));
        assert!(body["latency_ms"].as_u64().is_some());
        assert!(body.get("error").is_none() || body["error"].is_null());
    }

    #[tokio::test]
    async fn sync_instances_to_env_strips_legacy_aliases_from_file_and_env_snapshot() {
        let _env_lock = TEST_ENV_MUTEX.lock().unwrap();
        let temp_dir = TempDir::new().unwrap();
        let env_file = temp_dir.path().join("env");
        let instances_file = temp_dir.path().join("instances.json");
        let _instances_json = EnvGuard::set(
            "ODOO_INSTANCES_JSON",
            Some(instances_file.to_string_lossy().as_ref()),
        );

        write_json(
            &instances_file,
            &json!({
                "legacy": {
                    "url": "http://localhost:8069",
                    "apiKey": "secret",
                    "tags": ["legacy", " prod ", "LEGACY", ""],
                    "aliases": ["old-name"]
                }
            }),
        );

        let response = sync_instances_to_env(State(make_test_state(temp_dir.path(), &env_file)))
            .await
            .into_response();
        assert_eq!(response.status(), StatusCode::OK);

        let normalized_instances: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(&instances_file).unwrap()).unwrap();
        assert!(normalized_instances["legacy"].get("aliases").is_none());
        assert_eq!(
            normalized_instances["legacy"]["tags"],
            json!(["legacy", "prod"])
        );

        let env_text = std::fs::read_to_string(&env_file).unwrap();
        assert!(env_text.contains("ODOO_INSTANCES="));
        assert!(!env_text.contains("\"aliases\""));
        assert!(env_text.contains("\"tags\""));
    }
}
