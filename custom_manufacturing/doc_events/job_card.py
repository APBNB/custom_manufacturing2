"""Job Card document event handlers."""

from __future__ import annotations

from datetime import datetime, timedelta
from functools import lru_cache
from typing import Iterable

import frappe
from frappe.model.document import Document
from frappe.utils import flt, getdate, get_time, today


NUMERIC_FIELD_TYPES: set[str] = {"Float", "Currency", "Int", "Percent"}

ALL_TIME_FIELDS: tuple[str, ...] = (
    # --- GLR ---
    "custom_from",
    "custom_to",
    "custom_from_time",
    "custom_to_time",
    "custom_from_time3",
    "custom_to_time3",
    "custom_from_time5",
    "custom_to_time_5",
    "custom_from_time_7",
    "custom_to_time_7",
    "custom_from_time9",
    "custom_to_time9",
    "custom_from_time11",
    "custom_to_time11_",
    "custom_from_time14",
    "custom_to_time14",

    # --- ANF ---
    "custom_from_time_anf1",
    "custom_to_time1",
    "custom_from_time_anf",
    "custom_to_time_anf",
    "custom_from_time_anf3",
    "custom_to_time_anf3",
    "custom_from_time_anf4",
    "custom_to_time_anf4",
    "custom_from_timeanf7",
    "custom_to_time_anf7",
    "custom_from_time__copy",
    "custom_to_time__copy",
    "custom_from_time_copy1",
    "custom_to_time__copy1",
    "custom_from_timeanf2",
    "custom_to_timeanf2_copy",
    "custom_from_timeanf15",
    "custom_to_timeanf15_copy",
    "custom_from_time16",
    "custom_to_time16",
    "custom_from_time17",
    "custom_to_time17",
    "custom_from_time18",
    "custom_to_time18_",
    "custom_from_time19",
    "custom_to_time19",
)

def sync_weight_totals(doc: Document, _method: str | None = None) -> None:
	"""Keep the target quantity aligned with bag weights without overriding production totals."""
	if not doc:
		return

	previous: Document | None = None
	if not doc.is_new():
		try:
			previous = doc.get_doc_before_save()
		except Exception:
			previous = None

	total_weight = _get_weight_total(doc)
	if total_weight:
		doc.for_quantity = total_weight

	total_minutes = flt(getattr(doc, "total_time_in_mins", 0))
	total_hours = total_minutes / 60 if total_minutes else 0

	if doc.meta.has_field("custom_total_machine_operation_time_float"):
		doc.custom_total_machine_operation_time_float = flt(total_hours, 2)

	_ensure_shift_time_log(doc)

	if not previous:
		return

	prev_totals = {
		"total_completed_qty": flt(getattr(previous, "total_completed_qty", 0)),
		"process_loss_qty": flt(getattr(previous, "process_loss_qty", 0)),
	}

	prev_time_logs = previous.get("time_logs") or []
	prev_qty_map: dict[str | int | None, float] = {}
	for row in prev_time_logs:
		key = row.get("name") or row.get("idx")
		prev_qty_map[key] = flt(row.get("completed_qty"))

	doc_time_logs = doc.get("time_logs") or []

	log_changed = len(doc_time_logs) != len(prev_time_logs)

	if not log_changed:
		for row in doc_time_logs:
			key = row.get("name") or row.get("idx")
			prev_val = prev_qty_map.get(key)
			if prev_val is None or flt(row.get("completed_qty")) != prev_val:
				log_changed = True
				break

	if log_changed:
		return

	# No time-log quantity changes detected: preserve the previous production totals.
	doc.total_completed_qty = prev_totals["total_completed_qty"]
	if doc.meta.has_field("process_loss_qty"):
		doc.process_loss_qty = prev_totals["process_loss_qty"]

	for row in doc_time_logs:
		key = row.get("name") or row.get("idx")
		if key in prev_qty_map:
			row.completed_qty = prev_qty_map[key]


def clear_glr_time_defaults(doc, _method=None):
    if not doc :
        return

    for fieldname in ALL_TIME_FIELDS:
        if doc.meta.has_field(fieldname):
            doc.set(fieldname, None)

@frappe.whitelist()
def get_active_batches(doctype, txt, searchfield, start, page_len, filters):
    return frappe.db.get_values(
        "Batch",
        filters={"status": "Active"},
        fieldname=["name"],
        as_list=True
    )


