try:
    data = {}
    try:
        data = frappe.request.get_json(silent=True) or {}
    except Exception:
        data = {}
    if not data:
        data = dict(frappe.form_dict or {})

    timesheet = ""
    try:
        timesheet = str(data["timesheet"] or "").strip()
    except (KeyError, TypeError):
        timesheet = ""
    exit_time = ""
    try:
        exit_time = str(data["exit_time"] or "").strip()
    except (KeyError, TypeError):
        exit_time = ""
    completion_note = ""
    try:
        completion_note = str(data["completion_note"] or "").strip()
    except (KeyError, TypeError):
        completion_note = ""

    if not timesheet:
        frappe.response["message"] = {"error": "timesheet is required"}
    elif not exit_time:
        frappe.response["message"] = {"error": "exit_time is required"}
    elif not completion_note:
        frappe.response["message"] = {"error": "completion_note is required"}
    else:
        existing = frappe.db.get_value("Timesheet", timesheet, ["name", "docstatus"], as_dict=True)
        if not existing:
            frappe.response["message"] = {"error": "Timesheet " + timesheet + " not found"}
        elif int(existing.docstatus or 0) == 1:
            frappe.response["message"] = {
                "name": timesheet,
                "docstatus": 1,
                "message": "already submitted",
            }
        else:
            doc = frappe.get_doc("Timesheet", timesheet)
            row = None
            if doc.time_logs:
                row = doc.time_logs[0]
            if row is None:
                frappe.response["message"] = {"error": "Timesheet has no time_logs"}
            else:
                from_t = row.from_time
                from_sec = frappe.utils.time_diff_in_seconds(exit_time, str(from_t))
                hours = float(from_sec or 0) / 3600.0
                if hours < 0.01:
                    hours = 0.01
                row.to_time = exit_time
                row.hours = round(hours, 4)
                row.expected_hours = round(hours, 4)
                row.description = completion_note
                row.completed = 1
                doc.save(ignore_permissions=True)
                doc.submit()
                frappe.db.commit()
                frappe.response["message"] = {
                    "name": doc.name,
                    "docstatus": doc.docstatus,
                    "exit_time": exit_time,
                    "hours": round(hours, 4),
                    "completion_note": completion_note,
                }
except Exception as e:
    frappe.db.rollback()
    frappe.log_error("submit_gate_timesheet", str(e))
    frappe.response["message"] = {"error": str(e)}
