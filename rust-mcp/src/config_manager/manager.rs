use serde::Serialize;
use serde_json::{Value, json};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{error, info, warn};

use crate::odoo::config::OdooInstanceConfig;

const DEFAULT_TOOLS_JSON: &str = include_str!("../../config-defaults/tools.json");

#[derive(Debug, Clone, Serialize)]
pub struct ToolCatalogToolSummary {
    pub name: String,
    pub description: Option<String>,
    pub guards: Option<Value>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ToolCatalogDrift {
    pub runtime_count: usize,
    pub packaged_count: usize,
    pub missing_count: usize,
    pub missing_tools: Vec<ToolCatalogToolSummary>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ToolCatalogImportResult {
    pub imported_count: usize,
    pub imported_tools: Vec<ToolCatalogToolSummary>,
    pub drift: ToolCatalogDrift,
}

/// Result type for config operations that may need to notify the UI
#[derive(Debug, Clone)]
pub struct ConfigResult {
    pub success: bool,
    pub message: String,
    pub warning: Option<String>,
    pub rollback_performed: bool,
}

impl ConfigResult {
    pub fn ok(message: impl Into<String>) -> Self {
        Self {
            success: true,
            message: message.into(),
            warning: None,
            rollback_performed: false,
        }
    }

    pub fn error(message: impl Into<String>) -> Self {
        Self {
            success: false,
            message: message.into(),
            warning: None,
            rollback_performed: false,
        }
    }

    pub fn with_warning(mut self, warning: impl Into<String>) -> Self {
        self.warning = Some(warning.into());
        self
    }

    pub fn with_rollback(mut self) -> Self {
        self.rollback_performed = true;
        self
    }
}

fn normalize_instance_tags(tags: &[String]) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut normalized = Vec::new();

    for tag in tags {
        let trimmed = tag.trim();
        let key = trimmed.to_lowercase();
        if trimmed.is_empty() || !seen.insert(key) {
            continue;
        }
        normalized.push(trimmed.to_string());
    }

    normalized
}

fn extract_tools_array(config: Value) -> anyhow::Result<Vec<Value>> {
    if let Some(tools) = config.get("tools").and_then(|v| v.as_array()) {
        Ok(tools.clone())
    } else if let Some(tools) = config.as_array() {
        Ok(tools.clone())
    } else {
        anyhow::bail!(
            "Invalid tools.json format: expected object with 'tools' array or array directly"
        )
    }
}

fn tool_name(tool: &Value) -> anyhow::Result<String> {
    tool.get("name")
        .and_then(Value::as_str)
        .filter(|name| !name.trim().is_empty())
        .map(ToString::to_string)
        .ok_or_else(|| anyhow::anyhow!("Tool entry is missing a non-empty string 'name' field"))
}

fn validate_unique_tool_names(tools: &[Value]) -> anyhow::Result<()> {
    let mut seen = HashSet::new();

    for tool in tools {
        let name = tool_name(tool)?;
        if !seen.insert(name.clone()) {
            anyhow::bail!("Duplicate tool name in tools.json: {name}");
        }
    }

    Ok(())
}

fn summarize_tool(tool: &Value) -> anyhow::Result<ToolCatalogToolSummary> {
    Ok(ToolCatalogToolSummary {
        name: tool_name(tool)?,
        description: tool
            .get("description")
            .and_then(Value::as_str)
            .map(ToString::to_string),
        guards: tool.get("guards").cloned(),
    })
}

#[derive(Clone)]
pub struct ConfigManager {
    config_dir: PathBuf,
    instances_cache: Arc<RwLock<Value>>,
}

impl ConfigManager {
    pub fn new(config_dir: PathBuf) -> Self {
        Self {
            config_dir,
            instances_cache: Arc::new(RwLock::new(json!({}))),
        }
    }

    /// Create a backup of a config file before modifying
    fn backup_file(&self, path: &PathBuf) -> Option<String> {
        if path.exists() {
            match fs::read_to_string(path) {
                Ok(content) => Some(content),
                Err(e) => {
                    warn!("Failed to create backup of {:?}: {}", path, e);
                    None
                }
            }
        } else {
            None
        }
    }

    /// Restore a config file from backup
    fn restore_backup(&self, path: &PathBuf, backup: &str) -> bool {
        match fs::write(path, backup) {
            Ok(_) => {
                info!("Restored config from backup: {:?}", path);
                true
            }
            Err(e) => {
                error!("Failed to restore backup for {:?}: {}", path, e);
                false
            }
        }
    }

