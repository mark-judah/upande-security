# Returns Staff Vehicle Sticker Request rows for the Command Center's
# sticker/badge management screen (the review queue that feeds
# approve_staff_sticker_request / reject_staff_sticker_request).
#
# Request payload (all optional):
#   { "status": "Pending" | "Approved" | "Rejected", "limit": <int> }
#   status defaults to "Pending" — that's the working set a review screen
#   needs most; pass an explicit empty string to get all statuses.
#
# Access: System Manager or Security Head only (management/approval surface,
# same gate as approve/reject).
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
        frappe.response["message"] = {"error": "Only System Manager or Security Head can list sticker requests."}
    else:
        data = {}
        try:
            data = frappe.request.get_json(silent=True) or {}
        except Exception:
            data = {}
        if not data:
            data = dict(frappe.form_dict or {})

        status = "Pending"
        try:
            raw_status = data["status"]
            if raw_status is not None:
                status = str(raw_status).strip()
        except (KeyError, TypeError):
            status = "Pending"

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
        params["row_limit"] = limit

        where_clause = " AND ".join(where_parts)
        sql = (
            "SELECT name, employee, employee_name, vehicle_type, plate_number, color, "
            "collection_farm, collection_point, status, review_notes, linked_sticker, creation "
            "FROM `tabStaff Vehicle Sticker Request` "
            "WHERE " + where_clause + " "
            "ORDER BY creation DESC "
            "LIMIT %(row_limit)s"
        )
        rows = frappe.db.sql(sql, params, as_dict=True)
        out = []
        for r in rows:
            out.append(
                {
                    "name": r.name,
                    "employee": r.employee or "",
                    "employee_name": r.employee_name or "",
                    "vehicle_type": r.vehicle_type or "",
                    "plate_number": r.plate_number or "",
                    "color": r.color or "",
                    "collection_farm": r.collection_farm or "",
                    "collection_point": r.collection_point or "",
                    "status": r.status or "",
                    "review_notes": r.review_notes or "",
                    "linked_sticker": r.linked_sticker or "",
                    "creation": str(r.creation) if r.creation else "",
                }
            )
        frappe.response["message"] = out
except Exception as e:
    frappe.log_error("list_sticker_requests", str(e))
    frappe.response["message"] = {"error": str(e)}
