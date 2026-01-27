use serde_json::{Value, json};
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{error, info, warn};

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

    /// Load instances config from file
    pub async fn load_instances(&self) -> anyhow::Result<Value> {
        let path = self.config_dir.join("instances.json");

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

    /// Save instances config to file with backup and rollback support
    pub async fn save_instances(&self, config: Value) -> anyhow::Result<ConfigResult> {
        let path = self.config_dir.join("instances.json");

        // Validate JSON structure
        if !config.is_object() {
            return Ok(ConfigResult::error(
                "Config must be a JSON object with instance names as keys",
            ));
        }

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

        let json_str = match serde_json::to_string_pretty(&config) {
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
            *cache = config;
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

        // Extract tools array from {"tools": [...]} or return array directly
        let tools = if let Some(tools_array) = config.get("tools").and_then(|v| v.as_array()) {
            json!(tools_array)
        } else if config.is_array() {
            config
        } else {
            return Err(anyhow::anyhow!(
                "Invalid tools.json format: expected object with 'tools' array or array directly"
            ));
        };

        info!("Loaded tools config from {:?}", path);
        Ok(tools)
    }

    /// Save tools config to file with backup and rollback support
    pub async fn save_tools(&self, config: Value) -> anyhow::Result<ConfigResult> {
        let path = self.config_dir.join("tools.json");

        // Accept either array directly or object with tools array
        let tools_array = if config.is_array() {
            config
        } else if let Some(tools) = config.get("tools").and_then(|v| v.as_array()) {
            json!(tools)
        } else {
            return Ok(ConfigResult::error(
                "Tools config must be a JSON array or object with 'tools' array",
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
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_save_and_load_instances() {
        let temp_dir = TempDir::new().unwrap();
        let manager = ConfigManager::new(temp_dir.path().to_path_buf());

        let config = json!({
            "default": {
                "url": "http://localhost:8069",
                "db": "mydb",
                "apiKey": "test_key"
            }
        });

        let result = manager.save_instances(config.clone()).await.unwrap();
        assert!(result.success, "Save should succeed: {}", result.message);

        let loaded = manager.load_instances().await.unwrap();
        assert_eq!(loaded, config);
    }

    #[tokio::test]
    async fn test_save_invalid_instances_returns_error() {
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
}
