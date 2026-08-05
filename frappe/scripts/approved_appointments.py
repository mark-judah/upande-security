try:
    rows = frappe.db.sql(
        """
        SELECT a.name, a.customer_name, a.customer_phone_number,
               a.customer_details, a.scheduled_time, a.workflow_state,
               a.custom_meet_with,
               a.custom_check_in_time, a.custom_mode_of_transport,
               a.custom_vehicles_number_plate, a.custom_vehicles_colour,
               a.custom_number_of_passengers,
               a.custom_host_received_time,
               b.badge_number,
               e.employee_name AS host_name
        FROM `tabAppointment` a
        LEFT JOIN `tabEmployee` e ON e.name = a.custom_meet_with
        LEFT JOIN `tabVisitor Badge` b ON b.name = a.custom_visitor_badge
        WHERE a.workflow_state IN ('Approved by Host', 'Visitor Checked In')
        ORDER BY
          CASE a.workflow_state
            WHEN 'Visitor Checked In' THEN 0
            ELSE 1
          END,
          a.custom_check_in_time DESC,
          a.scheduled_time DESC
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
        try:
            check_in_time = str(r["custom_check_in_time"]) if r["custom_check_in_time"] else ""
        except (KeyError, TypeError):
            check_in_time = ""
        try:
            transport = str(r["custom_mode_of_transport"]) if r["custom_mode_of_transport"] else ""
        except (KeyError, TypeError):
            transport = ""
        try:
            plate = str(r["custom_vehicles_number_plate"]) if r["custom_vehicles_number_plate"] else ""
        except (KeyError, TypeError):
            plate = ""
        try:
            colour = str(r["custom_vehicles_colour"]) if r["custom_vehicles_colour"] else ""
        except (KeyError, TypeError):
            colour = ""
        passengers = 0
        try:
            pv = r["custom_number_of_passengers"]
            if pv is not None:
                passengers = int(pv)
        except (KeyError, TypeError, ValueError):
            passengers = 0
        try:
            badge_number = r["badge_number"] if r["badge_number"] is not None else None
        except (KeyError, TypeError):
            badge_number = None
        try:
            host_received_time = (
                str(r["custom_host_received_time"]) if r["custom_host_received_time"] else ""
            )
        except (KeyError, TypeError):
            host_received_time = ""
        result.append({
            "name": rname,
            "customer_name": cname,
            "phone": phone,
            "purpose": purpose,
            "scheduled_time": sched,
            "workflow_state": wf,
            "host_id": host_id,
            "host_name": hname,
            "check_in_time": check_in_time,
            "transport": transport,
            "plate": plate,
            "colour": colour,
            "passengers": passengers,
            "custom_visitor_badge_number": badge_number,
            "custom_host_received_time": host_received_time,
        })
    frappe.response["message"] = result
except Exception as e:
    frappe.log_error("approved_appointments", str(e))
    frappe.response["message"] = {"error": str(e)}