    /// Validate JSON content by attempting to parse it
    fn validate_json(content: &str) -> Result<Value, String> {
        serde_json::from_str(content).map_err(|e| format!("Invalid JSON: {}", e))
    }

    /// Resolve the authoritative instances.json path.
    /// Prefers ODOO_INSTANCES_JSON env var so the Config UI and the MCP pool
    /// always read/write the same file regardless of config_dir.
    pub fn instances_path(&self) -> PathBuf {
        if let Ok(p) = std::env::var("ODOO_INSTANCES_JSON") {
            let p = p.trim().to_string();
            if !p.is_empty() {
                return PathBuf::from(p);
            }
        }
        self.config_dir.join("instances.json")
    }

    /// Load instances config from file
    pub async fn load_instances(&self) -> anyhow::Result<Value> {
        let path = self.instances_path();

        if !path.exists() {
            warn!(
                "instances.json not found at {:?}, returning empty config",
                path
            );
            return Ok(json!({}));
        }

        let content = fs::read_to_string(&path)?;
        let config: Value = serde_json::from_str(&content)?;

        // Update cache
        {
            let mut cache = self.instances_cache.write().await;
            *cache = config.clone();
        }

        info!("Loaded instances config from {:?}", path);
        Ok(config)
    }

    /// Get cached instances config
    pub async fn get_instances(&self) -> Value {
        self.instances_cache.read().await.clone()
    }

    /// Normalize instances config through the Rust config model so deprecated
    /// fields are accepted on input but stripped from persisted output.
    pub async fn normalize_instances_config(&self, config: Value) -> anyhow::Result<Value> {
        let config_object = config.as_object().cloned().ok_or_else(|| {
            anyhow::anyhow!("Config must be a JSON object with instance names as keys")
        })?;

        let parsed_instances: HashMap<String, OdooInstanceConfig> = serde_json::from_value(config)
            .map_err(|e| anyhow::anyhow!("Invalid instances configuration: {e}"))?;

        if let Err(message) = self.validate_instance_tool_config(&parsed_instances).await {
            anyhow::bail!(message);
        }

        let mut normalized = serde_json::Map::with_capacity(config_object.len());
        for name in config_object.keys() {
            let mut instance = parsed_instances.get(name).cloned().ok_or_else(|| {
                anyhow::anyhow!("Normalized instances config is missing '{name}'")
            })?;

            if instance.auth_mode() == crate::odoo::config::OdooAuthMode::Password
                && instance.username_looks_like_url()
            {
                anyhow::bail!(
                    "Instance '{name}' has username/password auth, but the username looks like a URL. Enter the Odoo login name or email in the Username field instead of the instance URL."
                );
            }

            instance.tags = normalize_instance_tags(&instance.tags);
            normalized.insert(name.clone(), serde_json::to_value(instance)?);
        }

        Ok(Value::Object(normalized))
    }

    /// Save instances config to file with backup and rollback support
    pub async fn save_instances(&self, config: Value) -> anyhow::Result<ConfigResult> {
        let path = self.instances_path();
        let normalized_config = match self.normalize_instances_config(config).await {
            Ok(config) => config,
            Err(e) => return Ok(ConfigResult::error(e.to_string())),
        };

        // Create backup before modifying
        let backup = self.backup_file(&path);

        // Create parent directory if not exists
        if let Some(parent) = path.parent()
            && let Err(e) = fs::create_dir_all(parent)
        {
            return Ok(ConfigResult::error(format!(
                "Failed to create config directory: {}",
                e
            )));
        }

        let json_str = match serde_json::to_string_pretty(&normalized_config) {
            Ok(s) => s,
            Err(e) => {
                return Ok(ConfigResult::error(format!(
                    "Failed to serialize config: {}",
                    e
                )));
            }
        };

        // Validate JSON can be parsed back (sanity check)
        if let Err(e) = Self::validate_json(&json_str) {
            return Ok(ConfigResult::error(format!(
                "Generated invalid JSON: {}",
                e
            )));
        }

        // Write to file
        if let Err(e) = fs::write(&path, &json_str) {
            // Try to restore from backup if write failed
            if let Some(ref backup_content) = backup {
                self.restore_backup(&path, backup_content);
                return Ok(
                    ConfigResult::error(format!("Failed to save config: {}", e)).with_rollback()
                );
            }
            return Ok(ConfigResult::error(format!("Failed to save config: {}", e)));
        }

        // Validate the written file can be read back
        match fs::read_to_string(&path) {
            Ok(content) => {
                if let Err(e) = Self::validate_json(&content) {
                    error!("Written config is invalid, rolling back: {}", e);
                    if let Some(ref backup_content) = backup {
                        self.restore_backup(&path, backup_content);
                        return Ok(ConfigResult::error(format!(
                            "Config was corrupted during save, rolled back: {}",
                            e
                        ))
                        .with_rollback());
                    }
                    return Ok(ConfigResult::error(format!("Config corrupted: {}", e)));
                }
            }
            Err(e) => {
                if let Some(ref backup_content) = backup {
                    self.restore_backup(&path, backup_content);
                    return Ok(ConfigResult::error(format!(
                        "Cannot verify saved config, rolled back: {}",
                        e
                    ))
                    .with_rollback());
                }
            }
        }

        // Update cache only after successful save
        {
            let mut cache = self.instances_cache.write().await;
            *cache = normalized_config;
        }

        info!("Saved instances config to {:?}", path);
        Ok(ConfigResult::ok(
            "Instances configuration saved successfully",
        ))
    }

