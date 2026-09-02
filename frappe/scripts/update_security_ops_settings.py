# Writes to the Security Ops Settings singleton from the Command Center's
# mobile Settings screen.
#
# Request payload (all optional — only fields present are updated):
#   {
#     "nearby_guard_alert_radius_m": <int>,
#     "nearby_alert_stale_minutes": <int>,
#     "missed_checkin_minutes": <int>,
#     "escalation_minutes": <int>,
#     "command_center_extra_users": ["user1@example.com", "user2@example.com"]
#   }
#
# Scope of this first pass, deliberately narrow: only the 4 scalar
# thresholds and the command_center_extra_users allowlist are writable from
# mobile. fallback_contacts / notification_rules / farm_gates /
# dispatch_sources stay Desk-only — not exposed here.
#
# command_center_extra_users is a full-replacement list, not an
# incremental add/remove — simplest correct approach for a small allowlist
# edited rarely. Any email that isn't an existing User is skipped (not a
# hard failure) and reported back in "skipped_users" so the caller can show
# it to the person editing.
#
# Access: same has_command_center_access logic as get_security_ops_settings
# / get_session_info (role OR allowlist membership) — not narrowed to
# System Manager / Security Head only, since the point of the allowlist is
# to let a farm manager etc. manage this screen too.
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
        extra_user = frappe.db.exists(
            "Security Command Center User",
            {"parent": "Security Ops Settings", "user": current_user},
        )
        has_access = bool(extra_user)

    if not has_access:
        frappe.response["message"] = {"error": "You do not have access to Security Ops Settings."}
    else:
        data = {}
        try:
            data = frappe.request.get_json(silent=True) or {}
        except Exception:
            data = {}
        if not data:
            data = dict(frappe.form_dict or {})

        scalar_fields = (
            "nearby_guard_alert_radius_m",
            "nearby_alert_stale_minutes",
            "missed_checkin_minutes",
            "escalation_minutes",
        )
        updates = {}
        for field in scalar_fields:
            raw_value = None
            has_field = True
            try:
                raw_value = data[field]
            except (KeyError, TypeError):
                has_field = False
            if has_field and raw_value is not None and raw_value != "":
                try:
                    updates[field] = int(raw_value)
                except (TypeError, ValueError):
                    pass

        if updates:
            frappe.db.set_value("Security Ops Settings", "Security Ops Settings", updates)

        users_provided = False
        user_list = []
        try:
            raw_users = data["command_center_extra_users"]
            if raw_users is not None:
                users_provided = True
                probe_is_list = False
                try:
                    probe = raw_users[0]
                    probe_is_list = True
                except Exception:
                    probe_is_list = False
                if probe_is_list or raw_users == []:
                    user_list = raw_users
                else:
                    user_list = [raw_users]
        except (KeyError, TypeError):
            users_provided = False

        skipped_users = []
        applied_users = []

        if users_provided:
            clean_emails = []
            for candidate in user_list:
                email = str(candidate or "").strip()
                if not email:
                    continue
                exists = frappe.db.exists("User", email)
                if exists:
                    if email not in clean_emails:
                        clean_emails.append(email)
                else:
                    if email not in skipped_users:
                        skipped_users.append(email)

            existing_rows = frappe.db.sql(
                "SELECT name FROM `tabSecurity Command Center User` "
                "WHERE parent = %(parent)s AND parenttype = %(parenttype)s",
                {"parent": "Security Ops Settings", "parenttype": "Security Ops Settings"},
                as_dict=True,
            )
            for row in existing_rows:
                frappe.delete_doc(
                    "Security Command Center User",
                    row.name,
                    force=True,
                    ignore_permissions=True,
                )

            idx = 1
            for email in clean_emails:
                row_doc = frappe.new_doc("Security Command Center User")
                row_doc.parent = "Security Ops Settings"
                row_doc.parenttype = "Security Ops Settings"
                row_doc.parentfield = "command_center_extra_users"
                row_doc.idx = idx
                row_doc.user = email
                row_doc.flags.ignore_permissions = True
                row_doc.insert(ignore_permissions=True)
                applied_users.append(email)
                idx = idx + 1

        frappe.db.commit()

        settings = frappe.db.get_value(
            "Security Ops Settings",
            "Security Ops Settings",
            [
                "nearby_guard_alert_radius_m",
                "nearby_alert_stale_minutes",
                "missed_checkin_minutes",
                "escalation_minutes",
            ],
            as_dict=True,
        )
        if not settings:
            settings = {}
        radius_m = 0
        try:
            radius_m = settings["nearby_guard_alert_radius_m"] or 0
        except (KeyError, TypeError):
            radius_m = 0
        stale_minutes = 0
        try:
            stale_minutes = settings["nearby_alert_stale_minutes"] or 0
        except (KeyError, TypeError):
            stale_minutes = 0
        checkin_minutes = 0
        try:
            checkin_minutes = settings["missed_checkin_minutes"] or 0
        except (KeyError, TypeError):
            checkin_minutes = 0
        escalation_minutes_val = 0
        try:
            escalation_minutes_val = settings["escalation_minutes"] or 0
        except (KeyError, TypeError):
            escalation_minutes_val = 0

        extra_rows = frappe.db.sql(
            "SELECT user, full_name FROM `tabSecurity Command Center User` "
            "WHERE parent = %(parent)s AND parenttype = %(parenttype)s "
            "ORDER BY idx ASC",
            {"parent": "Security Ops Settings", "parenttype": "Security Ops Settings"},
            as_dict=True,
        )
        extra_users = []
        for row in extra_rows:
            extra_users.append({"user": row.user or "", "full_name": row.full_name or ""})

        frappe.response["message"] = {
            "success": True,
            "nearby_guard_alert_radius_m": radius_m,
            "nearby_alert_stale_minutes": stale_minutes,
            "missed_checkin_minutes": checkin_minutes,
            "escalation_minutes": escalation_minutes_val,
            "command_center_extra_users": extra_users,
            "skipped_users": skipped_users,
        }
except Exception as e:
    frappe.db.rollback()
    frappe.log_error("update_security_ops_settings", str(e))
    frappe.response["message"] = {"error": str(e)}
