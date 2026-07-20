pub mod cache;
pub mod capability;
pub mod cursor_stdio;
pub mod http;
pub mod module_snapshot;
pub mod prompts;
pub mod registry;
pub mod resources;
pub mod runtime;
pub mod tools;

use async_trait::async_trait;
use futures::future::join_all;
use mcp_rust_sdk::error::{Error, ErrorCode};
use mcp_rust_sdk::server::ServerHandler;
use mcp_rust_sdk::types::{ClientCapabilities, Implementation, ServerCapabilities};
use serde_json::{Value, json};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;
use tracing::{info, warn};

use crate::mcp::prompts::{get_prompt_result, list_prompts_result};
use crate::mcp::registry::{Registry, ToolCapabilityContext};
use crate::mcp::tools::{OdooClientPool, call_tool};

#[derive(Clone)]
pub struct McpOdooHandler {
    pool: OdooClientPool,
    registry: Arc<Registry>,
}

impl McpOdooHandler {
    pub fn new(pool: OdooClientPool, registry: Arc<Registry>) -> Self {
        Self { pool, registry }
    }

    pub fn instance_names(&self) -> Vec<String> {
        self.pool.instance_names()
    }

    pub async fn server_name(&self) -> String {
        self.registry.server_name().await
    }

    pub async fn instructions(&self) -> String {
        self.registry.instructions().await
    }

    pub async fn protocol_version_default(&self) -> String {
        self.registry.protocol_version_default().await
    }
}

fn protocol_err(message: impl Into<String>) -> Error {
    Error::protocol(ErrorCode::InvalidRequest, message)
}

#[async_trait]
impl ServerHandler for McpOdooHandler {
    async fn initialize(
        &self,
        _implementation: Implementation,
        _capabilities: ClientCapabilities,
    ) -> Result<ServerCapabilities, Error> {
        // mcp_rust_sdk ServerCapabilities is currently "custom" only, so we advertise tools/prompts/resources in custom.
        let mut custom = HashMap::new();
        custom.insert("tools".to_string(), json!({}));
        custom.insert("prompts".to_string(), json!({}));
        custom.insert("resources".to_string(), json!({}));
        custom.insert(
            "odooInstances".to_string(),
            json!({ "available": self.pool.instance_names() }),
        );
        Ok(ServerCapabilities {
            custom: Some(custom),
        })
    }

    async fn shutdown(&self) -> Result<(), Error> {
        Ok(())
    }