    /// Load tools config
    pub async fn load_tools(&self) -> anyhow::Result<Value> {
        let path = self.config_dir.join("tools.json");

        if !path.exists() {
            warn!("tools.json not found at {:?}, returning empty array", path);
            return Ok(json!([]));
        }

        let content = fs::read_to_string(&path)?;
        let config: Value = serde_json::from_str(&content)?;

        let tools = extract_tools_array(config)?;
        validate_unique_tool_names(&tools)?;

        info!("Loaded tools config from {:?}", path);
        Ok(json!(tools))
    }

    fn load_packaged_default_tools(&self) -> anyhow::Result<Vec<Value>> {
        let config: Value = serde_json::from_str(DEFAULT_TOOLS_JSON)
            .map_err(|e| anyhow::anyhow!("Invalid packaged default tools.json: {e}"))?;
        let tools = extract_tools_array(config)?;
        validate_unique_tool_names(&tools)?;
        Ok(tools)
    }

    async fn load_runtime_tools_vec(&self) -> anyhow::Result<Vec<Value>> {
        let tools = self.load_tools().await?;
        extract_tools_array(tools)
    }

    fn build_tool_catalog_drift(
        &self,
        runtime_tools: &[Value],
        packaged_tools: &[Value],
    ) -> anyhow::Result<ToolCatalogDrift> {
        validate_unique_tool_names(runtime_tools)?;
        validate_unique_tool_names(packaged_tools)?;

        let runtime_names = runtime_tools
            .iter()
            .map(tool_name)
            .collect::<anyhow::Result<HashSet<_>>>()?;

        let mut missing_tools = Vec::new();
        for tool in packaged_tools {
            let name = tool_name(tool)?;
            if !runtime_names.contains(&name) {
                missing_tools.push(summarize_tool(tool)?);
            }
        }

        Ok(ToolCatalogDrift {
            runtime_count: runtime_tools.len(),
            packaged_count: packaged_tools.len(),
            missing_count: missing_tools.len(),
            missing_tools,
        })
    }

    pub async fn tools_drift(&self) -> anyhow::Result<ToolCatalogDrift> {
        let runtime_tools = self.load_runtime_tools_vec().await?;
        let packaged_tools = self.load_packaged_default_tools()?;
        self.build_tool_catalog_drift(&runtime_tools, &packaged_tools)
    }

    pub async fn import_missing_tools(&self) -> anyhow::Result<ToolCatalogImportResult> {
        let mut runtime_tools = self.load_runtime_tools_vec().await?;
        let packaged_tools = self.load_packaged_default_tools()?;
        let initial_drift = self.build_tool_catalog_drift(&runtime_tools, &packaged_tools)?;

        if initial_drift.missing_tools.is_empty() {
            return Ok(ToolCatalogImportResult {
                imported_count: 0,
                imported_tools: Vec::new(),
                drift: initial_drift,
            });
        }

        let runtime_names = runtime_tools
            .iter()
            .map(tool_name)
            .collect::<anyhow::Result<HashSet<_>>>()?;

        let mut imported_tools = Vec::new();
        for tool in &packaged_tools {
            let name = tool_name(tool)?;
            if !runtime_names.contains(&name) {
                imported_tools.push(summarize_tool(tool)?);
                runtime_tools.push(tool.clone());
            }
        }

        let save_result = self.save_tools(json!(runtime_tools)).await?;
        if !save_result.success {
            anyhow::bail!(save_result.message);
        }

        let drift = self.tools_drift().await?;
        Ok(ToolCatalogImportResult {
            imported_count: imported_tools.len(),
            imported_tools,
            drift,
        })
    }

