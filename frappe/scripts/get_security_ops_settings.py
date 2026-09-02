# Returns the Security Ops Settings singleton for the Command Center's
# mobile Settings screen.
#
# Scope of this first pass, deliberately narrow: only the 4 scalar
# thresholds plus the command_center_extra_users allowlist are exposed.
# fallback_contacts / notification_rules / farm_gates / dispatch_sources
# are read-only-in-Desk for now (no mobile screen needs them yet) and are
# intentionally left out of this response.
#
# Access: same "has_command_center_access" logic as get_session_info —
# System Manager / Security Head by role, OR anyone listed in
# command_center_extra_users. Checked here (not just role) since the whole
# point of the allowlist is to grant Settings access to non-Security-Head
# users too.
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
            "nearby_guard_alert_radius_m": radius_m,
            "nearby_alert_stale_minutes": stale_minutes,
            "missed_checkin_minutes": checkin_minutes,
            "escalation_minutes": escalation_minutes_val,
            "command_center_extra_users": extra_users,
        }
except Exception as e:
    frappe.log_error("get_security_ops_settings", str(e))
    frappe.response["message"] = {"error": str(e)}
