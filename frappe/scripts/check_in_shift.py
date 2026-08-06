# Check In Shift — mobile check-in for External (contractor) guards only.
# Internal (Employee) guards have Attendance records that already carry
# their own check-in signal; External guards have no Employee record at
# all, so there's no Attendance path for them — this is the substitute.
#
# Writes only `checked_in`, never `status` — status stays purely
# clock-derived by security_guard_shift_assignment.py's own controller
# (validate() + the hourly refresh_shift_statuses job). Using
# frappe.db.set_value rather than doc.save() to avoid re-running validate()
# (which includes the overlap check) on a field that has nothing to do
# with scheduling.
try:
    current_user = frappe.session.user

    external_guard = None
    is_internal = False

    emp = frappe.db.get_value("Employee", {"user_id": current_user}, "name")
    if emp:
        is_internal = True
    else:
        user_full = frappe.db.get_value("User", current_user, "full_name") or ""
        if user_full:
            external_guard = frappe.db.get_value("Security Guard", {"full_name": user_full}, "name")

    if is_internal:
        frappe.response["message"] = {
            "error": "Employee guards check in via attendance, not the app"
        }
    elif not external_guard:
        frappe.response["message"] = {"error": "Could not resolve your guard identity"}
    else:
        shift_name = frappe.db.get_value(
            "Security Guard Shift Assignment",
            {"external_guard": external_guard, "status": ["in", ["Scheduled", "Active"]]},
            "name",
        )
        if not shift_name:
            frappe.response["message"] = {"error": "No scheduled or active shift found to check in to"}
        else:
            frappe.db.set_value(
                "Security Guard Shift Assignment", shift_name, "checked_in", 1, update_modified=True
            )
            frappe.db.commit()
            frappe.response["message"] = {"name": shift_name, "checked_in": 1}
except Exception as e:
    frappe.db.rollback()
    frappe.log_error("check_in_shift", str(e))
    frappe.response["message"] = {"error": str(e)}
