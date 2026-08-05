# Returns all Incident Report rows for the gate dashboard, optionally filtered
# by an inclusive incident_datetime date range.
#
# Request payload (all optional):
#   { "from_date": "YYYY-MM-DD", "to_date": "YYYY-MM-DD", "limit": <int> }
#
# Access scoping: Incident Report has no direct company/farm field, so the
# scope is inferred from whoever reported it (Employee.user_id = reported_by).
# System Manager sees everything; a Security Head sees whatever their own
# User Permission grants (Company and/or Farm); anyone else (a regular gate
# guard) is scoped to their own company/farm only.
#
# Notes (safe-exec quirks):
#   - frappe.form_dict gets request args; we use bracket access in try/except
#     because .get(...) is intercepted as a key lookup, not a method.
#   - SQL is parameterised — never interpolate user input.
#   - Default limit is 200 rows so the picker stays responsive; raise via the
#     limit param if you genuinely need more.
try:
    form = frappe.form_dict

    from_date = ""
    try:
        from_date = form["from_date"] or ""
    except (KeyError, TypeError):
        from_date = ""

    to_date = ""
    try:
        to_date = form["to_date"] or ""
    except (KeyError, TypeError):
        to_date = ""

    limit = 200
    try:
        raw_limit = form["limit"]
        if raw_limit:
            limit = int(raw_limit)
    except (KeyError, TypeError, ValueError):
        limit = 200
    if limit < 1:
        limit = 1
    if limit > 1000:
        limit = 1000

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

    where_parts = ["1=1"]
    params = {}
    if from_date:
        where_parts.append("DATE(i.incident_datetime) >= %(from_date)s")
        params["from_date"] = from_date
    if to_date:
        where_parts.append("DATE(i.incident_datetime) <= %(to_date)s")
        params["to_date"] = to_date

    if not is_system_manager:
        conditions = []
        if scope_companies:
            placeholders = ", ".join(["%(c" + str(idx) + ")s" for idx in range(len(scope_companies))])
            conditions.append("e.company IN (" + placeholders + ")")
            for idx in range(len(scope_companies)):
                params["c" + str(idx)] = scope_companies[idx]
        if scope_farms:
            placeholders = ", ".join(["%(f" + str(idx) + ")s" for idx in range(len(scope_farms))])
            conditions.append("e.custom_farm IN (" + placeholders + ")")
            for idx in range(len(scope_farms)):
                params["f" + str(idx)] = scope_farms[idx]
        if conditions:
            where_parts.append("(" + " OR ".join(conditions) + ")")
        else:
            # No resolvable company/farm for this user at all — show nothing
            # rather than silently falling through to "everything".
            where_parts.append("1=0")

    params["row_limit"] = limit

    where_clause = " AND ".join(where_parts)
    sql = (
        "SELECT i.name, i.incident_datetime, i.location, i.nature_of_incident, i.severity, "
        "i.description, i.status, i.reported_datetime, i.reported_by "
        "FROM `tabIncident Report` i "
        "LEFT JOIN `tabEmployee` e ON e.user_id = i.reported_by "
        "WHERE " + where_clause + " "
        "ORDER BY i.incident_datetime DESC "
        "LIMIT %(row_limit)s"
    )

    rows = frappe.db.sql(sql, params, as_dict=True)
    out = []
    for r in rows:
        out.append(
            {
                "name": r.name,
                "incident_datetime": str(r.incident_datetime) if r.incident_datetime else "",
                "location": r.location or "",
                "nature_of_incident": r.nature_of_incident or "",
                "severity": r.severity or "",
                "description": r.description or "",
                "status": r.status or "",
                "reported_datetime": str(r.reported_datetime) if r.reported_datetime else "",
                "reported_by": r.reported_by or "",
            }
        )
    frappe.response["message"] = out
except Exception as e:
    frappe.log_error("list_incidents", str(e))
    frappe.response["message"] = {"error": str(e)}
