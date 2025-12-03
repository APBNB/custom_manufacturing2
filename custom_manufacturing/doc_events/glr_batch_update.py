import frappe

def update_glr_batch(doc, method):
    job_card_id = doc.job_card
    if not job_card_id:
        return

    job_card = frappe.get_doc("Job Card", job_card_id)

    if job_card.operation != "GLR":
        return

    for item in doc.items:
        if not item.batch_no:
            continue  
        qty = getattr(item, "transfer_qty", None) or getattr(item, "qty", None) or 0
        existing_row = next((row for row in job_card.custom_batch if row.batch == item.batch_no), None)

        if existing_row:
            existing_row.quantity = qty
        else:
            job_card.append("custom_batch", {
                "batch": item.batch_no,
                "quantity": qty
            })

    job_card.flags.ignore_validate = True
    job_card.flags.ignore_permissions = True
    job_card.save()
    frappe.db.commit()
