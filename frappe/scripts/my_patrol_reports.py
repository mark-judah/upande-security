# My Patrol Reports — guard's own filed patrol reports, most recent first.
# Filtered on `owner` (the standard Frappe field for whoever created the
# doc) rather than internal_guard/external_guard — always correct without
# needing to re-resolve guard identity, mirrors my_incidents.py's intent.
try:
    user = frappe.session.user
    rows = frappe.db.sql(
        """
        SELECT name, patrol, report_type, farm, severity, nature_of_incident,
               status, filed_at, points_logged
        FROM `tabPatrol Report`
        WHERE owner = %s
        ORDER BY filed_at DESC
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
                "patrol": r.patrol or "",
                "report_type": r.report_type or "",
                "farm": r.farm or "",
                "severity": r.severity or "",
                "nature_of_incident": r.nature_of_incident or "",
                "status": r.status or "",
                "filed_at": str(r.filed_at) if r.filed_at else "",
                "points_logged": r.points_logged or 0,
            }
        )
    frappe.response["message"] = out
except Exception as e:
    frappe.log_error("my_patrol_reports", str(e))
    frappe.response["message"] = {"error": str(e)}
