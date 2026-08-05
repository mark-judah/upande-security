try:
    data = {}
    try:
        data = frappe.request.get_json(silent=True) or {}
    except Exception:
        data = {}
    if not data:
        data = dict(frappe.form_dict or {})

    def s(key):
        try:
            v = data[key]
            if v is None:
                return ""
            return str(v).strip()
        except (KeyError, TypeError):
            return ""

    customer_name = s("customer_name")
    id_number = s("id_number")
    phone = s("phone")
    email = s("email")
    host = s("host")
    purpose = s("purpose")
    transport = s("transport") or "On Foot"
    plate = s("plate")
    colour = s("colour")
    driver_name = s("driver_name")
    driver_phone = s("driver_phone")
    scheduled_time = s("scheduled_time")
    passengers_raw = ""
    try:
        passengers_raw = str(data["passengers"]) if data["passengers"] is not None else ""
    except (KeyError, TypeError):
        passengers_raw = ""

    if not customer_name:
        frappe.response["message"] = {"error": "customer_name is required"}
    elif not phone:
        frappe.response["message"] = {"error": "phone is required"}
    elif not host:
        frappe.response["message"] = {"error": "host is required"}
    else:
        if not scheduled_time:
            scheduled_time = str(frappe.utils.now_datetime())

        host_ok = frappe.db.get_value("Employee", host, "name")
        if not host_ok:
            frappe.response["message"] = {"error": "Host " + host + " not found"}
        else:
            now = frappe.utils.now_datetime()
            doc = frappe.new_doc("Appointment")
            doc.flags.ignore_mandatory = True
            doc.customer_name = customer_name
            doc.custom_id_number = id_number
            doc.customer_phone_number = phone
            doc.customer_email = email
            doc.custom_meet_with = host
            doc.scheduled_time = scheduled_time
            doc.customer_details = purpose
            doc.custom_mode_of_transport = transport
            doc.custom_vehicles_number_plate = plate
            doc.custom_vehicles_colour = colour
            if driver_name:
                doc.custom_taxi_driver_name = driver_name
            if driver_phone:
                doc.custom_taxi_driver_phone = driver_phone
            if passengers_raw:
                try:
                    doc.custom_number_of_passengers = int(passengers_raw)
                except Exception:
                    pass
            doc.status = "Open"
            doc.custom_reporting_status = "Checked in"
            doc.custom_check_in_time = now

            # Stamp which company/farm this visit belongs to, from the
            # checking-in guard's own scope — this is what the access
            # scoping in daily_summary.py / list_incidents.py filters on.
            current_user = frappe.session.user
            employee = frappe.db.get_value(
                "Employee", {"user_id": current_user}, ["company", "custom_farm"], as_dict=True
            )
            resolved_company = employee.company if employee else None
            resolved_farm = employee.custom_farm if employee else None
            if not resolved_company and not resolved_farm:
                user_full = frappe.db.get_value("User", current_user, "full_name") or ""
                if user_full:
                    guard = frappe.db.get_value(
                        "Security Guard", {"full_name": user_full}, ["company", "farm"], as_dict=True
                    )
                    if guard:
                        resolved_company = guard.company
                        resolved_farm = guard.farm
            if resolved_company:
                doc.custom_company = resolved_company
            if resolved_farm:
                doc.custom_farmunit = resolved_farm

            doc.insert(ignore_permissions=True)
            frappe.db.commit()
            frappe.response["message"] = {
                "name": doc.name,
                "customer_name": customer_name,
                "host_id": host,
                "custom_reporting_status": "Checked in",
                "custom_check_in_time": str(now),
            }
except Exception as e:
    frappe.db.rollback()
    frappe.log_error("create_walk_in", str(e))
    frappe.response["message"] = {"error": str(e)}
