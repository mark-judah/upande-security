# Every submitted Attendance record for today, across all employees — used
# for the Summary tab's staff activity section. Same fix as
# get_today_attendance.py: was a raw /api/resource/Attendance REST call
# from the client (fetchTodayStaffAttendance), which hits a genuine 403
# for any Gate Guard without HR-linked Attendance read access. frappe.get_all
# doesn't enforce permissions, matching create_staff_attendance/
# submit_staff_attendance/list_checked_in_staff's existing pattern.
#
# No company/farm scoping here, matching the exact behavior the raw REST
# call already had (unscoped, every company) - not changing that as part
# of this fix, just moving it behind a permission-safe endpoint.
try:
    today = frappe.utils.today()
    rows = frappe.get_all(
        "Attendance",
        filters=[
            ["attendance_date", "=", today],
            ["docstatus", "=", 1],
        ],
        fields=[
            "name",
            "employee",
            "employee_name",
            "department",
            "in_time",
            "out_time",
            "custom_temp_exit_time",
        ],
        order_by="in_time desc",
        limit_page_length=200,
    )
    frappe.response["message"] = {"attendance": rows}
except Exception as e:
    frappe.log_error("list_today_staff_attendance", str(e))
    frappe.response["message"] = {"attendance": [], "error": str(e)}
