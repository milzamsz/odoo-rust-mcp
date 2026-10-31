pub mod database;
pub mod deep;
pub mod stock_inventory;

use serde_json::json;

use crate::odoo::types::OdooResult;
use crate::odoo::unified_client::OdooClient;

/// Cleanup lists models from optional modules (sale, purchase, crm, ...); callers skip absent ones.
pub(crate) async fn model_installed(client: &OdooClient, model: &str) -> OdooResult<bool> {
    let domain = json!([["model", "=", model]]);
    Ok(client.search_count("ir.model", Some(domain), None).await? > 0)
}
