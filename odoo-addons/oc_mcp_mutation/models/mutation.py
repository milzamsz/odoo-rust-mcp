from odoo import api, fields, models
from odoo.exceptions import ValidationError


class ControlledMutation(models.AbstractModel):
    _name = "oc.mcp.mutation"
    _description = "Atomic controlled mutation boundary"

    _POLICIES = {
        "sale.order": {
            "table": "sale_order",
            "group": "sales_team.group_sale_salesman",
            "fields": {
                "validity_date": "validity_date",
                "client_reference": "client_order_ref",
                "payment_term_id": "payment_term_id",
            },
        },
        "account.move": {
            "table": "account_move",
            "group": "account.group_account_invoice",
            "fields": {
                "invoice_date": "invoice_date",
                "due_date": "invoice_date_due",
                "payment_term_id": "invoice_payment_term_id",
                "vendor_reference": "ref",
            },
        },
    }

    @api.model
    def update_allowed_draft_fields(
        self, model, record_id, expected_write_date, changes, company_id
    ):
        policy = self._POLICIES.get(model)
        if not policy or not isinstance(changes, dict) or not changes:
            raise ValidationError("unsupported model or empty changes")
        unknown = set(changes) - set(policy["fields"])
        if unknown:
            raise ValidationError("unsupported draft field")
        if not self.env.user.has_group(policy["group"]):
            return {
                "status": "denied",
                "reason": "the caller lacks the required business role",
            }

        # Atomicity requires locking the exact row before checking its version.
        self.env.cr.execute(
            f"SELECT company_id, state, write_date FROM {policy['table']} WHERE id = %s FOR UPDATE",
            [record_id],
        )
        observed = self.env.cr.fetchone()
        if not observed:
            return {"status": "conflict", "reason": "record not found"}
        observed_company, state, write_date = observed
        if observed_company != company_id:
            return {
                "status": "denied",
                "reason": "record is outside the approved company",
            }
        if state != "draft":
            return {"status": "conflict", "reason": "record is no longer draft"}
        if fields.Datetime.to_string(write_date) != expected_write_date:
            return {"status": "conflict", "reason": "record changed after preview"}

        values = {
            policy["fields"][name]: value if value is not None else False
            for name, value in changes.items()
        }
        record = self.env[model].browse(record_id).with_company(company_id)
        # ORM write applies ACLs, record rules, and model constraints on every
        # supported Odoo version; the row lock above only adds atomicity.
        record.write(values)
        return {
            "status": "updated",
            "id": record.id,
            "company_id": record.company_id.id,
            "state": record.state,
            "write_date": fields.Datetime.to_string(record.write_date),
        }
