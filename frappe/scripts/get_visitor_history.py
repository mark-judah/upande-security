try:
    query = (frappe.form_dict.get("query") or "").strip()

    if not query:
        frappe.response["message"] = {"found": False}
    else:
        # ID number only - deliberately NOT name or phone. Both of those can
        # match more than one real person (two visitors named "Peter", a
        # shared/reassigned phone number), and this lookup feeds straight
        # into pre-filling and LOCKING a walk-in's identity fields - a name
        # match here would silently attach a stranger's ID/phone/host/
        # purpose to today's visitor. custom_id_number is the one field
        # that's actually guaranteed unique per person, so it's the only
        # safe key for "is this the same person as before".
        matches = frappe.get_all(
            "Appointment",
            filters=[
                ["custom_check_in_time", "is", "set"],
                ["custom_id_number", "=", query],
            ],
            fields=[
                "name",
                "customer_name",
                "customer_phone_number",
                "custom_id_number",
                "custom_meet_with",
                "customer_details",
                "custom_mode_of_transport",
                "custom_vehicles_number_plate",
                "custom_vehicles_colour",
                "scheduled_time",
                "custom_check_in_time",
            ],
            order_by="custom_check_in_time desc",
            limit_page_length=10,
        )

        if not matches:
            frappe.response["message"] = {"found": False}
        else:
            # Most recent visit is the source of truth for name/ID/host/
            # purpose - but not every visitor type collects every field
            # (Customer/Contractor bookings never key in a phone number),
            # so a later phone-less visit must not blank out a phone that
            # genuinely IS on file from an earlier one. Backfill each
            # optional field from the nearest match (still newest-first)
            # that actually has it, rather than only ever looking at the
            # single most recent record.
            m = matches[0]

            def backfill(fieldname):
                for row in matches:
                    if row.get(fieldname):
                        return row.get(fieldname)
                return None

            phone = m.customer_phone_number or backfill("customer_phone_number")
            transport_mode = m.custom_mode_of_transport or backfill("custom_mode_of_transport")
            vehicle_reg_no = m.custom_vehicles_number_plate or backfill("custom_vehicles_number_plate")
            vehicle_color = m.custom_vehicles_colour or backfill("custom_vehicles_colour")

            frappe.response["message"] = {
                "found": True,
                "visitor_name": m.customer_name,
                "phone_number": phone,
                "id_no": m.custom_id_number,
                "host_id": m.custom_meet_with,
                "host_name": frappe.db.get_value(
                    "Employee", m.custom_meet_with, "employee_name"
                ) if m.custom_meet_with else "",
                "purpose": m.customer_details,
                "transport_mode": transport_mode,
                "vehicle_reg_no": vehicle_reg_no,
                "vehicle_color": vehicle_color,
                "last_visit_date": m.custom_check_in_time or m.scheduled_time,
            }
except Exception as e:
    frappe.log_error("get_visitor_history", str(e))
    frappe.response["message"] = {"found": False}
