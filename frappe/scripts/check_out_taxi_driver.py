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
        existing = frappe.db.get_value(
            "Appointment",
            name,
            ["name", "custom_mode_of_transport", "custom_taxi_driver_check_out_time"],
            as_dict=True,
        )
        if not existing:
            frappe.response["message"] = {"error": "Appointment " + name + " not found"}
        elif existing.custom_mode_of_transport != "Taxi":
            frappe.response["message"] = {
                "error": "This appointment is not marked as arriving by Taxi"
            }
        elif existing.custom_taxi_driver_check_out_time:
            frappe.response["message"] = {
                "error": "Driver already marked as departed at "
                + str(existing.custom_taxi_driver_check_out_time)
            }
        else:
            now = frappe.utils.now_datetime()
            # Only the driver-departure field is touched here — the
            # visitor's own check-in/check-out state (workflow_state,
            # custom_check_out_time, status) is completely untouched, so
            # they can still be checked out separately later, whenever they
            # actually leave.
            frappe.db.set_value(
                "Appointment", name, "custom_taxi_driver_check_out_time", now
            )
            frappe.db.commit()
            frappe.response["message"] = {
                "name": name,
                "custom_taxi_driver_check_out_time": str(now),
            }
except Exception as e:
    frappe.db.rollback()
    frappe.log_error("check_out_taxi_driver", str(e))
    frappe.response["message"] = {"error": str(e)}
