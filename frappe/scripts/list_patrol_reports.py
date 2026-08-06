# List Patrol Reports — supervisor-facing list for reviewing what guards
# have filed. Same hierarchical scoping as list_incidents.py: System
# Manager sees everything; a Security Head sees whatever their own User
# Permission grants (Company and/or Farm); anyone else is scoped to their
# own company/farm only.
#
# Patrol Report has no direct `company` column (only `farm`), so a
# Company-level grant is matched via a LEFT JOIN to Farm rather than a
# LEFT JOIN to Employee the way list_incidents.py does it — farm is already
# directly on this doctype, no need to infer it from the filer.
#
# Request payload (all optional):
#   { "from_date": "YYYY-MM-DD", "to_date": "YYYY-MM-DD", "status": "...",
#     "report_type": "Routine"|"Incident", "limit": <int> }
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

    status_filter = ""
    try:
        status_filter = form["status"] or ""
    except (KeyError, TypeError):
        status_filter = ""

    report_type_filter = ""
    try:
        report_type_filter = form["report_type"] or ""
    except (KeyError, TypeError):
        report_type_filter = ""

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
        where_parts.append("DATE(p.filed_at) >= %(from_date)s")
        params["from_date"] = from_date
    if to_date:
        where_parts.append("DATE(p.filed_at) <= %(to_date)s")
        params["to_date"] = to_date
    if status_filter:
        where_parts.append("p.status = %(status_filter)s")
        params["status_filter"] = status_filter
    if report_type_filter:
        where_parts.append("p.report_type = %(report_type_filter)s")
        params["report_type_filter"] = report_type_filter

    if not is_system_manager:
        conditions = []
        if scope_companies:
            placeholders = ", ".join(["%(c" + str(idx) + ")s" for idx in range(len(scope_companies))])
            conditions.append("f.company IN (" + placeholders + ")")
            for idx in range(len(scope_companies)):
                params["c" + str(idx)] = scope_companies[idx]
        if scope_farms:
            placeholders = ", ".join(["%(f" + str(idx) + ")s" for idx in range(len(scope_farms))])
            conditions.append("p.farm IN (" + placeholders + ")")
            for idx in range(len(scope_farms)):
                params["f" + str(idx)] = scope_farms[idx]
        if conditions:
            where_parts.append("(" + " OR ".join(conditions) + ")")
        else:
            # No resolvable company/farm for this user — show nothing rather
            # than silently falling through to "everything".
            where_parts.append("1=0")

    params["row_limit"] = limit

    where_clause = " AND ".join(where_parts)
    sql = (
        "SELECT p.name, p.patrol, p.report_type, p.farm, p.severity, p.nature_of_incident, "
        "p.status, p.filed_at, p.points_logged, p.personel, p.internal_guard, p.external_guard "
        "FROM `tabPatrol Report` p "
        "LEFT JOIN `tabFarm` f ON f.name = p.farm "
        "WHERE " + where_clause + " "
        "ORDER BY p.filed_at DESC "
        "LIMIT %(row_limit)s"
    )

    rows = frappe.db.sql(sql, params, as_dict=True)
    out = []
    for r in rows:
        out.append(
            {
                "name": r.name,
                "patrol": r.patrol or "",
                "report_type": r.report_type or "",
                "farm": r.farm or "",
                "severity": r.severity or "",
                "nature_of_incident": r.nature_of_incident or "",
                "status": r.status or "",
                "filed_at": str(r.filed_at) if r.filed_at else "",
                "points_logged": r.points_logged or 0,
                "personel": r.personel or "",
                "internal_guard": r.internal_guard or "",
                "external_guard": r.external_guard or "",
            }
        )
    frappe.response["message"] = out
except Exception as e:
    frappe.log_error("list_patrol_reports", str(e))
    frappe.response["message"] = {"error": str(e)}
