use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};

use chrono::{DateTime, Utc};
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value, json};
use sha2::{Digest, Sha256};

use crate::mcp::tools::OdooClientPool;
use crate::odoo::config::{OdooAuthMode, OdooProtocol};
use crate::odoo::types::{OdooError, OdooResult};

type HmacSha256 = Hmac<Sha256>;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct TargetCell {
    version: String,
    edition: String,
    protocol: String,
    auth_mode: String,
    environment: String,
    instance_id: String,
    database_ref: String,
    target_identity: String,
    company_id: i64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct Envelope {
    instance: String,
    capability: String,
    target: TargetCell,
    actor_ref: String,
    reviewer_ref: String,
    approval_ref: String,
    approval_decided_at: String,
    approval_expires_at: String,
    idempotency_key: String,
    payload_digest: String,
    correlation_id: String,
    audit_id: String,
    registry_revision: String,
    input: Value,
    signature: String,
}

struct Mutation {
    model: &'static str,
    values: Value,
    context: Value,
    verify_fields: Vec<String>,
}

pub async fn execute(pool: &OdooClientPool, args: Value) -> OdooResult<Value> {
    let envelope: Envelope = serde_json::from_value(args.clone())
        .map_err(|e| invalid(format!("invalid capability envelope: {e}")))?;
    let registry = validate_envelope(pool, &args, &envelope)?;

    let (state_path, created) = claim(&envelope)?;
    if !created {
        let output = load_existing(&state_path, &envelope)?;
        return validate_result(&registry, &envelope, output);
    }

    let client = pool
        .get(&envelope.instance)
        .await
        .map_err(|e| invalid(e.to_string()))?;
    if envelope.capability == "update_allowed_draft_fields.v1" {
        let input = envelope
            .input
            .as_object()
            .ok_or_else(|| invalid("capability input must be an object"))?;
        let context = json!({
            "allowed_company_ids": [envelope.target.company_id],
            "force_company": envelope.target.company_id,
        });
        let mut params = Map::new();
        for field in ["model", "record_id", "expected_write_date", "changes"] {
            params.insert(field.into(), input[field].clone());
        }
        params.insert("company_id".into(), json!(envelope.target.company_id));
        let response = match client
            .call_named(
                "oc.mcp.mutation",
                "update_allowed_draft_fields",
                None,
                params,
                Some(context),
            )
            .await
        {
            Ok(value) => value,
            Err(error) => {
                return validate_result(
                    &registry,
                    &envelope,
                    result(
                        &envelope,
                        "uncertain",
                        None,
                        "draft_write",
                        "uncertain",
                        Some(&format!("write outcome uncertain: {error}")),
                    ),
                );
            }
        };
        let status = response["status"].as_str().unwrap_or("conflict");
        let (record, verification, reason) = if status == "updated"
            && response["id"].as_i64().is_some()
            && response["company_id"] == envelope.target.company_id
            && response["state"] == "draft"
            && response["write_date"].as_str().is_some()
        {
            (
                Some((
                    input["model"].as_str().unwrap_or_default(),
                    response["id"].as_i64().unwrap_or_default(),
                )),
                "passed",
                None,
            )
        } else {
            (
                None,
                "not_run",
                response["reason"]
                    .as_str()
                    .or(Some("atomic update rejected")),
            )
        };
        let output_status = if record.is_some() {
            "updated"
        } else if status == "denied" {
            "denied"
        } else {
            "conflict"
        };
        let output = validate_result(
            &registry,
            &envelope,
            result(
                &envelope,
                output_status,
                record,
                "draft_write",
                verification,
                reason,
            ),
        )?;
        persist_completed(&state_path, &envelope, &output)?;
        return Ok(output);
    }

    let mutation = build_mutation(&envelope)?;
    let record_id = match client
        .create(
            mutation.model,
            mutation.values,
            Some(mutation.context.clone()),
        )
        .await
    {
        Ok(id) => id,
        Err(error) => {
            return validate_result(
                &registry,
                &envelope,
                result(
                    &envelope,
                    "uncertain",
                    None,
                    operation_class(&envelope.capability),
                    "uncertain",
                    Some(&format!("write outcome uncertain: {error}")),
                ),
            );
        }
    };

    let verified = client
        .read(
            mutation.model,
            vec![record_id],
            Some(mutation.verify_fields),
            Some(mutation.context),
        )
        .await;
    let verification = match verified {
        Ok(records) if verify_record(&envelope, &records) => "passed",
        _ => "failed",
    };
    let status = if verification == "passed" {
        "created"
    } else {
        "conflict"
    };
    let mut output = result(
        &envelope,
        status,
        Some((mutation.model, record_id)),
        operation_class(&envelope.capability),
        verification,
        (verification == "failed").then_some("created record failed postcondition"),
    );
    if verification == "failed" {
        output["receipt"]["status"] = json!("verification_failed");
    }
    let output = validate_result(&registry, &envelope, output)?;
    persist_completed(&state_path, &envelope, &output)?;
    Ok(output)
}

fn validate_envelope(pool: &OdooClientPool, raw: &Value, envelope: &Envelope) -> OdooResult<Value> {
    if envelope.actor_ref.trim().is_empty()
        || envelope.reviewer_ref.trim().is_empty()
        || envelope.actor_ref == envelope.reviewer_ref
        || envelope.approval_ref.trim().is_empty()
    {
        return Err(invalid(
            "approval must bind distinct non-empty actor and reviewer",
        ));
    }
    uuid::Uuid::parse_str(&envelope.correlation_id)
        .map_err(|_| invalid("correlation_id must be a UUID"))?;
    let decided = DateTime::parse_from_rfc3339(&envelope.approval_decided_at)
        .map_err(|_| invalid("approval_decided_at must be RFC3339"))?;
    let expires = DateTime::parse_from_rfc3339(&envelope.approval_expires_at)
        .map_err(|_| invalid("approval_expires_at must be RFC3339"))?;
    if decided >= expires || expires.with_timezone(&Utc) <= Utc::now() {
        return Err(invalid(
            "approval is expired or has an invalid decision window",
        ));
    }

    let registry_path = required_env("ODOO_CAPABILITY_REGISTRY")?;
    let registry_bytes = fs::read(&registry_path)
        .map_err(|e| invalid(format!("cannot read capability registry: {e}")))?;
    let revision = format!("sha256:{:x}", Sha256::digest(&registry_bytes));
    if envelope.registry_revision != revision {
        return Err(invalid("capability registry revision mismatch"));
    }
    let registry: Value = serde_json::from_slice(&registry_bytes)
        .map_err(|e| invalid(format!("invalid capability registry JSON: {e}")))?;
    validate_registry_target(pool, &registry, envelope)?;

    let schema = registry
        .pointer(&format!(
            "/capabilities/{}/input",
            envelope.capability.replace('~', "~0").replace('/', "~1")
        ))
        .ok_or_else(|| invalid("capability input schema is unavailable"))?;
    let validator = jsonschema::validator_for(schema)
        .map_err(|e| invalid(format!("invalid capability input schema: {e}")))?;
    if let Err(error) = validator.validate(&envelope.input) {
        return Err(invalid(format!("capability input rejected: {error}")));
    }
    if envelope
        .input
        .get("idempotency_key")
        .and_then(Value::as_str)
        != Some(&envelope.idempotency_key)
        || envelope.input.get("approval_id").and_then(Value::as_str) != Some(&envelope.approval_ref)
    {
        return Err(invalid("input approval/idempotency binding mismatch"));
    }
    let digest = format!("sha256:{:x}", Sha256::digest(canonical(&envelope.input)?));
    if digest != envelope.payload_digest {
        return Err(invalid("payload digest mismatch"));
    }

    let key = required_env("ODOO_CAPABILITY_APPROVAL_HMAC_KEY")?;
    if key.len() < 32 {
        return Err(invalid(
            "ODOO_CAPABILITY_APPROVAL_HMAC_KEY must be at least 32 bytes",
        ));
    }
    let signature = hex::decode(&envelope.signature)
        .map_err(|_| invalid("capability signature must be lowercase hexadecimal"))?;
    let mut unsigned = raw.clone();
    unsigned
        .as_object_mut()
        .ok_or_else(|| invalid("capability envelope must be an object"))?
        .remove("signature");
    let mut mac = HmacSha256::new_from_slice(key.as_bytes())
        .map_err(|_| invalid("invalid capability signing key"))?;
    mac.update(&canonical(&unsigned)?);
    mac.verify_slice(&signature)
        .map_err(|_| invalid("capability signature mismatch"))?;
    Ok(registry)
}

fn validate_result(registry: &Value, envelope: &Envelope, output: Value) -> OdooResult<Value> {
    let capability = envelope.capability.replace('~', "~0").replace('/', "~1");
    let schema = registry
        .pointer(&format!("/capabilities/{capability}/output"))
        .ok_or_else(|| invalid("capability output schema is unavailable"))?;
    let validator = jsonschema::validator_for(schema)
        .map_err(|e| invalid(format!("invalid capability output schema: {e}")))?;
    if let Err(error) = validator.validate(&output) {
        return Err(invalid(format!("capability output rejected: {error}")));
    }
    let receipt = output
        .get("receipt")
        .ok_or_else(|| invalid("capability output receipt is missing"))?;
    let receipt_schema = registry
        .get("capability_receipt")
        .ok_or_else(|| invalid("capability receipt schema is unavailable"))?;
    let validator = jsonschema::validator_for(receipt_schema)
        .map_err(|e| invalid(format!("invalid capability receipt schema: {e}")))?;
    if let Err(error) = validator.validate(receipt) {
        return Err(invalid(format!("capability receipt rejected: {error}")));
    }
    Ok(output)
}

fn validate_registry_target(
    pool: &OdooClientPool,
    registry: &Value,
    envelope: &Envelope,
) -> OdooResult<()> {
    let instance = registry
        .get("instances")
        .and_then(Value::as_array)
        .and_then(|items| items.iter().find(|item| item["id"] == envelope.instance))
        .ok_or_else(|| invalid("instance is absent from capability registry"))?;
    let odoo = &instance["odoo"];
    let expected = TargetCell {
        version: format!(
            "{}.0",
            odoo["expected_major_version"].as_i64().unwrap_or_default()
        ),
        edition: text(odoo, "edition")?,
        protocol: text(odoo, "protocol")?,
        auth_mode: text(odoo, "auth_mode")?,
        environment: text(instance, "environment")?,
        instance_id: envelope.instance.clone(),
        database_ref: text(odoo, "database_ref")?,
        target_identity: format!(
            "sha256:{:x}",
            Sha256::digest(
                format!(
                    "{}|{}|{}",
                    envelope.instance,
                    text(odoo, "database_ref")?,
                    text(odoo, "base_url")?
                )
                .as_bytes()
            )
        ),
        company_id: envelope.target.company_id,
    };
    if serde_json::to_value(&expected).ok() != serde_json::to_value(&envelope.target).ok()
        || envelope.target.environment == "production"
        || !instance["companies"]["allow"]
            .as_array()
            .is_some_and(|items| {
                items
                    .iter()
                    .any(|item| item["id"] == envelope.target.company_id)
            })
    {
        return Err(invalid(
            "target cell does not match the approved registry binding",
        ));
    }

    let contract = registry
        .pointer(&format!(
            "/capability_contract/capabilities/{}",
            envelope.capability.replace('~', "~0").replace('/', "~1")
        ))
        .ok_or_else(|| invalid("capability is absent from registry contract"))?;
    let cells = registry["capability_contract"]["cells"]
        .as_object()
        .ok_or_else(|| invalid("capability cells are unavailable"))?;
    let cell_id = cells
        .iter()
        .find(|(_, cell)| {
            cell["version"] == expected.version
                && cell["edition"] == expected.edition
                && cell["protocol"] == expected.protocol
                && cell["auth_mode"] == expected.auth_mode
        })
        .map(|(id, _)| id)
        .ok_or_else(|| invalid("target support cell is unavailable"))?;
    if contract["support"][cell_id][&expected.environment] != "approved" {
        return Err(invalid("capability is blocked for the target support cell"));
    }
    let modules = odoo["installed_modules"]
        .as_array()
        .cloned()
        .unwrap_or_default();
    if !contract["required_modules"]
        .as_array()
        .is_some_and(|required| required.iter().all(|item| modules.contains(item)))
        || !contract["models"].as_array().is_some_and(|models| {
            models.iter().all(|model| {
                model.as_str().is_some_and(|name| {
                    odoo["model_metadata_fingerprints"]
                        .get(name)
                        .and_then(Value::as_str)
                        .is_some_and(|value| !value.is_empty())
                })
            })
        })
    {
        return Err(invalid(
            "required module or model fingerprint evidence is missing",
        ));
    }

    let local = pool.instance_config(&envelope.instance)?;
    if local.read_only {
        return Err(invalid(
            "controlled capability is disabled for a read-only instance",
        ));
    }
    let local_protocol = match local.protocol {
        OdooProtocol::JsonRpc => "jsonrpc",
        OdooProtocol::Json2 => "json2",
        OdooProtocol::Auto => {
            return Err(invalid("controlled capability requires explicit protocol"));
        }
    };
    let local_auth = match local.auth_mode() {
        OdooAuthMode::Password => "username_password",
        OdooAuthMode::ApiKey => "api_key",
    };
    let local_database_ref = local.extra.get("databaseRef").and_then(Value::as_str);
    let expected_major = odoo["expected_major_version"]
        .as_i64()
        .unwrap_or_default()
        .to_string();
    if local.url.trim_end_matches('/') != text(odoo, "base_url")?.trim_end_matches('/')
        || local.version.as_deref().and_then(|v| v.split('.').next())
            != Some(expected_major.as_str())
        || local_protocol != expected.protocol
        || local_auth != expected.auth_mode
        || local_database_ref != Some(&expected.database_ref)
    {
        return Err(invalid(
            "live MCP instance configuration does not match target binding",
        ));
    }
    Ok(())
}

fn build_mutation(envelope: &Envelope) -> OdooResult<Mutation> {
    let input = envelope
        .input
        .as_object()
        .ok_or_else(|| invalid("capability input must be an object"))?;
    let company = envelope.target.company_id;
    let context = json!({"allowed_company_ids": [company], "force_company": company});
    match envelope.capability.as_str() {
        "create_crm_lead_draft.v1" => {
            let mut values = Map::new();
            values.insert("name".into(), json!(text_map(input, "title")?.trim()));
            values.insert("type".into(), json!("lead"));
            values.insert("company_id".into(), json!(company));
            for (target, source) in [
                ("partner_name", "organization"),
                ("contact_name", "contact_name"),
                ("email_from", "email"),
                ("phone", "phone"),
                ("description", "description"),
            ] {
                if let Some(value) = input.get(source).filter(|value| !value.is_null()) {
                    values.insert(target.into(), value.clone());
                }
            }
            Ok(Mutation {
                model: "crm.lead",
                values: Value::Object(values),
                context,
                verify_fields: fields(&["id", "company_id", "type"]),
            })
        }
        "create_quotation_draft.v1" => {
            let mut values = json!({
                "company_id": company,
                "partner_id": input["partner_id"],
                "currency_id": input["currency_id"],
                "pricelist_id": input["pricelist_id"],
                "state": "draft",
                "order_line": line_commands(input, true, &envelope.target.version)?,
            });
            optional_copy(&mut values, input, "payment_term_id", "payment_term_id");
            optional_copy(&mut values, input, "validity_date", "validity_date");
            optional_copy(&mut values, input, "client_order_ref", "client_reference");
            Ok(Mutation {
                model: "sale.order",
                values,
                context,
                verify_fields: fields(&["id", "company_id", "state"]),
            })
        }
        "prepare_vendor_bill_draft.v1" => {
            let mut values = json!({
                "move_type": "in_invoice",
                "partner_id": input["partner_id"],
                "currency_id": input["currency_id"],
                "invoice_date": input["invoice_date"],
                "ref": input["vendor_reference"],
                "company_id": company,
                "invoice_line_ids": line_commands(input, false, &envelope.target.version)?,
            });
            optional_copy(&mut values, input, "invoice_date_due", "due_date");
            optional_copy(
                &mut values,
                input,
                "invoice_payment_term_id",
                "payment_term_id",
            );
            let mut context = context;
            context["default_move_type"] = json!("in_invoice");
            Ok(Mutation {
                model: "account.move",
                values,
                context,
                verify_fields: fields(&["id", "company_id", "state", "move_type"]),
            })
        }
        "import_bank_transaction_draft.v1" => {
            let mut values = json!({
                "journal_id": input["journal_id"],
                "company_id": company,
                "date": input["transaction_date"],
                "payment_ref": input["payment_reference"],
                "amount": minor(input, "amount_minor")?,
            });
            optional_copy(&mut values, input, "partner_id", "partner_id");
            optional_copy(
                &mut values,
                input,
                "foreign_currency_id",
                "foreign_currency_id",
            );
            if !input["amount_currency_minor"].is_null() {
                values["amount_currency"] = json!(minor(input, "amount_currency_minor")?);
            }
            Ok(Mutation {
                model: "account.bank.statement.line",
                values,
                context,
                verify_fields: fields(&[
                    "id",
                    "company_id",
                    "journal_id",
                    "state",
                    "is_reconciled",
                ]),
            })
        }
        _ => Err(invalid("unsupported named mutation capability")),
    }
}

fn line_commands(input: &Map<String, Value>, quotation: bool, version: &str) -> OdooResult<Value> {
    let lines = input["lines"]
        .as_array()
        .ok_or_else(|| invalid("lines must be an array"))?;
    let mut commands = Vec::with_capacity(lines.len());
    for line in lines {
        let mut values = json!({
            "name": line["description"],
            "quantity": line["quantity_milli"].as_i64().unwrap_or_default() as f64 / 1000.0,
            "price_unit": line["unit_price_minor"].as_i64().unwrap_or_default() as f64 / 100.0,
            "tax_ids": [[6, 0, line["tax_ids"]]],
        });
        if quotation {
            values["product_id"] = line["product_id"].clone();
            if version != "19.0" {
                values["tax_id"] = values
                    .as_object_mut()
                    .and_then(|values| values.remove("tax_ids"))
                    .expect("line values contain tax_ids");
            }
            values[if version == "19.0" {
                "product_uom_id"
            } else {
                "product_uom"
            }] = line["uom_id"].clone();
            values["product_uom_qty"] = values
                .as_object_mut()
                .and_then(|values| values.remove("quantity"))
                .expect("line values contain quantity");
            values["discount"] =
                json!(line["discount_basis_points"].as_i64().unwrap_or_default() as f64 / 100.0);
        } else {
            values["account_id"] = line["account_id"].clone();
            optional_copy(
                &mut values,
                line.as_object().unwrap(),
                "product_id",
                "product_id",
            );
            optional_copy(
                &mut values,
                line.as_object().unwrap(),
                "product_uom_id",
                "uom_id",
            );
        }
        commands.push(json!([0, 0, values]));
    }
    Ok(Value::Array(commands))
}

fn verify_record(envelope: &Envelope, records: &Value) -> bool {
    let Some(record) = records.as_array().and_then(|items| items.first()) else {
        return false;
    };
    if relation_id(&record["company_id"]) != Some(envelope.target.company_id) {
        return false;
    }
    match envelope.capability.as_str() {
        "create_crm_lead_draft.v1" => record["type"] == "lead",
        "create_quotation_draft.v1" => record["state"] == "draft",
        "prepare_vendor_bill_draft.v1" => {
            record["state"] == "draft" && record["move_type"] == "in_invoice"
        }
        "import_bank_transaction_draft.v1" => {
            relation_id(&record["journal_id"]) == envelope.input["journal_id"].as_i64()
                && record["state"] == "posted"
                && record["is_reconciled"] == false
        }
        _ => false,
    }
}

fn result(
    envelope: &Envelope,
    status: &str,
    record: Option<(&str, i64)>,
    operation_class: &str,
    verification: &str,
    reason: Option<&str>,
) -> Value {
    let compensation_status = if envelope.capability == "import_bank_transaction_draft.v1"
        && matches!(status, "uncertain" | "verification_failed")
    {
        "manual_required"
    } else if verification == "passed" {
        "not_required"
    } else {
        "not_applicable"
    };
    let record_value = record.map(|(model, id)| json!({"model": model, "id": id}));
    let receipt = json!({
        "receipt_version": 1,
        "target_cell": envelope.target,
        "capability": envelope.capability,
        "operation_class": operation_class,
        "status": status,
        "actor_ref": envelope.actor_ref,
        "approval_ref": envelope.approval_ref,
        "approval_decided_at": envelope.approval_decided_at,
        "idempotency_key": envelope.idempotency_key,
        "payload_digest": envelope.payload_digest,
        "correlation_id": envelope.correlation_id,
        "audit_id": envelope.audit_id,
        "registry_revision": envelope.registry_revision,
        "record": record_value,
        "verification": {"status": verification, "checks": verification_checks(&envelope.capability)},
        "compensation": {
            "status": compensation_status,
            "owner_ref": envelope.input.get("correction_owner_ref").cloned().unwrap_or(Value::Null),
            "evidence_ref": envelope.input.get("evidence_refs").and_then(Value::as_array).and_then(|v| v.first()).cloned().unwrap_or(Value::Null),
        },
        "reason": reason,
    });
    let mut output = json!({
        "capability": envelope.capability,
        "status": status,
        "correlation_id": envelope.correlation_id,
        "operation_class": operation_class,
        "company_id": envelope.target.company_id,
        "payload_hash": envelope.payload_digest,
        "receipt": receipt,
    });
    if let Some((_, id)) = record {
        if envelope.capability == "create_crm_lead_draft.v1" {
            output["record"] = json!({"id": id, "state": "lead"});
        } else if envelope.capability == "create_quotation_draft.v1" {
            output["record"] = json!({"id": id, "state": "draft"});
        } else {
            output["record_id"] = json!(id);
        }
    }
    if let Some(reason) = reason {
        output["reason"] = json!(reason);
    }
    output
}

fn claim(envelope: &Envelope) -> OdooResult<(PathBuf, bool)> {
    let root = PathBuf::from(required_env("ODOO_CAPABILITY_STATE_DIR")?);
    fs::create_dir_all(&root)
        .map_err(|e| invalid(format!("cannot create state directory: {e}")))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&root, fs::Permissions::from_mode(0o700))
            .map_err(|e| invalid(format!("cannot secure state directory: {e}")))?;
    }
    let name = format!(
        "{:x}.json",
        Sha256::digest(envelope.idempotency_key.as_bytes())
    );
    let path = root.join(name);
    let created = match OpenOptions::new().write(true).create_new(true).open(&path) {
        Ok(mut file) => {
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                fs::set_permissions(&path, fs::Permissions::from_mode(0o600))
                    .map_err(|e| invalid(format!("cannot secure idempotency claim: {e}")))?;
            }
            let claim = serde_json::to_vec(&json!({
                "status": "executing",
                "capability": envelope.capability,
                "target_identity": envelope.target.target_identity,
                "payload_digest": envelope.payload_digest,
            }))
            .map_err(|e| invalid(e.to_string()))?;
            file.write_all(&claim)
                .and_then(|_| file.sync_all())
                .map_err(|e| invalid(format!("cannot persist idempotency claim: {e}")))?;
            true
        }
        Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => false,
        Err(error) => return Err(invalid(format!("cannot claim idempotency key: {error}"))),
    };
    Ok((path, created))
}