def on_submit(doc: Document, _method: str | None = None) -> None:
    delta = flt(getattr(doc, "total_completed_qty", 0))
    _update_workstation_hours(doc, delta)
    # for auto stock entry (disabled)
    # _create_finish_stock_entry(doc)


def on_cancel(doc: Document, _method: str | None = None) -> None:
    delta = -flt(getattr(doc, "total_completed_qty", 0))
    _update_workstation_hours(doc, delta)


def _get_weight_total(doc: Document) -> float:
    rows: Iterable[Document] = doc.get("custom_weight_per_bag") or []
    if not rows:
        return 0.0

    child_doctype = rows[0].doctype
    numeric_fields = _get_numeric_child_fields(child_doctype)

    total = 0.0
    for row in rows:
        for fieldname in numeric_fields:
            value = row.get(fieldname)
            if value not in (None, ""):
                total += flt(value)

    return total


@lru_cache(maxsize=None)
def _get_numeric_child_fields(doctype: str) -> list[str]:
    """Return child table fields that should be treated as numeric weights."""
    meta = frappe.get_meta(doctype)
    numeric_fields = [
        df.fieldname
        for df in meta.fields
        if (df.fieldtype in NUMERIC_FIELD_TYPES or str(df.fieldname).isdigit())
        and df.fieldname != "total"
    ]
    return numeric_fields


def _update_workstation_hours(doc: Document, delta: float) -> None:
    if not delta:
        return
    workstation = getattr(doc, "workstation", None)
    if not workstation:
        return

    delta = flt(delta)
    workstation_doc = frappe.get_doc("Workstation", workstation)
    current_hours = flt(workstation_doc.custom_worked_hours or 0)
    workstation_doc.custom_worked_hours = max(current_hours + delta, 0)
    workstation_doc.save(ignore_permissions=True)


def _create_finish_stock_entry(doc: Document) -> None:
    """Create a draft Manufacture Stock Entry for the linked Work Order when JC is submitted.

    # for auto stock entry
    """
    from erpnext.manufacturing.doctype.work_order.work_order import make_stock_entry

    work_order = getattr(doc, "work_order", None)
    qty_done = flt(getattr(doc, "total_completed_qty", 0)) or flt(getattr(doc, "for_quantity", 0))

    if not work_order:
        return

    try:
        wo_doc = frappe.get_doc("Work Order", work_order)
    except Exception:
        return

    # Avoid duplicates if a draft Manufacture SE already exists for this Work Order
    existing = frappe.db.exists(
        "Stock Entry",
        {"work_order": work_order, "purpose": "Manufacture", "docstatus": 0},
    )
    if existing:
        return

    pending_qty = max(flt(wo_doc.qty) - flt(wo_doc.produced_qty), 0)

    # If JC doesn't carry quantities, fall back to Work Order pending
    qty_candidates = [qty_done, pending_qty]
    qty_positive = [q for q in qty_candidates if q > 0]
    qty = max(qty_positive) if qty_positive else 0
    if qty <= 0:
        return

    try:
        se_doc = make_stock_entry(work_order, "Manufacture", qty=qty)
        se_doc.insert(ignore_permissions=True)
    except Exception:
        frappe.log_error(
            title="Auto Finish Stock Entry Failed",
            message=f"Job Card {doc.name} could not create Stock Entry for Work Order {work_order}",
        )


def _ensure_shift_time_log(doc: Document) -> None:
    if doc.get("time_logs"):
        return

    shift_name = getattr(doc, "custom_shift_number", None)
    if not shift_name:
        return

    shift = frappe.db.get_value("Shift", shift_name, ["from_time", "to_time"], as_dict=True)
    if not shift or not shift.from_time or not shift.to_time:
        return

    try:
        from_time = get_time(shift.from_time)
        to_time = get_time(shift.to_time)
    except Exception:
        return

    base_date = getdate(today())
    from_dt = datetime.combine(base_date, from_time)

    to_date = base_date
    if to_time <= from_time:
        to_date = base_date + timedelta(days=1)
    to_dt = datetime.combine(to_date, to_time)

    duration_minutes = (to_dt - from_dt).total_seconds() / 60

    doc.append(
        "time_logs",
        {
            "from_time": from_dt,
            "to_time": to_dt,
            "time_in_mins": duration_minutes,
            "completed_qty": 0,
        },
    )
