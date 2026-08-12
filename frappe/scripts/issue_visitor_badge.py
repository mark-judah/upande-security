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
                # Which company+farm badge pool this is issuing from — every
                # farm has its own physical gate and its own badge stock, so
                # both dimensions are needed, not just company. Same
                # resolution order as get_security_head_contact.py: Employee
                # linked to this login first, then Security Guard matched by
                # full name (Security Guard has no user_id field). Falls back
                # to the visit's own host's company/farm when neither
                # resolves (System Manager / admin accounts testing the
                # flow, or any caller not tied to a specific company/farm) —
                # the host's own company/farm is always a reliable stand-in
                # since every visitor appointment requires a host.
                current_user = frappe.session.user
                company = ""
                farm = ""
                employee = frappe.db.get_value(
                    "Employee", {"user_id": current_user}, ["company", "custom_farm"], as_dict=True
                )
                if employee:
                    company = employee.company or ""
                    farm = employee.custom_farm or ""
                else:
                    user_full = frappe.db.get_value("User", current_user, "full_name") or ""
                    if user_full:
                        guard = frappe.db.get_value(
                            "Security Guard", {"full_name": user_full}, ["company", "farm"], as_dict=True
                        )
                        if guard:
                            company = guard.company or ""
                            farm = guard.farm or ""

                if not company or not farm:
                    host = frappe.db.get_value("Appointment", name, "custom_meet_with")
                    if host:
                        host_employee = frappe.db.get_value(
                            "Employee", host, ["company", "custom_farm"], as_dict=True
                        )
                        if host_employee:
                            if not company:
                                company = host_employee.company or ""
                            if not farm:
                                farm = host_employee.custom_farm or ""

                if not company or not farm:
                    frappe.response["message"] = {
                        "error": "Could not determine which company/farm badge pool to use "
                        "— no Employee or Security Guard record linked to this user "
                        "with both set, and this visit's host has no fallback for "
                        "whichever is still missing"
                    }
                else:
                    badge = frappe.db.get_value(
                        "Visitor Badge",
                        {"company": company, "farm": farm, "badge_number": badge_number},
                        ["name", "status", "current_appointment"],
                        as_dict=True,
                    )
                    if not badge:
                        frappe.response["message"] = {
                            "error": "Badge "
                            + str(badge_number)
                            + " does not exist for "
                            + company
                            + " / "
                            + farm
                        }
                    elif badge.status == "Issued" and badge.current_appointment != name:
                        frappe.response["message"] = {
                            "error": "Badge "
                            + str(badge_number)
                            + " ("
                            + company
                            + " / "
                            + farm
                            + ") is already issued to another visit ("
                            + str(badge.current_appointment)
                            + ")"
                        }
                    else:
                        # The badge is a fixed, pre-printed physical object —
                        # its QR always encodes the same company + farm +
                        # badge number, never a per-visit code. Linking it to
                        # THIS visit is purely a server-side pointer
                        # (current_appointment); nothing about the physical
                        # card changes between visitors.
                        #
                        # The check above and this write are NOT atomic on
                        # their own — two guards (or one guard double-tapping)
                        # issuing the same badge_number within the same
                        # instant can both read "Available" before either
                        # write lands, and both then hand the same physical
                        # card to two different visitors. Loading the full
                        # document and saving it (instead of a direct
                        # frappe.db.set_value) makes Frappe check the row's
                        # own modified timestamp before writing — if a
                        # second request's read is now stale because the
                        # first request's save already landed, this raises
                        # instead of silently overwriting, and that second
                        # guard sees a clear "just issued" error rather than
                        # believing they succeeded.
                        badge_doc = frappe.get_doc("Visitor Badge", badge.name)
                        badge_doc.status = "Issued"
                        badge_doc.current_appointment = name
                        try:
                            badge_doc.save(ignore_permissions=True)
                        except frappe.TimestampMismatchError:
                            frappe.response["message"] = {
                                "error": "Badge "
                                + str(badge_number)
                                + " ("
                                + company
                                + " / "
                                + farm
                                + ") was just issued to another visit — rescan or pick a different badge."
                            }
                        else:
                            frappe.db.set_value("Appointment", name, "custom_visitor_badge", badge.name)
                            frappe.db.commit()
                            frappe.response["message"] = {
                                "badge_number": badge_number,
                                "company": company,
                                "farm": farm,
                                "confirm_url": frappe.utils.get_url()
                                + "/visitor-received?company="
                                + company.replace(" ", "%20")
                                + "&farm="
                                + farm.replace(" ", "%20")
                                + "&badge="
                                + str(badge_number),
                            }
except Exception as e:
    frappe.db.rollback()
    frappe.log_error("issue_visitor_badge", str(e))
    frappe.response["message"] = {"error": str(e)}