fn load_existing(path: &Path, envelope: &Envelope) -> OdooResult<Value> {
    let value: Value = serde_json::from_slice(
        &fs::read(path).map_err(|e| invalid(format!("cannot read idempotency state: {e}")))?,
    )
    .map_err(|e| invalid(format!("idempotency state is corrupt: {e}")))?;
    if value["capability"] != envelope.capability
        || value["target_identity"] != envelope.target.target_identity
        || value["payload_digest"] != envelope.payload_digest
    {
        return Ok(result(
            envelope,
            "conflict",
            None,
            operation_class(&envelope.capability),
            "not_run",
            Some("idempotency key is already bound to a different request"),
        ));
    }
    if value["status"] == "completed" {
        let mut output = value["output"].clone();
        output["status"] = json!("replay");
        output["receipt"]["status"] = json!("replay");
        return Ok(output);
    }
    Ok(result(
        envelope,
        "uncertain",
        None,
        operation_class(&envelope.capability),
        "uncertain",
        Some("prior execution did not persist a final outcome; do not retry automatically"),
    ))
}

fn persist_completed(path: &Path, envelope: &Envelope, output: &Value) -> OdooResult<()> {
    let tmp = path.with_extension("tmp");
    let bytes = serde_json::to_vec(&json!({
        "status": "completed",
        "capability": envelope.capability,
        "target_identity": envelope.target.target_identity,
        "payload_digest": envelope.payload_digest,
        "output": output,
    }))
    .map_err(|e| invalid(e.to_string()))?;
    fs::write(&tmp, bytes).map_err(|e| invalid(format!("cannot write final state: {e}")))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&tmp, fs::Permissions::from_mode(0o600))
            .map_err(|e| invalid(format!("cannot secure final state: {e}")))?;
    }
    fs::rename(&tmp, path).map_err(|e| invalid(format!("cannot commit final state: {e}")))?;
    if let Some(parent) = path.parent() {
        #[cfg(not(windows))]
        OpenOptions::new()
            .read(true)
            .open(parent)
            .and_then(|directory| directory.sync_all())
            .map_err(|e| invalid(format!("cannot sync final state: {e}")))?;
    }
    Ok(())
}