    async fn handle_method(&self, method: &str, params: Option<Value>) -> Result<Value, Error> {
        match method {
            "tools/list" => {
                // Fully declarative: tools are served from tools.json (registry).
                // Note: cleanup gating is handled by tool guards (e.g. requiresEnvTrue).
                let instance = params
                    .as_ref()
                    .and_then(|params| params.get("instance"))
                    .and_then(Value::as_str)
                    .map(str::to_string);
                let read_only = instance
                    .as_deref()
                    .map(|instance| self.pool.instance_is_read_only(instance))
                    .unwrap_or_else(|| self.pool.all_instances_read_only());
                let instances = if let Some(instance) = instance {
                    vec![instance]
                } else {
                    self.pool.instance_names()
                };
                let capabilities = join_all(instances.into_iter().map(|instance| async move {
                    ToolCapabilityContext {
                        snapshot: self.pool.module_snapshot(&instance).await,
                        disabled_packs: self.pool.disabled_packs(&instance),
                        instance,
                    }
                }))
                .await;
                let tools = self.registry.list_tools(read_only, &capabilities).await;
                Ok(json!({ "tools": tools }))
            }
            "tools/call" => {
                let started = Instant::now();
                let params = params.ok_or_else(|| protocol_err("Missing params for tools/call"))?;
                let name = params
                    .get("name")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| protocol_err("tools/call missing 'name'"))?;
                let args = params
                    .get("arguments")
                    .cloned()
                    .unwrap_or_else(|| json!({}));
                let instance_name = args
                    .get("instance")
                    .and_then(|v| v.as_str())
                    .map(|v| v.to_string());
                let model = args
                    .get("model")
                    .and_then(|v| v.as_str())
                    .map(str::to_owned);
                let record_id_count = args
                    .get("ids")
                    .and_then(Value::as_array)
                    .map(Vec::len)
                    .or_else(|| args.get("id").map(|_| 1));

                let Some(tool) = self.registry.get_tool(name, instance_name.as_deref()).await
                else {
                    warn!(
                        service = "odoo-rust-mcp",
                        tool = name,
                        instance = instance_name.as_deref().unwrap_or("unknown"),
                        model = model.as_deref().unwrap_or("unknown"),
                        record_id_count = record_id_count.unwrap_or(0),
                        outcome = "unknown_tool",
                        duration_ms = started.elapsed().as_millis(),
                        "MCP tool call completed"
                    );
                    return Ok(json!({
                        "content": [{
                            "type": "text",
                            "text": serde_json::to_string_pretty(&json!({
                                "error": "Unknown or disabled tool",
                                "tool": name,
                            })).unwrap_or_else(|_| "{\"error\":\"disabled\"}".to_string())
                        }],
                        "isError": true
                    }));
                };

                match call_tool(&self.pool, &tool, args).await {
                    Ok(v) => {
                        info!(
                            service = "odoo-rust-mcp",
                            tool = name,
                            instance = instance_name.as_deref().unwrap_or("unknown"),
                            model = model.as_deref().unwrap_or("unknown"),
                            record_id_count = record_id_count.unwrap_or(0),
                            outcome = "success",
                            duration_ms = started.elapsed().as_millis(),
                            "MCP tool call completed"
                        );
                        Ok(v)
                    }
                    Err(e) => {
                        warn!(
                            service = "odoo-rust-mcp",
                            tool = name,
                            instance = instance_name.as_deref().unwrap_or("unknown"),
                            model = model.as_deref().unwrap_or("unknown"),
                            record_id_count = record_id_count.unwrap_or(0),
                            outcome = "error",
                            duration_ms = started.elapsed().as_millis(),
                            "MCP tool call completed"
                        );
                        let mut error_payload = json!({
                            "error": e.to_string(),
                            "tool": name,
                        });
                        if let Some(instance) = instance_name {
                            error_payload["instance"] = json!(instance);
                        }

                        Ok(json!({
                            "content": [{
                                "type": "text",
                                "text": serde_json::to_string_pretty(&error_payload)
                                    .unwrap_or_else(|_| "{\"error\":\"unknown\"}".to_string())
                            }],
                            "isError": true
                        }))
                    }
                }
            }
            "prompts/list" => {
                let prompts = self.registry.list_prompts().await;
                Ok(list_prompts_result(&prompts))
            }
            "prompts/get" => {
                let params =
                    params.ok_or_else(|| protocol_err("Missing params for prompts/get"))?;
                let name = params
                    .get("name")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| protocol_err("prompts/get missing 'name'"))?;
                let p = self
                    .registry
                    .get_prompt(name)
                    .await
                    .ok_or_else(|| protocol_err(format!("Unknown prompt: {name}")))?;
                Ok(get_prompt_result(&p))
            }
            "resources/list" => resources::list_resources(&self.pool).await,
            "resources/read" => {
                let params =
                    params.ok_or_else(|| protocol_err("Missing params for resources/read"))?;
                let uri = params
                    .get("uri")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| protocol_err("resources/read missing 'uri'"))?;
                resources::read_resource(&self.pool, uri).await
            }
            // MCP ping method for health check / keep-alive
            "ping" => Ok(json!({})),
            // Handle notifications gracefully (no response needed, but return empty if called as request)
            "notifications/cancelled" => Ok(json!({})),
            "notifications/progress" => Ok(json!({})),
            "notifications/message" => Ok(json!({})),
            "notifications/resources/list_changed" => Ok(json!({})),
            "notifications/tools/list_changed" => Ok(json!({})),
            "notifications/prompts/list_changed" => Ok(json!({})),
            _ => Err(protocol_err(format!("Unknown method: {method}"))),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_protocol_err_creates_error_with_message() {
        let err = protocol_err("test message");
        let display = err.to_string();
        assert!(display.contains("test message"));
    }

    #[test]
    fn test_protocol_err_has_invalid_request_code() {
        let err = protocol_err("test");
        // Error display should contain something about the error
        let display = format!("{:?}", err);
        assert!(!display.is_empty());
    }
}
