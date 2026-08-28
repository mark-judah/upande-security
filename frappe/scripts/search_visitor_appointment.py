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
            SELECT a.name, a.customer_name, a.custom_id_number, a.customer_phone_number,
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
                   OR a.name LIKE %s
                   OR a.custom_id_number = %s)
            ORDER BY a.scheduled_time DESC
            LIMIT 1
            """,
            (today, like, like, like, query),
            as_dict=True,
        )

        if not rows:
            frappe.response["message"] = {
                "has_appointment": False,
                "query": query,
            }
        else:
            r = rows[0]

            # Same backfill principle as get_visitor_history: today's own
            # appointment is the source of truth for name/host/purpose/
            # status, but not every visitor type collects every field
            # (Customer/Contractor bookings never key in phone, transport,
            # or vehicle details). If today's match is missing one of
            # those, look at this person's past visits (by ID/phone/name,
            # same as get_visitor_history) and fill it in from the most
            # recent one that actually has it - otherwise a guard sees a
            # blank Phone field even though it's genuinely on file from an
            # earlier visit, with no way to reach the richer history
            # lookup (that path only runs when NO appointment is found for
            # today at all).
            phone = r.customer_phone_number or ""
            transport_mode = r.custom_mode_of_transport or ""
            vehicle_reg_no = r.custom_vehicles_number_plate or ""
            vehicle_color = r.custom_vehicles_colour or ""

            if not (phone and transport_mode and vehicle_reg_no and vehicle_color):
                id_no = r.custom_id_number or ""
                past = frappe.get_all(
                    "Appointment",
                    filters=[
                        ["custom_check_in_time", "is", "set"],
                        ["name", "!=", r.name],
                    ],
                    or_filters=[
                        ["customer_phone_number", "=", query],
                        ["customer_name", "like", like],
                        ["custom_id_number", "=", id_no if id_no else query],
                    ],
                    fields=[
                        "customer_phone_number",
                        "custom_mode_of_transport",
                        "custom_vehicles_number_plate",
                        "custom_vehicles_colour",
                        "custom_check_in_time",
                    ],
                    order_by="custom_check_in_time desc",
                    limit_page_length=10,
                )

                def backfill(fieldname):
                    for row in past:
                        if row.get(fieldname):
                            return row.get(fieldname)
                    return ""

                if not phone:
                    phone = backfill("customer_phone_number")
                if not transport_mode:
                    transport_mode = backfill("custom_mode_of_transport")
                if not vehicle_reg_no:
                    vehicle_reg_no = backfill("custom_vehicles_number_plate")
                if not vehicle_color:
                    vehicle_color = backfill("custom_vehicles_colour")

            frappe.response["message"] = {
                "has_appointment": True,
                "name": r.name,
                "visitor_name": r.customer_name or "",
                "id_no": r.custom_id_number or "",
                "phone_number": phone,
                "organization": "",
                "host_id": r.custom_meet_with or "",
                "host_name": r.host_name or r.custom_meet_with or "",
                "scheduled_time": str(r.scheduled_time) if r.scheduled_time else "",
                "purpose": r.customer_details or "",
                "transport_mode": transport_mode or "On Foot",
                "vehicle_reg_no": vehicle_reg_no,
                "vehicle_color": vehicle_color,
                "status": r.workflow_state or r.status or "",
                "reporting_status": r.custom_reporting_status or "",
            }
except Exception as e:
    frappe.log_error("search_visitor_appointment", str(e))
    frappe.response["message"] = {"error": str(e)}
