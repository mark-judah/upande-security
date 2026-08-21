try:
    data = {}
    try:
        data = frappe.request.get_json(silent=True) or {}
    except Exception:
        data = {}
    if not data:
        data = dict(frappe.form_dict or {})

    query = ""
    try:
        query = str(data["query"] or "").strip()
    except (KeyError, TypeError):
        query = ""

    if not query or len(query) < 2:
        frappe.response["message"] = []
    else:
        like = "%" + query + "%"
        rows = frappe.db.sql(
            """
            SELECT name, employee_name, designation, department, status
            FROM `tabEmployee`
            WHERE status = 'Active'
              AND (name LIKE %s OR employee_name LIKE %s)
            ORDER BY employee_name ASC
            LIMIT 20
            """,
            (like, like),
            as_dict=True,
        )
        out = []
        for r in rows:
            out.append(
                {
                    "name": r.name,
                    "employee_name": r.employee_name or "",
                    "designation": r.designation or "",
                    "department": r.department or "",
                    "status": r.status or "",
                }
            )
        frappe.response["message"] = out
except Exception as e:
    frappe.log_error("search_employees", str(e))
    frappe.response["message"] = {"error": str(e)}
