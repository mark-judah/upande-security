# My Current Shift — guard-facing read of their own shift assignment.
# Returns the currently Active shift if one exists, else the nearest
# upcoming Scheduled one, else none. Desk-only creation (Security Head /
# System Manager / HR User already have full CRUD via native doctype
# permissions) — this verb is read-only for the guard's own record.
# guard_type/checked_in are surfaced so the mobile app can decide whether
# to show the app-based "check in to shift" action — that's only relevant
# for External (contractor) guards, who have no Employee/Attendance record
# to check in against at all. Internal guards' checked_in stays governed by
# whatever process ties it to Attendance — untouched here.
try:
    current_user = frappe.session.user

    internal_guard = None
    external_guard = None
    guard_type = None

    emp = frappe.db.get_value("Employee", {"user_id": current_user}, "name")
    if emp:
        internal_guard = emp
        guard_type = "Internal"
    else:
        user_full = frappe.db.get_value("User", current_user, "full_name") or ""
        if user_full:
            guard_name = frappe.db.get_value("Security Guard", {"full_name": user_full}, "name")
            if guard_name:
                external_guard = guard_name
                guard_type = "External"

    if not internal_guard and not external_guard:
        frappe.response["message"] = {"shift": None}
    else:
        active = None
        if internal_guard:
            rows = frappe.db.sql(
                """
                SELECT name, farm, shift_type, start_date, end_date, status, checked_in
                FROM `tabSecurity Guard Shift Assignment`
                WHERE internal_guard = %s AND status = 'Active'
                ORDER BY start_date DESC
                LIMIT 1
                """,
                (internal_guard,),
                as_dict=True,
            )
        else:
            rows = frappe.db.sql(
                """
                SELECT name, farm, shift_type, start_date, end_date, status, checked_in
                FROM `tabSecurity Guard Shift Assignment`
                WHERE external_guard = %s AND status = 'Active'
                ORDER BY start_date DESC
                LIMIT 1
                """,
                (external_guard,),
                as_dict=True,
            )
        if rows:
            active = rows[0]

        upcoming = None
        if not active:
            if internal_guard:
                rows2 = frappe.db.sql(
                    """
                    SELECT name, farm, shift_type, start_date, end_date, status, checked_in
                    FROM `tabSecurity Guard Shift Assignment`
                    WHERE internal_guard = %s AND status = 'Scheduled'
                    ORDER BY start_date ASC
                    LIMIT 1
                    """,
                    (internal_guard,),
                    as_dict=True,
                )
            else:
                rows2 = frappe.db.sql(
                    """
                    SELECT name, farm, shift_type, start_date, end_date, status, checked_in
                    FROM `tabSecurity Guard Shift Assignment`
                    WHERE external_guard = %s AND status = 'Scheduled'
                    ORDER BY start_date ASC
                    LIMIT 1
                    """,
                    (external_guard,),
                    as_dict=True,
                )
            if rows2:
                upcoming = rows2[0]

        chosen = active if active else upcoming
        if not chosen:
            frappe.response["message"] = {"shift": None, "guard_type": guard_type}
        else:
            frappe.response["message"] = {
                "shift": {
                    "name": chosen["name"],
                    "farm": chosen["farm"],
                    "shift_type": chosen["shift_type"],
                    "start_date": str(chosen["start_date"]),
                    "end_date": str(chosen["end_date"]),
                    "status": chosen["status"],
                    "guard_type": guard_type,
                    "checked_in": 1 if chosen["checked_in"] else 0,
                }
            }
except Exception as e:
    frappe.log_error("my_current_shift", str(e))
    frappe.response["message"] = {"error": str(e)}
