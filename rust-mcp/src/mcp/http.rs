//! MCP Streamable HTTP Transport
//!
//! Implements the MCP Streamable HTTP transport per specification 2025-11-25.
//! Features:
//! - POST /mcp: Send JSON-RPC messages, receive JSON or SSE stream response
//! - GET /mcp: Open SSE stream for server-to-client notifications
//! - DELETE /mcp: Explicitly terminate a session
//! - Origin validation for security
//! - Session management with resumability support
//! - Protocol version header handling

use std::collections::{HashMap, VecDeque};
use std::convert::Infallible;
use std::net::SocketAddr;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

use axum::extract::{Query, State};
use axum::http::{HeaderMap, HeaderName, HeaderValue, StatusCode};
use axum::response::IntoResponse;
use axum::response::sse::{Event, Sse};
use axum::routing::{get, post};
use axum::{Json, Router};
use mcp_rust_sdk::error::{Error as McpError, ErrorCode};
use mcp_rust_sdk::protocol::{RequestId, Response};
use mcp_rust_sdk::server::ServerHandler;
use serde::Deserialize;
use serde_json::{Value, json};
use tokio::sync::{Mutex, RwLock, broadcast};
use tokio_stream::wrappers::{BroadcastStream, IntervalStream};
use tokio_stream::{StreamExt, iter};
use tower_http::cors::CorsLayer;
use tracing::{debug, info, warn};
use uuid::Uuid;

use crate::mcp::McpOdooHandler;

// Header names per MCP spec
static MCP_SESSION_ID: HeaderName = HeaderName::from_static("mcp-session-id");
static MCP_PROTOCOL_VERSION: HeaderName = HeaderName::from_static("mcp-protocol-version");
static AUTHORIZATION: HeaderName = HeaderName::from_static("authorization");
static ORIGIN: HeaderName = HeaderName::from_static("origin");
static LAST_EVENT_ID: HeaderName = HeaderName::from_static("last-event-id");

/// Default protocol version for backwards compatibility
const DEFAULT_PROTOCOL_VERSION: &str = "2025-03-26";

/// Current supported protocol version
const CURRENT_PROTOCOL_VERSION: &str = "2025-11-05";

/// Maximum number of events to buffer for resumability per session
const MAX_EVENT_BUFFER_SIZE: usize = 100;

/// SSE keepalive interval in seconds
const SSE_KEEPALIVE_SECS: u64 = 15;

/// Default retry interval for SSE reconnection (milliseconds)
const SSE_RETRY_MS: u64 = 3000;

/// Stored SSE event for resumability
#[derive(Clone, Debug)]
struct StoredEvent {
    id: String,
    data: Value,
}

/// Session state with enhanced tracking for Streamable HTTP
#[derive(Clone)]
struct SessionState {
    initialized: bool,
    protocol_version: String,
    event_counter: Arc<AtomicU64>,
    /// Circular buffer of recent events for resumability (placeholder for full implementation)
    #[allow(dead_code)]
    event_buffer: Arc<RwLock<VecDeque<StoredEvent>>>,
}

impl Default for SessionState {
    fn default() -> Self {
        Self {
            initialized: false,
            protocol_version: DEFAULT_PROTOCOL_VERSION.to_string(),
            event_counter: Arc::new(AtomicU64::new(0)),
            event_buffer: Arc::new(RwLock::new(VecDeque::with_capacity(MAX_EVENT_BUFFER_SIZE))),
        }
    }
}

impl SessionState {
    fn new(protocol_version: String) -> Self {
        Self {
            initialized: true,
            protocol_version,
            event_counter: Arc::new(AtomicU64::new(0)),
            event_buffer: Arc::new(RwLock::new(VecDeque::with_capacity(MAX_EVENT_BUFFER_SIZE))),
        }
    }

    /// Generate next event ID for this session
    fn next_event_id(&self, session_id: &str) -> String {
        let counter = self.event_counter.fetch_add(1, Ordering::SeqCst);
        format!("{}:{}", session_id, counter)
    }

    /// Store an event for potential replay (placeholder for full resumability implementation)
    #[allow(dead_code)]
    async fn store_event(&self, event: StoredEvent) {
        let mut buffer = self.event_buffer.write().await;
        if buffer.len() >= MAX_EVENT_BUFFER_SIZE {
            buffer.pop_front();
        }
        buffer.push_back(event);
    }

