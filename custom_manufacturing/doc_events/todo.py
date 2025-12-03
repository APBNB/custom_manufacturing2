"""ToDo safeguards."""

from __future__ import annotations

import frappe


def validate(doc, _method: str | None = None) -> None:
	"""Prevent closing ToDo when linked maintenance is not submitted."""
	if (
		doc.reference_type == "Machine Maintenance"
		and doc.reference_name
		and doc.status == "Closed"
	):
		status = frappe.db.get_value("Machine Maintenance", doc.reference_name, "docstatus")
		# docstatus 1 = Submitted
		if status != 1:
			frappe.throw(
				"Cannot close this task until the linked Machine Maintenance is submitted.",
				title="Validation",
			)
