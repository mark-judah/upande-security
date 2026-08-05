try:
    data = {}
    try:
        data = frappe.request.get_json(silent=True) or {}
    except Exception:
        data = {}
    if not data:
        data = dict(frappe.form_dict or {})

    def s(key):
        try:
            v = data[key]
            if v is None:
                return ""
            return str(v).strip()
        except (KeyError, TypeError):
            return ""

    incident_datetime = s("incident_datetime")
    location = s("location")
    nature_of_incident = s("nature_of_incident")
    severity = s("severity") or "Medium"
    description = s("description")
    attachment_1 = s("attachment_1")
    attachment_2 = s("attachment_2")
    attachment_3 = s("attachment_3")
    attachment_4 = s("attachment_4")

    if not incident_datetime:
        incident_datetime = str(frappe.utils.now_datetime())

    if not nature_of_incident:
        frappe.response["message"] = {"error": "nature_of_incident is required"}
    elif severity not in ("Low", "Medium", "High", "Critical"):
        frappe.response["message"] = {"error": "severity must be Low/Medium/High/Critical"}
    else:
        # Some sites model nature_of_incident as a Link to a real "Incident
        # Category" master doctype; others use a plain Select with a fixed
        # options list, where "Incident Category" exists as a doctype but is
        # never actually populated. Only enforce Link-style validation when
        # that master data actually exists — otherwise trust the Select
        # field's own built-in option list (Frappe rejects an invalid Select
        # value on insert regardless).
        category_master_in_use = frappe.db.count("Incident Category") > 0
        cat_ok = True
        if category_master_in_use:
            cat_ok = bool(frappe.db.get_value("Incident Category", nature_of_incident, "name"))

        if not cat_ok:
            frappe.response["message"] = {
                "error": "Incident Category '" + nature_of_incident + "' does not exist"
            }
        else:
            user = frappe.session.user
            full_name = frappe.db.get_value("User", user, "full_name") or user
            now = frappe.utils.now_datetime()

            doc = frappe.new_doc("Incident Report")
            doc.incident_datetime = incident_datetime
            doc.location = location
            doc.nature_of_incident = nature_of_incident
            doc.severity = severity
            doc.description = description
            doc.reported_by = user
            doc.reporter_name = full_name
            doc.reported_datetime = now
            doc.status = "Open"
            if attachment_1:
                doc.attachment_1 = attachment_1
            if attachment_2:
                doc.attachment_2 = attachment_2
            if attachment_3:
                doc.attachment_3 = attachment_3
            if attachment_4:
                doc.attachment_4 = attachment_4

            doshs_deadline = ""
            if nature_of_incident == "Workplace Injury":
                is_fatal = s("is_fatal") in ("1", "true", "True")
                doc.is_fatal = 1 if is_fatal else 0
                doc.injury_case_status = "Reported"

                activity_at_time_of_injury = s("activity_at_time_of_injury")
                if activity_at_time_of_injury:
                    doc.activity_at_time_of_injury = activity_at_time_of_injury
                body_part_affected = s("body_part_affected")
                if body_part_affected:
                    doc.body_part_affected = body_part_affected
                nature_of_injury = s("nature_of_injury")
                if nature_of_injury:
                    doc.nature_of_injury = nature_of_injury
                injury_current_location = s("injury_current_location")
                if injury_current_location:
                    doc.injury_current_location = injury_current_location

                try:
                    incident_dt = frappe.utils.get_datetime(incident_datetime)
                    days = 2 if is_fatal else 7
                    doshs_deadline = str(frappe.utils.add_days(incident_dt, days).date())
                    doc.doshs_deadline = doshs_deadline
                except Exception:
                    doshs_deadline = ""

            doc.insert(ignore_permissions=True)
            frappe.db.commit()
            frappe.response["message"] = {
                "name": doc.name,
                "incident_datetime": incident_datetime,
                "location": location,
                "nature_of_incident": nature_of_incident,
                "severity": severity,
                "description": description,
                "reported_by": user,
                "reporter_name": full_name,
                "status": "Open",
                "doshs_deadline": doshs_deadline,
            }
except Exception as e:
    frappe.db.rollback()
    frappe.log_error("create_incident", str(e))
    frappe.response["message"] = {"error": str(e)}
