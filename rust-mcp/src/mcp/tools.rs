use std::collections::HashMap;
use std::sync::Arc;

use base64::Engine;
use schemars::{schema_for, JsonSchema};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tokio::sync::Mutex;

use crate::odoo::client::OdooHttpClient;
use crate::odoo::config::{load_odoo_env, OdooEnvConfig};
use crate::odoo::types::OdooError;
use crate::cleanup;

/// Shared state: parsed env + instantiated HTTP clients per instance.
#[derive(Clone)]
pub struct OdooClientPool {
    env: Arc<OdooEnvConfig>,
    clients: Arc<Mutex<HashMap<String, OdooHttpClient>>>,
}

impl OdooClientPool {
    pub fn from_env() -> anyhow::Result<Self> {
        let env = load_odoo_env()?;
        Ok(Self {
            env: Arc::new(env),
            clients: Arc::new(Mutex::new(HashMap::new())),
        })
    }

    pub async fn get(&self, instance: &str) -> anyhow::Result<OdooHttpClient> {
        {
            let guard = self.clients.lock().await;
            if let Some(c) = guard.get(instance) {
                return Ok(c.clone());
            }
        }

        let cfg = self.env.instances.get(instance).ok_or_else(|| {
            let available = self
                .env
                .instances
                .keys()
                .cloned()
                .collect::<Vec<_>>()
                .join(", ");
            anyhow::anyhow!("Unknown Odoo instance '{instance}'. Available: {available}")
        })?;

        let client = OdooHttpClient::new(cfg)?;
        let mut guard = self.clients.lock().await;
        guard.insert(instance.to_string(), client.clone());
        Ok(client)
    }

    pub fn instance_names(&self) -> Vec<String> {
        self.env.instances.keys().cloned().collect()
    }
}