    /// Get events after a given event ID for replay (placeholder for full resumability implementation)
    #[allow(dead_code)]
    async fn get_events_after(&self, last_event_id: &str) -> Vec<StoredEvent> {
        let buffer = self.event_buffer.read().await;
        let mut found = false;
        let mut result = Vec::new();

        for event in buffer.iter() {
            if found {
                result.push(event.clone());
            } else if event.id == last_event_id {
                found = true;
            }
        }

        result
    }
}

/// Security configuration for Origin validation
#[derive(Clone, Debug, Default)]
pub struct SecurityConfig {
    /// Allowed origins. None = allow all (default), Some([]) = localhost only
    pub allowed_origins: Option<Vec<String>>,
}

impl SecurityConfig {
    /// Load security config from environment
    pub fn from_env() -> Self {
        let allowed_origins: Option<Vec<String>> =
            std::env::var("MCP_ALLOWED_ORIGINS").ok().map(|s| {
                s.split(',')
                    .map(|o| o.trim().to_string())
                    .filter(|o| !o.is_empty())
                    .collect()
            });

        if let Some(ref origins) = allowed_origins {
            if origins.is_empty() {
                info!("MCP Origin validation: localhost only");
            } else {
                info!("MCP Origin validation enabled: {:?}", origins);
            }
        } else {
            debug!("MCP Origin validation disabled (set MCP_ALLOWED_ORIGINS to enable)");
        }

        Self { allowed_origins }
    }
}

/// Authentication configuration for HTTP transport
#[derive(Clone)]
pub struct AuthConfig {
    /// Bearer token for authentication. If None, authentication is disabled.
    pub bearer_token: Option<String>,
    /// Whether authentication is enabled (MCP_AUTH_ENABLED)
    pub enabled: bool,
}

impl AuthConfig {
    /// Load auth config from environment variables
    pub fn from_env() -> Self {
        // Check if auth is explicitly enabled
        let enabled = std::env::var("MCP_AUTH_ENABLED")
            .map(|v| v.to_lowercase() == "true" || v == "1")
            .unwrap_or(false);

        let bearer_token = std::env::var("MCP_AUTH_TOKEN")
            .ok()
            .filter(|s| !s.is_empty());

        if enabled {
            if bearer_token.is_some() {
                info!("MCP HTTP authentication enabled (Bearer token)");
            } else {
                warn!("MCP HTTP authentication enabled but MCP_AUTH_TOKEN not set!");
            }
        } else {
            debug!("MCP HTTP authentication disabled (set MCP_AUTH_ENABLED=true to enable)");
        }

        Self {
            bearer_token,
            enabled,
        }
    }

    /// Create a disabled auth config
    pub fn disabled() -> Self {
        Self {
            bearer_token: None,
            enabled: false,
        }
    }
}

#[derive(Clone)]
struct AppState {
    handler: Arc<McpOdooHandler>,
    sessions: Arc<Mutex<HashMap<String, SessionState>>>,
    sse_channels: Arc<Mutex<HashMap<String, broadcast::Sender<Value>>>>,
    auth: AuthConfig,
    security: SecurityConfig,
}

pub async fn serve(handler: Arc<McpOdooHandler>, listen: &str) -> anyhow::Result<()> {
    serve_with_config(
        handler,
        listen,
        AuthConfig::from_env(),
        SecurityConfig::from_env(),
    )
    .await
}

pub async fn serve_with_auth(
    handler: Arc<McpOdooHandler>,
    listen: &str,
    auth: AuthConfig,
) -> anyhow::Result<()> {
    serve_with_config(handler, listen, auth, SecurityConfig::from_env()).await
}

