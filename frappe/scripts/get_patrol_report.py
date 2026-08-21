# Get Patrol Report — single-record fetch with an ownership check, same
# hierarchy as get_incident_report.py: System Manager sees everything, the
# filer always sees their own, a Security Head sees whatever their own
# User Permission grants, anyone else only their own company/farm.
#
# Patrol Report has no direct `company` field (only `farm`), so a
# Company-level grant is checked by resolving the report's farm's own
# company via the Farm doctype, not a column on Patrol Report itself.
try:
    data = {}
    try:
        data = frappe.request.get_json(silent=True) or {}
    except Exception:
        data = {}
    if not data:
        data = dict(frappe.form_dict or {})

    name = ""
    try:
        name = str(data["name"] or "").strip()
    except (KeyError, TypeError):
        name = ""

    if not name:
        frappe.response["message"] = {"error": "name is required"}
    else:
        r = frappe.db.get_value(
            "Patrol Report",
            name,
            [
                "name",
                "patrol",
                "report_type",
                "farm",
                "personel",
                "internal_guard",
                "external_guard",
                "shift_assignment",
                "started_at",
                "ended_at",
                "points_logged",
                "filed_at",
                "observations",
                "severity",
                "nature_of_incident",
                "incident_report",
                "attachment_1",
                "attachment_2",
                "attachment_3",
                "attachment_4",
                "status",
                "reviewed_by",
                "reviewed_on",
                "supervisor_remarks",
                "owner",
            ],
            as_dict=True,
        )
        if not r:
            frappe.response["message"] = {"error": "Patrol Report " + name + " not found"}
        else:
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

            allowed = is_system_manager or r.owner == current_user

            if not allowed:
                report_company = None
                if r.farm:
                    report_company = frappe.db.get_value("Farm", r.farm, "company")

                scope_companies = []
                scope_farms = []
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

                if report_company and report_company in scope_companies:
                    allowed = True
                elif r.farm and r.farm in scope_farms:
                    allowed = True

            if not allowed:
                frappe.response["message"] = {"error": "You do not have access to this patrol report"}
            else:
                frappe.response["message"] = {
                    "name": r.name,
                    "patrol": r.patrol or "",
                    "report_type": r.report_type or "",
                    "farm": r.farm or "",
                    "personel": r.personel or "",
                    "internal_guard": r.internal_guard or "",
                    "external_guard": r.external_guard or "",
                    "shift_assignment": r.shift_assignment or "",
                    "started_at": str(r.started_at) if r.started_at else "",
                    "ended_at": str(r.ended_at) if r.ended_at else "",
                    "points_logged": r.points_logged or 0,
                    "filed_at": str(r.filed_at) if r.filed_at else "",
                    "observations": r.observations or "",
                    "severity": r.severity or "",
                    "nature_of_incident": r.nature_of_incident or "",
                    "incident_report": r.incident_report or "",
                    "attachment_1": r.attachment_1 or "",
                    "attachment_2": r.attachment_2 or "",
                    "attachment_3": r.attachment_3 or "",
                    "attachment_4": r.attachment_4 or "",
                    "status": r.status or "",
                    "reviewed_by": r.reviewed_by or "",
                    "reviewed_on": str(r.reviewed_on) if r.reviewed_on else "",
                    "supervisor_remarks": r.supervisor_remarks or "",
                }
except Exception as e:
    frappe.log_error("get_patrol_report", str(e))
    frappe.response["message"] = {"error": str(e)}
