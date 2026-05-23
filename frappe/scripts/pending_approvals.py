try:
    rows = frappe.db.sql(
        """
        SELECT a.name, a.customer_name, a.customer_phone_number,
               a.customer_details, a.scheduled_time, a.workflow_state,
               a.custom_meet_with,
               e.employee_name AS host_name
        FROM `tabAppointment` a
        LEFT JOIN `tabEmployee` e ON e.name = a.custom_meet_with
        WHERE a.workflow_state = 'Pending Host Review'
        ORDER BY a.scheduled_time DESC
        LIMIT 100
        """,
        as_dict=True,
    )
    result = []
    for r in rows:
        try:
            rname = str(r["name"]) if r["name"] else ""
        except (KeyError, TypeError):
            rname = ""
        try:
            cname = str(r["customer_name"]) if r["customer_name"] else ""
        except (KeyError, TypeError):
            cname = ""
        try:
            phone = str(r["customer_phone_number"]) if r["customer_phone_number"] else ""
        except (KeyError, TypeError):
            phone = ""
        try:
            purpose = str(r["customer_details"]) if r["customer_details"] else ""
        except (KeyError, TypeError):
            purpose = ""
        try:
            sched = str(r["scheduled_time"]) if r["scheduled_time"] else ""
        except (KeyError, TypeError):
            sched = ""
        try:
            wf = str(r["workflow_state"]) if r["workflow_state"] else ""
        except (KeyError, TypeError):
            wf = ""
        try:
            host_id = str(r["custom_meet_with"]) if r["custom_meet_with"] else ""
        except (KeyError, TypeError):
            host_id = ""
        try:
            hname = str(r["host_name"]) if r["host_name"] else host_id
        except (KeyError, TypeError):
            hname = host_id
        result.append({
            "name": rname,
            "customer_name": cname,
            "phone": phone,
            "purpose": purpose,
            "scheduled_time": sched,
            "workflow_state": wf,
            "host_id": host_id,
            "host_name": hname,
        })
    frappe.response["message"] = result
except Exception as e:
    frappe.log_error("pending_approvals", str(e))
    frappe.response["message"] = {"error": str(e)}
