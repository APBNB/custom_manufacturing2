import frappe

@frappe.whitelist()
def make_material_transfer_for_manufacture(material_request):
    """Create Stock Entry: Material Transfer for Manufacture from Material Request"""

    doc = frappe.get_doc("Material Request", material_request)

    # --- Prevent duplicate Stock Entry creation ---
    if doc.custom_stock_entry:
        frappe.throw(f"Stock Entry already created: {doc.custom_stock_entry}")

    se = frappe.new_doc("Stock Entry")
    se.stock_entry_type = "Material Transfer for Manufacture"

    doc.load_from_db()
    for item in doc.items:
        if not item.from_warehouse or not item.warehouse:
            frappe.throw(
                f"Row {item.idx}: Both From Warehouse and Warehouse must be set in Material Request Item"
            )

        se.append("items", {
            "item_code": item.item_code,
            "qty": item.qty,
            "transfer_qty": item.qty,
            "uom": getattr(item, "uom", None),
            "stock_uom": getattr(item, "stock_uom", None),
            "s_warehouse": item.from_warehouse,
            "t_warehouse": item.warehouse,
        })

    # Insert Stock Entry
    se.insert(ignore_permissions=True)

    # --- Save Stock Entry back to Material Request ---
    doc.custom_stock_entry = se.name
    doc.save(ignore_permissions=True)

    return se
