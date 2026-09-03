try:
    data = {}
    try:
        data = frappe.request.get_json(silent=True) or {}
    except Exception:
        data = {}
    if not data:
        data = dict(frappe.form_dict or {})

    date_str = ""
    try:
        date_str = str(data["date"] or "").strip()
    except (KeyError, TypeError):
        date_str = ""
    if not date_str:
        date_str = str(frappe.utils.nowdate())

    start = date_str + " 00:00:00"
    end = date_str + " 23:59:59"

    # Access scoping — System Manager sees everything; a Security Head sees
    # whatever their own User Permission grants (Company and/or Farm rows,
    # which may be broader or narrower than a single farm); anyone else (a
    # regular gate guard) is scoped to their own company/farm only, resolved
    # the same way as get_security_head_contact.py — Employee first, then
    # Security Guard matched by full name.
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

    scope_sql = ""
    scope_params = []
    if not is_system_manager:
        conditions = []
        if scope_companies:
            placeholders = ", ".join(["%s"] * len(scope_companies))
            conditions.append("a.custom_company IN (" + placeholders + ")")
            scope_params = scope_params + scope_companies
        if scope_farms:
            placeholders = ", ".join(["%s"] * len(scope_farms))
            conditions.append("a.custom_farmunit IN (" + placeholders + ")")
            scope_params = scope_params + scope_farms
        if conditions:
            scope_sql = " AND (" + " OR ".join(conditions) + ")"
        else:
            # No resolvable company/farm for this user at all — show nothing
            # rather than silently falling through to "everything".
            scope_sql = " AND 1=0"

    rows = frappe.db.sql(
        """
        SELECT a.name, a.customer_name, a.customer_phone_number,
               a.customer_organization,
               a.custom_meet_with, e.employee_name AS host_name,
               a.workflow_state, a.custom_reporting_status,
               a.custom_check_in_time, a.custom_check_out_time,
               a.scheduled_time, a.custom_mode_of_transport,
               a.custom_vehicles_number_plate, a.custom_vehicles_colour,
               a.custom_number_of_passengers, a.custom_visitor_type,
               a.custom_contractor_ref, a.custom_temp_exit_time,
               a.customer_details
        FROM `tabAppointment` a
        LEFT JOIN `tabEmployee` e ON e.name = a.custom_meet_with
        WHERE a.scheduled_time BETWEEN %s AND %s
        """
        + scope_sql
        + """
        ORDER BY a.custom_check_in_time DESC, a.scheduled_time DESC
        LIMIT 200
        """,
        [start, end] + scope_params,
        as_dict=True,
    )

    all_records = []
    for r in rows:
        all_records.append(
            {
                "name": r.name,
                "customer_name": r.customer_name or "",
                "customer_phone_number": r.customer_phone_number or "",
                "customer_organization": r.customer_organization or "",
                "custom_meet_with": r.custom_meet_with or "",
                "host_name": r.host_name or r.custom_meet_with or "",
                "workflow_state": r.workflow_state or "",
                "custom_reporting_status": r.custom_reporting_status or "",
                "custom_check_in_time": str(r.custom_check_in_time) if r.custom_check_in_time else "",
                "custom_check_out_time": str(r.custom_check_out_time) if r.custom_check_out_time else "",
                "scheduled_time": str(r.scheduled_time) if r.scheduled_time else "",
                "custom_mode_of_transport": r.custom_mode_of_transport or "",
                "custom_vehicles_number_plate": r.custom_vehicles_number_plate or "",
                "custom_vehicles_colour": r.custom_vehicles_colour or "",
                "custom_number_of_passengers": r.custom_number_of_passengers or 0,
                "custom_visitor_type": r.custom_visitor_type or "Visitor",
                "custom_contractor_ref": r.custom_contractor_ref or "",
                "custom_temp_exit_time": str(r.custom_temp_exit_time) if r.custom_temp_exit_time else "",
                "customer_details": r.customer_details or "",
            }
        )

    checked_in = 0
    checked_out = 0
    still_inside = []
    for a in all_records:
        if a["custom_check_in_time"]:
            checked_in = checked_in + 1
            if not a["custom_check_out_time"]:
                still_inside.append(a)
        if a["custom_check_out_time"]:
            checked_out = checked_out + 1

    frappe.response["message"] = {
        "date": date_str,
        "total_checked_in": checked_in,
        "total_checked_out": checked_out,
        "still_inside": len(still_inside),
        "still_inside_list": still_inside,
        "all": all_records,
    }
except Exception as e:
    frappe.log_error("daily_summary", str(e))
    frappe.response["message"] = {"error": str(e)}
