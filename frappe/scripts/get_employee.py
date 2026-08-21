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
        emp = frappe.db.get_value(
            "Employee",
            name,
            [
                "name",
                "employee_name",
                "department",
                "designation",
                "company",
                "default_shift",
                "custom_farm",
                "employee_category",
                "status",
            ],
            as_dict=True,
        )
        if not emp:
            frappe.response["message"] = {"error": "Employee " + name + " not found"}
        else:
            frappe.response["message"] = {
                "name": emp.name,
                "employee_name": emp.employee_name or "",
                "department": emp.department or "",
                "designation": emp.designation or "",
                "company": emp.company or "",
                "default_shift": emp.default_shift or "",
                "custom_farm": emp.custom_farm or "",
                "custom_employee_category": emp.employee_category or "",
                "status": emp.status or "",
            }
except Exception as e:
    frappe.log_error("get_employee", str(e))
    frappe.response["message"] = {"error": str(e)}
