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

    badge_number_raw = ""
    try:
        badge_number_raw = str(data["badge_number"]) if data["badge_number"] is not None else ""
    except (KeyError, TypeError):
        badge_number_raw = ""

    if not name:
        frappe.response["message"] = {"error": "name is required"}
    elif not badge_number_raw:
        frappe.response["message"] = {"error": "badge_number is required"}
    else:
        appt = frappe.db.get_value("Appointment", name, ["name", "custom_visitor_badge"], as_dict=True)
        if not appt:
            frappe.response["message"] = {"error": "Appointment " + name + " not found"}
        else:
            try:
                badge_number = int(badge_number_raw)
            except Exception:
                badge_number = None

            if badge_number is None:
                frappe.response["message"] = {"error": "badge_number must be a number"}
            else:
                # Which company's badge pool this is issuing from — same
                # resolution order as get_security_head_contact.py: Employee
                # linked to this login first, then Security Guard matched by
                # full name (Security Guard has no user_id field). Falls back
                # to the visit's own host's company when neither resolves
                # (System Manager / admin accounts testing the flow, or any
                # caller not tied to a specific company) — the host's company
                # is always a reliable stand-in since every visitor
                # appointment requires one.
                current_user = frappe.session.user
                company = ""
                employee = frappe.db.get_value(
                    "Employee", {"user_id": current_user}, "company"
                )
                if employee:
                    company = employee
                else:
                    user_full = frappe.db.get_value("User", current_user, "full_name") or ""
                    if user_full:
                        company = (
                            frappe.db.get_value(
                                "Security Guard", {"full_name": user_full}, "company"
                            )
                            or ""
                        )

                if not company:
                    host = frappe.db.get_value("Appointment", name, "custom_meet_with")
                    if host:
                        company = frappe.db.get_value("Employee", host, "company") or ""

                if not company:
                    frappe.response["message"] = {
                        "error": "Could not determine which company's badge pool to use "
                        "— no Employee or Security Guard record linked to this user, "
                        "and this visit has no host to fall back on"
                    }
                else:
                    badge = frappe.db.get_value(
                        "Visitor Badge",
                        {"company": company, "badge_number": badge_number},
                        ["name", "status", "current_appointment"],
                        as_dict=True,
                    )
                    if not badge:
                        frappe.response["message"] = {
                            "error": "Badge "
                            + str(badge_number)
                            + " does not exist for "
                            + company
                        }
                    elif badge.status == "Issued" and badge.current_appointment != name:
                        frappe.response["message"] = {
                            "error": "Badge "
                            + str(badge_number)
                            + " ("
                            + company
                            + ") is already issued to another visit ("
                            + str(badge.current_appointment)
                            + ")"
                        }
                    else:
                        # The badge is a fixed, pre-printed physical object —
                        # its QR always encodes the same company + badge
                        # number, never a per-visit code. Linking it to THIS
                        # visit is purely a server-side pointer
                        # (current_appointment); nothing about the physical
                        # card changes between visitors.
                        frappe.db.set_value(
                            "Visitor Badge",
                            badge.name,
                            {"status": "Issued", "current_appointment": name},
                        )
                        frappe.db.set_value("Appointment", name, "custom_visitor_badge", badge.name)
                        frappe.db.commit()
                        frappe.response["message"] = {
                            "badge_number": badge_number,
                            "company": company,
                            "confirm_url": frappe.utils.get_url()
                            + "/visitor-received?company="
                            + company
                            + "&badge="
                            + str(badge_number),
                        }
except Exception as e:
    frappe.db.rollback()
    frappe.log_error("issue_visitor_badge", str(e))
    frappe.response["message"] = {"error": str(e)}
