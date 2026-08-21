# Desktop-friendly counterpart to confirm_host_received.py — see
# get_visitor_badge_info_by_number.py for why this is a separate, non-guest
# verb keyed by badge_number only (company resolved from the logged-in
# host's own Employee record).
try:
    data = {}
    try:
        data = frappe.request.get_json(silent=True) or {}
    except Exception:
        data = {}
    if not data:
        data = dict(frappe.form_dict or {})

    badge_number_raw = ""
    try:
        badge_number_raw = str(data["badge_number"]) if data["badge_number"] is not None else ""
    except (KeyError, TypeError):
        badge_number_raw = ""

    if not badge_number_raw:
        frappe.response["message"] = {"error": "badge_number is required"}
    else:
        try:
            badge_number = int(badge_number_raw)
        except Exception:
            badge_number = None

        if badge_number is None:
            frappe.response["message"] = {"error": "badge_number must be a number"}
        else:
            current_user = frappe.session.user
            employee = frappe.db.get_value(
                "Employee", {"user_id": current_user}, ["company", "custom_farm"], as_dict=True
            )
            company = employee.company if employee else ""
            farm = employee.custom_farm if employee else ""

            if not company:
                frappe.response["message"] = {
                    "error": "No Employee record linked to this login — cannot determine your company."
                }
            else:
                current_appointment = None
                if farm:
                    current_appointment = frappe.db.get_value(
                        "Visitor Badge",
                        {"company": company, "farm": farm, "badge_number": badge_number},
                        "current_appointment",
                    )
                else:
                    candidates = frappe.db.get_all(
                        "Visitor Badge",
                        filters={"company": company, "badge_number": badge_number},
                        fields=["current_appointment"],
                    )
                    for c in candidates:
                        if c.current_appointment:
                            current_appointment = c.current_appointment
                            break

                if not current_appointment:
                    frappe.response["message"] = {
                        "error": "Badge "
                        + str(badge_number)
                        + " ("
                        + company
                        + (" / " + farm if farm else "")
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
    frappe.log_error("confirm_host_received_by_number", str(e))
    frappe.response["message"] = {"error": str(e)}
