# Today's most recent submitted Attendance record for one employee, if any
# — used by the Staff check-in panel to decide whether to show CHECK IN or
# CHECK OUT/STEP OUT.
#
# Was a raw `/api/resource/Attendance?filters=...` REST call from the
# client (see lib/api/attendance.ts's fetchTodayAttendance) instead of a
# Server Script — Attendance's own DocPerm only grants read to System
# Manager/HR User/HR Manager/the Employee role, none of which a Gate Guard
# without an HR-linked Employee record (most external/outsourced guards)
# ever has. That raw REST call hit a genuine 403 for those users the
# moment they picked a staff match, which the app's axios interceptor
# treats as a dead session - looked like "the app goes back to home" /
# forces a full logout, for what was actually just a missing read
# permission on one specific doctype. frappe.get_all (not get_list)
# doesn't enforce permissions, matching the same pattern already used by
# list_checked_in_staff and create_staff_attendance/submit_staff_attendance
# (ignore_permissions=True) - a Gate Guard legitimately needs to see this
# regardless of their base Attendance DocPerm.
try:
    data = {}
    try:
        data = frappe.request.get_json(silent=True) or {}
    except Exception:
        data = {}
    if not data:
        data = dict(frappe.form_dict or {})

    employee = ""
    try:
        employee = str(data["employee"] or "").strip()
    except (KeyError, TypeError):
        employee = ""

    if not employee:
        frappe.response["message"] = {"error": "employee is required"}
    else:
        today = frappe.utils.today()
        rows = frappe.get_all(
            "Attendance",
            filters=[
                ["employee", "=", employee],
                ["attendance_date", "=", today],
                ["docstatus", "=", 1],
            ],
            fields=[
                "name",
                "employee",
                "in_time",
                "out_time",
                "status",
                "attendance_date",
                "custom_temp_exit_time",
            ],
            order_by="creation desc",
            limit_page_length=1,
        )
        frappe.response["message"] = {"attendance": rows[0] if rows else None}
except Exception as e:
    frappe.log_error("get_today_attendance", str(e))
    frappe.response["message"] = {"error": str(e)}
