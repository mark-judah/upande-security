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
        existing = frappe.db.get_value("Appointment", name, "name")
        if not existing:
            frappe.response["message"] = {"error": "Appointment " + name + " not found"}
        else:
            now = frappe.utils.now_datetime()

            # Safe-exec sandbox blocks `from frappe.model.workflow import ...`
            # so apply_workflow() silently fails. Set workflow_state directly.
            frappe.db.set_value(
                "Appointment",
                name,
                {
                    "workflow_state": "Visitor Checked Out",
                    "custom_reporting_status": "Checked out",
                    "custom_check_out_time": now,
                    "status": "Closed",
                },
            )
            frappe.db.commit()
            frappe.response["message"] = {
                "name": name,
                "workflow_state": "Visitor Checked Out",
                "custom_reporting_status": "Checked out",
                "custom_check_out_time": str(now),
                "status": "Closed",
            }
except Exception as e:
    frappe.db.rollback()
    frappe.log_error("check_out_visitor", str(e))
    frappe.response["message"] = {"error": str(e)}
