try:
    data = {}
    try:
        data = frappe.request.get_json(silent=True) or {}
    except Exception:
        data = {}
    if not data:
        data = dict(frappe.form_dict or {})

    date_str = ""
    try:
        date_str = str(data["date"] or "").strip()
    except (KeyError, TypeError):
        date_str = ""
    if not date_str:
        date_str = str(frappe.utils.nowdate())

    start = date_str + " 00:00:00"
    end = date_str + " 23:59:59"

    rows = frappe.db.sql(
        """
        SELECT a.name, a.customer_name, a.customer_phone_number,
               a.custom_meet_with, e.employee_name AS host_name,
               a.workflow_state, a.custom_reporting_status,
               a.custom_check_in_time, a.custom_check_out_time,
               a.scheduled_time, a.custom_mode_of_transport,
               a.custom_vehicles_number_plate, a.custom_vehicles_colour,
               a.custom_number_of_passengers, a.custom_visitor_type,
               a.custom_contractor_ref, a.custom_temp_exit_time,
               a.customer_details
        FROM `tabAppointment` a
        LEFT JOIN `tabEmployee` e ON e.name = a.custom_meet_with
        WHERE a.scheduled_time BETWEEN %s AND %s
        ORDER BY a.custom_check_in_time DESC, a.scheduled_time DESC
        LIMIT 200
        """,
        (start, end),
        as_dict=True,
    )

    all_records = []
    for r in rows:
        all_records.append(
            {
                "name": r.name,
                "customer_name": r.customer_name or "",
                "customer_phone_number": r.customer_phone_number or "",
                "custom_meet_with": r.custom_meet_with or "",
                "host_name": r.host_name or r.custom_meet_with or "",
                "workflow_state": r.workflow_state or "",
                "custom_reporting_status": r.custom_reporting_status or "",
                "custom_check_in_time": str(r.custom_check_in_time) if r.custom_check_in_time else "",
                "custom_check_out_time": str(r.custom_check_out_time) if r.custom_check_out_time else "",
                "scheduled_time": str(r.scheduled_time) if r.scheduled_time else "",
                "custom_mode_of_transport": r.custom_mode_of_transport or "",
                "custom_vehicles_number_plate": r.custom_vehicles_number_plate or "",
                "custom_vehicles_colour": r.custom_vehicles_colour or "",
                "custom_number_of_passengers": r.custom_number_of_passengers or 0,
                "custom_visitor_type": r.custom_visitor_type or "Visitor",
                "custom_contractor_ref": r.custom_contractor_ref or "",
                "custom_temp_exit_time": str(r.custom_temp_exit_time) if r.custom_temp_exit_time else "",
                "customer_details": r.customer_details or "",
            }
        )

    checked_in = 0
    checked_out = 0
    still_inside = []
    for a in all_records:
        if a["custom_check_in_time"]:
            checked_in = checked_in + 1
            if not a["custom_check_out_time"]:
                still_inside.append(a)
        if a["custom_check_out_time"]:
            checked_out = checked_out + 1

    frappe.response["message"] = {
        "date": date_str,
        "total_checked_in": checked_in,
        "total_checked_out": checked_out,
        "still_inside": len(still_inside),
        "still_inside_list": still_inside,
        "all": all_records,
    }
except Exception as e:
    frappe.log_error("daily_summary", str(e))
    frappe.response["message"] = {"error": str(e)}