pub async fn serve_with_config(
    handler: Arc<McpOdooHandler>,
    listen: &str,
    auth: AuthConfig,
    security: SecurityConfig,
) -> anyhow::Result<()> {
    let app = create_app_with_security(handler, auth, security);
    let addr: SocketAddr = listen.parse()?;
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

/// Health check handler: returns server status and per-instance Odoo reachability
async fn health_check(State(state): State<AppState>) -> impl IntoResponse {
    let pool = &state.handler.pool;
    let instances = pool.instance_names();

    let mut instance_health = serde_json::Map::new();
    let mut any_reachable = false;
    let mut any_unreachable = false;

    for instance in instances {
        match pool.get(&instance).await {
            Ok(client) => {
                if client.health_check().await {
                    instance_health.insert(instance.clone(), json!({"reachable": true}));
                    any_reachable = true;
                } else {
                    instance_health.insert(
                        instance.clone(),
                        json!({"reachable": false, "error": "health check failed"}),
                    );
                    any_unreachable = true;
                }
            }
            Err(e) => {
                instance_health.insert(
                    instance.clone(),
                    json!({"reachable": false, "error": e.to_string()}),
                );
                any_unreachable = true;
            }
        }
    }

    let status = if !any_unreachable {
        "ok"
    } else if any_reachable {
        "degraded"
    } else {
        "unhealthy"
    };

    let response = json!({
        "status": status,
        "version": env!("CARGO_PKG_VERSION"),
        "instances": instance_health
    });

    Json(response)
}

/// OpenAPI specification handler
async fn openapi_spec() -> impl IntoResponse {
    const OPENAPI_JSON: &str = include_str!("../../openapi/openapi.json");
    let spec: Value = serde_json::from_str(OPENAPI_JSON)
        .unwrap_or_else(|_| json!({"error": "Failed to parse OpenAPI spec"}));
    Json(spec)
}

/// Create the Axum Router for the MCP HTTP server (with default security).
/// This is public to enable integration testing with axum-test.
pub fn create_app(handler: Arc<McpOdooHandler>, auth: AuthConfig) -> Router {
    create_app_with_security(handler, auth, SecurityConfig::default())
}

/// Create the Axum Router with full configuration
pub fn create_app_with_security(
    handler: Arc<McpOdooHandler>,
    auth: AuthConfig,
    security: SecurityConfig,
) -> Router {
    let state = AppState {
        handler,
        sessions: Arc::new(Mutex::new(HashMap::new())),
        sse_channels: Arc::new(Mutex::new(HashMap::new())),
        auth,
        security,
    };

    Router::new()
        // Streamable HTTP (MCP 2025-11-25 spec)
        .route("/mcp", post(mcp_post).get(mcp_get).delete(mcp_delete))
        // Legacy SSE transport (Cursor supports `SSE` transport option)
        .route("/sse", get(legacy_sse))
        .route("/messages", post(legacy_messages))
        // Health check endpoint (no auth required for monitoring)
        .route("/health", get(health_check))
        // OpenAPI specification (no auth required)
        .route("/openapi.json", get(openapi_spec))
        .layer(CorsLayer::permissive())
        .with_state(state)
}

fn jsonrpc_err(id: RequestId, code: ErrorCode, message: impl Into<String>) -> Response {
    Response::error(
        id,
        mcp_rust_sdk::protocol::ResponseError {
            code: code.into(),
            message: message.into(),
            data: None,
        },
    )
}

/// Create a JSON-RPC error response without an ID (for HTTP-level errors)
fn jsonrpc_err_no_id(code: ErrorCode, message: impl Into<String>) -> Value {
    json!({
        "jsonrpc": "2.0",
        "error": {
            "code": i32::from(code),
            "message": message.into()
        }
    })
}

fn cursor_initialize_result(
    params: &Value,
    odoo_instances: Vec<String>,
    protocol_default: String,
    server_name: String,
    instructions: String,
) -> Result<(Value, String), McpError> {
    let protocol_version = params
        .get("protocolVersion")
        .and_then(|v| v.as_str())
        .unwrap_or(&protocol_default)
        .to_string();

    let result = json!({
        "protocolVersion": protocol_version,
        "capabilities": {
            "tools": { "listChanged": true },
            "prompts": { "listChanged": true },
            "resources": {},
            "experimental": {
                "odooInstances": { "available": odoo_instances }
            }
        },
        "serverInfo": {
            "name": server_name,
            "version": env!("CARGO_PKG_VERSION")
        },
        "instructions": instructions
    });

    Ok((result, protocol_version))
}

/// Validate Origin header for security (DNS rebinding prevention)
fn validate_origin(
    headers: &HeaderMap,
    security: &SecurityConfig,
) -> Result<(), (StatusCode, Json<Value>)> {
    let Some(ref allowed) = security.allowed_origins else {
        // Origin validation disabled
        return Ok(());
    };

    let origin = headers.get(&ORIGIN).and_then(|v| v.to_str().ok());

    match origin {
        Some(origin_str) => {
            // Check if localhost (always allowed when list is empty)
            let is_localhost = origin_str.contains("localhost")
                || origin_str.contains("127.0.0.1")
                || origin_str.contains("[::1]");

            if allowed.is_empty() {
                // Empty list = localhost only
                if is_localhost {
                    Ok(())
                } else {
                    Err((
                        StatusCode::FORBIDDEN,
                        Json(jsonrpc_err_no_id(
                            ErrorCode::InvalidRequest,
                            "Origin not allowed: only localhost permitted",
                        )),
                    ))
                }
            } else if allowed.iter().any(|a| a == origin_str) || is_localhost {
                Ok(())
            } else {
                Err((
                    StatusCode::FORBIDDEN,
                    Json(jsonrpc_err_no_id(
                        ErrorCode::InvalidRequest,
                        format!("Origin not allowed: {}", origin_str),
                    )),
                ))
            }
        }
        None => {
            // No Origin header - could be same-origin request or non-browser client
            // Per spec, we only validate when Origin is present
            Ok(())
        }
    }
}

/// Validate Bearer token authentication
fn validate_auth(headers: &HeaderMap, auth: &AuthConfig) -> Result<(), (StatusCode, Json<Value>)> {
    // Check if auth is enabled
    if !auth.enabled {
        return Ok(());
    }

    let Some(expected_token) = &auth.bearer_token else {
        // Auth enabled but no token configured - deny all
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({
                "error": "server_error",
                "error_description": "Authentication enabled but no token configured"
            })),
        ));
    };

    let auth_header = headers.get(&AUTHORIZATION).and_then(|v| v.to_str().ok());

    match auth_header {
        Some(header) if header.starts_with("Bearer ") => {
            let token = &header[7..];
            if token == expected_token {
                Ok(())
            } else {
                Err((
                    StatusCode::UNAUTHORIZED,
                    Json(json!({
                        "error": "invalid_token",
                        "error_description": "The access token is invalid"
                    })),
                ))
            }
        }
        Some(_) => Err((
            StatusCode::UNAUTHORIZED,
            Json(json!({
                "error": "invalid_request",
                "error_description": "Authorization header must use Bearer scheme"
            })),
        )),
        None => Err((
            StatusCode::UNAUTHORIZED,
            Json(json!({
                "error": "invalid_request",
                "error_description": "Missing Authorization header"
            })),
        )),
    }
}

