# Copyright (c) 2025, Daks and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class LinkingJobcard(Document):
    pass


@frappe.whitelist()
def job_card_query(doctype, txt, searchfield, start, page_len, filters):
    return frappe.db.sql("""
        SELECT
            name,
            workstation,
            workstation AS description
        FROM `tabJob Card`
        WHERE name LIKE %(txt)s
        ORDER BY modified DESC
    """, {"txt": "%%%s%%" % txt})
