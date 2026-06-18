# Returns all Incident Report rows for the gate dashboard, optionally filtered
# by an inclusive incident_datetime date range.
#
# Request payload (all optional):
#   { "from_date": "YYYY-MM-DD", "to_date": "YYYY-MM-DD", "limit": <int> }
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

    where_parts = ["1=1"]
    params = {}
    if from_date:
        where_parts.append("DATE(incident_datetime) >= %(from_date)s")
        params["from_date"] = from_date
    if to_date:
        where_parts.append("DATE(incident_datetime) <= %(to_date)s")
        params["to_date"] = to_date
    params["row_limit"] = limit

    where_clause = " AND ".join(where_parts)
    sql = (
        "SELECT name, incident_datetime, location, nature_of_incident, severity, "
        "description, status, reported_datetime, reported_by "
        "FROM `tabIncident Report` "
        "WHERE " + where_clause + " "
        "ORDER BY incident_datetime DESC "
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
