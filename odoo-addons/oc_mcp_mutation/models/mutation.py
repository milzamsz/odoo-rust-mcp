from odoo import api, fields, models
from odoo.exceptions import ValidationError


def _precise(write_date):
    return write_date.isoformat(sep=" ", timespec="microseconds")


def _version_matches(write_date, expected):
    """Compare a full-precision version token, or fall back to whole seconds."""
    # Odoo's APIs serialize write_date to whole seconds, which cannot see a second
    # edit within the same second; the precise token comes from oc_mcp_write_version.
    if "." in expected:
        return _precise(write_date) == expected
    return fields.Datetime.to_string(write_date) == expected


def _write_versions(cr, table, ids):
    # Table names come only from the fixed _POLICIES/_VERSIONED_TABLES maps, never from input.
    cr.execute(f"SELECT id, write_date FROM {table} WHERE id IN %s", [tuple(ids)])
    return {row_id: _precise(write_date) for row_id, write_date in cr.fetchall() if write_date}


class WriteVersionMixin(models.AbstractModel):
    _name = "oc.mcp.write.version.mixin"
    _description = "Full-precision write version for guarded draft updates"

    oc_mcp_write_version = fields.Char(
        compute="_compute_oc_mcp_write_version",
        help="write_date with microseconds; pass it as expected_write_date to the guarded update.",
    )

    def _compute_oc_mcp_write_version(self):
        stored = self.filtered("id")
        self.flush_model(["write_date"])
        versions = _write_versions(self.env.cr, self._table, stored.ids) if stored else {}
        for record in self:
            record.oc_mcp_write_version = versions.get(record.id, False)


class SaleOrder(models.Model):
    _name = "sale.order"
    _inherit = ["sale.order", "oc.mcp.write.version.mixin"]


class AccountMove(models.Model):
    _name = "account.move"
    _inherit = ["account.move", "oc.mcp.write.version.mixin"]


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
        if not _version_matches(write_date, expected_write_date):
            return {"status": "conflict", "reason": "record changed after preview"}

        values = {
            policy["fields"][name]: value if value is not None else False
            for name, value in changes.items()
        }
        record = self.env[model].browse(record_id).with_company(company_id)
        # ORM write applies ACLs, record rules, and model constraints on every
        # supported Odoo version; the row lock above only adds atomicity.
        record.write(values)
        record.flush_recordset()
        return {
            "status": "updated",
            "id": record.id,
            "company_id": record.company_id.id,
            "state": record.state,
            "write_date": fields.Datetime.to_string(record.write_date),
            "write_version": _write_versions(self.env.cr, policy["table"], record.ids)[record.id],
        }
