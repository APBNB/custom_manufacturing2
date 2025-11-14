import frappe
from datetime import datetime, timedelta

def delete_old_open_job_cards():
    target_date = (datetime.today() - timedelta(days=2)).date()

    query = """
        DELETE FROM `tabJob Card`
        WHERE status = 'Open'
        AND posting_date = %s
    """

    try:
        frappe.db.sql(query, (target_date,))
        frappe.db.commit()
        frappe.logger().info(f"Deleted Job Cards with status=open and posting_date={target_date}")
    except Exception as e:
        frappe.logger().error(f"Job Card deletion failed: {str(e)}")
