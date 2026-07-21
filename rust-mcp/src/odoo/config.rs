use std::collections::HashMap;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use serde_json::Value;

fn is_false(value: &bool) -> bool {
    !value
}

/// Authentication mode for Odoo instances.
/// - `ApiKey`: Odoo 19+ JSON-2 API with bearer token
/// - `Password`: Odoo < 19 JSON-RPC with username/password
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub enum OdooAuthMode {
    #[default]
    ApiKey,
    Password,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct InstanceToolConfig {
    #[serde(
        default,
        rename = "disabledTools",
        skip_serializing_if = "Vec::is_empty"
    )]
    pub disabled_tools: Vec<String>,
    #[serde(
        default,
        rename = "disabledPacks",
        skip_serializing_if = "Vec::is_empty"
    )]
    pub disabled_packs: Vec<String>,
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub defaults: HashMap<String, Value>,
    #[serde(
        default,
        rename = "executeAllowlist",
        skip_serializing_if = "Vec::is_empty"
    )]
    pub execute_allowlist: Vec<ExecuteAllowlistEntry>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct ExecuteAllowlistEntry {
    pub model: String,
    #[serde(default)]
    pub methods: Vec<String>,
}

impl InstanceToolConfig {
    pub fn is_tool_disabled(&self, tool_name: &str) -> bool {
        self.disabled_tools.iter().any(|name| name == tool_name)
    }

    pub fn tool_defaults(&self, tool_name: &str) -> Option<&Value> {
        self.defaults.get(tool_name)
    }

    pub fn is_empty(&self) -> bool {
        self.disabled_tools.is_empty()
            && self.disabled_packs.is_empty()
            && self.defaults.is_empty()
            && self.execute_allowlist.is_empty()
    }
}

/// Protocol to use for Odoo communication.
#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum OdooProtocol {
    #[default]
    Auto,
    /// Force JSON-RPC (Legacy client)
    JsonRpc,
    /// Force JSON-2 (Modern client)
    #[serde(rename = "json2")]
    Json2,
}

impl OdooProtocol {
    fn is_auto(&self) -> bool {
        matches!(self, Self::Auto)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OdooInstanceConfig {
    pub url: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub db: Option<String>,
    #[serde(default, rename = "apiKey", skip_serializing_if = "Option::is_none")]
    pub api_key: Option<String>,
    /// Username for Odoo < 19 (JSON-RPC authentication)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub username: Option<String>,
    /// Password for Odoo < 19 (JSON-RPC authentication)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub password: Option<String>,
    /// Odoo version (e.g., "18", "17", "19"). If < 19, uses JSON-RPC with username/password.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    /// Explicitly select protocol: "auto", "jsonrpc", or "json2"
    #[serde(default, skip_serializing_if = "OdooProtocol::is_auto")]
    pub protocol: OdooProtocol,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub timeout_ms: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_retries: Option<usize>,
    #[serde(
        default,
        rename = "toolConfig",
        skip_serializing_if = "Option::is_none"
    )]
    pub tool_config: Option<InstanceToolConfig>,
    /// Deny mutating, cleanup, and arbitrary execute tools for this instance.
    #[serde(default, rename = "readOnly", skip_serializing_if = "is_false")]
    pub read_only: bool,
    /// Manual labels used by Config UI search and grouping.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tags: Vec<String>,
    /// Deprecated legacy input field. Still accepted so older configs remain readable,
    /// but it is ignored at runtime and omitted from any normalized output.
    #[serde(default, skip_serializing)]
    pub aliases: Vec<String>,

    // Allow extra fields in ODOO_INSTANCES JSON.
    #[serde(flatten, default, skip_serializing_if = "HashMap::is_empty")]
    pub extra: HashMap<String, Value>,
}