// --- Tool input schemas (ported from TS, using serde_json for free-form fields) ---

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct SearchArgs {
    pub instance: String,
    pub model: String,
    #[schemars(schema_with = "any_schema")]
    pub domain: Option<Value>,
    pub fields: Option<Vec<String>>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    pub order: Option<String>,
    #[schemars(schema_with = "any_schema")]
    pub context: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct ReadArgs {
    pub instance: String,
    pub model: String,
    pub ids: Vec<i64>,
    pub fields: Option<Vec<String>>,
    #[schemars(schema_with = "any_schema")]
    pub context: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct CreateArgs {
    pub instance: String,
    pub model: String,
    #[schemars(schema_with = "any_schema")]
    pub values: Value,
    #[schemars(schema_with = "any_schema")]
    pub context: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct UpdateArgs {
    pub instance: String,
    pub model: String,
    pub ids: Vec<i64>,
    #[schemars(schema_with = "any_schema")]
    pub values: Value,
    #[schemars(schema_with = "any_schema")]
    pub context: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct DeleteArgs {
    pub instance: String,
    pub model: String,
    pub ids: Vec<i64>,
    #[schemars(schema_with = "any_schema")]
    pub context: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct ExecuteArgs {
    pub instance: String,
    pub model: String,
    pub method: String,
    #[schemars(schema_with = "any_schema")]
    pub args: Option<Value>,
    #[schemars(schema_with = "any_schema")]
    pub kwargs: Option<Value>,
    #[schemars(schema_with = "any_schema")]
    pub context: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct CountArgs {
    pub instance: String,
    pub model: String,
    #[schemars(schema_with = "any_schema")]
    pub domain: Option<Value>,
    #[schemars(schema_with = "any_schema")]
    pub context: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct WorkflowArgs {
    pub instance: String,
    pub model: String,
    pub ids: Vec<i64>,
    pub action: String,
    #[schemars(schema_with = "any_schema")]
    pub context: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct ReportArgs {
    pub instance: String,
    #[serde(rename = "reportName")]
    pub report_name: String,
    pub ids: Vec<i64>,
    #[schemars(schema_with = "any_schema")]
    pub data: Option<Value>,
    #[schemars(schema_with = "any_schema")]
    pub context: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct ModelMetadataArgs {
    pub instance: String,
    pub model: String,
    #[schemars(schema_with = "any_schema")]
    pub context: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct DatabaseCleanupArgs {
    pub instance: String,
    #[serde(rename = "removeTestData")]
    pub remove_test_data: Option<bool>,
    #[serde(rename = "removeInactivRecords")]
    pub remove_inactiv_records: Option<bool>,
    #[serde(rename = "cleanupDrafts")]
    pub cleanup_drafts: Option<bool>,
    #[serde(rename = "archiveOldRecords")]
    pub archive_old_records: Option<bool>,
    #[serde(rename = "optimizeDatabase")]
    pub optimize_database: Option<bool>,
    #[serde(rename = "daysThreshold")]
    pub days_threshold: Option<i64>,
    #[serde(rename = "dryRun")]
    pub dry_run: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct DeepCleanupArgs {
    pub instance: String,
    #[serde(rename = "dryRun")]
    pub dry_run: Option<bool>,
    #[serde(rename = "keepCompanyDefaults")]
    pub keep_company_defaults: Option<bool>,
    #[serde(rename = "keepUserAccounts")]
    pub keep_user_accounts: Option<bool>,
    #[serde(rename = "keepMenus")]
    pub keep_menus: Option<bool>,
    #[serde(rename = "keepGroups")]
    pub keep_groups: Option<bool>,
}

fn any_schema(_: &mut schemars::r#gen::SchemaGenerator) -> schemars::schema::Schema {
    schemars::schema::Schema::Bool(true)
}

pub fn tool_defs(enable_cleanup_tools: bool) -> Vec<Value> {
    let mut tools = vec![
        json!({
            "name": "odoo_search",
            "description": "Search for Odoo records with domain filters. Returns record IDs matching the criteria.",
            "inputSchema": schema_for!(SearchArgs).schema,
        }),
        json!({
            "name": "odoo_search_read",
            "description": "Search and read Odoo records in one operation. Returns full record data.",
            "inputSchema": schema_for!(SearchArgs).schema,
        }),
        json!({
            "name": "odoo_read",
            "description": "Read specific Odoo records by IDs. Returns detailed field values.",
            "inputSchema": schema_for!(ReadArgs).schema,
        }),
        json!({
            "name": "odoo_create",
            "description": "Create a new Odoo record. Returns the ID of the created record.",
            "inputSchema": schema_for!(CreateArgs).schema,
        }),
        json!({
            "name": "odoo_update",
            "description": "Update existing Odoo records. Returns true on success.",
            "inputSchema": schema_for!(UpdateArgs).schema,
        }),
        json!({
            "name": "odoo_delete",
            "description": "Delete Odoo records. Returns true on success. Use with caution!",
            "inputSchema": schema_for!(DeleteArgs).schema,
        }),
        json!({
            "name": "odoo_execute",
            "description": "Execute arbitrary method on Odoo model. For advanced operations and custom methods.",
            "inputSchema": schema_for!(ExecuteArgs).schema,
        }),
        json!({
            "name": "odoo_count",
            "description": "Count records matching domain filters. Returns the total count.",
            "inputSchema": schema_for!(CountArgs).schema,
        }),
        json!({
            "name": "odoo_workflow_action",
            "description": "Execute workflow action/button on records (e.g., confirm sale order, post invoice).",
            "inputSchema": schema_for!(WorkflowArgs).schema,
        }),
        json!({
            "name": "odoo_generate_report",
            "description": "Generate PDF report for records. Returns base64-encoded PDF.",
            "inputSchema": schema_for!(ReportArgs).schema,
        }),
        json!({
            "name": "odoo_get_model_metadata",
            "description": "Get model metadata including field definitions, types, and relationships.",
            "inputSchema": schema_for!(ModelMetadataArgs).schema,
        }),
    ];

    if enable_cleanup_tools {
        tools.push(json!({
            "name": "odoo_database_cleanup",
            "description": "Comprehensive database cleanup for production readiness. IMPORTANT: Use dryRun=true to preview changes first!",
            "inputSchema": schema_for!(DatabaseCleanupArgs).schema
        }));
        tools.push(json!({
            "name": "odoo_deep_cleanup",
            "description": "DESTRUCTIVE: Remove ALL non-essential data. ALWAYS use dryRun=true first!",
            "inputSchema": schema_for!(DeepCleanupArgs).schema
        }));
    }

    tools
}

pub async fn call_tool(pool: &OdooClientPool, name: &str, args: Value) -> Result<Value, OdooError> {
    match name {
        "odoo_search" => {
            let a: SearchArgs = serde_json::from_value(args)
                .map_err(|e| OdooError::InvalidResponse(format!("Invalid args for odoo_search: {e}")))?;
            let client = pool.get(&a.instance).await.map_err(|e| OdooError::InvalidResponse(e.to_string()))?;
            let ids = client
                .search(
                    &a.model,
                    a.domain,
                    a.limit,
                    a.offset,
                    a.order,
                    a.context,
                )
                .await?;
            Ok(json!({
                "content": [{ "type": "text", "text": serde_json::to_string_pretty(&json!({
                    "ids": ids,
                    "count": ids.len(),
                })).unwrap_or_else(|_| "{}".to_string()) }]
            }))
        }
        "odoo_search_read" => {
            let a: SearchArgs = serde_json::from_value(args)
                .map_err(|e| OdooError::InvalidResponse(format!("Invalid args for odoo_search_read: {e}")))?;
            let client = pool.get(&a.instance).await.map_err(|e| OdooError::InvalidResponse(e.to_string()))?;
            let records = client
                .search_read(
                    &a.model,
                    a.domain,
                    a.fields,
                    a.limit,
                    a.offset,
                    a.order,
                    a.context,
                )
                .await?;
            let count = records.as_array().map(|a| a.len()).unwrap_or(0);
            Ok(json!({
                "content": [{ "type": "text", "text": serde_json::to_string_pretty(&json!({
                    "records": records,
                    "count": count,
                })).unwrap_or_else(|_| "{}".to_string()) }]
            }))
        }
        "odoo_read" => {
            let a: ReadArgs = serde_json::from_value(args)
                .map_err(|e| OdooError::InvalidResponse(format!("Invalid args for odoo_read: {e}")))?;
            let client = pool.get(&a.instance).await.map_err(|e| OdooError::InvalidResponse(e.to_string()))?;
            let records = client.read(&a.model, a.ids, a.fields, a.context).await?;
            Ok(json!({
                "content": [{ "type": "text", "text": serde_json::to_string_pretty(&json!({
                    "records": records,
                })).unwrap_or_else(|_| "{}".to_string()) }]
            }))
        }
        "odoo_create" => {
            let a: CreateArgs = serde_json::from_value(args)
                .map_err(|e| OdooError::InvalidResponse(format!("Invalid args for odoo_create: {e}")))?;
            let client = pool.get(&a.instance).await.map_err(|e| OdooError::InvalidResponse(e.to_string()))?;
            let id = client.create(&a.model, a.values, a.context).await?;
            Ok(json!({
                "content": [{ "type": "text", "text": serde_json::to_string_pretty(&json!({
                    "id": id,
                    "success": true,
                })).unwrap_or_else(|_| "{}".to_string()) }]
            }))
        }
        "odoo_update" => {
            let a: UpdateArgs = serde_json::from_value(args)
                .map_err(|e| OdooError::InvalidResponse(format!("Invalid args for odoo_update: {e}")))?;
            let client = pool.get(&a.instance).await.map_err(|e| OdooError::InvalidResponse(e.to_string()))?;
            let ok = client.write(&a.model, a.ids.clone(), a.values, a.context).await?;
            Ok(json!({
                "content": [{ "type": "text", "text": serde_json::to_string_pretty(&json!({
                    "success": ok,
                    "updated_count": a.ids.len(),
                })).unwrap_or_else(|_| "{}".to_string()) }]
            }))
        }
        "odoo_delete" => {
            let a: DeleteArgs = serde_json::from_value(args)
                .map_err(|e| OdooError::InvalidResponse(format!("Invalid args for odoo_delete: {e}")))?;
            let client = pool.get(&a.instance).await.map_err(|e| OdooError::InvalidResponse(e.to_string()))?;
            let ok = client.unlink(&a.model, a.ids.clone(), a.context).await?;
            Ok(json!({
                "content": [{ "type": "text", "text": serde_json::to_string_pretty(&json!({
                    "success": ok,
                    "deleted_count": a.ids.len(),
                })).unwrap_or_else(|_| "{}".to_string()) }]
            }))
        }
        "odoo_count" => {
            let a: CountArgs = serde_json::from_value(args)
                .map_err(|e| OdooError::InvalidResponse(format!("Invalid args for odoo_count: {e}")))?;
            let client = pool.get(&a.instance).await.map_err(|e| OdooError::InvalidResponse(e.to_string()))?;
            let count = client.search_count(&a.model, a.domain, a.context).await?;
            Ok(json!({
                "content": [{ "type": "text", "text": serde_json::to_string_pretty(&json!({
                    "count": count,
                })).unwrap_or_else(|_| "{}".to_string()) }]
            }))
        }
        "odoo_workflow_action" => {
            let a: WorkflowArgs = serde_json::from_value(args)
                .map_err(|e| OdooError::InvalidResponse(format!("Invalid args for odoo_workflow_action: {e}")))?;
            let client = pool.get(&a.instance).await.map_err(|e| OdooError::InvalidResponse(e.to_string()))?;
            // JSON-2 uses named args; call action with ids.
            let params = serde_json::Map::new();
            let result = client
                .call_named(&a.model, &a.action, Some(a.ids.clone()), params, a.context)
                .await?;
            Ok(json!({
                "content": [{ "type": "text", "text": serde_json::to_string_pretty(&json!({
                    "result": result,
                    "executed_on": a.ids,
                })).unwrap_or_else(|_| "{}".to_string()) }]
            }))
        }
        "odoo_execute" => {
            let a: ExecuteArgs = serde_json::from_value(args)
                .map_err(|e| OdooError::InvalidResponse(format!("Invalid args for odoo_execute: {e}")))?;
            let client = pool.get(&a.instance).await.map_err(|e| OdooError::InvalidResponse(e.to_string()))?;

            // Best-effort JSON-2 mapping:
            // - If args looks like [[1,2,3]] then treat it as ids (common TS execute_kw usage).
            // - If kwargs is an object, merge into body params.
            // - If args is an object, merge into body params.
            // - Otherwise, include args under "args" key (method must accept it).
            let mut params = serde_json::Map::new();

            let mut ids: Option<Vec<i64>> = None;
            if let Some(v) = a.args.clone() {
                match v {
                    Value::Array(arr) => {
                        if arr.len() == 1 {
                            if let Some(Value::Array(inner)) = arr.get(0) {
                                let maybe_ids: Option<Vec<i64>> = inner
                                    .iter()
                                    .map(|x| x.as_i64())
                                    .collect::<Option<Vec<_>>>();
                                if maybe_ids.is_some() {
                                    ids = maybe_ids;
                                } else {
                                    params.insert("args".to_string(), Value::Array(arr));
                                }
                            } else {
                                params.insert("args".to_string(), Value::Array(arr));
                            }
                        } else {
                            params.insert("args".to_string(), Value::Array(arr));
                        }
                    }
                    Value::Object(map) => {
                        for (k, v) in map {
                            params.insert(k, v);
                        }
                    }
                    other => {
                        params.insert("arg".to_string(), other);
                    }
                }
            }

            if let Some(Value::Object(map)) = a.kwargs {
                for (k, v) in map {
                    params.insert(k, v);
                }
            } else if let Some(v) = a.kwargs {
                params.insert("kwargs".to_string(), v);
            }

            let result = client
                .call_named(&a.model, &a.method, ids, params, a.context)
                .await?;

            Ok(json!({
                "content": [{ "type": "text", "text": serde_json::to_string_pretty(&json!({
                    "result": result
                })).unwrap_or_else(|_| "{}".to_string()) }]
            }))
        }
        "odoo_get_model_metadata" => {
            let a: ModelMetadataArgs = serde_json::from_value(args)
                .map_err(|e| OdooError::InvalidResponse(format!("Invalid args for odoo_get_model_metadata: {e}")))?;
            let client = pool.get(&a.instance).await.map_err(|e| OdooError::InvalidResponse(e.to_string()))?;

            let fields = client.fields_get(&a.model, a.context.clone()).await?;
            let domain = json!([[ "model", "=", a.model ]]);
            let info = client
                .search_read(
                    "ir.model",
                    Some(domain),
                    Some(vec!["name".to_string(), "model".to_string()]),
                    Some(1),
                    None,
                    None,
                    a.context,
                )
                .await?;

            let description = info
                .as_array()
                .and_then(|arr| arr.first())
                .and_then(|o| o.get("name"))
                .and_then(|v| v.as_str())
                .unwrap_or(&a.model)
                .to_string();

            Ok(json!({
                "content": [{ "type": "text", "text": serde_json::to_string_pretty(&json!({
                    "model": {
                        "name": a.model,
                        "description": description,
                        "fields": fields
                    }
                })).unwrap_or_else(|_| "{}".to_string()) }]
            }))
        }
        "odoo_generate_report" => {
            let a: ReportArgs = serde_json::from_value(args)
                .map_err(|e| OdooError::InvalidResponse(format!("Invalid args for odoo_generate_report: {e}")))?;
            let client = pool.get(&a.instance).await.map_err(|e| OdooError::InvalidResponse(e.to_string()))?;

            // Prefer the HTTP report controller (stable across versions).
            let pdf_bytes = client.download_report_pdf(&a.report_name, &a.ids).await?;
            let pdf_base64 = base64::engine::general_purpose::STANDARD.encode(pdf_bytes);

            Ok(json!({
                "content": [{ "type": "text", "text": serde_json::to_string_pretty(&json!({
                    "pdf_base64": pdf_base64,
                    "report_name": a.report_name,
                    "record_ids": a.ids,
                })).unwrap_or_else(|_| "{}".to_string()) }]
            }))
        }
        "odoo_database_cleanup" => {
            let a: DatabaseCleanupArgs = serde_json::from_value(args)
                .map_err(|e| OdooError::InvalidResponse(format!("Invalid args for odoo_database_cleanup: {e}")))?;
            let client = pool.get(&a.instance).await.map_err(|e| OdooError::InvalidResponse(e.to_string()))?;
            let report = cleanup::database::execute_full_cleanup(
                &client,
                cleanup::database::CleanupOptions {
                    remove_test_data: a.remove_test_data,
                    remove_inactive_records: a.remove_inactiv_records,
                    cleanup_drafts: a.cleanup_drafts,
                    archive_old_records: a.archive_old_records,
                    optimize_database: a.optimize_database,
                    days_threshold: a.days_threshold,
                    dry_run: a.dry_run,
                },
            )
            .await?;
            Ok(json!({
                "content": [{ "type": "text", "text": serde_json::to_string_pretty(&report).unwrap_or_else(|_| "{}".to_string()) }]
            }))
        }
        "odoo_deep_cleanup" => {
            let a: DeepCleanupArgs = serde_json::from_value(args)
                .map_err(|e| OdooError::InvalidResponse(format!("Invalid args for odoo_deep_cleanup: {e}")))?;
            let client = pool.get(&a.instance).await.map_err(|e| OdooError::InvalidResponse(e.to_string()))?;
            let report = cleanup::deep::execute_deep_cleanup(
                &client,
                cleanup::deep::DeepCleanupOptions {
                    dry_run: Some(a.dry_run.unwrap_or(true)),
                    keep_company_defaults: a.keep_company_defaults,
                    keep_user_accounts: a.keep_user_accounts,
                    keep_menus: a.keep_menus,
                    keep_groups: a.keep_groups,
                },
            )
            .await?;
            Ok(json!({
                "content": [{ "type": "text", "text": serde_json::to_string_pretty(&report).unwrap_or_else(|_| "{}".to_string()) }]
            }))
        }
        _ => Err(OdooError::InvalidResponse(format!("Unknown tool: {name}"))),
    }
}

