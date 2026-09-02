# Returns Supplier Badge rows for the Command Center's sticker/badge
# management screen.
#
# Request payload (all optional):
#   { "status": "Unassigned" | "Active" | "Suspended" | "Lost",
#     "company": "<Company name>",
#     "limit": <int> }
#
# Access: System Manager or Security Head only.
try:
    allowed_roles = ("System Manager", "Security Head")
    role_rows = frappe.db.sql(
        "SELECT role FROM `tabHas Role` WHERE parent = %s", (frappe.session.user,)
    )
    caller_roles = []
    for row in role_rows:
        if row and row[0]:
            caller_roles.append(row[0])
    if not any(r in caller_roles for r in allowed_roles):
        frappe.response["message"] = {"error": "Only System Manager or Security Head can list supplier badges."}
    else:
        data = {}
        try:
            data = frappe.request.get_json(silent=True) or {}
        except Exception:
            data = {}
        if not data:
            data = dict(frappe.form_dict or {})

        status = ""
        try:
            raw_status = data["status"]
            if raw_status is not None:
                status = str(raw_status).strip()
        except (KeyError, TypeError):
            status = ""

        company = ""
        try:
            raw_company = data["company"]
            if raw_company is not None:
                company = str(raw_company).strip()
        except (KeyError, TypeError):
            company = ""

        limit = 200
        try:
            raw_limit = data["limit"]
            if raw_limit:
                limit = int(raw_limit)
        except (KeyError, TypeError, ValueError):
            limit = 200
        if limit < 1:
            limit = 1
        if limit > 1000:
            limit = 1000

        where_parts = ["1=1"]
        params = {}
        if status:
            where_parts.append("status = %(status)s")
            params["status"] = status
        if company:
            where_parts.append("company = %(company)s")
            params["company"] = company
        params["row_limit"] = limit

        where_clause = " AND ".join(where_parts)
        sql = (
            "SELECT name, badge_number, company, supplier, status, qr_image, creation "
            "FROM `tabSupplier Badge` "
            "WHERE " + where_clause + " "
            "ORDER BY creation DESC "
            "LIMIT %(row_limit)s"
        )
        rows = frappe.db.sql(sql, params, as_dict=True)
        out = []
        for r in rows:
            supplier_name = ""
            if r.supplier:
                supplier_name = frappe.db.get_value("Supplier", r.supplier, "supplier_name") or r.supplier
            out.append(
                {
                    "name": r.name,
                    "badge_number": r.badge_number,
                    "company": r.company or "",
                    "supplier": r.supplier or "",
                    "supplier_name": supplier_name,
                    "status": r.status or "",
                    "qr_image": r.qr_image or "",
                    "creation": str(r.creation) if r.creation else "",
                }
            )
        frappe.response["message"] = out
except Exception as e:
    frappe.log_error("list_supplier_badges", str(e))
    frappe.response["message"] = {"error": str(e)}
