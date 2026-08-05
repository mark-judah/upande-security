try:
    data = {}
    try:
        data = frappe.request.get_json(silent=True) or {}
    except Exception:
        data = {}
    if not data:
        data = dict(frappe.form_dict or {})

    company = ""
    try:
        company = str(data["company"] or "").strip()
    except (KeyError, TypeError):
        company = ""

    badge_number_raw = ""
    try:
        badge_number_raw = str(data["badge_number"]) if data["badge_number"] is not None else ""
    except (KeyError, TypeError):
        badge_number_raw = ""

    if not company:
        frappe.response["message"] = {"error": "company is required"}
    elif not badge_number_raw:
        frappe.response["message"] = {"error": "badge_number is required"}
    else:
        try:
            badge_number = int(badge_number_raw)
        except Exception:
            badge_number = None

        if badge_number is None:
            frappe.response["message"] = {"error": "badge_number must be a number"}
        else:
            current_appointment = frappe.db.get_value(
                "Visitor Badge", {"company": company, "badge_number": badge_number}, "current_appointment"
            )
            if not current_appointment:
                frappe.response["message"] = {
                    "error": "Badge "
                    + str(badge_number)
                    + " ("
                    + company
                    + ") is not currently assigned to any visitor."
                }
            else:
                appt = frappe.db.get_value(
                    "Appointment",
                    current_appointment,
                    ["name", "custom_host_received_time"],
                    as_dict=True,
                )
                if not appt:
                    frappe.response["message"] = {
                        "error": "Badge "
                        + str(badge_number)
                        + " points to a visit that no longer exists."
                    }
                elif appt.custom_host_received_time:
                    frappe.response["message"] = {
                        "already_confirmed": True,
                        "confirmed_at": str(appt.custom_host_received_time),
                    }
                else:
                    now = frappe.utils.now_datetime()
                    frappe.db.set_value(
                        "Appointment", appt.name, "custom_host_received_time", now
                    )
                    frappe.db.commit()
                    frappe.response["message"] = {
                        "already_confirmed": False,
                        "confirmed_at": str(now),
                    }
except Exception as e:
    frappe.log_error("confirm_host_received", str(e))
    frappe.response["message"] = {"error": str(e)}