impl OdooInstanceConfig {
    /// Determine authentication mode based on version or available credentials.
    pub fn auth_mode(&self) -> OdooAuthMode {
        // Respect explicit protocol override
        match self.protocol {
            OdooProtocol::JsonRpc => return OdooAuthMode::Password,
            OdooProtocol::Json2 => return OdooAuthMode::ApiKey,
            OdooProtocol::Auto => {}
        }

        // If version is explicitly set and < 19, use password mode
        if let Some(v) = &self.version
            && let Ok(major) = v.split('.').next().unwrap_or(v).parse::<u32>()
            && major < 19
        {
            return OdooAuthMode::Password;
        }
        // If no API key but has username/password, use password mode
        if self
            .api_key
            .as_ref()
            .map(|s| s.trim().is_empty())
            .unwrap_or(true)
            && self.username.is_some()
            && self.password.is_some()
        {
            return OdooAuthMode::Password;
        }
        OdooAuthMode::ApiKey
    }

    pub fn username_looks_like_url(&self) -> bool {
        let Some(username) = self.username.as_deref() else {
            return false;
        };

        let username = username.trim();
        if username.is_empty() {
            return false;
        }

        if username.eq_ignore_ascii_case(self.url.trim()) {
            return true;
        }

        username.starts_with("http://") || username.starts_with("https://")
    }
}

#[derive(Debug, Clone)]
pub struct OdooEnvConfig {
    pub instances: HashMap<String, OdooInstanceConfig>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RuntimeInstancesSourceKind {
    InstancesJson,
    InlineEnv,
    SingleInstance,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RuntimeInstancesSource {
    pub kind: RuntimeInstancesSourceKind,
    pub path: Option<PathBuf>,
}

impl RuntimeInstancesSourceKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            RuntimeInstancesSourceKind::InstancesJson => "instances_json",
            RuntimeInstancesSourceKind::InlineEnv => "inline_env",
            RuntimeInstancesSourceKind::SingleInstance => "single_instance",
        }
    }
}

pub fn default_instances_json_path() -> Option<PathBuf> {
    #[cfg(unix)]
    {
        // Match the startup behavior for system-wide installs running as root.
        if unsafe { libc::geteuid() } == 0 {
            return Some(PathBuf::from("/etc/odoo-rust-mcp/instances.json"));
        }
    }

    dirs::home_dir().map(|p| {
        p.join(".config")
            .join("odoo-rust-mcp")
            .join("instances.json")
    })
}

pub fn detect_runtime_instances_source() -> RuntimeInstancesSource {
    if let Ok(path) = std::env::var("ODOO_INSTANCES_JSON") {
        let path = path.trim();
        if !path.is_empty() {
            return RuntimeInstancesSource {
                kind: RuntimeInstancesSourceKind::InstancesJson,
                path: Some(PathBuf::from(path)),
            };
        }
    }

    if let Some(default_path) = default_instances_json_path()
        && default_path.exists()
    {
        return RuntimeInstancesSource {
            kind: RuntimeInstancesSourceKind::InstancesJson,
            path: Some(default_path),
        };
    }

    if let Ok(raw) = std::env::var("ODOO_INSTANCES")
        && !raw.trim().is_empty()
    {
        return RuntimeInstancesSource {
            kind: RuntimeInstancesSourceKind::InlineEnv,
            path: None,
        };
    }

    RuntimeInstancesSource {
        kind: RuntimeInstancesSourceKind::SingleInstance,
        path: None,
    }
}

