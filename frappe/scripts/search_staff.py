try:
    data = {}
    try:
        data = frappe.request.get_json(silent=True) or {}
    except Exception:
        data = {}
    if not data:
        data = dict(frappe.form_dict or {})
    query = str(data.get("query") or "").strip()

    if not query:
        frappe.response["message"] = {"error": "query is required"}
    else:
        emp = frappe.db.get_value(
            "Employee",
            {"name": query, "status": "Active"},
            [
                "name",
                "employee_name",
                "department",
                "designation",
                "company",
                "default_shift",
                "custom_farm",
                "custom_employee_category",
            ],
            as_dict=True,
        )

        if not emp:
            like = "%" + query + "%"
            rows = frappe.db.sql(
                """
                SELECT name, employee_name, department, designation, company,
                       default_shift, custom_farm, custom_employee_category
                FROM `tabEmployee`
                WHERE status = 'Active'
                  AND (name LIKE %s OR employee_name LIKE %s)
                ORDER BY employee_name ASC
                LIMIT 1
                """,
                (like, like),
                as_dict=True,
            )
            if rows:
                emp = rows[0]

        if emp:
            frappe.response["message"] = {
                "found": True,
                "employee_id": emp.name,
                "full_name": emp.employee_name or "",
                "department": emp.department or "",
                "designation": emp.designation or "",
                "company": emp.company or "",
                "default_shift": emp.default_shift or "",
                "custom_farm": emp.custom_farm or "",
                "custom_employee_category": emp.custom_employee_category or "",
            }
        else:
            frappe.response["message"] = {"found": False, "query": query}
except Exception as e:
    frappe.log_error("search_staff", str(e))
    frappe.response["message"] = {"error": str(e)}
