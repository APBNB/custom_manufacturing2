"""Workstation hooks."""

from __future__ import annotations

import frappe
from frappe.utils import flt


ASSIGNEE = "harshal.choudhary@apbnb.com"


def on_update(doc, _method: str | None = None) -> None:
	"""When worked hours exceed the threshold, open a maintenance ticket + ToDo."""
	if not doc:
		return

	if flt(doc.custom_worked_hours or 0) <= flt(doc.custom_working_hours_before_replacement or 0):
		return

	existing = frappe.db.get_value(
		"Machine Maintenance",
		{"machine_name": doc.name, "docstatus": 0},
		["name", "maintenance_done"],
		as_dict=True,
	)

	if existing:
		# Skip if an open maintenance exists; allow reopening if it was completed and cancelled
		if existing.get("maintenance_done") != "Yes":
			return

	mm_doc = _ensure_machine_maintenance(doc.name)
	if not mm_doc:
		return

	_create_todo(mm_doc.name, doc.name)


def _ensure_machine_maintenance(workstation: str):
	"""Return an existing open Machine Maintenance or create a new one."""
	filters = {"machine_name": workstation, "docstatus": 0}
	existing = frappe.db.get_value("Machine Maintenance", filters, ["name"], as_dict=True)
	if existing:
		try:
			return frappe.get_doc("Machine Maintenance", existing.name)
		except Exception:
			return None

	doc = frappe.new_doc("Machine Maintenance")
	doc.machine_name = workstation
	doc.maintenance_done = "No"
	try:
		doc.insert(ignore_permissions=True)
		return doc
	except Exception:
		return None


def _create_todo(maintenance_name: str, workstation: str) -> None:
	"""Create a ToDo linked to the Machine Maintenance."""
	description = f"Blade change for the workstation required: {workstation}"
	fields = {
		"doctype": "ToDo",
		"allocated_to": ASSIGNEE,
		"reference_type": "Machine Maintenance",
		"reference_name": maintenance_name,
		"description": description,
		"priority": "Medium",
		"status": "Open",
	}

	try:
		existing = frappe.db.exists(
			"ToDo",
			{
				"reference_type": "Machine Maintenance",
				"reference_name": maintenance_name,
				"allocated_to": ASSIGNEE,
				"status": ("!=", "Cancelled"),
			},
		)
		if existing:
			return

		frappe.get_doc(fields).insert(ignore_permissions=True)
	except Exception:
		# Silently ignore ToDo creation failures to avoid blocking the save
		pass