pub fn load_odoo_env() -> anyhow::Result<OdooEnvConfig> {
    let mut instances = HashMap::new();
    let mut instances_json_path: Option<String> = None;

    let runtime_source = detect_runtime_instances_source();
    if let Some(path) = runtime_source.path.as_ref() {
        instances_json_path = Some(path.display().to_string());
    }

    match runtime_source.kind {
        RuntimeInstancesSourceKind::InstancesJson => {
            let path = runtime_source
                .path
                .expect("instances_json source must have a path");
            let path_str = path.display().to_string();
            match std::fs::read_to_string(&path) {
                Ok(content) => {
                    let parsed: HashMap<String, OdooInstanceConfig> =
                        serde_json::from_str(&content).map_err(|e| {
                            anyhow::anyhow!(
                                "Failed to parse ODOO_INSTANCES_JSON file '{path_str}': {e}"
                            )
                        })?;
                    instances.extend(parsed);
                }
                Err(e) => {
                    tracing::warn!(
                        "ODOO instances file '{}' not found or not readable: {}. \
                        Falling back to ODOO_INSTANCES or single-instance env vars.",
                        path_str,
                        e
                    );
                }
            }
        }
        RuntimeInstancesSourceKind::InlineEnv => {
            if let Ok(raw) = std::env::var("ODOO_INSTANCES")
                && !raw.trim().is_empty()
            {
                let raw = raw.trim();
                if raw.starts_with('{') || raw.starts_with('[') {
                    let parsed: HashMap<String, OdooInstanceConfig> = serde_json::from_str(raw)
                        .map_err(|e| anyhow::anyhow!("Failed to parse ODOO_INSTANCES JSON: {e}"))?;
                    instances.extend(parsed);
                } else if let Ok(content) = std::fs::read_to_string(raw) {
                    let parsed: HashMap<String, OdooInstanceConfig> =
                        serde_json::from_str(&content).map_err(|e| {
                            anyhow::anyhow!("Failed to parse ODOO_INSTANCES file '{raw}': {e}")
                        })?;
                    instances.extend(parsed);
                } else {
                    anyhow::bail!(
                        "ODOO_INSTANCES value '{raw}' is not valid JSON and is not a readable file path"
                    );
                }
            }
        }
        RuntimeInstancesSourceKind::SingleInstance => {}
    }

    // Fallback to single-instance env vars.
    if instances.is_empty() {
        let url = std::env::var("ODOO_URL").ok();
        let db = std::env::var("ODOO_DB").ok();
        let api_key = std::env::var("ODOO_API_KEY").ok();
        let username = std::env::var("ODOO_USERNAME").ok();
        let password = std::env::var("ODOO_PASSWORD").ok();
        let version = std::env::var("ODOO_VERSION").ok();

        // Accept if we have URL + (api_key OR (username + password))
        let has_api_key = api_key
            .as_ref()
            .map(|s| !s.trim().is_empty())
            .unwrap_or(false);
        let has_password_auth = username
            .as_ref()
            .map(|s| !s.trim().is_empty())
            .unwrap_or(false)
            && password
                .as_ref()
                .map(|s| !s.trim().is_empty())
                .unwrap_or(false);

        if let Some(url) = url
            && (has_api_key || has_password_auth)
        {
            let url = normalize_url(&url);
            instances.insert(
                "default".to_string(),
                OdooInstanceConfig {
                    url,
                    db,
                    api_key,
                    username,
                    password,
                    version,
                    protocol: OdooProtocol::default(),
                    timeout_ms: std::env::var("ODOO_TIMEOUT_MS")
                        .ok()
                        .and_then(|v| v.parse().ok()),
                    max_retries: std::env::var("ODOO_MAX_RETRIES")
                        .ok()
                        .and_then(|v| v.parse().ok()),
                    tool_config: None,
                    read_only: false,
                    tags: Vec::new(),
                    aliases: Vec::new(),
                    extra: HashMap::new(),
                },
            );
        }
    }

    if instances.is_empty() {
        let mut msg = String::from("No Odoo instances configured.\n\n");
        if let Some(path) = instances_json_path {
            msg.push_str(&format!(
                "ODOO_INSTANCES_JSON was set to '{}' but the file was not found or is empty.\n",
                path
            ));
            msg.push_str("Please create the file with your Odoo instance configuration.\n\n");
        }
        msg.push_str("Configuration options:\n");
        msg.push_str("  1. Multi-instance (recommended): Create instances.json file and set ODOO_INSTANCES_JSON\n");
        msg.push_str("  2. Single-instance: Set ODOO_URL + credentials (ODOO_API_KEY or ODOO_USERNAME/PASSWORD)\n\n");
        msg.push_str("For Odoo 19+: Use apiKey in instances.json or ODOO_API_KEY env var\n");
        msg.push_str("For Odoo < 19: Use version + username + password in instances.json or ODOO_VERSION + ODOO_USERNAME + ODOO_PASSWORD env vars");
        anyhow::bail!(msg);
    }

    // Ensure credentials are available per instance.
    let global_api_key = std::env::var("ODOO_API_KEY").ok();
    let global_username = std::env::var("ODOO_USERNAME").ok();
    let global_password = std::env::var("ODOO_PASSWORD").ok();
    let global_version = std::env::var("ODOO_VERSION").ok();

    for (name, cfg) in instances.iter_mut() {
        cfg.url = normalize_url(&cfg.url);

        // Apply global version if not set
        if cfg.version.is_none() {
            cfg.version = global_version.clone();
        }

        let mode = cfg.auth_mode();
        match mode {
            OdooAuthMode::ApiKey => {
                // Ensure API key is available
                if cfg
                    .api_key
                    .as_ref()
                    .map(|s| s.trim().is_empty())
                    .unwrap_or(true)
                {
                    if let Some(k) = &global_api_key {
                        cfg.api_key = Some(k.clone());
                    } else {
                        anyhow::bail!(
                            "Missing apiKey for instance '{name}'. Provide it in ODOO_INSTANCES or set ODOO_API_KEY."
                        );
                    }
                }
            }
            OdooAuthMode::Password => {
                // Ensure username/password are available
                if cfg
                    .username
                    .as_ref()
                    .map(|s| s.trim().is_empty())
                    .unwrap_or(true)
                {
                    if let Some(u) = &global_username {
                        cfg.username = Some(u.clone());
                    } else {
                        anyhow::bail!(
                            "Missing username for instance '{name}'. Provide it in ODOO_INSTANCES or set ODOO_USERNAME."
                        );
                    }
                }
                if cfg
                    .password
                    .as_ref()
                    .map(|s| s.trim().is_empty())
                    .unwrap_or(true)
                {
                    if let Some(p) = &global_password {
                        cfg.password = Some(p.clone());
                    } else {
                        anyhow::bail!(
                            "Missing password for instance '{name}'. Provide it in ODOO_INSTANCES or set ODOO_PASSWORD."
                        );
                    }
                }
                // For password mode, db is required
                if cfg.db.as_ref().map(|s| s.trim().is_empty()).unwrap_or(true) {
                    anyhow::bail!(
                        "Missing db for instance '{name}'. Database is required for Odoo < 19 (password auth)."
                    );
                }
            }
        }
    }

    Ok(OdooEnvConfig { instances })
}

