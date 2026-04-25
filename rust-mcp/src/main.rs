use std::fs;
use std::io::ErrorKind;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::sync::Arc;

use clap::{Parser, ValueEnum};
use mcp_rust_sdk::transport::websocket::WebSocketTransport;
use tokio::net::TcpListener;
use tokio_tungstenite::accept_async;
use tracing::{error, info, warn};

use rust_mcp::config_manager::start_config_server;
use rust_mcp::mcp::McpOdooHandler;
use rust_mcp::mcp::cursor_stdio::CursorStdioTransport;
use rust_mcp::mcp::http as mcp_http;
use rust_mcp::mcp::registry::Registry;
use rust_mcp::mcp::runtime::ServerCompat;
use rust_mcp::mcp::tools::OdooClientPool;

/// Get config directory based on context:
/// - If running as root/systemd service: /etc/rust-mcp
/// - If running as regular user: ~/.config/odoo-rust-mcp
fn get_config_dir() -> Option<PathBuf> {
    // Check if running as root (systemd service context)
    #[cfg(unix)]
    {
        // Check effective UID - if 0, we're running as root
        // SAFETY: geteuid() is always safe to call
        if unsafe { libc::geteuid() } == 0 {
            // Running as root - use system config directory
            let system_config = PathBuf::from("/etc/rust-mcp");
            // If system config exists or we can create it, use it
            if system_config.exists() || std::fs::create_dir_all(&system_config).is_ok() {
                return Some(system_config);
            }
        }
    }

    // For regular users or Windows, use home directory
    dirs::home_dir().map(|p| p.join(".config").join("odoo-rust-mcp"))
}

/// Get share directory for default configs (platform-specific)
fn get_share_dir() -> Option<PathBuf> {
    // Check common locations for Homebrew/system-installed configs
    let candidates = [
        // Homebrew Apple Silicon
        PathBuf::from("/opt/homebrew/share/odoo-rust-mcp"),
        // Homebrew Intel Mac
        PathBuf::from("/usr/local/share/odoo-rust-mcp"),
        // Linux (APT, manual install)
        PathBuf::from("/usr/share/rust-mcp"),
        PathBuf::from("/usr/local/share/odoo-rust-mcp"),
        // System config directory (for systemd service)
        PathBuf::from("/etc/rust-mcp"),
    ];

    candidates.into_iter().find(|path| path.exists())
}

/// Set environment variable if not already set
/// SAFETY: Called early in main() before threads are spawned
fn set_default_env(key: &str, value: PathBuf) {
    if std::env::var(key).is_err() {
        // SAFETY: Called during single-threaded init
        unsafe {
            std::env::set_var(key, &value);
        }
        info!("Set default {}={:?}", key, value);
    }
}

/// Copy default config file to user config directory if it doesn't exist
fn copy_default_config_if_missing(config_dir: &std::path::Path, filename: &str) {
    let target = config_dir.join(filename);
    if target.exists() {
        return;
    }

    // Try to find the default config from various locations
    let sources = [
        // Current directory (for development)
        PathBuf::from("config").join(filename),
        PathBuf::from("rust-mcp/config").join(filename),
        // Config defaults bundled with binary
        PathBuf::from("config-defaults").join(filename),
    ];

    for source in &sources {
        if source.exists() {
            match fs::copy(source, &target) {
                Ok(_) => {
                    info!("Copied default {} to {:?}", filename, target);
                    return;
                }
                Err(e) => {
                    warn!("Failed to copy {} from {:?}: {}", filename, source, e);
                }
            }
        }
    }

    // If no source found, create minimal default
    let default_content = match filename {
        "tools.json" => include_str!("../config-defaults/tools.json"),
        "prompts.json" => include_str!("../config-defaults/prompts.json"),
        "server.json" => include_str!("../config-defaults/server.json"),
        _ => return,
    };

    match fs::write(&target, default_content) {
        Ok(_) => info!("Created default {} at {:?}", filename, target),
        Err(e) => warn!("Failed to create default {}: {}", filename, e),
    }
}