fn canonical(value: &Value) -> OdooResult<Vec<u8>> {
    serde_json::to_vec(value).map_err(|e| invalid(format!("cannot canonicalize JSON: {e}")))
}

fn required_env(name: &str) -> OdooResult<String> {
    std::env::var(name)
        .ok()
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| invalid(format!("{name} is required")))
}

fn invalid(message: impl Into<String>) -> OdooError {
    OdooError::InvalidResponse(message.into())
}

fn text(value: &Value, key: &str) -> OdooResult<String> {
    value[key]
        .as_str()
        .map(str::to_owned)
        .ok_or_else(|| invalid(format!("registry field '{key}' must be a string")))
}

fn text_map(value: &Map<String, Value>, key: &str) -> OdooResult<String> {
    value
        .get(key)
        .and_then(Value::as_str)
        .map(str::to_owned)
        .ok_or_else(|| invalid(format!("input field '{key}' must be a string")))
}

fn optional_copy(target: &mut Value, source: &Map<String, Value>, to: &str, from: &str) {
    if let Some(value) = source.get(from).filter(|value| !value.is_null()) {
        target[to] = value.clone();
    }
}

fn minor(input: &Map<String, Value>, key: &str) -> OdooResult<f64> {
    input[key]
        .as_i64()
        .map(|value| value as f64 / 100.0)
        .ok_or_else(|| invalid(format!("input field '{key}' must be integer minor units")))
}

