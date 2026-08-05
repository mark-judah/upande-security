# Desk-side counterpart to confirm_host_received.py — that verb is
# allow_guest (keyed by company+badge_number, reached anonymously via the QR
# code) so it deliberately never trusts an appointment name from an
# unauthenticated caller. This one is for the "Confirm Receipt" button added
# to the Appointment form (see the matching client script) for hosts who are
# already logged into the desk and looking at the record directly, without
# needing to scan the physical badge.
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
        appt = frappe.db.get_value(
            "Appointment",
            name,
            ["name", "custom_host_received_time", "custom_visitor_badge"],
            as_dict=True,
        )
        if not appt:
            frappe.response["message"] = {"error": "Appointment " + name + " not found"}
        elif not appt.custom_visitor_badge:
            frappe.response["message"] = {
                "error": "No visitor badge has been issued for this visit yet"
            }
        elif appt.custom_host_received_time:
            frappe.response["message"] = {
                "already_confirmed": True,
                "confirmed_at": str(appt.custom_host_received_time),
            }
        else:
            now = frappe.utils.now_datetime()
            frappe.db.set_value("Appointment", name, "custom_host_received_time", now)
            frappe.db.commit()
            frappe.response["message"] = {
                "already_confirmed": False,
                "confirmed_at": str(now),
            }
except Exception as e:
    frappe.log_error("confirm_host_received_by_appointment", str(e))
    frappe.response["message"] = {"error": str(e)}
