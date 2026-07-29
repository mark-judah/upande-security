try:
    data = {}
    try:
        data = frappe.request.get_json(silent=True) or {}
    except Exception:
        data = {}
    if not data:
        data = dict(frappe.form_dict or {})
    query = str(data.get("query") or "").strip()

    if not query:
        frappe.response["message"] = {"error": "query is required"}
    else:
        today = frappe.utils.today()
        like = "%" + query + "%"

        rows = frappe.db.sql(
            """
            SELECT a.name, a.customer_name, a.customer_phone_number,
                   a.customer_email, a.custom_meet_with,
                   e.employee_name AS host_name,
                   a.scheduled_time, a.customer_details,
                   a.custom_mode_of_transport,
                   a.custom_vehicles_number_plate, a.custom_vehicles_colour,
                   a.workflow_state, a.status, a.custom_reporting_status
            FROM `tabAppointment` a
            LEFT JOIN `tabEmployee` e ON e.name = a.custom_meet_with
            WHERE DATE(a.scheduled_time) = %s
              AND (a.customer_name LIKE %s
                   OR a.customer_phone_number LIKE %s
                   OR a.name LIKE %s)
            ORDER BY a.scheduled_time DESC
            LIMIT 1
            """,
            (today, like, like, like),
            as_dict=True,
        )

        if rows:
            r = rows[0]
            frappe.response["message"] = {
                "has_appointment": True,
                "name": r.name,
                "visitor_name": r.customer_name or "",
                "id_no": "",
                "phone_number": r.customer_phone_number or "",
                "organization": "",
                "host_id": r.custom_meet_with or "",
                "host_name": r.host_name or r.custom_meet_with or "",
                "scheduled_time": str(r.scheduled_time) if r.scheduled_time else "",
                "purpose": r.customer_details or "",
                "transport_mode": r.custom_mode_of_transport or "On Foot",
                "vehicle_reg_no": r.custom_vehicles_number_plate or "",
                "vehicle_color": r.custom_vehicles_colour or "",
                "status": r.workflow_state or r.status or "",
                "reporting_status": r.custom_reporting_status or "",
            }
        else:
            frappe.response["message"] = {
                "has_appointment": False,
                "query": query,
            }
except Exception as e:
    frappe.log_error("search_visitor_appointment", str(e))
    frappe.response["message"] = {"error": str(e)}
