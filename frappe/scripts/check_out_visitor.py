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

    exit_gate = ""
    try:
        exit_gate = str(data["exit_gate"] or "").strip()
    except (KeyError, TypeError):
        exit_gate = ""

    if not name:
        frappe.response["message"] = {"error": "name is required"}
    else:
        existing = frappe.db.get_value(
            "Appointment",
            name,
            ["name", "custom_host_received_time", "custom_visitor_badge", "custom_entry_gate"],
            as_dict=True,
        )
        if not existing:
            frappe.response["message"] = {"error": "Appointment " + name + " not found"}
        elif existing.custom_visitor_badge and not existing.custom_host_received_time:
            # Only gated when a badge was actually issued for this visit —
            # appointments that never went through the badge flow (or visitor
            # types that don't use it) are unaffected.
            frappe.response["message"] = {
                "error": "Host has not yet confirmed receiving this visitor "
                "— ask them to scan the visitor badge QR code first."
            }
        else:
            now = frappe.utils.now_datetime()

            checkout_updates = {
                "workflow_state": "Visitor Checked Out",
                "custom_reporting_status": "Checked out",
                "custom_check_out_time": now,
                "status": "Closed",
            }
            if exit_gate:
                checkout_updates["custom_exit_gate"] = exit_gate
                # Mismatch only means something once both ends are known -
                # an entry gate never recorded (site predates this feature,
                # or the guard skipped the picker) isn't treated as a
                # mismatch, that would just be noise.
                if existing.custom_entry_gate and existing.custom_entry_gate != exit_gate:
                    checkout_updates["custom_gate_mismatch"] = 1

            # Safe-exec sandbox blocks `from frappe.model.workflow import ...`
            # so apply_workflow() silently fails. Set workflow_state directly.
            frappe.db.set_value("Appointment", name, checkout_updates)
            if existing.custom_visitor_badge:
                frappe.db.set_value(
                    "Visitor Badge",
                    existing.custom_visitor_badge,
                    {"status": "Available", "current_appointment": None},
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
