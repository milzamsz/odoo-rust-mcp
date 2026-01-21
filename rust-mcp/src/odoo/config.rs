use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OdooInstanceConfig {
    pub url: String,
    #[serde(default)]
    pub db: Option<String>,
    #[serde(default, rename = "apiKey")]
    pub api_key: Option<String>,
    #[serde(default)]
    pub timeout_ms: Option<u64>,
    #[serde(default)]
    pub max_retries: Option<usize>,

    // Allow extra fields in ODOO_INSTANCES JSON (version/provider/etc).
    #[serde(flatten, default)]
    pub extra: HashMap<String, Value>,
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

        if let (Some(url), Some(api_key)) = (url, api_key) {
            let url = normalize_url(&url);
            instances.insert(
                "default".to_string(),
                OdooInstanceConfig {
                    url,
                    db,
                    api_key: Some(api_key),
                    timeout_ms: std::env::var("ODOO_TIMEOUT_MS").ok().and_then(|v| v.parse().ok()),
                    max_retries: std::env::var("ODOO_MAX_RETRIES").ok().and_then(|v| v.parse().ok()),
                    extra: HashMap::new(),
                },
            );
        }
    }

    if instances.is_empty() {
        anyhow::bail!(
            "No Odoo instances configured. Set ODOO_INSTANCES or ODOO_URL + ODOO_API_KEY (optional ODOO_DB)."
        );
    }

    // Ensure API key is available per instance (either inline or via global env).
    let global_api_key = std::env::var("ODOO_API_KEY").ok();
    for (name, cfg) in instances.iter_mut() {
        cfg.url = normalize_url(&cfg.url);
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

