# My Assets At Farm — feeds the "report missing" picker: known Security
# Assets at the calling guard's own farm, most recently seen first.
try:
    current_user = frappe.session.user

    resolved_farm = None
    emp = frappe.db.get_value("Employee", {"user_id": current_user}, "custom_farm")
    if emp:
        resolved_farm = emp
    else:
        user_full = frappe.db.get_value("User", current_user, "full_name") or ""
        guard_name = None
        if user_full:
            guard_name = frappe.db.get_value("Security Guard", {"full_name": user_full}, "name")
        if guard_name:
            resolved_farm = frappe.db.get_value("Security Guard", guard_name, "farm")

    if not resolved_farm:
        frappe.response["message"] = {"assets": []}
    else:
        rows = frappe.db.sql(
            """
            SELECT asset_code, asset_name, category, last_status, last_seen_at, last_missing_reported_at
            FROM `tabSecurity Asset`
            WHERE farm = %s
            ORDER BY COALESCE(last_seen_at, '1970-01-01') DESC
            LIMIT 200
            """,
            (resolved_farm,),
            as_dict=True,
        )
        assets = []
        for r in rows:
            assets.append(
                {
                    "asset_code": r["asset_code"],
                    "asset_name": r["asset_name"],
                    "category": r["category"],
                    "last_status": r["last_status"],
                    "last_seen_at": str(r["last_seen_at"]) if r["last_seen_at"] else None,
                    "last_missing_reported_at": str(r["last_missing_reported_at"]) if r["last_missing_reported_at"] else None,
                }
            )
        frappe.response["message"] = {"assets": assets}
except Exception as e:
    frappe.log_error("my_assets_at_farm", str(e))
    frappe.response["message"] = {"error": str(e)}