    /// Save tools config to file with backup and rollback support
    pub async fn save_tools(&self, config: Value) -> anyhow::Result<ConfigResult> {
        let path = self.config_dir.join("tools.json");

        // Accept either array directly or object with tools array
        let tools_array = match extract_tools_array(config) {
            Ok(tools) => tools,
            Err(_) => {
                return Ok(ConfigResult::error(
                    "Tools config must be a JSON array or object with 'tools' array",
                ));
            }
        };

        if let Err(e) = validate_unique_tool_names(&tools_array) {
            return Ok(ConfigResult::error(e.to_string()));
        };

        // Create backup before modifying
        let backup = self.backup_file(&path);

        if let Some(parent) = path.parent()
            && let Err(e) = fs::create_dir_all(parent)
        {
            return Ok(ConfigResult::error(format!(
                "Failed to create config directory: {}",
                e
            )));
        }

        // Save as {"tools": [...]} format to match file structure
        let file_content = json!({ "tools": tools_array });

        let json_str = match serde_json::to_string_pretty(&file_content) {
            Ok(s) => s,
            Err(e) => {
                return Ok(ConfigResult::error(format!(
                    "Failed to serialize config: {}",
                    e
                )));
            }
        };

        // Write to file
        if let Err(e) = fs::write(&path, &json_str) {
            if let Some(ref backup_content) = backup {
                self.restore_backup(&path, backup_content);
                return Ok(
                    ConfigResult::error(format!("Failed to save config: {}", e)).with_rollback()
                );
            }
            return Ok(ConfigResult::error(format!("Failed to save config: {}", e)));
        }

        // Validate the written file
        if let Ok(content) = fs::read_to_string(&path)
            && let Err(e) = Self::validate_json(&content)
        {
            error!("Written tools config is invalid, rolling back: {}", e);
            if let Some(ref backup_content) = backup {
                self.restore_backup(&path, backup_content);
                return Ok(ConfigResult::error(format!(
                    "Config was corrupted during save, rolled back: {}",
                    e
                ))
                .with_rollback());
            }
        }

        info!("Saved tools config to {:?}", path);
        Ok(ConfigResult::ok("Tools configuration saved successfully"))
    }

    /// Load prompts config
    pub async fn load_prompts(&self) -> anyhow::Result<Value> {
        let path = self.config_dir.join("prompts.json");

        if !path.exists() {
            warn!(
                "prompts.json not found at {:?}, returning empty array",
                path
            );
            return Ok(json!([]));
        }

        let content = fs::read_to_string(&path)?;
        let config: Value = serde_json::from_str(&content)?;

        // Extract prompts array from {"prompts": [...]} or return array directly
        let prompts = if let Some(prompts_array) = config.get("prompts").and_then(|v| v.as_array())
        {
            json!(prompts_array)
        } else if config.is_array() {
            config
        } else {
            return Err(anyhow::anyhow!(
                "Invalid prompts.json format: expected object with 'prompts' array or array directly"
            ));
        };

        info!("Loaded prompts config from {:?}", path);
        Ok(prompts)
    }

