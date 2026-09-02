# Edits a Security Guard Shift Assignment from the Command Center's mobile
# shift-management screen.
#
# Request payload (only "name" is required — every other field is optional,
# only fields present in the payload are applied):
#   {
#     "name": "<SGSA-xxxxx>",
#     "status": "Scheduled" | "Active" | "Ended" | "Cancelled",
#     "start_date": "YYYY-MM-DD",
#     "end_date": "YYYY-MM-DD",
#     "start_time": "HH:MM:SS",
#     "end_time": "HH:MM:SS",
#     "remarks": "<text>"
#   }
#
# Internal Guard shifts are a read-only HR mirror (see the doctype's own
# LOCKED_FIELDS_FOR_INTERNAL_GUARD / validate_internal_guard_shift_is_hr_owned
# in security_guard_shift_assignment.py) — start_date/end_date/start_time/
# end_time can't be changed here for an Internal Guard. That's already
# enforced doc-side on save, but this script rejects it up front (all-or-
# nothing, not a partial save that then throws) so the caller gets one
# clean error instead of a half-applied change. status and remarks are
# always editable regardless of guard type.
#
# Overlap checking is NOT reimplemented here — validate_no_overlapping_assignment()
# already runs inside doc.save(), so its frappe.throw() is just caught and
# surfaced as {"error": ...}.
#
# Access: strictly Security Head / System Manager by role - no allowlist.
try:
    current_user = frappe.session.user
    role_rows = frappe.db.sql(
        "SELECT role FROM `tabHas Role` WHERE parent = %s", (current_user,)
    )
    roles = []
    for row in role_rows:
        if row and row[0]:
            roles.append(row[0])
    has_access = "Security Head" in roles or "System Manager" in roles

    if not has_access:
        frappe.response["message"] = {"error": "You do not have access to this action."}
    else:
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
        elif not frappe.db.exists("Security Guard Shift Assignment", name):
            frappe.response["message"] = {"error": "Shift assignment not found."}
        else:
            doc = frappe.get_doc("Security Guard Shift Assignment", name)

            has_start_date = True
            start_date_val = None
            try:
                start_date_val = data["start_date"]
            except (KeyError, TypeError):
                has_start_date = False

            has_end_date = True
            end_date_val = None
            try:
                end_date_val = data["end_date"]
            except (KeyError, TypeError):
                has_end_date = False

            has_start_time = True
            start_time_val = None
            try:
                start_time_val = data["start_time"]
            except (KeyError, TypeError):
                has_start_time = False

            has_end_time = True
            end_time_val = None
            try:
                end_time_val = data["end_time"]
            except (KeyError, TypeError):
                has_end_time = False

            has_status = True
            status_val = None
            try:
                status_val = data["status"]
            except (KeyError, TypeError):
                has_status = False

            has_remarks = True
            remarks_val = None
            try:
                remarks_val = data["remarks"]
            except (KeyError, TypeError):
                has_remarks = False

            # Dates/times are normalised before comparing — the payload sends
            # plain "YYYY-MM-DD" / "HH:MM:SS" strings, while the loaded doc's
            # start_time/end_time come back as datetime.timedelta (e.g.
            # str() gives "8:00:00", not "08:00:00"). A raw string compare
            # would false-positive "changed" on a same-value resend just
            # because of zero-padding, incorrectly blocking a status-only
            # save. frappe.utils.getdate()/get_time() (called as
            # frappe.utils.x(), not frappe.x() — see sandbox gotchas) give
            # both sides a common representation. Any parse failure fails
            # closed (treated as blocked) rather than silently allowing an
            # edit that should have been rejected.
            blocked = False
            if doc.security_guard == "Internal Guard":
                if has_start_date:
                    try:
                        if frappe.utils.getdate(start_date_val) != frappe.utils.getdate(doc.start_date):
                            blocked = True
                    except Exception:
                        blocked = True
                if has_end_date:
                    try:
                        if frappe.utils.getdate(end_date_val) != frappe.utils.getdate(doc.end_date):
                            blocked = True
                    except Exception:
                        blocked = True
                if has_start_time:
                    try:
                        if frappe.utils.get_time(start_time_val) != frappe.utils.get_time(doc.start_time):
                            blocked = True
                    except Exception:
                        blocked = True
                if has_end_time:
                    try:
                        if frappe.utils.get_time(end_time_val) != frappe.utils.get_time(doc.end_time):
                            blocked = True
                    except Exception:
                        blocked = True

            if blocked:
                frappe.response["message"] = {
                    "error": "Internal Guard shifts mirror HR and cannot have their dates/times "
                    "edited here. Only status can be changed."
                }
            else:
                applied = False
                if has_status:
                    doc.status = status_val
                    applied = True
                if has_start_date:
                    doc.start_date = start_date_val
                    applied = True
                if has_end_date:
                    doc.end_date = end_date_val
                    applied = True
                if has_start_time:
                    doc.start_time = start_time_val
                    applied = True
                if has_end_time:
                    doc.end_time = end_time_val
                    applied = True
                if has_remarks:
                    doc.remarks = remarks_val
                    applied = True

                if not applied:
                    frappe.response["message"] = {"error": "No updatable fields were sent"}
                else:
                    try:
                        doc.save(ignore_permissions=True)
                        frappe.db.commit()

                        start_date_str = ""
                        try:
                            start_date_str = str(doc.start_date) if doc.start_date else ""
                        except Exception:
                            start_date_str = ""
                        end_date_str = ""
                        try:
                            end_date_str = str(doc.end_date) if doc.end_date else ""
                        except Exception:
                            end_date_str = ""
                        start_time_str = ""
                        try:
                            start_time_str = str(doc.start_time) if doc.start_time is not None else ""
                        except Exception:
                            start_time_str = ""
                        end_time_str = ""
                        try:
                            end_time_str = str(doc.end_time) if doc.end_time is not None else ""
                        except Exception:
                            end_time_str = ""

                        frappe.response["message"] = {
                            "success": True,
                            "name": doc.name,
                            "status": doc.status,
                            "start_date": start_date_str,
                            "end_date": end_date_str,
                            "start_time": start_time_str,
                            "end_time": end_time_str,
                            "remarks": doc.remarks or "",
                            "security_guard": doc.security_guard,
                        }
                    except Exception as e:
                        frappe.db.rollback()
                        frappe.response["message"] = {"error": str(e)}
except Exception as e:
    frappe.db.rollback()
    frappe.log_error("update_shift_assignment", str(e))
    frappe.response["message"] = {"error": str(e)}