fn fields(values: &[&str]) -> Vec<String> {
    values.iter().map(|value| (*value).to_owned()).collect()
}

fn relation_id(value: &Value) -> Option<i64> {
    value.as_i64().or_else(|| {
        value
            .as_array()
            .and_then(|items| items.first())
            .and_then(Value::as_i64)
    })
}

fn operation_class(capability: &str) -> &'static str {
    if capability == "import_bank_transaction_draft.v1" {
        "accounting_suspense_write"
    } else {
        "draft_write"
    }
}

fn verification_checks(capability: &str) -> Vec<&'static str> {
    match capability {
        "create_crm_lead_draft.v1" => vec!["company_id", "type=lead"],
        "create_quotation_draft.v1" => vec!["company_id", "state=draft"],
        "prepare_vendor_bill_draft.v1" => vec!["company_id", "state=draft", "move_type=in_invoice"],
        "import_bank_transaction_draft.v1" => {
            vec![
                "company_id",
                "journal_id",
                "state=posted",
                "is_reconciled=false",
            ]
        }
        "update_allowed_draft_fields.v1" => {
            vec!["company_id", "state=draft", "write_date_changed"]
        }
        _ => vec![],
    }
}

#[cfg(test)]
#[allow(clippy::await_holding_lock)] // The process environment requires serialized tests.
mod tests {
    use super::*;
    use std::collections::HashMap;
    use std::sync::Mutex;