    /// Save prompts config to file with backup and rollback support
    pub async fn save_prompts(&self, config: Value) -> anyhow::Result<ConfigResult> {
        let path = self.config_dir.join("prompts.json");

        // Accept either array directly or object with prompts array
        let prompts_array = if config.is_array() {
            config
        } else if let Some(prompts) = config.get("prompts").and_then(|v| v.as_array()) {
            json!(prompts)
        } else {
            return Ok(ConfigResult::error(
                "Prompts config must be a JSON array or object with 'prompts' array",
            ));
        };

        // Create backup before modifying
        let backup = self.backup_file(&path);

        if let Some(parent) = path.parent()
            && let Err(e) = fs::create_dir_all(parent)
        {
            return Ok(ConfigResult::error(format!(
                "Failed to create config directory: {}",
                e
            )));
        }

        // Save as {"prompts": [...]} format to match file structure
        let file_content = json!({ "prompts": prompts_array });

        let json_str = match serde_json::to_string_pretty(&file_content) {
            Ok(s) => s,
            Err(e) => {
                return Ok(ConfigResult::error(format!(
                    "Failed to serialize config: {}",
                    e
                )));
            }
        };

        // Write to file
        if let Err(e) = fs::write(&path, &json_str) {
            if let Some(ref backup_content) = backup {
                self.restore_backup(&path, backup_content);
                return Ok(
                    ConfigResult::error(format!("Failed to save config: {}", e)).with_rollback()
                );
            }
            return Ok(ConfigResult::error(format!("Failed to save config: {}", e)));
        }

        // Validate the written file
        if let Ok(content) = fs::read_to_string(&path)
            && let Err(e) = Self::validate_json(&content)
        {
            error!("Written prompts config is invalid, rolling back: {}", e);
            if let Some(ref backup_content) = backup {
                self.restore_backup(&path, backup_content);
                return Ok(ConfigResult::error(format!(
                    "Config was corrupted during save, rolled back: {}",
                    e
                ))
                .with_rollback());
            }
        }

        info!("Saved prompts config to {:?}", path);
        Ok(ConfigResult::ok("Prompts configuration saved successfully"))
    }

    /// Load server config
    pub async fn load_server(&self) -> anyhow::Result<Value> {
        let path = self.config_dir.join("server.json");

        if !path.exists() {
            warn!(
                "server.json not found at {:?}, returning empty config",
                path
            );
            return Ok(json!({}));
        }

        let content = fs::read_to_string(&path)?;
        let config: Value = serde_json::from_str(&content)?;

        info!("Loaded server config from {:?}", path);
        Ok(config)
    }

    /// Save server config to file with backup and rollback support
    pub async fn save_server(&self, config: Value) -> anyhow::Result<ConfigResult> {
        let path = self.config_dir.join("server.json");

        if !config.is_object() {
            return Ok(ConfigResult::error("Server config must be a JSON object"));
        }

        // Create backup before modifying
        let backup = self.backup_file(&path);

        if let Some(parent) = path.parent()
            && let Err(e) = fs::create_dir_all(parent)
        {
            return Ok(ConfigResult::error(format!(
                "Failed to create config directory: {}",
                e
            )));
        }

        let json_str = match serde_json::to_string_pretty(&config) {
            Ok(s) => s,
            Err(e) => {
                return Ok(ConfigResult::error(format!(
                    "Failed to serialize config: {}",
                    e
                )));
            }
        };

        // Write to file
        if let Err(e) = fs::write(&path, &json_str) {
            if let Some(ref backup_content) = backup {
                self.restore_backup(&path, backup_content);
                return Ok(
                    ConfigResult::error(format!("Failed to save config: {}", e)).with_rollback()
                );
            }
            return Ok(ConfigResult::error(format!("Failed to save config: {}", e)));
        }

        // Validate the written file
        if let Ok(content) = fs::read_to_string(&path)
            && let Err(e) = Self::validate_json(&content)
        {
            error!("Written server config is invalid, rolling back: {}", e);
            if let Some(ref backup_content) = backup {
                self.restore_backup(&path, backup_content);
                return Ok(ConfigResult::error(format!(
                    "Config was corrupted during save, rolled back: {}",
                    e
                ))
                .with_rollback());
            }
        }

        info!("Saved server config to {:?}", path);
        Ok(ConfigResult::ok("Server configuration saved successfully"))
    }

    pub fn config_dir(&self) -> &PathBuf {
        &self.config_dir
    }