/// Validate MCP-Protocol-Version header
fn validate_protocol_version(
    headers: &HeaderMap,
    session: Option<&SessionState>,
) -> Result<(), (StatusCode, Json<Value>)> {
    let version = headers
        .get(&MCP_PROTOCOL_VERSION)
        .and_then(|v| v.to_str().ok());

    match version {
        Some(v) => {
            // Validate against session's negotiated version or supported versions
            let expected = session
                .map(|s| s.protocol_version.as_str())
                .unwrap_or(CURRENT_PROTOCOL_VERSION);

            // Accept the version if it matches or is a known compatible version
            let known_versions = [
                "2024-11-05",
                "2025-03-26",
                "2025-11-05",
                CURRENT_PROTOCOL_VERSION,
            ];
            if v == expected || known_versions.contains(&v) {
                Ok(())
            } else {
                Err((
                    StatusCode::BAD_REQUEST,
                    Json(jsonrpc_err_no_id(
                        ErrorCode::InvalidRequest,
                        format!("Unsupported protocol version: {}", v),
                    )),
                ))
            }
        }
        None => {
            // Per spec: if no header, assume 2025-03-26 for backwards compatibility
            Ok(())
        }
    }
}

/// Validate session exists and is not expired
fn validate_session(
    session_id: Option<&str>,
    sessions: &HashMap<String, SessionState>,
) -> Result<Option<SessionState>, (StatusCode, Json<Value>)> {
    match session_id {
        Some(id) => match sessions.get(id) {
            Some(state) => Ok(Some(state.clone())),
            None => {
                // Session not found - per spec, return 404
                Err((
                    StatusCode::NOT_FOUND,
                    Json(jsonrpc_err_no_id(
                        ErrorCode::InvalidRequest,
                        "Session not found or expired",
                    )),
                ))
            }
        },
        None => Ok(None), // No session required for initialize
    }
}

