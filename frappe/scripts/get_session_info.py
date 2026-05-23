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

    frappe.response["message"] = {
        "user": user,
        "full_name": full_name,
        "roles": roles,
        "is_gate_guard": "Gate Guard" in roles,
        "is_security_head": "Security Head" in roles,
        "employee": employee or {},
    }
except Exception as e:
    frappe.log_error("get_session_info", str(e))
    frappe.response["message"] = {"error": str(e)}
