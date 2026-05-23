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
        # Validate the category exists
        cat = frappe.db.get_value("Incident Category", nature_of_incident, "name")
        if not cat:
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
            }
except Exception as e:
    frappe.db.rollback()
    frappe.log_error("create_incident", str(e))
    frappe.response["message"] = {"error": str(e)}
