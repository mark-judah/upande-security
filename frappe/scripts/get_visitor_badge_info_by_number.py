# Desktop-friendly counterpart to get_visitor_badge_info.py (which is the
# allow_guest, QR-scan version keyed by company+badge_number since an
# anonymous scanner doesn't have a login to resolve a company from). This one
# is for a logged-in host typing just the plain badge number printed on the
# card — no company field to fill in, since we resolve it from their own
# Employee record. Not allow_guest: a Guest caller gets rejected outright.
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
            company = frappe.db.get_value("Employee", {"user_id": current_user}, "company") or ""

            if not company:
                frappe.response["message"] = {
                    "error": "No Employee record linked to this login — cannot determine your company."
                }
            else:
                badge = frappe.db.get_value(
                    "Visitor Badge",
                    {"company": company, "badge_number": badge_number},
                    ["current_appointment", "status"],
                    as_dict=True,
                )
                if not badge or not badge.current_appointment:
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
                        badge.current_appointment,
                        [
                            "name",
                            "customer_name",
                            "custom_meet_with",
                            "custom_host_received_time",
                            "customer_details",
                        ],
                        as_dict=True,
                    )
                    if not appt:
                        frappe.response["message"] = {
                            "error": "Badge "
                            + str(badge_number)
                            + " points to a visit that no longer exists."
                        }
                    else:
                        host_name = (
                            frappe.db.get_value("Employee", appt.custom_meet_with, "employee_name")
                            or appt.custom_meet_with
                            or ""
                        )
                        frappe.response["message"] = {
                            "badge_number": badge_number,
                            "company": company,
                            "visitor_name": appt.customer_name or "",
                            "host_name": host_name,
                            "purpose": appt.customer_details or "",
                            "already_confirmed": bool(appt.custom_host_received_time),
                            "confirmed_at": str(appt.custom_host_received_time)
                            if appt.custom_host_received_time
                            else None,
                        }
except Exception as e:
    frappe.log_error("get_visitor_badge_info_by_number", str(e))
    frappe.response["message"] = {"error": str(e)}