async fn handle_jsonrpc(
    state: &AppState,
    session_id: Option<String>,
    v: Value,
) -> Result<(Option<String>, Option<Value>, StatusCode, Option<String>), (StatusCode, Value)> {
    let obj = v
        .as_object()
        .ok_or((StatusCode::BAD_REQUEST, json!({"error":"expected object"})))?;
    let method = obj
        .get("method")
        .and_then(|m| m.as_str())
        .ok_or((StatusCode::BAD_REQUEST, json!({"error":"missing method"})))?
        .to_string();

    // Notifications have no id.
    let id_val = obj.get("id").cloned();
    let params = obj.get("params").cloned();

    // Streamable HTTP sessions: create on initialize, otherwise accept without requiring.
    let effective_session = session_id.clone();

    if method == "initialize" {
        let id_val = id_val.ok_or((
            StatusCode::BAD_REQUEST,
            json!({"error":"initialize requires id"}),
        ))?;
        let id: RequestId = serde_json::from_value(id_val)
            .map_err(|e| (StatusCode::BAD_REQUEST, json!({"error": e.to_string()})))?;
        let params = params.unwrap_or_else(|| json!({}));
        let protocol_default = state.handler.protocol_version_default().await;
        let server_name = state.handler.server_name().await;
        let instructions = state.handler.instructions().await;
        let (result, negotiated_version) = cursor_initialize_result(
            &params,
            state.handler.instance_names(),
            protocol_default,
            server_name,
            instructions,
        )
        .map_err(|e| (StatusCode::BAD_REQUEST, json!({"error": e.to_string()})))?;

        let sess = Uuid::new_v4().to_string();
        state
            .sessions
            .lock()
            .await
            .insert(sess.clone(), SessionState::new(negotiated_version.clone()));
        state
            .sse_channels
            .lock()
            .await
            .entry(sess.clone())
            .or_insert_with(|| broadcast::channel(256).0);

        let resp = Response::success(id, Some(result));
        return Ok((
            Some(sess),
            Some(serde_json::to_value(resp).unwrap()),
            StatusCode::OK,
            Some(negotiated_version),
        ));
    }

    // initialized notification toggles gating for the session (if provided)
    if method == "initialized" {
        if let Some(sess) = &effective_session
            && let Some(st) = state.sessions.lock().await.get_mut(sess)
        {
            st.initialized = true;
        }
        return Ok((None, None, StatusCode::ACCEPTED, None));
    }

    // For other methods, if we have a known session and it's not initialized, reject.
    if let Some(sess) = &effective_session
        && let Some(st) = state.sessions.lock().await.get(sess)
        && !st.initialized
    {
        // Cursor typically sends initialized quickly; if not, still allow read-only ops?
        // We'll follow MCP gating to match stdio behavior.
        let id = id_val
            .clone()
            .and_then(|x| serde_json::from_value::<RequestId>(x).ok())
            .unwrap_or(RequestId::String("unknown".to_string()));
        let resp = jsonrpc_err(
            id,
            ErrorCode::ServerNotInitialized,
            "Server not initialized",
        );
        return Ok((
            None,
            Some(serde_json::to_value(resp).unwrap()),
            StatusCode::OK,
            None,
        ));
    }

    // Notifications: best-effort handle_method, return 202.
    if id_val.is_none() {
        let _ = state.handler.handle_method(&method, params).await;
        return Ok((None, None, StatusCode::ACCEPTED, None));
    }

    let id: RequestId = serde_json::from_value(id_val.unwrap())
        .map_err(|e| (StatusCode::BAD_REQUEST, json!({"error": e.to_string()})))?;

    let result = state
        .handler
        .handle_method(&method, params)
        .await
        .map_err(|e| {
            (
                StatusCode::OK,
                jsonrpc_err(id.clone(), ErrorCode::InternalError, e.to_string()).to_value(),
            )
        })?;
    let resp = Response::success(id, Some(result));
    Ok((
        None,
        Some(serde_json::to_value(resp).unwrap()),
        StatusCode::OK,
        None,
    ))
}

