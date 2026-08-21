try:
    user = frappe.session.user
    rows = frappe.db.sql(
        """
        SELECT name, incident_datetime, location, nature_of_incident, severity,
               description, status, reported_datetime
        FROM `tabIncident Report`
        WHERE reported_by = %s
        ORDER BY incident_datetime DESC
        LIMIT 50
        """,
        (user,),
        as_dict=True,
    )
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
            }
        )
    frappe.response["message"] = out
except Exception as e:
    frappe.log_error("my_incidents", str(e))
    frappe.response["message"] = {"error": str(e)}