/// Default instances.json template for multi-instance configuration
const DEFAULT_INSTANCES_TEMPLATE: &str = r#"{
  "production": {
    "url": "http://localhost:8069",
    "db": "production",
    "apiKey": "YOUR_ODOO_19_API_KEY"
  },
  "staging": {
    "url": "http://localhost:8069",
    "db": "staging",
    "apiKey": "YOUR_STAGING_API_KEY"
  },
  "development": {
    "url": "http://localhost:8069",
    "db": "development",
    "version": "18",
    "username": "admin",
    "password": "admin"
  }
}
"#;

/// Generate default env file template with actual config directory path
fn generate_default_env_template(config_dir: &std::path::Path) -> String {
    let config_path = config_dir.to_string_lossy();
    format!(
        r#"# Odoo Rust MCP Server Configuration
# Multi-instance configuration (default)

# =============================================================================
# Multi-Instance Configuration (Default - Recommended)
# =============================================================================
# Uses instances.json for multiple Odoo instances
# The path below will be automatically set based on your config directory
# ODOO_INSTANCES_JSON is set automatically if instances.json exists

# =============================================================================
# Single Instance Configuration (Alternative - uncomment if not using multi-instance)
# =============================================================================
# # Odoo 19+ (API Key authentication)
# ODOO_URL=http://localhost:8069
# ODOO_DB=mydb
# ODOO_API_KEY=YOUR_API_KEY
#
# # Odoo < 19 (Username/Password authentication)
# # ODOO_VERSION=18
# # ODOO_USERNAME=admin
# # ODOO_PASSWORD=admin

# =============================================================================
# Config UI Authentication
# =============================================================================
# Login credentials for the web-based configuration interface.
# IMPORTANT: Change these default credentials immediately after first install!
CONFIG_UI_USERNAME=admin
CONFIG_UI_PASSWORD=changeme

# =============================================================================
# MCP HTTP Transport Authentication
# =============================================================================
# Enable/disable HTTP transport authentication (default: disabled)
# When enabled, clients must include "Authorization: Bearer <token>" header
MCP_AUTH_ENABLED=false
# MCP_AUTH_TOKEN=your-secure-random-token-here

# =============================================================================
# MCP Config Paths
# =============================================================================
# Path to MCP configuration files (tools, prompts, server settings)
# These are automatically set to your user config directory
MCP_TOOLS_JSON={config_path}/tools.json
MCP_PROMPTS_JSON={config_path}/prompts.json
MCP_SERVER_JSON={config_path}/server.json
"#
    )
}

fn has_explicit_odoo_instances_env() -> bool {
    std::env::var("ODOO_INSTANCES")
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false)
}

fn should_auto_set_instances_json(instances_file_exists: bool) -> bool {
    instances_file_exists && std::env::var("ODOO_INSTANCES_JSON").is_err()
}

