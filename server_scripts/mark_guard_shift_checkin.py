# Server Script — paste this into ERPNext at:
#   Server Script: Mark Guard Shift Checkin
#   Script Type:   DocType Event
#   Reference DocType: Employee Checkin
#   DocType Event: After Insert
#
# Purpose:
#   Security Head needs to see, per shift, whether the assigned guard
#   actually checked in via the biometric device — without manually cross
#   referencing Employee Checkin logs against the shift roster.
#
#   Whenever a biometric device posts a new Employee Checkin with
#   log_type=IN for an employee whose designation is "Security Guard", this
#   finds that guard's currently-Active Shift Assignment covering the
#   check-in's date and ticks it.
#
# Requires on Shift Assignment (added as Custom Fields):
#   custom_checked_in       Check     — ticked by this script
#   custom_checkin_time     Datetime  — the biometric log's time, read-only
#   custom_checkin_reference Link->Employee Checkin — audit trail, read-only
#
# Note: no frappe.db.commit() here — DocType Event scripts run inside the
# same transaction as the triggering insert; the framework commits at the
# end of the request. Calling commit()/rollback() manually is blocked by
# Frappe's sandbox for this script type (safe_exec's restrict_commit_rollback).

if doc.log_type == "IN":
    designation = frappe.db.get_value("Employee", doc.employee, "designation")
    if designation == "Security Guard":
        checkin_date = frappe.utils.getdate(doc.time)

        matches = frappe.get_all(
            "Shift Assignment",
            filters=[
                ["employee", "=", doc.employee],
                ["status", "=", "Active"],
                ["start_date", "<=", checkin_date],
            ],
            or_filters=[
                ["end_date", "is", "not set"],
                ["end_date", ">=", checkin_date],
            ],
            fields=["name"],
            order_by="start_date desc",
            limit_page_length=1,
        )

        if matches:
            frappe.db.set_value(
                "Shift Assignment",
                matches[0].name,
                {
                    "custom_checked_in": 1,
                    "custom_checkin_time": doc.time,
                    "custom_checkin_reference": doc.name,
                },
            )