/// POST /mcp - Send JSON-RPC messages
///
/// Per MCP spec:
/// - Accept header must include application/json and text/event-stream
/// - Response can be JSON or SSE stream
/// - For notifications/responses: return 202 Accepted
/// - For requests: return response or stream
async fn mcp_post(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> impl IntoResponse {
    // Validate Origin (security)
    if let Err(err) = validate_origin(&headers, &state.security) {
        return err.into_response();
    }

    // Validate authentication
    if let Err(err) = validate_auth(&headers, &state.auth) {
        return err.into_response();
    }

    let session_id = headers
        .get(&MCP_SESSION_ID)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    // Validate session if provided (except for initialize)
    let is_initialize = body
        .get("method")
        .and_then(|m| m.as_str())
        .is_some_and(|m| m == "initialize");

    if !is_initialize && let Some(ref sid) = session_id {
        let sessions = state.sessions.lock().await;
        if let Err(err) = validate_session(Some(sid), &sessions) {
            return err.into_response();
        }
        let session_state = sessions.get(sid);
        if let Err(err) = validate_protocol_version(&headers, session_state) {
            return err.into_response();
        }
    }

    // Handle the JSON-RPC message
    let (new_sess, maybe_resp, status, protocol_version) =
        match handle_jsonrpc(&state, session_id.clone(), body).await {
            Ok(v) => v,
            Err((sc, v)) => return (sc, Json(v)).into_response(),
        };

    // Build response headers
    let mut out_headers = HeaderMap::new();
    if let Some(sess) = new_sess {
        let _ = out_headers.insert(&MCP_SESSION_ID, HeaderValue::from_str(&sess).unwrap());
    }
    if let Some(version) = protocol_version {
        let _ = out_headers.insert(
            &MCP_PROTOCOL_VERSION,
            HeaderValue::from_str(&version).unwrap(),
        );
    }

    match maybe_resp {
        Some(v) => (status, out_headers, Json(v)).into_response(),
        None => (status, out_headers).into_response(),
    }
}

/// GET /mcp - Open SSE stream for server-to-client messages
///
/// Per MCP spec:
/// - Accept header must include text/event-stream
/// - Server can send notifications/requests
/// - Supports resumability via Last-Event-ID
async fn mcp_get(State(state): State<AppState>, headers: HeaderMap) -> axum::response::Response {
    // Validate Origin (security)
    if let Err(err) = validate_origin(&headers, &state.security) {
        return err.into_response();
    }

    // Validate authentication
    if let Err(err) = validate_auth(&headers, &state.auth) {
        return err.into_response();
    }

    // Get session ID
    let session_id = headers
        .get(&MCP_SESSION_ID)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
        .unwrap_or_else(|| "default".to_string());

    // Check for Last-Event-ID for resumability
    let _last_event_id = headers
        .get(&LAST_EVENT_ID)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    // Get or create the broadcast channel
    let (tx, session_state) = {
        let mut chans = state.sse_channels.lock().await;
        let tx = chans
            .entry(session_id.clone())
            .or_insert_with(|| broadcast::channel(256).0)
            .clone();

        let sessions = state.sessions.lock().await;
        let session_state = sessions.get(&session_id).cloned();
        (tx, session_state)
    };

    // Build the SSE stream
    let session_for_events = session_id.clone();

    // Initial event with retry field to prime reconnection
    let initial_event_id = session_state
        .as_ref()
        .map(|s| s.next_event_id(&session_for_events))
        .unwrap_or_else(|| format!("{}:0", session_for_events));

    let initial_events = iter(vec![Ok::<Event, Infallible>(
        Event::default()
            .id(initial_event_id)
            .retry(Duration::from_millis(SSE_RETRY_MS))
            .comment("connected"),
    )]);

    // Replay events if Last-Event-ID was provided
    // Note: For full resumability, we'd fetch events from session_state.get_events_after(_last_event_id).
    // This is left as a placeholder - in production, you'd spawn a task to fetch and replay events.
    let replay_events: Vec<StoredEvent> = vec![];

    let replay_stream = iter(replay_events.into_iter().map(|e: StoredEvent| {
        Ok::<Event, Infallible>(
            Event::default()
                .id(e.id)
                .event("message")
                .data(e.data.to_string()),
        )
    }));

    // Keepalive stream
    let keepalive = IntervalStream::new(tokio::time::interval(Duration::from_secs(
        SSE_KEEPALIVE_SECS,
    )))
    .map(|_| Ok::<Event, Infallible>(Event::default().comment("keepalive")));

    // Message stream from broadcast channel
    let session_for_stream = session_id.clone();
    let session_state_for_stream = session_state.clone();

    let stream = BroadcastStream::new(tx.subscribe()).filter_map(move |msg| {
        match msg {
            Ok(v) => {
                let event_id = session_state_for_stream
                    .as_ref()
                    .map(|s| s.next_event_id(&session_for_stream))
                    .unwrap_or_else(|| Uuid::new_v4().to_string());

                Some(Ok(Event::default()
                    .id(event_id)
                    .event("message")
                    .data(v.to_string())))
            }
            Err(_) => None, // Channel lagged, skip
        }
    });

    // Combine all streams
    Sse::new(
        initial_events
            .chain(replay_stream)
            .chain(keepalive.merge(stream)),
    )
    .keep_alive(axum::response::sse::KeepAlive::default())
    .into_response()
}

/// DELETE /mcp - Explicitly terminate a session
///
/// Per MCP spec:
/// - Client can explicitly terminate a session
/// - Server responds with 200 OK or 405 Method Not Allowed
async fn mcp_delete(State(state): State<AppState>, headers: HeaderMap) -> impl IntoResponse {
    // Validate Origin (security)
    if let Err(err) = validate_origin(&headers, &state.security) {
        return err.into_response();
    }

    // Validate authentication
    if let Err(err) = validate_auth(&headers, &state.auth) {
        return err.into_response();
    }

    let session_id = headers
        .get(&MCP_SESSION_ID)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    let Some(session_id) = session_id else {
        return (
            StatusCode::BAD_REQUEST,
            Json(jsonrpc_err_no_id(
                ErrorCode::InvalidRequest,
                "Missing MCP-Session-Id header",
            )),
        )
            .into_response();
    };

    // Remove session and its SSE channel
    let removed = {
        let mut sessions = state.sessions.lock().await;
        sessions.remove(&session_id).is_some()
    };

    {
        let mut channels = state.sse_channels.lock().await;
        channels.remove(&session_id);
    }

    if removed {
        info!("Session terminated: {}", session_id);
        StatusCode::OK.into_response()
    } else {
        (
            StatusCode::NOT_FOUND,
            Json(jsonrpc_err_no_id(
                ErrorCode::InvalidRequest,
                "Session not found",
            )),
        )
            .into_response()
    }
}

#[derive(Deserialize)]
struct LegacyQuery {
    #[serde(rename = "sessionId")]
    session_id: Option<String>,
}

async fn legacy_sse(State(state): State<AppState>, headers: HeaderMap) -> axum::response::Response {
    // Validate Origin (security)
    if let Err(err) = validate_origin(&headers, &state.security) {
        return err.into_response();
    }

    // Validate authentication
    if let Err(err) = validate_auth(&headers, &state.auth) {
        return err.into_response();
    }

    let session_id = Uuid::new_v4().to_string();
    let tx = {
        let mut chans = state.sse_channels.lock().await;
        chans
            .entry(session_id.clone())
            .or_insert_with(|| broadcast::channel(256).0)
            .clone()
    };

    // First event tells the client where to POST messages (legacy spec).
    let endpoint_event = iter(vec![Ok::<Event, Infallible>(
        Event::default()
            .event("endpoint")
            .data(format!("/messages?sessionId={session_id}")),
    )]);

    let stream = BroadcastStream::new(tx.subscribe()).filter_map(|msg| match msg {
        Ok(v) => Some(Ok(Event::default().event("message").data(v.to_string()))),
        Err(_) => None,
    });

    Sse::new(endpoint_event.chain(stream))
        .keep_alive(axum::response::sse::KeepAlive::default())
        .into_response()
}

async fn legacy_messages(
    State(state): State<AppState>,
    Query(q): Query<LegacyQuery>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> impl IntoResponse {
    // Validate Origin (security)
    if let Err(err) = validate_origin(&headers, &state.security) {
        return err.into_response();
    }

    // Validate authentication
    if let Err(err) = validate_auth(&headers, &state.auth) {
        return err.into_response();
    }

    let session = q.session_id.or_else(|| {
        headers
            .get(&MCP_SESSION_ID)
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string())
    });

    // Legacy transport: responses are delivered on SSE stream, not in HTTP response.
    let (_new_sess, maybe_resp, _status, _) =
        match handle_jsonrpc(&state, session.clone(), body).await {
            Ok(v) => v,
            Err((_sc, _v)) => return StatusCode::BAD_REQUEST.into_response(),
        };

    if let (Some(sess), Some(resp)) = (session, maybe_resp)
        && let Some(tx) = state.sse_channels.lock().await.get(&sess).cloned()
    {
        let _ = tx.send(resp);
    }

    StatusCode::ACCEPTED.into_response()
}

trait ResponseExt {
    fn to_value(self) -> Value;
}

impl ResponseExt for Response {
    fn to_value(self) -> Value {
        serde_json::to_value(self).unwrap_or_else(|_| json!({}))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_origin_validation_disabled() {
        let security = SecurityConfig {
            allowed_origins: None,
        };
        let headers = HeaderMap::new();
        assert!(validate_origin(&headers, &security).is_ok());
    }

    #[test]
    fn test_origin_validation_localhost_only() {
        let security = SecurityConfig {
            allowed_origins: Some(vec![]),
        };

        // No origin - should pass
        let headers = HeaderMap::new();
        assert!(validate_origin(&headers, &security).is_ok());

        // Localhost - should pass
        let mut headers = HeaderMap::new();
        headers.insert(&ORIGIN, HeaderValue::from_static("http://localhost:3000"));
        assert!(validate_origin(&headers, &security).is_ok());

        // 127.0.0.1 - should pass
        let mut headers = HeaderMap::new();
        headers.insert(&ORIGIN, HeaderValue::from_static("http://127.0.0.1:8080"));
        assert!(validate_origin(&headers, &security).is_ok());

        // External origin - should fail
        let mut headers = HeaderMap::new();
        headers.insert(&ORIGIN, HeaderValue::from_static("http://evil.com"));
        assert!(validate_origin(&headers, &security).is_err());
    }

    #[test]
    fn test_origin_validation_with_allowed_list() {
        let security = SecurityConfig {
            allowed_origins: Some(vec!["https://example.com".to_string()]),
        };

        // Allowed origin - should pass
        let mut headers = HeaderMap::new();
        headers.insert(&ORIGIN, HeaderValue::from_static("https://example.com"));
        assert!(validate_origin(&headers, &security).is_ok());

        // Localhost - should always pass
        let mut headers = HeaderMap::new();
        headers.insert(&ORIGIN, HeaderValue::from_static("http://localhost:3000"));
        assert!(validate_origin(&headers, &security).is_ok());

        // Other origin - should fail
        let mut headers = HeaderMap::new();
        headers.insert(&ORIGIN, HeaderValue::from_static("https://other.com"));
        assert!(validate_origin(&headers, &security).is_err());
    }

    #[test]
    fn test_protocol_version_validation() {
        // No header - should pass (backwards compatibility)
        let headers = HeaderMap::new();
        assert!(validate_protocol_version(&headers, None).is_ok());

        // Known version - should pass
        let mut headers = HeaderMap::new();
        headers.insert(
            &MCP_PROTOCOL_VERSION,
            HeaderValue::from_static("2025-03-26"),
        );
        assert!(validate_protocol_version(&headers, None).is_ok());

        // Current version - should pass
        let mut headers = HeaderMap::new();
        headers.insert(
            &MCP_PROTOCOL_VERSION,
            HeaderValue::from_static(CURRENT_PROTOCOL_VERSION),
        );
        assert!(validate_protocol_version(&headers, None).is_ok());
    }

    #[test]
    fn test_session_state_event_id() {
        let state = SessionState::new("2025-03-26".to_string());
        let id1 = state.next_event_id("session123");
        let id2 = state.next_event_id("session123");

        assert!(id1.starts_with("session123:"));
        assert!(id2.starts_with("session123:"));
        assert_ne!(id1, id2);
    }

    #[tokio::test]
    async fn test_session_state_event_buffer() {
        let state = SessionState::new("2025-03-26".to_string());

        // Store some events
        state
            .store_event(StoredEvent {
                id: "s:0".to_string(),
                data: json!({"msg": "first"}),
            })
            .await;
        state
            .store_event(StoredEvent {
                id: "s:1".to_string(),
                data: json!({"msg": "second"}),
            })
            .await;
        state
            .store_event(StoredEvent {
                id: "s:2".to_string(),
                data: json!({"msg": "third"}),
            })
            .await;

        // Get events after s:0
        let events = state.get_events_after("s:0").await;
        assert_eq!(events.len(), 2);
        assert_eq!(events[0].id, "s:1");
        assert_eq!(events[1].id, "s:2");

        // Get events after non-existent ID
        let events = state.get_events_after("s:999").await;
        assert!(events.is_empty());
    }
}
