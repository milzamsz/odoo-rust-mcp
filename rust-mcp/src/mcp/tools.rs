use std::collections::HashMap;
use std::sync::Arc;

use base64::Engine;
use schemars::JsonSchema;
use schemars::schema::{InstanceType, Schema, SchemaObject, SingleOrVec};
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
    #[schemars(schema_with = "domain_schema")]
    #[serde(default)]
    pub domain: Value,
    #[schemars(schema_with = "string_array_schema")]
    pub fields: Option<Vec<String>>,
    #[schemars(schema_with = "int_schema")]
    pub limit: Option<i64>,
    #[schemars(schema_with = "int_schema")]
    pub offset: Option<i64>,
    #[schemars(schema_with = "string_schema")]
    pub order: Option<String>,
    #[schemars(schema_with = "context_schema")]
    #[serde(default)]
    pub context: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct ReadArgs {
    pub instance: String,
    pub model: String,
    pub ids: Vec<i64>,
    #[schemars(schema_with = "string_array_schema")]
    pub fields: Option<Vec<String>>,
    #[schemars(schema_with = "context_schema")]
    #[serde(default)]
    pub context: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct CreateArgs {
    pub instance: String,
    pub model: String,
    #[schemars(schema_with = "object_schema")]
    pub values: Value,
    #[schemars(schema_with = "context_schema")]
    #[serde(default)]
    pub context: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct UpdateArgs {
    pub instance: String,
    pub model: String,
    pub ids: Vec<i64>,
    #[schemars(schema_with = "object_schema")]
    pub values: Value,
    #[schemars(schema_with = "context_schema")]
    #[serde(default)]
    pub context: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct DeleteArgs {
    pub instance: String,
    pub model: String,
    pub ids: Vec<i64>,
    #[schemars(schema_with = "context_schema")]
    #[serde(default)]
    pub context: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct ExecuteArgs {
    pub instance: String,
    pub model: String,
    pub method: String,
    #[schemars(schema_with = "array_schema")]
    #[serde(default)]
    pub args: Value,
    #[schemars(schema_with = "object_schema")]
    #[serde(default)]
    pub kwargs: Value,
    #[schemars(schema_with = "context_schema")]
    #[serde(default)]
    pub context: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct CountArgs {
    pub instance: String,
    pub model: String,
    #[schemars(schema_with = "domain_schema")]
    #[serde(default)]
    pub domain: Value,
    #[schemars(schema_with = "context_schema")]
    #[serde(default)]
    pub context: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct WorkflowArgs {
    pub instance: String,
    pub model: String,
    pub ids: Vec<i64>,
    pub action: String,
    #[schemars(schema_with = "context_schema")]
    #[serde(default)]
    pub context: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct ReportArgs {
    pub instance: String,
    #[serde(rename = "reportName")]
    pub report_name: String,
    pub ids: Vec<i64>,
    #[schemars(schema_with = "object_schema")]
    #[serde(default)]
    pub data: Value,
    #[schemars(schema_with = "context_schema")]
    #[serde(default)]
    pub context: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct ModelMetadataArgs {
    pub instance: String,
    pub model: String,
    #[schemars(schema_with = "context_schema")]
    #[serde(default)]
    pub context: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct DatabaseCleanupArgs {
    pub instance: String,
    #[serde(rename = "removeTestData")]
    #[schemars(schema_with = "bool_schema")]
    pub remove_test_data: Option<bool>,
    #[serde(rename = "removeInactivRecords")]
    #[schemars(schema_with = "bool_schema")]
    pub remove_inactiv_records: Option<bool>,
    #[serde(rename = "cleanupDrafts")]
    #[schemars(schema_with = "bool_schema")]
    pub cleanup_drafts: Option<bool>,
    #[serde(rename = "archiveOldRecords")]
    #[schemars(schema_with = "bool_schema")]
    pub archive_old_records: Option<bool>,
    #[serde(rename = "optimizeDatabase")]
    #[schemars(schema_with = "bool_schema")]
    pub optimize_database: Option<bool>,
    #[serde(rename = "daysThreshold")]
    #[schemars(schema_with = "int_schema")]
    pub days_threshold: Option<i64>,
    #[serde(rename = "dryRun")]
    #[schemars(schema_with = "bool_schema")]
    pub dry_run: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct DeepCleanupArgs {
    pub instance: String,
    #[serde(rename = "dryRun")]
    #[schemars(schema_with = "bool_schema")]
    pub dry_run: Option<bool>,
    #[serde(rename = "keepCompanyDefaults")]
    #[schemars(schema_with = "bool_schema")]
    pub keep_company_defaults: Option<bool>,
    #[serde(rename = "keepUserAccounts")]
    #[schemars(schema_with = "bool_schema")]
    pub keep_user_accounts: Option<bool>,
    #[serde(rename = "keepMenus")]
    #[schemars(schema_with = "bool_schema")]
    pub keep_menus: Option<bool>,
    #[serde(rename = "keepGroups")]
    #[schemars(schema_with = "bool_schema")]
    pub keep_groups: Option<bool>,
}

fn schema_with_type(t: InstanceType) -> Schema {
    Schema::Object(SchemaObject {
        instance_type: Some(SingleOrVec::Single(Box::new(t))),
        ..Default::default()
    })
}

fn string_schema(_: &mut schemars::r#gen::SchemaGenerator) -> Schema {
    schema_with_type(InstanceType::String)
}

fn int_schema(_: &mut schemars::r#gen::SchemaGenerator) -> Schema {
    schema_with_type(InstanceType::Integer)
}

fn bool_schema(_: &mut schemars::r#gen::SchemaGenerator) -> Schema {
    schema_with_type(InstanceType::Boolean)
}

fn string_array_schema(_: &mut schemars::r#gen::SchemaGenerator) -> Schema {
    schema_with_type(InstanceType::Array)
}

/// Odoo domain filters are always arrays (possibly nested).
/// We keep it permissive (no `items`) to avoid client schema parsers choking on boolean schemas.
fn domain_schema(_: &mut schemars::r#gen::SchemaGenerator) -> Schema {
    schema_with_type(InstanceType::Array)
}

/// Odoo context dict-like object.
fn context_schema(_: &mut schemars::r#gen::SchemaGenerator) -> Schema {
    schema_with_type(InstanceType::Object)
}

/// Generic JSON object (values/kwargs/data).
fn object_schema(_: &mut schemars::r#gen::SchemaGenerator) -> Schema {
    schema_with_type(InstanceType::Object)
}

/// Generic JSON array (args).
fn array_schema(_: &mut schemars::r#gen::SchemaGenerator) -> Schema {
    schema_with_type(InstanceType::Array)
}

// Cursor's MCP client can be picky about JSON Schema features (e.g. $ref/definitions/anyOf).
// We provide explicit inline schemas for tool inputs to avoid those issues.
fn schema_object(properties: Value, required: &[&str]) -> Value {
    json!({
        "type": "object",
        "properties": properties,
        "required": required,
        "additionalProperties": false
    })
}

fn schema_string() -> Value {
    json!({ "type": "string" })
}

fn schema_integer() -> Value {
    json!({ "type": "integer" })
}

fn schema_boolean() -> Value {
    json!({ "type": "boolean" })
}

fn schema_object_any() -> Value {
    json!({ "type": "object" })
}

fn schema_array_any() -> Value {
    json!({ "type": "array" })
}

fn schema_array_of(item: Value) -> Value {
    json!({ "type": "array", "items": item })
}

fn input_schema_search() -> Value {
    schema_object(
        json!({
            "instance": schema_string(),
            "model": schema_string(),
            "domain": schema_array_any(),
            "fields": schema_array_of(schema_string()),
            "limit": schema_integer(),
            "offset": schema_integer(),
            "order": schema_string(),
            "context": schema_object_any()
        }),
        &["instance", "model"],
    )
}

fn input_schema_read() -> Value {
    schema_object(
        json!({
            "instance": schema_string(),
            "model": schema_string(),
            "ids": schema_array_of(schema_integer()),
            "fields": schema_array_of(schema_string()),
            "context": schema_object_any()
        }),
        &["instance", "model", "ids"],
    )
}

fn input_schema_create() -> Value {
    schema_object(
        json!({
            "instance": schema_string(),
            "model": schema_string(),
            "values": schema_object_any(),
            "context": schema_object_any()
        }),
        &["instance", "model", "values"],
    )
}

fn input_schema_update() -> Value {
    schema_object(
        json!({
            "instance": schema_string(),
            "model": schema_string(),
            "ids": schema_array_of(schema_integer()),
            "values": schema_object_any(),
            "context": schema_object_any()
        }),
        &["instance", "model", "ids", "values"],
    )
}

fn input_schema_delete() -> Value {
    schema_object(
        json!({
            "instance": schema_string(),
            "model": schema_string(),
            "ids": schema_array_of(schema_integer()),
            "context": schema_object_any()
        }),
        &["instance", "model", "ids"],
    )
}

fn input_schema_execute() -> Value {
    schema_object(
        json!({
            "instance": schema_string(),
            "model": schema_string(),
            "method": schema_string(),
            "args": schema_array_any(),
            "kwargs": schema_object_any(),
            "context": schema_object_any()
        }),
        &["instance", "model", "method"],
    )
}

fn input_schema_count() -> Value {
    schema_object(
        json!({
            "instance": schema_string(),
            "model": schema_string(),
            "domain": schema_array_any(),
            "context": schema_object_any()
        }),
        &["instance", "model"],
    )
}

fn input_schema_workflow() -> Value {
    schema_object(
        json!({
            "instance": schema_string(),
            "model": schema_string(),
            "ids": schema_array_of(schema_integer()),
            "action": schema_string(),
            "context": schema_object_any()
        }),
        &["instance", "model", "ids", "action"],
    )
}

fn input_schema_report() -> Value {
    schema_object(
        json!({
            "instance": schema_string(),
            "reportName": schema_string(),
            "ids": schema_array_of(schema_integer()),
            "data": schema_object_any(),
            "context": schema_object_any()
        }),
        &["instance", "reportName", "ids"],
    )
}

fn input_schema_model_metadata() -> Value {
    schema_object(
        json!({
            "instance": schema_string(),
            "model": schema_string(),
            "context": schema_object_any()
        }),
        &["instance", "model"],
    )
}

fn input_schema_database_cleanup() -> Value {
    schema_object(
        json!({
            "instance": schema_string(),
            "removeTestData": schema_boolean(),
            "removeInactivRecords": schema_boolean(),
            "cleanupDrafts": schema_boolean(),
            "archiveOldRecords": schema_boolean(),
            "optimizeDatabase": schema_boolean(),
            "daysThreshold": schema_integer(),
            "dryRun": schema_boolean()
        }),
        &["instance"],
    )
}

fn input_schema_deep_cleanup() -> Value {
    schema_object(
        json!({
            "instance": schema_string(),
            "dryRun": schema_boolean(),
            "keepCompanyDefaults": schema_boolean(),
            "keepUserAccounts": schema_boolean(),
            "keepMenus": schema_boolean(),
            "keepGroups": schema_boolean()
        }),
        &["instance"],
    )
}

pub fn tool_defs(enable_cleanup_tools: bool) -> Vec<Value> {
    let mut tools = vec![
        json!({
            "name": "odoo_search",
            "description": "Search for Odoo records with domain filters. Returns record IDs matching the criteria.",
            "inputSchema": input_schema_search(),
        }),
        json!({
            "name": "odoo_search_read",
            "description": "Search and read Odoo records in one operation. Returns full record data.",
            "inputSchema": input_schema_search(),
        }),
        json!({
            "name": "odoo_read",
            "description": "Read specific Odoo records by IDs. Returns detailed field values.",
            "inputSchema": input_schema_read(),
        }),
        json!({
            "name": "odoo_create",
            "description": "Create a new Odoo record. Returns the ID of the created record.",
            "inputSchema": input_schema_create(),
        }),
        json!({
            "name": "odoo_update",
            "description": "Update existing Odoo records. Returns true on success.",
            "inputSchema": input_schema_update(),
        }),
        json!({
            "name": "odoo_delete",
            "description": "Delete Odoo records. Returns true on success. Use with caution!",
            "inputSchema": input_schema_delete(),
        }),
        json!({
            "name": "odoo_execute",
            "description": "Execute arbitrary method on Odoo model. For advanced operations and custom methods.",
            "inputSchema": input_schema_execute(),
        }),
        json!({
            "name": "odoo_count",
            "description": "Count records matching domain filters. Returns the total count.",
            "inputSchema": input_schema_count(),
        }),
        json!({
            "name": "odoo_workflow_action",
            "description": "Execute workflow action/button on records (e.g., confirm sale order, post invoice).",
            "inputSchema": input_schema_workflow(),
        }),
        json!({
            "name": "odoo_generate_report",
            "description": "Generate PDF report for records. Returns base64-encoded PDF.",
            "inputSchema": input_schema_report(),
        }),
        json!({
            "name": "odoo_get_model_metadata",
            "description": "Get model metadata including field definitions, types, and relationships.",
            "inputSchema": input_schema_model_metadata(),
        }),
    ];

    if enable_cleanup_tools {
        tools.push(json!({
            "name": "odoo_database_cleanup",
            "description": "Comprehensive database cleanup for production readiness. IMPORTANT: Use dryRun=true to preview changes first!",
            "inputSchema": input_schema_database_cleanup()
        }));
        tools.push(json!({
            "name": "odoo_deep_cleanup",
            "description": "DESTRUCTIVE: Remove ALL non-essential data. ALWAYS use dryRun=true first!",
            "inputSchema": input_schema_deep_cleanup()
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
            let domain = (!a.domain.is_null()).then_some(a.domain);
            let context = (!a.context.is_null()).then_some(a.context);
            let ids = client
                .search(
                    &a.model,
                    domain,
                    a.limit,
                    a.offset,
                    a.order,
                    context,
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
            let domain = (!a.domain.is_null()).then_some(a.domain);
            let context = (!a.context.is_null()).then_some(a.context);
            let records = client
                .search_read(
                    &a.model,
                    domain,
                    a.fields,
                    a.limit,
                    a.offset,
                    a.order,
                    context,
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
            let context = (!a.context.is_null()).then_some(a.context);
            let records = client.read(&a.model, a.ids, a.fields, context).await?;
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
            let context = (!a.context.is_null()).then_some(a.context);
            let id = client.create(&a.model, a.values, context).await?;
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
            let context = (!a.context.is_null()).then_some(a.context);
            let ok = client.write(&a.model, a.ids.clone(), a.values, context).await?;
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
            let context = (!a.context.is_null()).then_some(a.context);
            let ok = client.unlink(&a.model, a.ids.clone(), context).await?;
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
            let domain = (!a.domain.is_null()).then_some(a.domain);
            let context = (!a.context.is_null()).then_some(a.context);
            let count = client.search_count(&a.model, domain, context).await?;
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
            let context = (!a.context.is_null()).then_some(a.context);
            // JSON-2 uses named args; call action with ids.
            let params = serde_json::Map::new();
            let result = client
                .call_named(&a.model, &a.action, Some(a.ids.clone()), params, context)
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
            if !a.args.is_null() {
                match a.args {
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

            if let Value::Object(map) = a.kwargs {
                for (k, v) in map {
                    params.insert(k, v);
                }
            } else if !a.kwargs.is_null() {
                let v = a.kwargs;
                params.insert("kwargs".to_string(), v);
            }

            let context = (!a.context.is_null()).then_some(a.context);
            let result = client
                .call_named(&a.model, &a.method, ids, params, context)
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
            let context = (!a.context.is_null()).then_some(a.context);

            let fields = client.fields_get(&a.model, context.clone()).await?;
            let domain = json!([[ "model", "=", a.model ]]);
            let info = client
                .search_read(
                    "ir.model",
                    Some(domain),
                    Some(vec!["name".to_string(), "model".to_string()]),
                    Some(1),
                    None,
                    None,
                    context,
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

