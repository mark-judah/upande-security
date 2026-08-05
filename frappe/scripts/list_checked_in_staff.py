try:
    today = frappe.utils.today()

    current_user = frappe.session.user
    role_rows = frappe.db.sql(
        "SELECT role FROM `tabHas Role` WHERE parent = %s", (current_user,)
    )
    roles = []
    for row in role_rows:
        if row and row[0]:
            roles.append(row[0])

    is_system_manager = "System Manager" in roles
    is_security_head = "Security Head" in roles

    scope_companies = []
    scope_farms = []

    if not is_system_manager:
        if is_security_head:
            perm_rows = frappe.db.sql(
                "SELECT allow, for_value FROM `tabUser Permission` "
                "WHERE user = %s AND allow IN ('Company', 'Farm')",
                (current_user,),
                as_dict=True,
            )
            for p in perm_rows:
                if p.allow == "Company" and p.for_value:
                    scope_companies.append(p.for_value)
                elif p.allow == "Farm" and p.for_value:
                    scope_farms.append(p.for_value)
        else:
            employee = frappe.db.get_value(
                "Employee", {"user_id": current_user}, ["company", "custom_farm"], as_dict=True
            )
            if employee:
                if employee.company:
                    scope_companies.append(employee.company)
                if employee.custom_farm:
                    scope_farms.append(employee.custom_farm)
            else:
                user_full = frappe.db.get_value("User", current_user, "full_name") or ""
                if user_full:
                    guard = frappe.db.get_value(
                        "Security Guard", {"full_name": user_full}, ["company", "farm"], as_dict=True
                    )
                    if guard:
                        if guard.company:
                            scope_companies.append(guard.company)
                        if guard.farm:
                            scope_farms.append(guard.farm)

    filters = [
        ["attendance_date", "=", today],
        ["custom_gate_app_entry", "=", 1],
        ["out_time", "is", "not set"],
        ["docstatus", "<", 2],
    ]

    if not is_system_manager:
        if scope_companies:
            filters.append(["company", "in", scope_companies])
        elif scope_farms:
            filters.append(["custom_farm", "in", scope_farms])
        else:
            # No resolvable company/farm for this user — show nothing rather
            # than silently falling through to "everything".
            filters.append(["name", "=", "__no_match__"])

    rows = frappe.get_all(
        "Attendance",
        filters=filters,
        fields=[
            "name",
            "employee",
            "employee_name",
            "department",
            "in_time",
            "custom_temp_exit_time",
            "docstatus",
        ],
        order_by="in_time desc",
    )
    frappe.response["message"] = {"staff": rows}
except Exception as e:
    frappe.log_error("list_checked_in_staff", str(e))
    frappe.response["message"] = {"staff": [], "error": str(e)}
