import frappe

@frappe.whitelist()
def completed_jobcards_within_last_day(doctype, txt, searchfield, start, page_len, filters):
	return frappe.db.sql(
		"""
		SELECT name, operation, workstation
		FROM `tabJob Card`
		WHERE status = 'Completed'
		AND docstatus < 2
		AND modified >= NOW() - INTERVAL 1 DAY
		AND (name LIKE %(txt)s OR workstation LIKE %(txt)s OR operation LIKE %(txt)s)
		ORDER BY modified DESC
		LIMIT %(start)s, %(page_len)s
		""",
		{
			"txt": f"%{txt}%",
			"start": start,
			"page_len": page_len,
		},
	)