/// Setup user config directory and load environment variables
fn setup_user_config() {
    let Some(config_dir) = get_config_dir() else {
        warn!("Could not determine user config directory");
        return;
    };

    // Create config directory if it doesn't exist
    if !config_dir.exists() {
        if let Err(e) = fs::create_dir_all(&config_dir) {
            warn!("Failed to create config directory {:?}: {}", config_dir, e);
        } else {
            info!("Created config directory: {:?}", config_dir);
        }
    }

    // Create default env file if it doesn't exist
    let env_file = config_dir.join("env");
    if !env_file.exists() {
        let template = generate_default_env_template(&config_dir);
        if let Err(e) = fs::write(&env_file, template) {
            warn!("Failed to create default env file {:?}: {}", env_file, e);
        } else {
            // Set restrictive permissions on env file (Unix only)
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let _ = fs::set_permissions(&env_file, fs::Permissions::from_mode(0o600));
            }
            info!("Created default env file: {:?}", env_file);
        }
    }

    // Load environment variables from env file FIRST
    // This is important so single-instance vars are loaded before migration check
    if env_file.exists() {
        load_env_file(&env_file);
    }

    // Check instances.json
    let instances_file = config_dir.join("instances.json");

    // Try to migrate single-instance config to multi-instance
    // This will create instances.json from ODOO_URL/DB/etc if they exist.
    // Skip this when multi-instance inline env is explicitly configured.
    if !instances_file.exists() && !has_explicit_odoo_instances_env() {
        migrate_single_to_multi_instance(&config_dir);
    }

    // Create default instances.json if still doesn't exist (fresh install).
    // Skip the template when ODOO_INSTANCES is explicitly configured so env-only
    // setups keep working and are not shadowed by an empty local file.
    if !instances_file.exists() && !has_explicit_odoo_instances_env() {
        if let Err(e) = fs::write(&instances_file, DEFAULT_INSTANCES_TEMPLATE) {
            warn!(
                "Failed to create default instances.json {:?}: {}",
                instances_file, e
            );
        } else {
            // Set restrictive permissions on instances file (Unix only)
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let _ = fs::set_permissions(&instances_file, fs::Permissions::from_mode(0o600));
            }
            info!("Created default instances.json: {:?}", instances_file);
            info!("Please edit it with your Odoo credentials");
        }
    }

    // Migrate env file: add new variables that were introduced in newer versions
    if env_file.exists() {
        migrate_env_file(&env_file);
    }

    // Prefer the file-backed instances.json whenever it exists, unless the caller
    // explicitly points the runtime somewhere else via ODOO_INSTANCES_JSON.
    // ODOO_INSTANCES is treated as a sync/bridge snapshot rather than the primary
    // editable source of truth for local runs.
    if should_auto_set_instances_json(instances_file.exists()) {
        // SAFETY: This is called early in main() before any threads are spawned,
        // and we're setting a new env var (not modifying an existing one being read).
        unsafe {
            std::env::set_var("ODOO_INSTANCES_JSON", &instances_file);
        }
        info!(
            "Using instances.json from user config: {:?}",
            instances_file
        );
    }

    // Set default MCP config paths if not already set
    // Priority: 1) Already set in env, 2) Homebrew/APT share dir, 3) User config dir
    if let Some(share_dir) = get_share_dir() {
        // Homebrew/APT installation - use share directory
        set_default_env("MCP_TOOLS_JSON", share_dir.join("tools.json"));
        set_default_env("MCP_PROMPTS_JSON", share_dir.join("prompts.json"));
        set_default_env("MCP_SERVER_JSON", share_dir.join("server.json"));
    } else {
        // Binary/source install - use user config directory
        set_default_env("MCP_TOOLS_JSON", config_dir.join("tools.json"));
        set_default_env("MCP_PROMPTS_JSON", config_dir.join("prompts.json"));
        set_default_env("MCP_SERVER_JSON", config_dir.join("server.json"));

        // Copy default config files to user directory if they don't exist
        copy_default_config_if_missing(&config_dir, "tools.json");
        copy_default_config_if_missing(&config_dir, "prompts.json");
        copy_default_config_if_missing(&config_dir, "server.json");
    }
}

/// Load environment variables from a file (simple key=value format)
fn load_env_file(path: &PathBuf) {
    let Ok(file) = fs::File::open(path) else {
        warn!("Could not open env file: {:?}", path);
        return;
    };

    info!("Loading environment from: {:?}", path);
    let reader = BufReader::new(file);
    for line in reader.lines() {
        let Ok(line) = line else { continue };
        let line = line.trim();

        // Skip empty lines and comments
        if line.is_empty() || line.starts_with('#') {
            continue;
        }

        // Parse key=value
        if let Some((key, value)) = line.split_once('=') {
            let key = key.trim();
            let value = value.trim();

            // Only set if not already set (env vars take precedence)
            if std::env::var(key).is_err() {
                // SAFETY: We're setting env vars at startup before any threads are spawned
                unsafe {
                    std::env::set_var(key, value);
                }
                // Mask sensitive values in logs
                let display_value =
                    if key.contains("PASSWORD") || key.contains("API_KEY") || key.contains("TOKEN")
                    {
                        "***"
                    } else {
                        value
                    };
                info!("  Set {}={}", key, display_value);
            }
        }
    }
}

