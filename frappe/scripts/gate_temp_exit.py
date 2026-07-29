try:
    args = frappe.form_dict

    reference_doctype = (args.get("reference_doctype") or "").strip()
    reference_name = (args.get("reference_name") or "").strip()
    direction = (args.get("direction") or "").strip()

    allowed_doctypes = ["Appointment", "Attendance"]

    if reference_doctype not in allowed_doctypes:
        frappe.response["message"] = {"error": "reference_doctype must be Appointment or Attendance"}
    elif not reference_name:
        frappe.response["message"] = {"error": "reference_name is required"}
    elif direction not in ("out", "in"):
        frappe.response["message"] = {"error": "direction must be 'out' or 'in'"}
    else:
        current_temp_exit = frappe.db.get_value(reference_doctype, reference_name, "custom_temp_exit_time")

        if direction == "out":
            if current_temp_exit:
                frappe.response["message"] = {"error": reference_name + " is already stepped out"}
            else:
                now_str = frappe.utils.now_datetime().strftime("%Y-%m-%d %H:%M:%S")
                frappe.db.set_value(reference_doctype, reference_name, "custom_temp_exit_time", now_str, update_modified=True)
                frappe.db.commit()
                frappe.response["message"] = {
                    "success": True,
                    "direction": "out",
                    "temp_exit_time": now_str,
                }
        else:
            if not current_temp_exit:
                frappe.response["message"] = {"error": reference_name + " is not currently stepped out"}
            else:
                now_str = frappe.utils.now_datetime().strftime("%Y-%m-%d %H:%M:%S")
                duration_minutes = None
                try:
                    duration_minutes = round(frappe.utils.time_diff_in_seconds(now_str, current_temp_exit) / 60, 1)
                except Exception:
                    duration_minutes = None

                existing_log = frappe.db.get_value(reference_doctype, reference_name, "custom_temp_exit_log") or ""
                log_line = str(current_temp_exit) + " -> " + now_str + " (" + str(duration_minutes) + "m)"
                new_log = log_line if not existing_log else existing_log + "\n" + log_line

                frappe.db.set_value(
                    reference_doctype,
                    reference_name,
                    {"custom_temp_exit_time": None, "custom_temp_exit_log": new_log},
                    update_modified=True,
                )
                frappe.db.commit()
                frappe.response["message"] = {
                    "success": True,
                    "direction": "in",
                    "out_time": now_str,
                    "duration_minutes": duration_minutes,
                }
except Exception as e:
    frappe.db.rollback()
    frappe.log_error("gate_temp_exit", str(e))
    frappe.response["message"] = {"error": str(e)}
