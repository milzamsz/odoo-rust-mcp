from odoo.tests import TransactionCase, tagged


@tagged("post_install", "-at_install")
class TestWriteVersion(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.partner = cls.env["res.partner"].create({"name": "Version Partner"})
        cls.order = cls.env["sale.order"].create({"partner_id": cls.partner.id})
        cls.Mutation = cls.env["oc.mcp.mutation"]

    def _update(self, expected, reference):
        return self.Mutation.update_allowed_draft_fields(
            "sale.order", self.order.id, expected, {"client_reference": reference}, self.order.company_id.id
        )

    def _same_second_concurrent_edit(self):
        # A concurrent transaction inside the same second: only microseconds differ.
        self.env.flush_all()
        self.env.cr.execute(
            "UPDATE sale_order SET write_date = write_date + interval '1 microsecond' WHERE id = %s",
            [self.order.id],
        )
        self.order.invalidate_recordset(["write_date", "oc_mcp_write_version"])

    def test_version_has_microseconds_and_matches_write_date(self):
        version = self.order.oc_mcp_write_version
        self.assertRegex(version, r"^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{6}$")
        self.assertTrue(version.startswith(self.order.write_date.strftime("%Y-%m-%d %H:%M:%S")))

    def test_precise_token_detects_same_second_edit(self):
        token = self.order.oc_mcp_write_version
        self._same_second_concurrent_edit()
        result = self._update(token, "late")
        self.assertEqual(result["status"], "conflict")
        self.assertFalse(self.order.client_order_ref)

    def test_seconds_token_cannot_see_same_second_edit(self):
        # Documents the legacy whole-second behavior the precise token closes.
        seconds = self.order.write_date.strftime("%Y-%m-%d %H:%M:%S")
        self._same_second_concurrent_edit()
        self.assertEqual(self._update(seconds, "legacy")["status"], "updated")

    def test_precise_token_updates_and_returns_next_token(self):
        token = self.order.oc_mcp_write_version
        result = self._update(token, "fresh")
        self.assertEqual(result["status"], "updated")
        self.assertEqual(self.order.client_order_ref, "fresh")
        self.assertRegex(result["write_version"], r"\.\d{6}$")
        self.order.invalidate_recordset(["oc_mcp_write_version"])
        self.assertEqual(result["write_version"], self.order.oc_mcp_write_version)

    def test_account_move_exposes_version(self):
        move = self.env["account.move"].create({"move_type": "entry"})
        self.assertRegex(move.oc_mcp_write_version, r"\.\d{6}$")