    use tempfile::TempDir;
    use wiremock::{
        Mock, MockServer, ResponseTemplate,
        matchers::{method, path},
    };

    use crate::odoo::config::{OdooEnvConfig, OdooInstanceConfig};

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn canonical_envelope_matches_python_golden_vector() {
        let value = json!({
            "capability": "create_crm_lead_draft.v1",
            "input": {
                "approval_id": "approval-1",
                "idempotency_key": "crm-lead:v1:abc",
                "title": "Café"
            },
            "target": {"company_id": 7, "edition": "community", "version": "19.0"}
        });
        let bytes = canonical(&value).unwrap();
        let payload = canonical(&value["input"]).unwrap();
        assert_eq!(
            format!("{:x}", Sha256::digest(payload)),
            "0dcf327c165060451cff55a403057b7e6f1275425e74430c60451b5e0429a393"
        );
        let mut mac = HmacSha256::new_from_slice(b"0123456789abcdef0123456789abcdef").unwrap();
        mac.update(&bytes);
        assert_eq!(
            hex::encode(mac.finalize().into_bytes()),
            "852b02e20f3e8cb449a81c16456e2df4590c4086681cfaa535cc34cf572e3f5a"
        );
    }

    #[test]
    fn quotation_uom_field_tracks_odoo_version() {
        let input = json!({"lines": [{
            "product_id": 1, "uom_id": 2, "description": "x",
            "quantity_milli": 1000, "unit_price_minor": 100,
            "discount_basis_points": 0, "tax_ids": []
        }]});
        let input = input.as_object().unwrap();
        let old = line_commands(input, true, "18.0").unwrap();
        let new = line_commands(input, true, "19.0").unwrap();
        assert_eq!(old[0][2]["product_uom"], 2);
        assert!(old[0][2].get("product_uom_id").is_none());
        assert!(old[0][2].get("tax_id").is_some());
        assert!(old[0][2].get("tax_ids").is_none());
        assert_eq!(new[0][2]["product_uom_id"], 2);
        assert!(new[0][2].get("product_uom").is_none());
        assert!(new[0][2].get("tax_ids").is_some());
        assert!(new[0][2].get("tax_id").is_none());
    }