/// Migrate env file: add new variables that were introduced in newer versions
fn migrate_env_file(path: &PathBuf) {
    let Ok(content) = fs::read_to_string(path) else {
        return;
    };

    let mut additions: Vec<String> = Vec::new();

    // Check for single-instance to multi-instance migration (added in v0.3.23)
    // If user has ODOO_URL but not ODOO_INSTANCES_JSON, suggest migration
    let has_single_instance = content.contains("ODOO_URL=") && !content.contains("# ODOO_URL=");
    let has_multi_instance = content.contains("ODOO_INSTANCES_JSON");

    if has_single_instance && !has_multi_instance {
        additions.push(
            r#"
# =============================================================================
# Multi-Instance Configuration (added in v0.3.23 - RECOMMENDED)
# =============================================================================
# Multi-instance mode is now the default. Your single-instance config above
# will continue to work, but we recommend migrating to multi-instance.
#
# To migrate:
# 1. Edit ~/.config/odoo-rust-mcp/instances.json with your Odoo instances
# 2. Uncomment the line below
# 3. Comment out or remove the single-instance ODOO_URL/DB/etc settings above
#
# ODOO_INSTANCES_JSON=~/.config/odoo-rust-mcp/instances.json
"#
            .to_string(),
        );
        info!("Migration: Adding multi-instance migration guide to env file");
    }

    // Check for CONFIG_UI_USERNAME/PASSWORD (added in v0.3.24)
    if !content.contains("CONFIG_UI_USERNAME") {
        additions.push(
            r#"
# =============================================================================
# Config UI Authentication (added in v0.3.24)
# =============================================================================
# Login credentials for the web-based configuration interface.
# IMPORTANT: Change these default credentials immediately!
CONFIG_UI_USERNAME=admin
CONFIG_UI_PASSWORD=changeme
"#
            .to_string(),
        );
        info!("Migration: Adding CONFIG_UI_USERNAME/PASSWORD to env file");
    }

    // Check for MCP_AUTH_ENABLED (added in v0.3.24)
    if !content.contains("MCP_AUTH_ENABLED") {
        additions.push(
            r#"
# =============================================================================
# MCP HTTP Transport Authentication (added in v0.3.24)
# =============================================================================
# Enable/disable HTTP transport authentication
MCP_AUTH_ENABLED=false
"#
            .to_string(),
        );
        info!("Migration: Adding MCP_AUTH_ENABLED to env file");
    }

    // Check for MCP config paths (added in v0.3.27)
    // These allow using user config directory for tools/prompts/server configs
    if !content.contains("MCP_TOOLS_JSON") {
        // Get user config directory for the template
        let config_dir = get_config_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| "~/.config/odoo-rust-mcp".to_string());

        additions.push(format!(
            r#"
# =============================================================================
# MCP Config Paths (added in v0.3.27)
# =============================================================================
# Path to MCP configuration files. By default, these use the user config
# directory. For Homebrew/APT installs, these may also point to the share
# directory. Set these to customize where config files are loaded from.
MCP_TOOLS_JSON={config_dir}/tools.json
MCP_PROMPTS_JSON={config_dir}/prompts.json
MCP_SERVER_JSON={config_dir}/server.json
"#
        ));
        info!("Migration: Adding MCP_*_JSON paths to env file");
    }

    if !additions.is_empty() {
        let mut new_content = content;
        for addition in additions {
            new_content.push_str(&addition);
        }

        if let Err(e) = fs::write(path, new_content) {
            warn!("Failed to migrate env file {:?}: {}", path, e);
        } else {
            info!("Successfully migrated env file with new variables");
        }
    }
}

