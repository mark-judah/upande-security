try:
    data = {}
    try:
        data = frappe.request.get_json(silent=True) or {}
    except Exception:
        data = {}
    if not data:
        data = dict(frappe.form_dict or {})

    query = ""
    try:
        query = str(data["query"] or "").strip()
    except (KeyError, TypeError):
        query = ""

    if not query:
        frappe.response["message"] = []
    else:
        like = "%" + query + "%"
        rows = frappe.db.sql(
            """
            SELECT name, motor_vehicle, farm, operator,
                   company, date, erp_task, timesheet
            FROM `tabTractor Daily Task`
            WHERE name LIKE %s OR motor_vehicle LIKE %s
            ORDER BY modified DESC
            LIMIT 20
            """,
            (like, like),
            as_dict=True,
        )
        out = []
        for r in rows:
            out.append(
                {
                    "name": r.name,
                    "motor_vehicle": r.motor_vehicle or "",
                    "farm": r.farm or "",
                    "operator": r.operator or "",
                    "custom_employee": r.operator or "",
                    "company": r.company or "",
                    "date": str(r.date) if r.date else "",
                    "erp_task": r.erp_task or "",
                    "timesheet": r.timesheet or "",
                    "workflow_state": "",
                }
            )
        frappe.response["message"] = out
except Exception as e:
    frappe.log_error("search_vehicle_tickets", str(e))
    frappe.response["message"] = {"error": str(e)}