fn normalize_url(raw: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.contains("://") {
        trimmed.to_string()
    } else {
        format!("http://{trimmed}")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::TEST_ENV_MUTEX;
    use tempfile::TempDir;

    struct EnvGuard {
        key: &'static str,
        original: Option<String>,
    }

    impl EnvGuard {
        fn set(key: &'static str, value: Option<&str>) -> Self {
            let original = std::env::var(key).ok();
            match value {
                Some(value) => unsafe { std::env::set_var(key, value) },
                None => unsafe { std::env::remove_var(key) },
            }

            Self { key, original }
        }
    }

    impl Drop for EnvGuard {
        fn drop(&mut self) {
            match &self.original {
                Some(value) => unsafe { std::env::set_var(self.key, value) },
                None => unsafe { std::env::remove_var(self.key) },
            }
        }
    }

    #[test]
    fn test_normalize_url_with_scheme() {
        assert_eq!(normalize_url("https://example.com"), "https://example.com");
        assert_eq!(
            normalize_url("http://localhost:8069"),
            "http://localhost:8069"
        );
    }

    #[test]
    fn test_normalize_url_without_scheme() {
        assert_eq!(normalize_url("localhost:8069"), "http://localhost:8069");
        assert_eq!(normalize_url("example.com"), "http://example.com");
    }

    #[test]
    fn test_normalize_url_with_whitespace() {
        assert_eq!(normalize_url("  localhost:8069  "), "http://localhost:8069");
    }

    #[test]
    fn test_auth_mode_api_key_default() {
        let config = OdooInstanceConfig {
            url: "http://localhost".to_string(),
            db: None,
            api_key: Some("test-key".to_string()),
            username: None,
            password: None,
            version: None,
            protocol: Default::default(),
            timeout_ms: None,
            max_retries: None,
            tool_config: None,
            read_only: false,
            tags: Vec::new(),
            aliases: Vec::new(),
            extra: HashMap::new(),
        };
        assert_eq!(config.auth_mode(), OdooAuthMode::ApiKey);
    }

    #[test]
    fn test_auth_mode_password_by_version() {
        let config = OdooInstanceConfig {
            url: "http://localhost".to_string(),
            db: Some("mydb".to_string()),
            api_key: None,
            username: Some("admin".to_string()),
            password: Some("admin".to_string()),
            version: Some("18".to_string()),
            protocol: Default::default(),
            timeout_ms: None,
            max_retries: None,
            tool_config: None,
            read_only: false,
            tags: Vec::new(),
            aliases: Vec::new(),
            extra: HashMap::new(),
        };
        assert_eq!(config.auth_mode(), OdooAuthMode::Password);
    }

    #[test]
    fn test_auth_mode_password_by_credentials() {
        let config = OdooInstanceConfig {
            url: "http://localhost".to_string(),
            db: Some("mydb".to_string()),
            api_key: None,
            username: Some("admin".to_string()),
            password: Some("admin".to_string()),
            version: None,
            protocol: Default::default(),
            timeout_ms: None,
            max_retries: None,
            tool_config: None,
            read_only: false,
            tags: Vec::new(),
            aliases: Vec::new(),
            extra: HashMap::new(),
        };
        assert_eq!(config.auth_mode(), OdooAuthMode::Password);
    }

    #[test]
    fn test_auth_mode_api_key_version_19() {
        let config = OdooInstanceConfig {
            url: "http://localhost".to_string(),
            db: None,
            api_key: Some("test-key".to_string()),
            username: None,
            password: None,
            version: Some("19".to_string()),
            protocol: Default::default(),
            timeout_ms: None,
            max_retries: None,
            tool_config: None,
            read_only: false,
            tags: Vec::new(),
            aliases: Vec::new(),
            extra: HashMap::new(),
        };
        assert_eq!(config.auth_mode(), OdooAuthMode::ApiKey);
    }

    #[test]
    fn test_instance_config_deserialize() {
        let json = r#"{
            "url": "http://localhost:8069",
            "db": "mydb",
            "apiKey": "test-key",
            "tags": ["prod", "KDKMP"],
            "timeout_ms": 30000,
            "extraField": "ignored"
        }"#;
        let config: OdooInstanceConfig = serde_json::from_str(json).unwrap();
        assert_eq!(config.url, "http://localhost:8069");
        assert_eq!(config.db, Some("mydb".to_string()));
        assert_eq!(config.api_key, Some("test-key".to_string()));
        assert_eq!(config.tags, vec!["prod".to_string(), "KDKMP".to_string()]);
        assert_eq!(config.timeout_ms, Some(30000));
        assert!(config.tool_config.is_none());
        assert!(config.aliases.is_empty());
        assert!(config.extra.contains_key("extraField"));
    }

    #[test]
    fn test_instance_config_deserialize_legacy() {
        let json = r#"{
            "url": "http://localhost:8069",
            "db": "mydb",
            "version": "18",
            "username": "admin",
            "password": "admin123"
        }"#;
        let config: OdooInstanceConfig = serde_json::from_str(json).unwrap();
        assert_eq!(config.url, "http://localhost:8069");
        assert_eq!(config.version, Some("18".to_string()));
        assert_eq!(config.username, Some("admin".to_string()));
        assert_eq!(config.password, Some("admin123".to_string()));
        assert!(config.aliases.is_empty());
        assert_eq!(config.auth_mode(), OdooAuthMode::Password);
    }

    #[test]
    fn test_instance_config_deserialize_with_tool_config() {
        let json = r#"{
            "url": "http://localhost:8069",
            "db": "mydb",
            "apiKey": "test-key",
            "toolConfig": {
                "disabledTools": ["odoo_create", "odoo_update"],
                "defaults": {
                    "odoo_search_read": {
                        "limit": 20,
                        "context": {
                            "allowed_company_ids": [1]
                        }
                    }
                }
            }
        }"#;
        let config: OdooInstanceConfig = serde_json::from_str(json).unwrap();
        let tool_config = config.tool_config.expect("tool config should deserialize");
        assert!(tool_config.is_tool_disabled("odoo_create"));
        assert!(!tool_config.is_tool_disabled("odoo_search_read"));
        assert_eq!(
            tool_config
                .tool_defaults("odoo_search_read")
                .and_then(|v| v.get("limit"))
                .and_then(|v| v.as_u64()),
            Some(20)
        );
    }

    #[test]
    fn test_auth_mode_protocol_override_jsonrpc() {
        let config = OdooInstanceConfig {
            url: "http://localhost".to_string(),
            db: None,
            api_key: Some("test-key".to_string()),
            username: None,
            password: None,
            version: Some("19".to_string()),
            protocol: OdooProtocol::JsonRpc,
            timeout_ms: None,
            max_retries: None,
            tool_config: None,
            read_only: false,
            tags: Vec::new(),
            aliases: Vec::new(),
            extra: HashMap::new(),
        };
        assert_eq!(config.auth_mode(), OdooAuthMode::Password);
    }

    #[test]
    fn test_auth_mode_protocol_override_json2() {
        let config = OdooInstanceConfig {
            url: "http://localhost".to_string(),
            db: Some("mydb".to_string()),
            api_key: None,
            username: Some("admin".to_string()),
            password: Some("admin".to_string()),
            version: Some("18".to_string()),
            protocol: OdooProtocol::Json2,
            timeout_ms: None,
            max_retries: None,
            tool_config: None,
            read_only: false,
            tags: Vec::new(),
            aliases: Vec::new(),
            extra: HashMap::new(),
        };
        assert_eq!(config.auth_mode(), OdooAuthMode::ApiKey);
    }

    #[test]
    fn test_protocol_deserialize() {
        let json = r#"{
            "url": "http://localhost",
            "protocol": "jsonrpc"
        }"#;
        let config: OdooInstanceConfig = serde_json::from_str(json).unwrap();
        assert_eq!(config.protocol, OdooProtocol::JsonRpc);

        let json = r#"{
            "url": "http://localhost",
            "protocol": "json2"
        }"#;
        let config: OdooInstanceConfig = serde_json::from_str(json).unwrap();
        assert_eq!(config.protocol, OdooProtocol::Json2);
    }

    #[test]
    fn test_detect_runtime_instances_source_prefers_explicit_instances_json() {
        let _env_lock = TEST_ENV_MUTEX.lock().unwrap();
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("instances.json");
        std::fs::write(&file_path, "{}").unwrap();

        let _instances_json = EnvGuard::set(
            "ODOO_INSTANCES_JSON",
            Some(file_path.to_string_lossy().as_ref()),
        );
        let _instances = EnvGuard::set(
            "ODOO_INSTANCES",
            Some(r#"{"inline":{"url":"http://localhost"}}"#),
        );

        let source = detect_runtime_instances_source();

        assert_eq!(source.kind, RuntimeInstancesSourceKind::InstancesJson);
        assert_eq!(source.path, Some(file_path));
    }

    #[test]
    fn test_instance_config_omits_aliases_when_serialized() {
        let config = OdooInstanceConfig {
            url: "http://localhost".to_string(),
            db: Some("mydb".to_string()),
            api_key: Some("secret".to_string()),
            username: None,
            password: None,
            version: Some("19".to_string()),
            protocol: Default::default(),
            timeout_ms: None,
            max_retries: None,
            tool_config: None,
            read_only: false,
            tags: vec!["prod".to_string()],
            aliases: vec!["legacy-alias".to_string()],
            extra: HashMap::new(),
        };

        let value = serde_json::to_value(config).unwrap();
        assert_eq!(value["tags"], serde_json::json!(["prod"]));
        assert!(value.get("aliases").is_none());
    }
}
