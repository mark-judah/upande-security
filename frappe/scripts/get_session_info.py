try:
    user = frappe.session.user
    full_name = frappe.db.get_value("User", user, "full_name") or user

    role_rows = frappe.db.sql(
        "SELECT role FROM `tabHas Role` WHERE parent = %s", (user,)
    )
    roles = []
    for r in role_rows:
        if r and r[0]:
            roles.append(r[0])

    employee = frappe.db.get_value(
        "Employee",
        {"user_id": user},
        [
            "name",
            "employee_name",
            "department",
            "designation",
            "company",
            "custom_farm",
        ],
        as_dict=True,
    )

    # Command Center (the mobile app's admin/management view - shift planning,
    # full incident list, sticker/badge approvals, Security Ops Settings) is
    # strictly role-gated: Security Head or System Manager only. No allowlist
    # bypass - every action inside Command Center is itself sensitive
    # (editing live shift plans, approving stickers/badges, changing Security
    # Ops Settings), so access has to track the same role that already governs
    # write permission on those doctypes, not a separate list that could drift
    # out of sync with what someone can actually do once inside.
    has_command_center_access = "Security Head" in roles or "System Manager" in roles

    frappe.response["message"] = {
        "user": user,
        "full_name": full_name,
        "roles": roles,
        "is_gate_guard": "Gate Guard" in roles,
        "is_security_head": "Security Head" in roles,
        "has_command_center_access": has_command_center_access,
        "employee": employee or {},
    }
except Exception as e:
    frappe.log_error("get_session_info", str(e))
    frappe.response["message"] = {"error": str(e)}
