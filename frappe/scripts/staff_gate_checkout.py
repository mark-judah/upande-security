try:
    args = frappe.form_dict

    attendance_name = (args.get("attendance_name") or "").strip()

    if not attendance_name:
        frappe.response["message"] = {"error": "attendance_name is required"}
    else:
        existing = frappe.db.get_value("Attendance", attendance_name, ["name", "in_time", "out_time"], as_dict=True)
        if not existing:
            frappe.response["message"] = {"error": "Attendance " + attendance_name + " not found"}
        elif existing.out_time:
            frappe.response["message"] = {"error": attendance_name + " is already checked out"}
        else:
            now_str = frappe.utils.now_datetime().strftime("%Y-%m-%d %H:%M:%S")

            working_hours = None
            if existing.in_time:
                try:
                    working_hours = round(frappe.utils.time_diff_in_hours(now_str, existing.in_time), 2)
                except Exception:
                    working_hours = None

            updates = {"out_time": now_str}
            if working_hours is not None:
                updates["working_hours"] = working_hours

            frappe.db.set_value("Attendance", attendance_name, updates, update_modified=True)
            frappe.db.commit()

            frappe.response["message"] = {
                "success": True,
                "attendance_name": attendance_name,
                "out_time": now_str,
                "working_hours": working_hours,
            }
except Exception as e:
    frappe.db.rollback()
    frappe.log_error("staff_gate_checkout", str(e))
    frappe.response["message"] = {"error": str(e)}
