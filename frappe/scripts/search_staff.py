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
        fields = [
            "name",
            "employee_name",
            "department",
            "designation",
            "company",
            "default_shift",
            "custom_farm",
            "custom_employee_category",
        ]

        exact = frappe.db.get_value(
            "Employee", {"name": query, "status": "Active"}, fields, as_dict=True
        )

        if exact:
            rows = [exact]
        else:
            like = "%" + query + "%"
            rows = frappe.db.sql(
                """
                SELECT name, employee_name, department, designation, company,
                       default_shift, custom_farm, custom_employee_category
                FROM `tabEmployee`
                WHERE status = 'Active'
                  AND (name LIKE %s OR employee_name LIKE %s)
                ORDER BY employee_name ASC
                LIMIT 20
                """,
                (like, like),
                as_dict=True,
            )

        matches = []
        for r in rows:
            matches.append(
                {
                    "employee_id": r.name,
                    "full_name": r.employee_name or "",
                    "department": r.department or "",
                    "designation": r.designation or "",
                    "company": r.company or "",
                    "default_shift": r.default_shift or "",
                    "custom_farm": r.custom_farm or "",
                    "custom_employee_category": r.custom_employee_category or "",
                }
            )

        # Backward-compatible response: older installed app builds only read
        # the found/employee_id/full_name top-level shape, not "matches".
        # Keep both until every device is upgraded to the picker-UI build.
        result = {"matches": matches}
        if matches:
            best = matches[0]
            result["found"] = True
            result["employee_id"] = best["employee_id"]
            result["full_name"] = best["full_name"]
            result["department"] = best["department"]
            result["designation"] = best["designation"]
            result["company"] = best["company"]
            result["default_shift"] = best["default_shift"]
            result["custom_farm"] = best["custom_farm"]
            result["custom_employee_category"] = best["custom_employee_category"]
        else:
            result["found"] = False
            result["query"] = query
        frappe.response["message"] = result
except Exception as e:
    frappe.log_error("search_staff", str(e))
    frappe.response["message"] = {"error": str(e)}