    async fn validate_instance_tool_config(
        &self,
        instances: &HashMap<String, OdooInstanceConfig>,
    ) -> Result<(), String> {
        let tool_names = extract_tool_names(
            &self
                .load_tools()
                .await
                .map_err(|e| format!("Failed to load tools for validation: {}", e))?,
        )?;

        for (instance_name, instance) in instances {
            let Some(tool_config) = &instance.tool_config else {
                continue;
            };

            for tool_name in &tool_config.disabled_tools {
                if !tool_names.contains(tool_name) {
                    return Err(format!(
                        "Instance '{}' references unknown disabled tool '{}'",
                        instance_name, tool_name
                    ));
                }
            }

            for (tool_name, defaults) in &tool_config.defaults {
                if !tool_names.contains(tool_name) {
                    return Err(format!(
                        "Instance '{}' references unknown tool '{}' in defaults",
                        instance_name, tool_name
                    ));
                }
                if !defaults.is_object() {
                    return Err(format!(
                        "Instance '{}' defaults for tool '{}' must be a JSON object",
                        instance_name, tool_name
                    ));
                }
            }
        }

        Ok(())
    }
}

fn extract_tool_names(tools: &Value) -> Result<HashSet<String>, String> {
    let Some(tools_array) = tools.as_array() else {
        return Err("Tools config must be a JSON array for validation".to_string());
    };

    let mut names = HashSet::new();
    for tool in tools_array {
        let Some(name) = tool.get("name").and_then(|value| value.as_str()) else {
            return Err("Every tool entry must include a string 'name'".to_string());
        };
        names.insert(name.to_string());
    }

    Ok(names)
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

    fn write_tools_fixture(temp_dir: &TempDir, tool_names: &[&str]) {
        let tools = json!({
            "tools": tool_names
                .iter()
                .map(|name| json!({ "name": name }))
                .collect::<Vec<_>>()
        });

        std::fs::write(
            temp_dir.path().join("tools.json"),
            serde_json::to_string_pretty(&tools).unwrap(),
        )
        .unwrap();
    }

    #[tokio::test]
    async fn test_save_and_load_instances() {
        let _env_lock = TEST_ENV_MUTEX.lock().unwrap();
        let _instances_json = EnvGuard::set("ODOO_INSTANCES_JSON", None);
        let temp_dir = TempDir::new().unwrap();
        let manager = ConfigManager::new(temp_dir.path().to_path_buf());

        let config = json!({
            "default": {
                "url": "http://localhost:8069",
                "db": "mydb",
                "apiKey": "test_key",
                "tags": ["prod", "kdkmp"]
            }
        });

        let result = manager.save_instances(config.clone()).await.unwrap();
        assert!(result.success, "Save should succeed: {}", result.message);

        let loaded = manager.load_instances().await.unwrap();
        assert_eq!(loaded, config);
    }

    #[tokio::test]
    async fn test_save_invalid_instances_returns_error() {
        let _env_lock = TEST_ENV_MUTEX.lock().unwrap();
        let _instances_json = EnvGuard::set("ODOO_INSTANCES_JSON", None);
        let temp_dir = TempDir::new().unwrap();
        let manager = ConfigManager::new(temp_dir.path().to_path_buf());

        // Array is not valid for instances (must be object)
        let invalid_config = json!([1, 2, 3]);

        let result = manager.save_instances(invalid_config).await.unwrap();
        assert!(!result.success, "Save should fail for invalid config");
        assert!(result.message.contains("must be a JSON object"));
    }

    #[tokio::test]
    async fn test_config_result_with_warning() {
        let result = ConfigResult::ok("Success").with_warning("Some warning");
        assert!(result.success);
        assert_eq!(result.warning, Some("Some warning".to_string()));
    }

    #[tokio::test]
    async fn test_config_result_with_rollback() {
        let result = ConfigResult::error("Failed").with_rollback();
        assert!(!result.success);
        assert!(result.rollback_performed);
    }

    #[tokio::test]
    async fn test_save_instances_round_trips_tool_config() {
        let _env_lock = TEST_ENV_MUTEX.lock().unwrap();
        let _instances_json = EnvGuard::set("ODOO_INSTANCES_JSON", None);
        let temp_dir = TempDir::new().unwrap();
        write_tools_fixture(&temp_dir, &["odoo_create", "odoo_search_read"]);
        let manager = ConfigManager::new(temp_dir.path().to_path_buf());

        let config = json!({
            "school-prod": {
                "url": "https://odoo.example.com",
                "db": "school",
                "apiKey": "secret",
                "toolConfig": {
                    "disabledTools": ["odoo_create"],
                    "defaults": {
                        "odoo_search_read": {
                            "limit": 20,
                            "context": {
                                "allowed_company_ids": [1]
                            }
                        }
                    }
                }
            }
        });

        let result = manager.save_instances(config.clone()).await.unwrap();
        assert!(result.success, "Save should succeed: {}", result.message);

        let loaded = manager.load_instances().await.unwrap();
        assert_eq!(loaded, config);
    }

    #[tokio::test]
    async fn test_save_instances_rejects_unknown_disabled_tool() {
        let _env_lock = TEST_ENV_MUTEX.lock().unwrap();
        let _instances_json = EnvGuard::set("ODOO_INSTANCES_JSON", None);
        let temp_dir = TempDir::new().unwrap();
        write_tools_fixture(&temp_dir, &["odoo_search_read"]);
        let manager = ConfigManager::new(temp_dir.path().to_path_buf());

        let config = json!({
            "school-prod": {
                "url": "https://odoo.example.com",
                "db": "school",
                "apiKey": "secret",
                "toolConfig": {
                    "disabledTools": ["odoo_create"]
                }
            }
        });

        let result = manager.save_instances(config).await.unwrap();
        assert!(!result.success);
        assert!(
            result
                .message
                .contains("unknown disabled tool 'odoo_create'")
        );
    }

    #[tokio::test]
    async fn test_save_instances_rejects_unknown_defaults_tool() {
        let _env_lock = TEST_ENV_MUTEX.lock().unwrap();
        let _instances_json = EnvGuard::set("ODOO_INSTANCES_JSON", None);
        let temp_dir = TempDir::new().unwrap();
        write_tools_fixture(&temp_dir, &["odoo_search_read"]);
        let manager = ConfigManager::new(temp_dir.path().to_path_buf());

        let config = json!({
            "school-prod": {
                "url": "https://odoo.example.com",
                "db": "school",
                "apiKey": "secret",
                "toolConfig": {
                    "defaults": {
                        "odoo_create": {
                            "name": "Student"
                        }
                    }
                }
            }
        });

        let result = manager.save_instances(config).await.unwrap();
        assert!(!result.success);
        assert!(result.message.contains("unknown tool 'odoo_create'"));
    }

    #[tokio::test]
    async fn test_save_instances_rejects_non_object_defaults() {
        let _env_lock = TEST_ENV_MUTEX.lock().unwrap();
        let _instances_json = EnvGuard::set("ODOO_INSTANCES_JSON", None);
        let temp_dir = TempDir::new().unwrap();
        write_tools_fixture(&temp_dir, &["odoo_search_read"]);
        let manager = ConfigManager::new(temp_dir.path().to_path_buf());

        let config = json!({
            "school-prod": {
                "url": "https://odoo.example.com",
                "db": "school",
                "apiKey": "secret",
                "toolConfig": {
                    "defaults": {
                        "odoo_search_read": ["invalid"]
                    }
                }
            }
        });

        let result = manager.save_instances(config).await.unwrap();
        assert!(!result.success);
        assert!(result.message.contains("must be a JSON object"));
    }

    #[tokio::test]
    async fn test_save_instances_strips_legacy_aliases() {
        let _env_lock = TEST_ENV_MUTEX.lock().unwrap();
        let _instances_json = EnvGuard::set("ODOO_INSTANCES_JSON", None);
        let temp_dir = TempDir::new().unwrap();
        let manager = ConfigManager::new(temp_dir.path().to_path_buf());

        let config = json!({
            "erp-kdkmp": {
                "url": "https://erp.example.com",
                "apiKey": "secret",
                "tags": ["prod", " KDKMP ", "PROD", ""],
                "aliases": ["legacy-name", "ERP"]
            }
        });

        let result = manager.save_instances(config).await.unwrap();
        assert!(result.success, "Save should succeed: {}", result.message);

        let loaded = manager.load_instances().await.unwrap();
        assert!(loaded["erp-kdkmp"].get("aliases").is_none());
        assert_eq!(loaded["erp-kdkmp"]["tags"], json!(["prod", "KDKMP"]));
        assert_eq!(loaded["erp-kdkmp"]["url"], json!("https://erp.example.com"));
    }

    #[tokio::test]
    async fn test_save_instances_rejects_password_username_that_looks_like_url() {
        let _env_lock = TEST_ENV_MUTEX.lock().unwrap();
        let _instances_json = EnvGuard::set("ODOO_INSTANCES_JSON", None);
        let temp_dir = TempDir::new().unwrap();
        let manager = ConfigManager::new(temp_dir.path().to_path_buf());

        let config = json!({
            "erp-ca-prod": {
                "url": "https://erp.centralaroma.com/",
                "db": "erp-ca",
                "username": "https://erp.centralaroma.com/",
                "password": "secret",
                "version": "18"
            }
        });

        let result = manager.save_instances(config).await.unwrap();
        assert!(!result.success);
        assert!(result.message.contains("username looks like a URL"));
    }
}
