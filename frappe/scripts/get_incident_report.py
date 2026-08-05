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
            "Incident Report",
            name,
            [
                "name",
                "incident_datetime",
                "location",
                "nature_of_incident",
                "severity",
                "description",
                "status",
                "reported_by",
                "reporter_name",
                "reported_datetime",
                "activity_at_time_of_injury",
                "body_part_affected",
                "nature_of_injury",
                "is_fatal",
                "doshs_deadline",
                "doshs_reported",
                "doshs_reported_date",
                "doshs_reference_number",
                "attending_physician",
                "injury_case_status",
                "injury_current_location",
                "days_off_work",
                "return_to_work_date",
                "first_aid_given",
                "first_aider_name",
                "ambulance_needed",
                "ambulance_provider",
                "ambulance_called_at",
                "taken_to_hospital",
                "hospital_name",
                "hospital_admission_type",
                "treatment_summary",
                "police_report_required",
                "ob_number",
                "police_station",
                "compensation_required",
                "wiba_claim_filed",
                "wiba_claim_number",
                "payment_status",
                "amount_paid",
            ],
            as_dict=True,
        )
        if not r:
            frappe.response["message"] = {"error": "Incident Report " + name + " not found"}
        else:
            # Access scoping — same hierarchy as list_incidents.py: System
            # Manager sees everything; a Security Head is scoped to their own
            # User Permission grants; anyone else only their own company/farm,
            # inferred from whoever reported the incident.
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

            allowed = is_system_manager or r.reported_by == current_user

            if not allowed:
                reporter_employee = frappe.db.get_value(
                    "Employee", {"user_id": r.reported_by}, ["company", "custom_farm"], as_dict=True
                )
                reporter_company = reporter_employee.company if reporter_employee else None
                reporter_farm = reporter_employee.custom_farm if reporter_employee else None

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

                if reporter_company and reporter_company in scope_companies:
                    allowed = True
                elif reporter_farm and reporter_farm in scope_farms:
                    allowed = True

            if not allowed:
                frappe.response["message"] = {"error": "You do not have access to this incident"}
            else:
                witnesses = frappe.get_all(
                    "Incident Person",
                    filters={"parent": name, "parentfield": "witnesses"},
                    fields=["person_name", "person_type", "contact", "id_number", "notes"],
                )
                victims = frappe.get_all(
                    "Incident Person",
                    filters={"parent": name, "parentfield": "victims"},
                    fields=["person_name", "person_type", "contact", "id_number", "notes"],
                )
                frappe.response["message"] = {
                "name": r.name,
                "incident_datetime": str(r.incident_datetime) if r.incident_datetime else "",
                "location": r.location or "",
                "nature_of_incident": r.nature_of_incident or "",
                "severity": r.severity or "",
                "description": r.description or "",
                "status": r.status or "",
                "reported_by": r.reported_by or "",
                "reporter_name": r.reporter_name or "",
                "reported_datetime": str(r.reported_datetime) if r.reported_datetime else "",
                "activity_at_time_of_injury": r.activity_at_time_of_injury or "",
                "body_part_affected": r.body_part_affected or "",
                "nature_of_injury": r.nature_of_injury or "",
                "is_fatal": bool(r.is_fatal),
                "doshs_deadline": str(r.doshs_deadline) if r.doshs_deadline else "",
                "doshs_reported": bool(r.doshs_reported),
                "doshs_reported_date": str(r.doshs_reported_date) if r.doshs_reported_date else "",
                "doshs_reference_number": r.doshs_reference_number or "",
                "attending_physician": r.attending_physician or "",
                "injury_case_status": r.injury_case_status or "",
                "injury_current_location": r.injury_current_location or "",
                "days_off_work": r.days_off_work if r.days_off_work is not None else None,
                "return_to_work_date": str(r.return_to_work_date) if r.return_to_work_date else "",
                "first_aid_given": bool(r.first_aid_given),
                "first_aider_name": r.first_aider_name or "",
                "ambulance_needed": bool(r.ambulance_needed),
                "ambulance_provider": r.ambulance_provider or "",
                "ambulance_called_at": str(r.ambulance_called_at) if r.ambulance_called_at else "",
                "taken_to_hospital": bool(r.taken_to_hospital),
                "hospital_name": r.hospital_name or "",
                "hospital_admission_type": r.hospital_admission_type or "",
                "treatment_summary": r.treatment_summary or "",
                "police_report_required": bool(r.police_report_required),
                "ob_number": r.ob_number or "",
                "police_station": r.police_station or "",
                "compensation_required": bool(r.compensation_required),
                "wiba_claim_filed": bool(r.wiba_claim_filed),
                "wiba_claim_number": r.wiba_claim_number or "",
                "payment_status": r.payment_status or "",
                "amount_paid": r.amount_paid if r.amount_paid is not None else None,
                "witnesses": witnesses,
                "victims": victims,
            }
except Exception as e:
    frappe.log_error("get_incident_report", str(e))
    frappe.response["message"] = {"error": str(e)}
