use std::collections::BTreeMap;

use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value, json};

use crate::odoo::types::{OdooError, OdooResult};
use crate::odoo::unified_client::OdooClient;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InventoryReversalLine {
    pub product_id: i64,
    pub location_id: i64,
    pub wrong_adjustment_qty: f64,
    pub source_stock_move_line_ids: Option<Vec<i64>>,
    pub note: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InventoryReversalOptions {
    pub lines: Vec<InventoryReversalLine>,
    pub dry_run: Option<bool>,
    pub confirm: Option<bool>,
    pub allow_negative: Option<bool>,
    pub reference: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InventoryReversalPlanLine {
    pub product_id: i64,
    pub product_name: String,
    pub location_id: i64,
    pub location_name: String,
    pub quant_id: Option<i64>,
    pub current_quantity: f64,
    pub reserved_quantity: f64,
    pub available_quantity: f64,
    pub wrong_adjustment_qty: f64,
    pub target_inventory_quantity: f64,
    pub projected_available_quantity: f64,
    pub source_stock_move_line_ids: Vec<i64>,
    pub status: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InventoryReversalReport {
    pub success: bool,
    pub timestamp: String,
    pub dry_run: bool,
    pub applied: bool,
    pub reference: String,
    pub total_input_lines: usize,
    pub total_plan_lines: usize,
    pub total_wrong_adjustment_qty: f64,
    pub applied_quant_ids: Vec<i64>,
    pub blocked_lines: Vec<InventoryReversalPlanLine>,
    pub planned_lines: Vec<InventoryReversalPlanLine>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone)]
struct AggregatedLine {
    product_id: i64,
    location_id: i64,
    wrong_adjustment_qty: f64,
    source_stock_move_line_ids: Vec<i64>,
}

pub async fn execute_stock_inventory_reversal(
    client: &OdooClient,
    options: InventoryReversalOptions,
) -> OdooResult<InventoryReversalReport> {
    if options.lines.is_empty() {
        return Err(OdooError::InvalidResponse(
            "At least one reversal line is required".to_string(),
        ));
    }

    let dry_run = options.dry_run.unwrap_or(true);
    let confirm = options.confirm.unwrap_or(false);
    let allow_negative = options.allow_negative.unwrap_or(false);
    let reference = options.reference.unwrap_or_else(|| {
        format!(
            "Reverse wrong inventory adjustment via MCP - {}",
            Utc::now().format("%Y-%m-%d")
        )
    });

    let aggregated = aggregate_lines(&options.lines)?;
    let mut planned_lines = Vec::new();
    let mut blocked_lines = Vec::new();
    let mut total_wrong_adjustment_qty = 0.0;

    for line in aggregated.values() {
        total_wrong_adjustment_qty += line.wrong_adjustment_qty;
        let plan_line = build_plan_line(client, line, allow_negative).await?;
        if plan_line.status == "blocked" {
            blocked_lines.push(plan_line.clone());
        }
        planned_lines.push(plan_line);
    }

    let mut warnings = Vec::new();
    if !blocked_lines.is_empty() {
        warnings.push(format!(
            "{} line(s) are blocked because reversal would make/keep stock negative or no matching quant was found",
            blocked_lines.len()
        ));
    }

    let mut applied_quant_ids = Vec::new();
    let can_apply = !dry_run && confirm;
    if !dry_run && !confirm {
        warnings.push("dryRun=false was requested, but confirm=true is required before applying inventory reversal".to_string());
    }

    if can_apply {
        for line in planned_lines.iter().filter(|line| line.status == "ready") {
            let quant_id = line.quant_id.ok_or_else(|| {
                OdooError::InvalidResponse(format!(
                    "Missing quant_id for product {} at location {}",
                    line.product_id, line.location_id
                ))
            })?;

            client
                .write(
                    "stock.quant",
                    vec![quant_id],
                    json!({
                        "inventory_quantity": line.target_inventory_quantity,
                        "inventory_quantity_set": true,
                    }),
                    Some(json!({
                        "inventory_name": reference,
                        "mcp_cleanup_reference": reference,
                    })),
                )
                .await?;

            client
                .call_named(
                    "stock.quant",
                    "action_apply_inventory",
                    Some(vec![quant_id]),
                    Map::new(),
                    Some(json!({
                        "inventory_name": reference,
                        "mcp_cleanup_reference": reference,
                    })),
                )
                .await?;
            applied_quant_ids.push(quant_id);
        }
    }

    Ok(InventoryReversalReport {
        success: blocked_lines.is_empty() || allow_negative,
        timestamp: Utc::now().to_rfc3339(),
        dry_run,
        applied: can_apply,
        reference,
        total_input_lines: options.lines.len(),
        total_plan_lines: planned_lines.len(),
        total_wrong_adjustment_qty,
        applied_quant_ids,
        blocked_lines,
        planned_lines,
        warnings,
    })
}

fn aggregate_lines(
    lines: &[InventoryReversalLine],
) -> OdooResult<BTreeMap<(i64, i64), AggregatedLine>> {
    let mut aggregated = BTreeMap::new();

    for line in lines {
        if line.product_id <= 0 || line.location_id <= 0 {
            return Err(OdooError::InvalidResponse(
                "productId and locationId must be positive Odoo IDs".to_string(),
            ));
        }
        if line.wrong_adjustment_qty <= 0.0 {
            return Err(OdooError::InvalidResponse(
                "wrongAdjustmentQty must be positive; the tool subtracts it from current stock"
                    .to_string(),
            ));
        }

        let entry = aggregated
            .entry((line.product_id, line.location_id))
            .or_insert_with(|| AggregatedLine {
                product_id: line.product_id,
                location_id: line.location_id,
                wrong_adjustment_qty: 0.0,
                source_stock_move_line_ids: Vec::new(),
            });
        entry.wrong_adjustment_qty += line.wrong_adjustment_qty;
        if let Some(ids) = &line.source_stock_move_line_ids {
            entry.source_stock_move_line_ids.extend(ids.iter().copied());
            entry.source_stock_move_line_ids.sort_unstable();
            entry.source_stock_move_line_ids.dedup();
        }
    }

    Ok(aggregated)
}

async fn build_plan_line(
    client: &OdooClient,
    line: &AggregatedLine,
    allow_negative: bool,
) -> OdooResult<InventoryReversalPlanLine> {
    let domain = json!([
        ["product_id", "=", line.product_id],
        ["location_id", "=", line.location_id],
        ["lot_id", "=", false],
        ["package_id", "=", false],
        ["owner_id", "=", false]
    ]);
    let records = client
        .search_read(
            "stock.quant",
            Some(domain),
            Some(vec![
                "id".to_string(),
                "product_id".to_string(),
                "location_id".to_string(),
                "quantity".to_string(),
                "reserved_quantity".to_string(),
                "available_quantity".to_string(),
            ]),
            Some(2),
            None,
            None,
            None,
        )
        .await?;

    let Some(records) = records.as_array() else {
        return Err(OdooError::InvalidResponse(
            "stock.quant search_read did not return an array".to_string(),
        ));
    };

    if records.len() != 1 {
        return Ok(InventoryReversalPlanLine {
            product_id: line.product_id,
            product_name: String::new(),
            location_id: line.location_id,
            location_name: String::new(),
            quant_id: None,
            current_quantity: 0.0,
            reserved_quantity: 0.0,
            available_quantity: 0.0,
            wrong_adjustment_qty: line.wrong_adjustment_qty,
            target_inventory_quantity: 0.0,
            projected_available_quantity: 0.0,
            source_stock_move_line_ids: line.source_stock_move_line_ids.clone(),
            status: "blocked".to_string(),
            message: format!(
                "Expected exactly one untracked quant for product {} at location {}, found {}",
                line.product_id,
                line.location_id,
                records.len()
            ),
        });
    }

    let record = &records[0];
    let quant_id = field_i64(record, "id")?;
    let current_quantity = field_f64(record, "quantity")?;
    let reserved_quantity = field_f64(record, "reserved_quantity")?;
    let available_quantity = field_f64(record, "available_quantity")?;
    let product_name = many2one_name(record, "product_id");
    let location_name = many2one_name(record, "location_id");
    let target_inventory_quantity = current_quantity - line.wrong_adjustment_qty;
    let projected_available_quantity = target_inventory_quantity - reserved_quantity;
    let blocked = target_inventory_quantity < 0.0 && !allow_negative;

    Ok(InventoryReversalPlanLine {
        product_id: line.product_id,
        product_name,
        location_id: line.location_id,
        location_name,
        quant_id: Some(quant_id),
        current_quantity,
        reserved_quantity,
        available_quantity,
        wrong_adjustment_qty: line.wrong_adjustment_qty,
        target_inventory_quantity,
        projected_available_quantity,
        source_stock_move_line_ids: line.source_stock_move_line_ids.clone(),
        status: if blocked { "blocked" } else { "ready" }.to_string(),
        message: if blocked {
            "Reversal would make or keep stock negative; set allowNegative=true only after business approval".to_string()
        } else {
            "Ready to apply inventory reversal".to_string()
        },
    })
}

fn field_i64(record: &Value, field: &str) -> OdooResult<i64> {
    record
        .get(field)
        .and_then(Value::as_i64)
        .ok_or_else(|| OdooError::InvalidResponse(format!("Missing integer field '{field}'")))
}

fn field_f64(record: &Value, field: &str) -> OdooResult<f64> {
    record
        .get(field)
        .and_then(Value::as_f64)
        .ok_or_else(|| OdooError::InvalidResponse(format!("Missing numeric field '{field}'")))
}

fn many2one_name(record: &Value, field: &str) -> String {
    record
        .get(field)
        .and_then(Value::as_array)
        .and_then(|items| items.get(1))
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn aggregate_lines_combines_duplicate_product_location() {
        let lines = vec![
            InventoryReversalLine {
                product_id: 1,
                location_id: 36,
                wrong_adjustment_qty: 10.0,
                source_stock_move_line_ids: Some(vec![100]),
                note: None,
            },
            InventoryReversalLine {
                product_id: 1,
                location_id: 36,
                wrong_adjustment_qty: 2.5,
                source_stock_move_line_ids: Some(vec![101, 100]),
                note: None,
            },
        ];

        let aggregated = aggregate_lines(&lines).unwrap();
        let line = aggregated.get(&(1, 36)).unwrap();

        assert_eq!(aggregated.len(), 1);
        assert_eq!(line.wrong_adjustment_qty, 12.5);
        assert_eq!(line.source_stock_move_line_ids, vec![100, 101]);
    }

    #[test]
    fn aggregate_lines_rejects_negative_qty() {
        let lines = vec![InventoryReversalLine {
            product_id: 1,
            location_id: 36,
            wrong_adjustment_qty: -1.0,
            source_stock_move_line_ids: None,
            note: None,
        }];

        assert!(aggregate_lines(&lines).is_err());
    }
}
