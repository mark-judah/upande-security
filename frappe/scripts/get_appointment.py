try:
    data = {}
    try:
        data = frappe.request.get_json(silent=True) or {}
    except Exception:
        data = {}
    if not data:
        data = dict(frappe.form_dict or {})

    name = ""
    try:
        name = str(data["name"] or "").strip()
    except (KeyError, TypeError):
        name = ""

    if not name:
        frappe.response["message"] = {"error": "name is required"}
    else:
        row = frappe.db.sql(
            """
            SELECT a.name, a.customer_name, a.customer_phone_number,
                   a.customer_email, a.custom_meet_with,
                   e.employee_name AS host_name,
                   a.scheduled_time, a.customer_details,
                   a.custom_mode_of_transport,
                   a.custom_vehicles_number_plate, a.custom_vehicles_colour,
                   a.workflow_state, a.status, a.custom_reporting_status,
                   a.custom_check_in_time, a.custom_check_out_time,
                   a.custom_visitor_badge, a.custom_host_received_time,
                   b.badge_number, b.company AS badge_company
            FROM `tabAppointment` a
            LEFT JOIN `tabEmployee` e ON e.name = a.custom_meet_with
            LEFT JOIN `tabVisitor Badge` b ON b.name = a.custom_visitor_badge
            WHERE a.name = %s
            LIMIT 1
            """,
            (name,),
            as_dict=True,
        )
        if not row:
            frappe.response["message"] = {"error": "Appointment " + name + " not found"}
        else:
            r = row[0]
            frappe.response["message"] = {
                "name": r.name,
                "customer_name": r.customer_name or "",
                "customer_phone_number": r.customer_phone_number or "",
                "customer_email": r.customer_email or "",
                "custom_meet_with": r.custom_meet_with or "",
                "host_name": r.host_name or r.custom_meet_with or "",
                "scheduled_time": str(r.scheduled_time) if r.scheduled_time else "",
                "customer_details": r.customer_details or "",
                "custom_mode_of_transport": r.custom_mode_of_transport or "",
                "custom_vehicles_number_plate": r.custom_vehicles_number_plate or "",
                "custom_vehicles_colour": r.custom_vehicles_colour or "",
                "workflow_state": r.workflow_state or "",
                "status": r.status or "",
                "custom_reporting_status": r.custom_reporting_status or "",
                "custom_check_in_time": str(r.custom_check_in_time) if r.custom_check_in_time else "",
                "custom_check_out_time": str(r.custom_check_out_time) if r.custom_check_out_time else "",
                "custom_visitor_badge": r.custom_visitor_badge or "",
                "custom_visitor_badge_number": r.badge_number if r.badge_number is not None else None,
                "custom_visitor_badge_company": r.badge_company or "",
                "custom_host_received_time": str(r.custom_host_received_time)
                if r.custom_host_received_time
                else "",
            }
except Exception as e:
    frappe.log_error("get_appointment", str(e))
    frappe.response["message"] = {"error": str(e)}
