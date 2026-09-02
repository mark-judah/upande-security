# Writes to the Security Ops Settings singleton from the Command Center's
# mobile Settings screen.
#
# Request payload (all optional — only fields present are updated):
#   {
#     "nearby_guard_alert_radius_m": <int>,
#     "nearby_alert_stale_minutes": <int>,
#     "missed_checkin_minutes": <int>,
#     "escalation_minutes": <int>
#   }
#
# Scope of this first pass, deliberately narrow: only the 4 scalar
# thresholds are writable from mobile. fallback_contacts /
# notification_rules / farm_gates / dispatch_sources stay Desk-only — not
# exposed here.
#
# Access: strictly Security Head / System Manager by role - no allowlist.
# The Security Command Center User allowlist used to be a second path to
# this same access; it's gone from get_session_info's has_command_center_access
# (mobile chip visibility) so it has to be gone here too, otherwise someone
# who can no longer see the Command Center chip could still write to
# Settings directly - the chip hiding would be cosmetic, not real access
# control.
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

        frappe.response["message"] = {
            "success": True,
            "nearby_guard_alert_radius_m": radius_m,
            "nearby_alert_stale_minutes": stale_minutes,
            "missed_checkin_minutes": checkin_minutes,
            "escalation_minutes": escalation_minutes_val,
        }
except Exception as e:
    frappe.db.rollback()
    frappe.log_error("update_security_ops_settings", str(e))
    frappe.response["message"] = {"error": str(e)}
