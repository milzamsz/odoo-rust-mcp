use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use serde::Deserialize;
use serde_json::Value;
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

use crate::mcp::module_snapshot::ModuleSnapshot;
use crate::mcp::prompts::Prompt;

// Embedded seed defaults (used when target files are missing).
const DEFAULT_TOOLS_JSON: &str = include_str!("../../config-defaults/tools.json");
const DEFAULT_PROMPTS_JSON: &str = include_str!("../../config-defaults/prompts.json");
const DEFAULT_SERVER_JSON: &str = include_str!("../../config-defaults/server.json");

#[derive(Debug, Clone, Deserialize)]
struct ToolsConfigFile {
    tools: Vec<ToolDef>,
}

#[derive(Debug, Clone, Deserialize)]
struct PromptsConfigFile {
    prompts: Vec<Prompt>,
}

#[derive(Debug, Clone, Deserialize)]
struct ServerConfigFile {
    #[serde(rename = "serverName")]
    server_name: String,
    instructions: String,
    #[serde(rename = "protocolVersionDefault")]
    protocol_version_default: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ToolDef {
    pub name: String,
    pub description: String,
    #[serde(default)]
    pub pack: Option<String>,
    #[serde(default, rename = "requiredModules")]
    pub required_modules: Vec<String>,
    #[serde(rename = "inputSchema")]
    pub input_schema: Value,
    pub op: OpSpec,
    #[serde(default)]
    pub guards: Option<ToolGuards>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct OpSpec {
    #[serde(rename = "type")]
    pub op_type: String,
    #[serde(default)]
    pub map: HashMap<String, String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ToolGuards {
    /// If set, tool is only listed/callable when env var exists and is truthy.
    #[serde(rename = "requiresEnvTrue")]
    pub requires_env_true: Option<String>,
    #[serde(default, rename = "requiresEnvTrueAll")]
    pub requires_env_true_all: Vec<String>,
}

pub struct ToolCapabilityContext {
    pub instance: String,
    pub snapshot: ModuleSnapshot,
    pub disabled_packs: Vec<String>,
}

#[derive(Debug, Clone)]
struct RegistryState {
    tools: Vec<ToolDef>,
    tool_by_name: HashMap<String, ToolDef>,
    prompts_by_name: HashMap<String, Prompt>,
    prompt_order: Vec<String>,
    server: ServerConfigFile,
}

impl RegistryState {
    fn empty() -> Self {
        Self {
            tools: Vec::new(),
            tool_by_name: HashMap::new(),
            prompts_by_name: HashMap::new(),
            prompt_order: Vec::new(),
            server: ServerConfigFile {
                server_name: "odoo-rust-mcp".to_string(),
                instructions: "Odoo MCP server".to_string(),
                protocol_version_default: Some("2025-11-05".to_string()),
            },
        }
    }
}

pub struct Registry {
    tools_path: PathBuf,
    prompts_path: PathBuf,
    server_path: PathBuf,
    state: RwLock<RegistryState>,
    watchers: Mutex<Option<WatchGuards>>,
}

struct WatchGuards {
    _watcher: RecommendedWatcher,
}

impl Registry {
    pub fn from_env() -> Self {
        let tools_path =
            std::env::var("MCP_TOOLS_JSON").unwrap_or_else(|_| "config/tools.json".to_string());
        let prompts_path =
            std::env::var("MCP_PROMPTS_JSON").unwrap_or_else(|_| "config/prompts.json".to_string());
        let server_path =
            std::env::var("MCP_SERVER_JSON").unwrap_or_else(|_| "config/server.json".to_string());

        Self {
            tools_path: PathBuf::from(tools_path),
            prompts_path: PathBuf::from(prompts_path),
            server_path: PathBuf::from(server_path),
            state: RwLock::new(RegistryState::empty()),
            watchers: Mutex::new(None),
        }
    }

    /// Ensure JSON files exist (seed defaults on first start), then load into memory.
    pub async fn initial_load(&self) -> anyhow::Result<()> {
        self.ensure_default_files_exist()?;
        self.reload().await
    }

    /// Start file watcher(s) that reload config automatically.
    ///
    /// Safety: call once; subsequent calls are no-ops.
    pub fn start_watchers(self: &Arc<Self>) {
        let mut guard = self
            .watchers
            .lock()
            .expect("registry watcher mutex poisoned");
        if guard.is_some() {
            return;
        }

        // Debounced reload trigger: multiple fs events collapse into one reload.
        let (reload_tx, mut reload_rx) = tokio::sync::mpsc::unbounded_channel::<()>();
        let registry = Arc::clone(self);

        tokio::spawn(async move {
            loop {
                if reload_rx.recv().await.is_none() {
                    break;
                }
                tokio::time::sleep(std::time::Duration::from_millis(200)).await;
                while reload_rx.try_recv().is_ok() {}
                if let Err(e) = registry.reload().await {
                    warn!(error = %e, "config reload failed; keeping last good");
                }
            }
        });

        let tools_dir = parent_dir_or_current(&self.tools_path);
        let prompts_dir = parent_dir_or_current(&self.prompts_path);
        let server_dir = parent_dir_or_current(&self.server_path);

        let mut watch_dirs = vec![tools_dir, prompts_dir, server_dir];
        watch_dirs.sort();
        watch_dirs.dedup();

        let mut watcher = match notify::recommended_watcher(move |res| match res {
            Ok(event) => {
                debug!(?event, "config fs event");
                let _ = reload_tx.send(());
            }
            Err(err) => {
                warn!(error = %err, "config watcher error");
            }
        }) {
            Ok(w) => w,
            Err(e) => {
                warn!(error = %e, "failed to create config watcher; auto-reload disabled");
                return;
            }
        };

        for dir in watch_dirs {
            if let Err(e) = watcher.watch(&dir, RecursiveMode::NonRecursive) {
                warn!(dir = %dir.display(), error = %e, "failed to watch config directory");
            } else {
                info!(dir = %dir.display(), "watching config directory");
            }
        }

        *guard = Some(WatchGuards { _watcher: watcher });
    }

    pub async fn server_name(&self) -> String {
        self.state.read().await.server.server_name.clone()
    }

    pub async fn instructions(&self) -> String {
        self.state.read().await.server.instructions.clone()
    }

    pub async fn protocol_version_default(&self) -> String {
        self.state
            .read()
            .await
            .server
            .protocol_version_default
            .clone()
            .unwrap_or_else(|| "2025-11-05".to_string())
    }

    pub async fn list_tools(
        &self,
        read_only: bool,
        capabilities: &[ToolCapabilityContext],
    ) -> Vec<Value> {
        let st = self.state.read().await;
        st.tools
            .iter()
            .filter(|tool| {
                let mut denial_instance = if capabilities.len() == 1 {
                    capabilities[0].instance.as_str()
                } else {
                    "all"
                };
                let mut denial = guard_denial(tool.guards.as_ref())
                    .map(|detail| ("env_guard", detail))
                    .or_else(|| {
                        (controlled_mode()
                            && is_mutating_op(&tool.op.op_type)
                            && tool.op.op_type != "execute_capability")
                            .then(|| ("controlled_mode", String::new()))
                    })
                    .or_else(|| {
                        (read_only && is_mutating_op(&tool.op.op_type))
                            .then(|| ("read_only", String::new()))
                    });
                // Unscoped list (many instances): hide the tool if ANY instance
                // denies it. This is deliberately conservative — an unscoped
                // tools/call skips per-instance capability checks and runs against
                // the default instance, so only listing tools available everywhere
                // keeps that default-instance call safe. Scoped lists pass a single
                // capability and gate on just that instance.
                if denial.is_none() {
                    for capability in capabilities {
                        if let Some(reason) = capability_denial(
                            tool,
                            Some(&capability.snapshot),
                            &capability.disabled_packs,
                        ) {
                            denial_instance = &capability.instance;
                            denial = Some(reason);
                            break;
                        }
                    }
                }
                if let Some((reason, detail)) = denial {
                    audit_tool_denial(denial_instance, tool, reason, &detail);
                    false
                } else {
                    true
                }
            })
            .map(|t| {
                serde_json::json!({
                    "name": t.name,
                    "description": t.description,
                    "inputSchema": t.input_schema
                })
            })
            .collect()
    }

    pub async fn get_tool(&self, name: &str, instance: Option<&str>) -> Option<ToolDef> {
        let st = self.state.read().await;
        let t = st.tool_by_name.get(name)?.clone();
        if let Some(detail) = guard_denial(t.guards.as_ref()) {
            audit_tool_denial(instance.unwrap_or("unknown"), &t, "env_guard", &detail);
            None
        } else {
            Some(t)
        }
    }

    pub async fn list_prompts(&self) -> Vec<(String, String)> {
        let st = self.state.read().await;
        st.prompt_order
            .iter()
            .filter_map(|name| {
                st.prompts_by_name
                    .get(name)
                    .map(|p| (p.name.clone(), p.description.clone()))
            })
            .collect()
    }

    pub async fn get_prompt(&self, name: &str) -> Option<Prompt> {
        let st = self.state.read().await;
        st.prompts_by_name.get(name).cloned()
    }

    pub async fn reload(&self) -> anyhow::Result<()> {
        self.ensure_default_files_exist()?;

        let tools = load_tools_file(&self.tools_path)?;
        let prompts = load_prompts_file(&self.prompts_path)?;
        let server = load_server_file(&self.server_path)?;

        // Validate and build maps.
        let mut tool_by_name = HashMap::new();
        for t in &tools {
            validate_cursor_schema(&t.input_schema).map_err(|e| {
                anyhow::anyhow!("tools.json tool '{}' has invalid inputSchema: {e}", t.name)
            })?;
            if tool_by_name.insert(t.name.clone(), t.clone()).is_some() {
                return Err(anyhow::anyhow!(
                    "Duplicate tool name in tools.json: {}",
                    t.name
                ));
            }
        }

        let mut prompts_by_name = HashMap::new();
        let mut prompt_order = Vec::new();
        for p in prompts {
            if prompts_by_name.insert(p.name.clone(), p.clone()).is_some() {
                return Err(anyhow::anyhow!(
                    "Duplicate prompt name in prompts.json: {}",
                    p.name
                ));
            }
            prompt_order.push(p.name.clone());
        }

        let mut st = self.state.write().await;
        st.tools = tools;
        st.tool_by_name = tool_by_name;
        st.prompts_by_name = prompts_by_name;
        st.prompt_order = prompt_order;
        st.server = server;

        info!(path = %self.tools_path.display(), "tools config loaded");
        info!(path = %self.prompts_path.display(), "prompts config loaded");
        info!(path = %self.server_path.display(), "server config loaded");
        Ok(())
    }

    fn ensure_default_files_exist(&self) -> anyhow::Result<()> {
        ensure_file_exists_with_seed(&self.tools_path, DEFAULT_TOOLS_JSON)?;
        ensure_file_exists_with_seed(&self.prompts_path, DEFAULT_PROMPTS_JSON)?;
        ensure_file_exists_with_seed(&self.server_path, DEFAULT_SERVER_JSON)?;
        Ok(())
    }
}

fn is_mutating_op(op_type: &str) -> bool {
    matches!(
        op_type,
        "create"
            | "write"
            | "unlink"
            | "workflow_action"
            | "execute"
            | "database_cleanup"
            | "deep_cleanup"
            | "stock_inventory_reversal_cleanup"
            | "copy"
            | "create_batch"
            | "execute_capability"
    )
}

fn guard_denial(guards: Option<&ToolGuards>) -> Option<String> {
    let g = guards?;
    if let Some(var) = &g.requires_env_true
        && !env_truthy(var)
    {
        return Some(var.clone());
    }
    let missing: Vec<_> = g
        .requires_env_true_all
        .iter()
        .filter(|var| !env_truthy(var))
        .cloned()
        .collect();
    (!missing.is_empty()).then(|| missing.join(","))
}

pub(crate) fn capability_denial(
    tool: &ToolDef,
    snapshot: Option<&ModuleSnapshot>,
    disabled_packs: &[String],
) -> Option<(&'static str, String)> {
    if let Some(pack) = tool.pack.as_ref()
        && disabled_packs.iter().any(|disabled| disabled == pack)
    {
        return Some(("pack_disabled", pack.clone()));
    }
    if tool.required_modules.is_empty() {
        return None;
    }
    let missing: Vec<_> = tool
        .required_modules
        .iter()
        .filter(|module| snapshot.is_none_or(|snapshot| !snapshot.modules.contains(*module)))
        .cloned()
        .collect();
    (!missing.is_empty()).then(|| ("missing_modules", missing.join(",")))
}

pub(crate) fn audit_tool_denial(instance: &str, tool: &ToolDef, reason_code: &str, detail: &str) {
    info!(
        audit_event = "tool_policy_decision",
        decision = "deny",
        instance,
        tool = tool.name,
        pack = tool.pack.as_deref().unwrap_or("none"),
        reason_code,
        detail,
        "MCP tool policy decision"
    );
}

fn env_truthy(var: &str) -> bool {
    match std::env::var(var) {
        Ok(v) => {
            let s = v.trim().to_ascii_lowercase();
            matches!(s.as_str(), "1" | "true" | "yes" | "y" | "on")
        }
        Err(_) => false,
    }
}

fn controlled_mode() -> bool {
    env_truthy("ODOO_CAPABILITY_CONTROLLED_MODE")
}

fn parent_dir_or_current(path: &Path) -> PathBuf {
    path.parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from("."))
}

fn ensure_file_exists_with_seed(path: &Path, seed_contents: &str) -> anyhow::Result<()> {
    if path.exists() {
        return Ok(());
    }
    if let Some(parent) = path.parent()
        && !parent.as_os_str().is_empty()
    {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, seed_contents)?;
    info!(path = %path.display(), "created default config file");
    Ok(())
}

fn load_tools_file(path: &Path) -> anyhow::Result<Vec<ToolDef>> {
    let raw = std::fs::read_to_string(path).map_err(|e| anyhow::anyhow!(e))?;
    let parsed: ToolsConfigFile =
        serde_json::from_str(&raw).map_err(|e| anyhow::anyhow!("Invalid tools.json: {e}"))?;
    Ok(parsed.tools)
}

fn load_prompts_file(path: &Path) -> anyhow::Result<Vec<Prompt>> {
    let raw = std::fs::read_to_string(path).map_err(|e| anyhow::anyhow!(e))?;
    let parsed: PromptsConfigFile =
        serde_json::from_str(&raw).map_err(|e| anyhow::anyhow!("Invalid prompts.json: {e}"))?;
    Ok(parsed.prompts)
}

fn load_server_file(path: &Path) -> anyhow::Result<ServerConfigFile> {
    let raw = std::fs::read_to_string(path).map_err(|e| anyhow::anyhow!(e))?;
    let parsed: ServerConfigFile =
        serde_json::from_str(&raw).map_err(|e| anyhow::anyhow!("Invalid server.json: {e}"))?;
    Ok(parsed)
}

/// Cursor can be picky about JSON Schema features.
/// Reject schemas that likely break Cursor parsing.
fn validate_cursor_schema(schema: &Value) -> anyhow::Result<()> {
    fn walk(v: &Value) -> anyhow::Result<()> {
        match v {
            Value::Object(map) => {
                for (k, vv) in map {
                    if matches!(
                        k.as_str(),
                        "anyOf" | "oneOf" | "allOf" | "$ref" | "definitions"
                    ) {
                        return Err(anyhow::anyhow!("schema contains forbidden key '{k}'"));
                    }
                    if k == "type" && vv.is_array() {
                        return Err(anyhow::anyhow!("schema contains type array"));
                    }
                    walk(vv)?;
                }
            }
            Value::Array(arr) => {
                for vv in arr {
                    walk(vv)?;
                }
            }
            _ => {}
        }
        Ok(())
    }

    walk(schema)
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use serde_json::json;
    use std::collections::BTreeSet;

    #[test]
    fn test_validate_cursor_schema_valid() {
        let schema = json!({
            "type": "object",
            "properties": {
                "name": { "type": "string" },
                "age": { "type": "integer" }
            },
            "required": ["name"]
        });
        assert!(validate_cursor_schema(&schema).is_ok());
    }

    #[test]
    fn tool_capability_metadata_round_trips_and_filters() {
        let tool: ToolDef = serde_json::from_value(json!({
            "name": "stock_tool",
            "description": "Stock",
            "pack": "inventory",
            "requiredModules": ["stock"],
            "inputSchema": {"type": "object"},
            "op": {"type": "search"}
        }))
        .unwrap();
        let snapshot = ModuleSnapshot {
            instance: "dev".into(),
            version: Some("18".into()),
            edition: "community".into(),
            modules: BTreeSet::from(["base".into()]),
            refreshed_at: Utc::now(),
            checked_at: Utc::now(),
            stale: false,
            last_error: None,
        };

        assert_eq!(tool.pack.as_deref(), Some("inventory"));
        assert_eq!(tool.required_modules, ["stock"]);
        assert_eq!(
            capability_denial(&tool, Some(&snapshot), &[]),
            Some(("missing_modules", "stock".into()))
        );

        let mut installed = snapshot;
        installed.modules.insert("stock".into());
        assert_eq!(capability_denial(&tool, Some(&installed), &[]), None);
        assert_eq!(
            capability_denial(&tool, Some(&installed), &["inventory".into()]),
            Some(("pack_disabled", "inventory".into()))
        );
    }

    #[tokio::test]
    async fn list_filters_modules_only_for_a_selected_instance() {
        let tool: ToolDef = serde_json::from_value(json!({
            "name": "stock_tool",
            "description": "Stock",
            "requiredModules": ["stock"],
            "inputSchema": {"type": "object"},
            "op": {"type": "search"}
        }))
        .unwrap();
        let mut state = RegistryState::empty();
        state.tools.push(tool);
        let registry = Registry {
            tools_path: "tools.json".into(),
            prompts_path: "prompts.json".into(),
            server_path: "server.json".into(),
            state: RwLock::new(state),
            watchers: Mutex::new(None),
        };
        let missing = ModuleSnapshot {
            instance: "dev".into(),
            version: None,
            edition: "unknown".into(),
            modules: BTreeSet::new(),
            refreshed_at: Utc::now(),
            checked_at: Utc::now(),
            stale: false,
            last_error: None,
        };

        assert_eq!(registry.list_tools(false, &[]).await.len(), 1);
        assert!(
            registry
                .list_tools(
                    false,
                    &[ToolCapabilityContext {
                        instance: "dev".into(),
                        snapshot: missing,
                        disabled_packs: Vec::new(),
                    }],
                )
                .await
                .is_empty()
        );
    }

    #[test]
    fn test_validate_cursor_schema_rejects_anyof() {
        let schema = json!({
            "anyOf": [
                { "type": "string" },
                { "type": "integer" }
            ]
        });
        let result = validate_cursor_schema(&schema);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("anyOf"));
    }

    #[test]
    fn test_validate_cursor_schema_rejects_oneof() {
        let schema = json!({
            "oneOf": [
                { "type": "string" }
            ]
        });
        assert!(validate_cursor_schema(&schema).is_err());
    }

    #[test]
    fn test_validate_cursor_schema_rejects_allof() {
        let schema = json!({
            "allOf": [
                { "type": "object" }
            ]
        });
        assert!(validate_cursor_schema(&schema).is_err());
    }

    #[test]
    fn test_validate_cursor_schema_rejects_ref() {
        let schema = json!({
            "$ref": "#/definitions/SomeType"
        });
        assert!(validate_cursor_schema(&schema).is_err());
    }

    #[test]
    fn test_validate_cursor_schema_rejects_definitions() {
        let schema = json!({
            "definitions": {
                "SomeType": { "type": "string" }
            }
        });
        assert!(validate_cursor_schema(&schema).is_err());
    }

    #[test]
    fn test_validate_cursor_schema_rejects_type_array() {
        let schema = json!({
            "type": ["string", "null"]
        });
        assert!(validate_cursor_schema(&schema).is_err());
    }

    #[test]
    fn test_validate_cursor_schema_nested_valid() {
        let schema = json!({
            "type": "object",
            "properties": {
                "items": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "id": { "type": "integer" }
                        }
                    }
                }
            }
        });
        assert!(validate_cursor_schema(&schema).is_ok());
    }

    #[test]
    fn test_validate_cursor_schema_nested_invalid() {
        let schema = json!({
            "type": "object",
            "properties": {
                "value": {
                    "anyOf": [{ "type": "string" }]
                }
            }
        });
        assert!(validate_cursor_schema(&schema).is_err());
    }

    #[test]
    fn test_env_truthy_missing_var() {
        assert!(!env_truthy("DEFINITELY_NOT_SET_VAR_12345"));
    }

    #[test]
    fn test_guards_allow_none() {
        assert!(guard_denial(None).is_none());
    }

    #[test]
    fn test_guards_allow_with_missing_env() {
        let guards = ToolGuards {
            requires_env_true: Some("MISSING_ENV_VAR_12345".to_string()),
            requires_env_true_all: Vec::new(),
        };
        assert!(guard_denial(Some(&guards)).is_some());
    }

    #[test]
    fn test_parent_dir_or_current_with_parent() {
        let path = std::path::Path::new("/some/path/file.json");
        let parent = parent_dir_or_current(path);
        assert_eq!(parent, std::path::PathBuf::from("/some/path"));
    }

    #[test]
    fn test_parent_dir_or_current_no_parent() {
        let path = std::path::Path::new("file.json");
        let parent = parent_dir_or_current(path);
        // On some systems, parent() of "file.json" returns Some(""), not None
        // The function should return "." for empty parent or current dir
        assert!(
            parent.as_os_str() == std::path::Path::new(".").as_os_str()
                || parent.as_os_str() == std::path::Path::new("").as_os_str()
        );
    }

    #[test]
    fn test_tool_def_deserialize() {
        let json = r#"{
            "name": "test_tool",
            "description": "A test tool",
            "inputSchema": {
                "type": "object",
                "properties": {}
            },
            "op": {
                "type": "search",
                "map": { "model": "res.partner" }
            }
        }"#;
        let tool: ToolDef = serde_json::from_str(json).unwrap();
        assert_eq!(tool.name, "test_tool");
        assert_eq!(tool.description, "A test tool");
        assert_eq!(tool.op.op_type, "search");
        assert_eq!(tool.op.map.get("model"), Some(&"res.partner".to_string()));
        assert!(tool.guards.is_none());
    }

    #[test]
    fn test_tool_def_deserialize_with_guards() {
        let json = r#"{
            "name": "guarded_tool",
            "description": "A guarded tool",
            "inputSchema": { "type": "object" },
            "op": { "type": "execute" },
            "guards": {
                "requiresEnvTrue": "ENABLE_DANGEROUS_TOOLS"
            }
        }"#;
        let tool: ToolDef = serde_json::from_str(json).unwrap();
        assert!(tool.guards.is_some());
        assert_eq!(
            tool.guards.unwrap().requires_env_true,
            Some("ENABLE_DANGEROUS_TOOLS".to_string())
        );
    }

    #[test]
    fn test_op_spec_deserialize() {
        let json = r#"{
            "type": "search_read",
            "map": {
                "model": "sale.order",
                "fields": "id,name"
            }
        }"#;
        let op: OpSpec = serde_json::from_str(json).unwrap();
        assert_eq!(op.op_type, "search_read");
        assert_eq!(op.map.len(), 2);
    }

    #[test]
    fn test_registry_state_empty() {
        let state = RegistryState::empty();
        assert!(state.tools.is_empty());
        assert!(state.tool_by_name.is_empty());
        assert!(state.prompts_by_name.is_empty());
        assert!(state.prompt_order.is_empty());
        assert_eq!(state.server.server_name, "odoo-rust-mcp");
    }
}