    struct EnvGuard(Vec<(&'static str, Option<String>)>);

    impl EnvGuard {
        fn set(values: &[(&'static str, String)]) -> Self {
            let old = values
                .iter()
                .map(|(key, value)| {
                    let old = std::env::var(key).ok();
                    // SAFETY: this test serializes its environment changes with ENV_LOCK.
                    unsafe { std::env::set_var(key, value) };
                    (*key, old)
                })
                .collect();
            Self(old)
        }
    }

    impl Drop for EnvGuard {
        fn drop(&mut self) {
            for (key, value) in &self.0 {
                // SAFETY: this test serializes its environment changes with ENV_LOCK.
                unsafe {
                    if let Some(value) = value {
                        std::env::set_var(key, value);
                    } else {
                        std::env::remove_var(key);
                    }
                }
            }
        }
    }

    #[tokio::test]
    async fn signed_capability_executes_once_and_replays_receipt() {
        let _lock = ENV_LOCK.lock().unwrap();
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/json/2/crm.lead/create"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!([42])))
            .expect(1)
            .mount(&server)
            .await;
        Mock::given(method("POST"))
            .and(path("/json/2/crm.lead/read"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!([{
                "id": 42, "company_id": [1, "Test"], "type": "lead"
            }])))
            .expect(1)
            .mount(&server)
            .await;

        let temp = TempDir::new().unwrap();
        let registry_path = temp.path().join("registry.json");
        let registry = json!({
            "instances": [{
                "id": "test", "environment": "staging",
                "companies": {"allow": [{"id": 1}]},
                "odoo": {
                    "expected_major_version": 19, "edition": "community",
                    "protocol": "json2", "auth_mode": "api_key",
                    "database_ref": "test-db", "base_url": server.uri(),
                    "installed_modules": ["crm"],
                    "model_metadata_fingerprints": {"crm.lead": "sha256:test"}
                }
            }],
            "capabilities": {"create_crm_lead_draft.v1": {
                "input": {
                    "type": "object", "additionalProperties": false,
                    "required": ["title", "organization", "contact_name", "email", "phone", "description", "evidence_ref", "idempotency_key", "approval_id"],
                    "properties": {
                        "title": {"type": "string"}, "organization": {}, "contact_name": {},
                        "email": {}, "phone": {}, "description": {}, "evidence_ref": {},
                        "idempotency_key": {"type": "string"}, "approval_id": {"type": "string"}
                    }
                },
                "output": {"type": "object"}
            }},
            "capability_receipt": {"type": "object"},
            "capability_contract": {
                "cells": {"odoo19-community": {
                    "version": "19.0", "edition": "community", "protocol": "json2", "auth_mode": "api_key"
                }},
                "capabilities": {"create_crm_lead_draft.v1": {
                    "required_modules": ["crm"], "models": ["crm.lead"],
                    "support": {"odoo19-community": {"staging": "approved"}}
                }}
            }
        });
        let registry_bytes = serde_json::to_vec(&registry).unwrap();
        fs::write(&registry_path, &registry_bytes).unwrap();
        let revision = format!("sha256:{:x}", Sha256::digest(&registry_bytes));
        let secret = "test-key-0123456789abcdef-0123456789abcdef";
        let _env = EnvGuard::set(&[
            (
                "ODOO_CAPABILITY_REGISTRY",
                registry_path.display().to_string(),
            ),
            ("ODOO_CAPABILITY_APPROVAL_HMAC_KEY", secret.to_string()),
            (
                "ODOO_CAPABILITY_STATE_DIR",
                temp.path().join("state").display().to_string(),
            ),
        ]);

        let mut extra = HashMap::new();
        extra.insert("databaseRef".into(), json!("test-db"));
        let mut instances = HashMap::new();
        instances.insert(
            "test".into(),
            OdooInstanceConfig {
                url: server.uri(),
                db: Some("test-db".into()),
                api_key: Some("key".into()),
                username: None,
                password: None,
                version: Some("19".into()),
                protocol: OdooProtocol::Json2,
                timeout_ms: Some(5000),
                max_retries: Some(2),
                tool_config: None,
                read_only: false,
                tags: vec![],
                aliases: vec![],
                extra,
            },
        );
        let pool = OdooClientPool::from_config(OdooEnvConfig { instances });
        let input = json!({
            "title": "Test lead", "organization": null, "contact_name": null,
            "email": null, "phone": null, "description": null,
            "evidence_ref": "test:evidence",
            "idempotency_key": format!("crm-lead:v1:{}", "1".repeat(64)),
            "approval_id": "approval-1"
        });
        let base_url = server.uri();
        let target_identity = format!(
            "sha256:{:x}",
            Sha256::digest(format!("test|test-db|{base_url}").as_bytes())
        );
        let now = Utc::now();
        let envelope = Envelope {
            instance: "test".into(),
            capability: "create_crm_lead_draft.v1".into(),
            target: TargetCell {
                version: "19.0".into(),
                edition: "community".into(),
                protocol: "json2".into(),
                auth_mode: "api_key".into(),
                environment: "staging".into(),
                instance_id: "test".into(),
                database_ref: "test-db".into(),
                target_identity,
                company_id: 1,
            },
            actor_ref: "requester".into(),
            reviewer_ref: "reviewer".into(),
            approval_ref: "approval-1".into(),
            approval_decided_at: (now - chrono::Duration::seconds(1)).to_rfc3339(),
            approval_expires_at: (now + chrono::Duration::minutes(5)).to_rfc3339(),
            idempotency_key: input["idempotency_key"].as_str().unwrap().into(),
            payload_digest: format!("sha256:{:x}", Sha256::digest(canonical(&input).unwrap())),
            correlation_id: uuid::Uuid::new_v4().to_string(),
            audit_id: "audit-1".into(),
            registry_revision: revision,
            input,
            signature: String::new(),
        };
        let mut value = serde_json::to_value(envelope).unwrap();
        let mut unsigned = value.clone();
        unsigned.as_object_mut().unwrap().remove("signature");
        let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).unwrap();
        mac.update(&canonical(&unsigned).unwrap());
        value["signature"] = json!(hex::encode(mac.finalize().into_bytes()));

        let first = execute(&pool, value.clone()).await.unwrap();
        assert_eq!(first["status"], "created");
        assert_eq!(first["receipt"]["verification"]["status"], "passed");
        let replay = execute(&pool, value.clone()).await.unwrap();
        assert_eq!(replay["status"], "replay");
        assert_eq!(replay["receipt"]["status"], "replay");

        value["actor_ref"] = json!("tampered");
        assert!(
            execute(&pool, value)
                .await
                .unwrap_err()
                .to_string()
                .contains("signature mismatch")
        );
    }
}
