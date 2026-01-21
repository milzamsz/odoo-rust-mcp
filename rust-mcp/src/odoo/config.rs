use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Authentication mode for Odoo instances.
/// - `ApiKey`: Odoo 19+ JSON-2 API with bearer token
/// - `Password`: Odoo < 19 JSON-RPC with username/password
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub enum OdooAuthMode {
    #[default]
    ApiKey,
    Password,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OdooInstanceConfig {
    pub url: String,
    #[serde(default)]
    pub db: Option<String>,
    #[serde(default, rename = "apiKey")]
    pub api_key: Option<String>,
    /// Username for Odoo < 19 (JSON-RPC authentication)
    #[serde(default)]
    pub username: Option<String>,
    /// Password for Odoo < 19 (JSON-RPC authentication)
    #[serde(default)]
    pub password: Option<String>,
    /// Odoo version (e.g., "18", "17", "19"). If < 19, uses JSON-RPC with username/password.
    #[serde(default)]
    pub version: Option<String>,
    #[serde(default)]
    pub timeout_ms: Option<u64>,
    #[serde(default)]
    pub max_retries: Option<usize>,

    // Allow extra fields in ODOO_INSTANCES JSON.
    #[serde(flatten, default)]
    pub extra: HashMap<String, Value>,
}

impl OdooInstanceConfig {
    /// Determine authentication mode based on version or available credentials.
    pub fn auth_mode(&self) -> OdooAuthMode {
        // If version is explicitly set and < 19, use password mode
        if let Some(v) = &self.version {
            if let Ok(major) = v.split('.').next().unwrap_or(v).parse::<u32>() {
                if major < 19 {
                    return OdooAuthMode::Password;
                }
            }
        }
        // If no API key but has username/password, use password mode
        if self.api_key.as_ref().map(|s| s.trim().is_empty()).unwrap_or(true)
            && self.username.is_some()
            && self.password.is_some()
        {
            return OdooAuthMode::Password;
        }
        OdooAuthMode::ApiKey
    }
}

#[derive(Debug, Clone)]
pub struct OdooEnvConfig {
    pub instances: HashMap<String, OdooInstanceConfig>,
}

pub fn load_odoo_env() -> anyhow::Result<OdooEnvConfig> {
    let mut instances = HashMap::new();

    // Prefer ODOO_INSTANCES JSON.
    if let Ok(raw) = std::env::var("ODOO_INSTANCES") {
        if !raw.trim().is_empty() {
            let parsed: HashMap<String, OdooInstanceConfig> = serde_json::from_str(&raw)
                .map_err(|e| anyhow::anyhow!("Failed to parse ODOO_INSTANCES JSON: {e}"))?;
            instances.extend(parsed);
        }
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
        let has_api_key = api_key.as_ref().map(|s| !s.trim().is_empty()).unwrap_or(false);
        let has_password_auth = username.as_ref().map(|s| !s.trim().is_empty()).unwrap_or(false)
            && password.as_ref().map(|s| !s.trim().is_empty()).unwrap_or(false);

        if let Some(url) = url {
            if has_api_key || has_password_auth {
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
                        timeout_ms: std::env::var("ODOO_TIMEOUT_MS").ok().and_then(|v| v.parse().ok()),
                        max_retries: std::env::var("ODOO_MAX_RETRIES").ok().and_then(|v| v.parse().ok()),
                        extra: HashMap::new(),
                    },
                );
            }
        }
    }

    if instances.is_empty() {
        anyhow::bail!(
            "No Odoo instances configured. Set ODOO_INSTANCES or ODOO_URL + credentials.\n\
             For Odoo 19+: ODOO_API_KEY\n\
             For Odoo < 19: ODOO_USERNAME + ODOO_PASSWORD + ODOO_VERSION"
        );
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
                if cfg.api_key.as_ref().map(|s| s.trim().is_empty()).unwrap_or(true) {
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
                if cfg.username.as_ref().map(|s| s.trim().is_empty()).unwrap_or(true) {
                    if let Some(u) = &global_username {
                        cfg.username = Some(u.clone());
                    } else {
                        anyhow::bail!(
                            "Missing username for instance '{name}'. Provide it in ODOO_INSTANCES or set ODOO_USERNAME."
                        );
                    }
                }
                if cfg.password.as_ref().map(|s| s.trim().is_empty()).unwrap_or(true) {
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