/// Create instances.json from single-instance env vars if it doesn't exist
/// This helps users who upgrade from single-instance to multi-instance
fn migrate_single_to_multi_instance(config_dir: &std::path::Path) {
    let instances_file = config_dir.join("instances.json");

    // Only migrate if instances.json doesn't exist and we have single-instance config
    if instances_file.exists() {
        return;
    }

    // Check if we have single-instance env vars set
    let odoo_url = std::env::var("ODOO_URL").ok();
    let odoo_db = std::env::var("ODOO_DB").ok();

    let Some(url) = odoo_url else {
        return;
    };

    let Some(db) = odoo_db else {
        return;
    };

    // Build instance config from env vars
    let api_key = std::env::var("ODOO_API_KEY").ok();
    let username = std::env::var("ODOO_USERNAME").ok();
    let password = std::env::var("ODOO_PASSWORD").ok();
    let version = std::env::var("ODOO_VERSION").ok();

    let mut instance = serde_json::json!({
        "url": url,
        "db": db
    });

    if let Some(key) = api_key {
        instance["apiKey"] = serde_json::json!(key);
    }
    if let Some(user) = username {
        instance["username"] = serde_json::json!(user);
    }
    if let Some(pass) = password {
        instance["password"] = serde_json::json!(pass);
    }
    if let Some(ver) = version {
        instance["version"] = serde_json::json!(ver);
    }

    let instances = serde_json::json!({
        "default": instance
    });

    // Write instances.json
    match serde_json::to_string_pretty(&instances) {
        Ok(json_str) => {
            if let Err(e) = fs::write(&instances_file, json_str) {
                warn!(
                    "Failed to create instances.json from single-instance config: {}",
                    e
                );
            } else {
                // Set restrictive permissions (Unix only)
                #[cfg(unix)]
                {
                    use std::os::unix::fs::PermissionsExt;
                    let _ = fs::set_permissions(&instances_file, fs::Permissions::from_mode(0o600));
                }
                info!(
                    "Migrated single-instance config to instances.json: {:?}",
                    instances_file
                );
                info!("Instance 'default' created with your existing Odoo configuration");
            }
        }
        Err(e) => {
            warn!("Failed to serialize instances.json: {}", e);
        }
    }
}

