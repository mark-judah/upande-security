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
        existing = frappe.db.get_value(
            "Attendance", name, ["name", "docstatus"], as_dict=True
        )
        if not existing:
            frappe.response["message"] = {"error": "Attendance " + name + " not found"}
        elif int(existing.docstatus or 0) == 1:
            frappe.response["message"] = {
                "name": name,
                "docstatus": 1,
                "message": "already submitted",
            }
        else:
            doc = frappe.get_doc("Attendance", name)
            # Gate Guards (the actual users of this app) have create_staff_
            # attendance's insert(ignore_permissions=True) to thank for the
            # draft existing at all, but the Attendance DocPerm table never
            # grants their role "submit" - only System Manager/HR User/HR
            # Manager can. Every check-in from a plain Gate Guard hit
            # PermissionError here, silently caught below and soft-failed,
            # leaving the already-committed draft at docstatus=0 forever.
            doc.flags.ignore_permissions = True
            doc.submit()
            frappe.db.commit()
            frappe.response["message"] = {
                "name": doc.name,
                "docstatus": doc.docstatus,
            }
except Exception as e:
    frappe.db.rollback()
    frappe.log_error("submit_staff_attendance", str(e))
    frappe.response["message"] = {"error": str(e)}
