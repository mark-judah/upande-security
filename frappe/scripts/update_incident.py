# Edits an Incident Report from the Command Center's mobile incident-review
# screen — status changes and closing out the case with a resolution /
# corrective actions note.
#
# Request payload (only "name" is required — every other field is optional,
# only fields present in the payload are applied):
#   {
#     "name": "<INC-xxxx-xxxxx>",
#     "status": "Open" | "In Progress" | "Resolved" | "Closed",
#     "resolution": "<text>",
#     "corrective_actions": "<text>"
#   }
#
# Access: strictly Security Head / System Manager by role - no allowlist.
try:
    current_user = frappe.session.user
    role_rows = frappe.db.sql(
        "SELECT role FROM `tabHas Role` WHERE parent = %s", (current_user,)
    )
    roles = []
    for row in role_rows:
        if row and row[0]:
            roles.append(row[0])
    has_access = "Security Head" in roles or "System Manager" in roles

    if not has_access:
        frappe.response["message"] = {"error": "You do not have access to this action."}
    else:
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
        elif not frappe.db.exists("Incident Report", name):
            frappe.response["message"] = {"error": "Incident Report not found."}
        else:
            # Matches Incident Report's "status" Select options exactly (see
            # incident_report.json field_order/fields) — kept in sync by hand
            # rather than fetched via frappe.get_meta at runtime, since that
            # call isn't verified safe inside the safe-exec sandbox.
            valid_statuses = ("Open", "In Progress", "Resolved", "Closed")

            has_status = True
            status_val = None
            try:
                status_val = data["status"]
            except (KeyError, TypeError):
                has_status = False

            has_resolution = True
            resolution_val = None
            try:
                resolution_val = data["resolution"]
            except (KeyError, TypeError):
                has_resolution = False

            has_corrective_actions = True
            corrective_actions_val = None
            try:
                corrective_actions_val = data["corrective_actions"]
            except (KeyError, TypeError):
                has_corrective_actions = False

            if has_status and status_val not in valid_statuses:
                frappe.response["message"] = {"error": "Invalid status."}
            else:
                doc = frappe.get_doc("Incident Report", name)
                applied = False
                if has_status:
                    doc.status = status_val
                    applied = True
                if has_resolution:
                    doc.resolution = resolution_val
                    applied = True
                if has_corrective_actions:
                    doc.corrective_actions = corrective_actions_val
                    applied = True

                if not applied:
                    frappe.response["message"] = {"error": "No updatable fields were sent"}
                else:
                    try:
                        doc.save(ignore_permissions=True)
                        frappe.db.commit()
                        frappe.response["message"] = {
                            "success": True,
                            "name": doc.name,
                            "status": doc.status,
                            "resolution": doc.resolution or "",
                            "corrective_actions": doc.corrective_actions or "",
                        }
                    except Exception as e:
                        frappe.db.rollback()
                        frappe.response["message"] = {"error": str(e)}
except Exception as e:
    frappe.db.rollback()
    frappe.log_error("update_incident", str(e))
    frappe.response["message"] = {"error": str(e)}