/// Direction 2 sync: if ODOO_INSTANCES env var contains instances that are not
/// yet in instances.json, add them so they appear in the Config UI.
/// This runs once at startup and only adds — never overwrites existing entries.
fn sync_env_instances_to_file() {
    // Only relevant when ODOO_INSTANCES (inline JSON) is set
    let Ok(raw) = std::env::var("ODOO_INSTANCES") else {
        return;
    };
    let raw = raw.trim();
    if raw.is_empty() || !(raw.starts_with('{') || raw.starts_with('[')) {
        return;
    }

    // Only merge if we know where instances.json lives
    let Ok(instances_path) = std::env::var("ODOO_INSTANCES_JSON") else {
        return;
    };
    let instances_path = instances_path.trim();
    if instances_path.is_empty() {
        return;
    }

    let env_instances: std::collections::HashMap<String, serde_json::Value> =
        match serde_json::from_str(raw) {
            Ok(v) => v,
            Err(e) => {
                warn!("sync_env_instances_to_file: failed to parse ODOO_INSTANCES: {e}");
                return;
            }
        };

    let mut file_instances: std::collections::HashMap<String, serde_json::Value> =
        fs::read_to_string(instances_path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default();

    let mut added = 0usize;
    for (name, config) in env_instances {
        if let std::collections::hash_map::Entry::Vacant(entry) = file_instances.entry(name) {
            entry.insert(config);
            added += 1;
        }
    }

    if added > 0 {
        match serde_json::to_string_pretty(&file_instances) {
            Ok(json_str) => {
                if let Err(e) = fs::write(instances_path, json_str) {
                    warn!("sync_env_instances_to_file: failed to write instances.json: {e}");
                } else {
                    info!(
                        "Synced {added} instance(s) from ODOO_INSTANCES env var into instances.json"
                    );
                }
            }
            Err(e) => warn!("sync_env_instances_to_file: failed to serialize: {e}"),
        }
    }
}

fn is_addr_in_use_error(err: &anyhow::Error) -> bool {
    err.chain().any(|cause| {
        cause
            .downcast_ref::<std::io::Error>()
            .is_some_and(|io_err| io_err.kind() == ErrorKind::AddrInUse)
    })
}

#[derive(Debug, Clone, ValueEnum)]
enum TransportMode {
    Stdio,
    Ws,
    Http,
}

#[derive(Debug, Parser)]
#[command(name = "odoo-mcp-rust", version, about = "Odoo MCP server (Rust)")]
struct Cli {
    #[command(subcommand)]
    command: Option<Command>,

    /// Transport mode (stdio for Claude Desktop, ws for standalone server)
    #[arg(long, value_enum, default_value_t = TransportMode::Stdio)]
    transport: TransportMode,

    /// Listen address for ws mode, e.g. 0.0.0.0:8787
    #[arg(long, default_value = "127.0.0.1:8787")]
    listen: String,

    /// Enable destructive cleanup tools (off by default)
    #[arg(long, env = "ODOO_ENABLE_CLEANUP_TOOLS", default_value_t = false)]
    enable_cleanup_tools: bool,

    /// Enable config server on separate port (default: 3008, inspired by Peugeot 3008)
    #[arg(long, env = "ODOO_CONFIG_SERVER_PORT", default_value = "3008")]
    config_server_port: u16,

    /// Config directory for config server (defaults to ~/.config/odoo-rust-mcp/)
    #[arg(long, env = "ODOO_CONFIG_DIR")]
    config_dir: Option<PathBuf>,
}

#[derive(Debug, Parser)]
enum Command {
    /// Validate Odoo instance configuration without starting the server
    #[command(about = "Validate Odoo configuration")]
    ValidateConfig {
        /// Optional path to env file (defaults to ~/.config/odoo-rust-mcp/env)
        #[arg(long)]
        env_file: Option<PathBuf>,
    },
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Parse CLI first to determine transport mode
    let cli = Cli::parse();

    // Initialize tracing - for stdio mode, we must use stderr only
    // because stdout is reserved for JSON-RPC messages
    match cli.transport {
        TransportMode::Stdio => {
            // Stdio mode: log to stderr only, no ANSI colors to avoid issues
            tracing_subscriber::fmt()
                .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
                .with_writer(std::io::stderr)
                .with_ansi(false)
                .init();
        }
        _ => {
            // HTTP/WS modes: normal logging to stdout with colors
            tracing_subscriber::fmt()
                .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
                .init();
        }
    }

    // Auto-load user config from ~/.config/odoo-rust-mcp/
    setup_user_config();

    // Direction 2: If ODOO_INSTANCES env var has instances not yet in instances.json,
    // merge them in so they are visible and editable via the Config UI.
    sync_env_instances_to_file();

    // Handle subcommands first
    if let Some(command) = cli.command {
        match command {
            Command::ValidateConfig { env_file } => {
                return validate_config(env_file).await;
            }
        }
    }

    // Otherwise, start the server
    let pool = OdooClientPool::from_env()?;
    let registry = Arc::new(Registry::from_env());
    registry.initial_load().await?;
    registry.start_watchers();

    // Clone pool for the config server before moving it into the handler
    let pool_for_config_server = pool.clone();

    // Cleanup tool gating is handled via tool guards (e.g. requiresEnvTrue=ODOO_ENABLE_CLEANUP_TOOLS).
    // We keep the CLI flag for compatibility, but it only affects the env var via clap env binding.
    let handler = Arc::new(McpOdooHandler::new(pool, registry));

    // Create shared HTTP auth config (supports hot-reload)
    let http_auth_config = mcp_http::AuthConfig::from_env();

    // Start config server (default port: 3008, inspired by Peugeot 3008)
    let config_dir = cli.config_dir.clone().unwrap_or_else(|| {
        get_config_dir().unwrap_or_else(|| std::path::PathBuf::from("~/.config/odoo-rust-mcp"))
    });

    // Clone auth config for config server to trigger reloads
    let auth_config_for_config_server = http_auth_config.clone();
    let config_server_port = cli.config_server_port;
    tokio::spawn(async move {
        if let Err(e) = start_config_server(
            config_server_port,
            config_dir,
            Some(auth_config_for_config_server),
            Some(pool_for_config_server),
        )
        .await
        {
            if is_addr_in_use_error(&e) {
                warn!(
                    "Config server port {} is already in use; reusing existing Config UI instance",
                    config_server_port
                );
            } else {
                error!("Config server error: {}", e);
            }
        }
    });

    info!(
        "Config server will start on port {} (inspired by Peugeot 3008)",
        cli.config_server_port
    );

    match cli.transport {
        TransportMode::Stdio => run_stdio(handler).await?,
        TransportMode::Ws => run_ws(handler, &cli.listen).await?,
        TransportMode::Http => run_http_with_auth(handler, &cli.listen, http_auth_config).await?,
    }

    Ok(())
}

async fn validate_config(_env_file: Option<PathBuf>) -> anyhow::Result<()> {
    // The environment is already loaded by setup_user_config()
    // The --env-file option is for future extensibility

    // Load Odoo environment configuration
    let env = rust_mcp::odoo::config::load_odoo_env()?;
    let instances: Vec<String> = env.instances.keys().cloned().collect();

    if instances.is_empty() {
        eprintln!("No Odoo instances configured");
        return Err(anyhow::anyhow!("No instances found in configuration"));
    }

    println!("Validating {} Odoo instance(s)...\n", instances.len());

    let mut all_ok = true;

    for instance_name in &instances {
        let instance_cfg = &env.instances[instance_name];
        print!("• {} ({}): ", instance_name, instance_cfg.url);

        match rust_mcp::odoo::unified_client::OdooClient::new(instance_cfg) {
            Ok(client) => {
                match tokio::time::timeout(
                    std::time::Duration::from_secs(10),
                    client.health_check(),
                )
                .await
                {
                    Ok(true) => {
                        println!("✓ OK");
                    }
                    Ok(false) => {
                        println!("✗ FAIL - health check failed");
                        all_ok = false;
                    }
                    Err(_) => {
                        println!("✗ FAIL - timeout");
                        all_ok = false;
                    }
                }
            }
            Err(e) => {
                println!("✗ FAIL - {}", e);
                all_ok = false;
            }
        }
    }

    println!();
    if all_ok {
        println!("✓ All instances validated successfully!");
        Ok(())
    } else {
        eprintln!("✗ One or more instances failed validation");
        Err(anyhow::anyhow!("Validation failed"))
    }
}

async fn run_stdio(handler: Arc<McpOdooHandler>) -> anyhow::Result<()> {
    let (transport, _sender) = CursorStdioTransport::new();
    let server = ServerCompat::new(Arc::new(transport), handler);

    info!("MCP server starting (stdio)");
    server
        .start()
        .await
        .map_err(|e| anyhow::anyhow!(e.to_string()))
}

async fn run_ws(handler: Arc<McpOdooHandler>, listen: &str) -> anyhow::Result<()> {
    let listener = TcpListener::bind(listen).await?;
    info!("MCP server listening (ws) on {}", listen);

    loop {
        let (stream, addr) = listener.accept().await?;
        let handler = handler.clone();
        tokio::spawn(async move {
            match accept_async(stream).await {
                Ok(ws_stream) => {
                    let transport = WebSocketTransport::from_stream(ws_stream);
                    let server = ServerCompat::new(Arc::new(transport), handler);
                    info!("Accepted ws connection from {}", addr);
                    if let Err(e) = server.start().await {
                        error!("ws server error: {}", e);
                    }
                }
                Err(e) => error!("ws accept error: {}", e),
            }
        });
    }
}

async fn run_http_with_auth(
    handler: Arc<McpOdooHandler>,
    listen: &str,
    auth: mcp_http::AuthConfig,
) -> anyhow::Result<()> {
    info!("MCP server listening (http) on {}", listen);
    mcp_http::serve_with_auth(handler, listen, auth).await
}

#[cfg(test)]
mod tests {
    use super::should_auto_set_instances_json;

    struct EnvGuard {
        key: &'static str,
        original: Option<String>,
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

    #[test]
    fn auto_sets_instances_json_when_no_env_source_is_present() {
        let _instances_json = EnvGuard::set("ODOO_INSTANCES_JSON", None);
        let _instances = EnvGuard::set("ODOO_INSTANCES", None);

        assert!(should_auto_set_instances_json(true));
    }

    #[test]
    fn still_auto_sets_instances_json_when_instances_env_is_present() {
        let _instances_json = EnvGuard::set("ODOO_INSTANCES_JSON", None);
        let _instances = EnvGuard::set(
            "ODOO_INSTANCES",
            Some(r#"{"prod":{"url":"http://localhost:8069"}}"#),
        );

        assert!(should_auto_set_instances_json(true));
    }

    #[test]
    fn skips_auto_setting_instances_json_when_path_is_already_set() {
        let _instances_json = EnvGuard::set("ODOO_INSTANCES_JSON", Some("/tmp/instances.json"));
        let _instances = EnvGuard::set("ODOO_INSTANCES", None);

        assert!(!should_auto_set_instances_json(true));
    }
}
