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

    # Command Center (the mobile app's admin/management view — shift planning,
    # full incident list, sticker/badge approvals, Security Ops Settings) is
    # open to Security Head / System Manager by role, plus anyone explicitly
    # listed in Security Ops Settings' "Additional Users" table, so a farm
    # manager or similar can get access without a role change. Checked here
    # (not client-side) since the extra-users list isn't something the app
    # should have to fetch and reason about itself.
    has_command_center_access = "Security Head" in roles or "System Manager" in roles
    if not has_command_center_access:
        extra_user = frappe.db.exists(
            "Security Command Center User",
            {"parent": "Security Ops Settings", "user": user},
        )
        has_command_center_access = bool(extra_user)

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
