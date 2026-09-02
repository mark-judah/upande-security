"""
Regenerate ../server_scripts.json from the .py files in this folder.

Each .py file becomes one record. Mapping is held in scripts.toml-ish form
inline below — display name + api_method + script file. Edit MANIFEST when
adding a new script.

Run after pushing a script change via _push.py to keep the repo mirror in sync.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "server_scripts.json")
MODULE = "Upande Security"

# Single source of truth for which scripts exist.
# (display_name, api_method, script_file)
MANIFEST = [
    ("Get Session Info", "get_session_info", "get_session_info.py"),
    ("Search Visitor Appointment", "search_visitor_appointment", "search_visitor_appointment.py"),
    ("Search Staff", "search_staff", "search_staff.py"),
    ("Fetch Contractor Contract", "getContractorContract", "getContractorContract.py"),
    ("Contractor Gate Checkin", "contractor_gate_checkin", "contractor_gate_checkin.py"),
    ("Contractor Gate Checkout", "contractor_gate_checkout", "contractor_gate_checkout.py"),
    ("Submit Patrol Points", "submit_patrol_points", "submit_patrol_points.py"),
    ("Search Employees", "search_employees", "search_employees.py"),
    ("Get Employee", "get_employee", "get_employee.py"),
    ("Daily Summary", "daily_summary", "daily_summary.py"),
    ("Get Appointment", "get_appointment", "get_appointment.py"),
    ("Check In Visitor", "check_in_visitor", "check_in_visitor.py"),
    ("Check Out Visitor", "check_out_visitor", "check_out_visitor.py"),
    ("Create Walk In", "create_walk_in", "create_walk_in.py"),
    ("Search Vehicle Tickets", "search_vehicle_tickets", "search_vehicle_tickets.py"),
    ("Get Vehicle Ticket", "get_vehicle_ticket", "get_vehicle_ticket.py"),
    ("Mark Vehicle Task Completed", "mark_vehicle_task_completed", "mark_vehicle_task_completed.py"),
    ("Create Gate Timesheet", "create_gate_timesheet", "create_gate_timesheet.py"),
    ("Submit Gate Timesheet", "submit_gate_timesheet", "submit_gate_timesheet.py"),
    ("Create Staff Attendance", "create_staff_attendance", "create_staff_attendance.py"),
    ("Submit Staff Attendance", "submit_staff_attendance", "submit_staff_attendance.py"),
    ("List Incident Categories", "list_incident_categories", "list_incident_categories.py"),
    ("Create Incident", "create_incident", "create_incident.py"),
    ("My Incidents", "my_incidents", "my_incidents.py"),
    ("List Incidents", "list_incidents", "list_incidents.py"),
    ("Notify Host", "notify_host", "notify_host.py"),
    ("Create Walk In Notify", "create_walk_in_notify", "create_walk_in_notify.py"),
    ("Create Contractor Notify", "create_contractor_notify", "create_contractor_notify.py"),
    ("Security Report", "security_report", "security_report.py"),
    ("Pending Approvals", "pending_approvals", "pending_approvals.py"),
    ("Approved Appointments", "approved_appointments", "approved_appointments.py"),
    ("Gate Activity", "gate_activity", "gate_activity.py"),
    ("Fetch Security Dashboard Data", "fetchSecurityDasboardData", "fetchSecurityDasboardData.py"),
    ("Fetch Patrol Data", "fetchPatrolData", "fetchPatrolData.py"),
    ("Gate Temp Exit", "gate_temp_exit", "gate_temp_exit.py"),
    ("Staff Gate Checkout", "staff_gate_checkout", "staff_gate_checkout.py"),
    ("Get Visitor History", "get_visitor_history", "get_visitor_history.py"),
    ("Update Shift Assignment", "update_shift_assignment", "update_shift_assignment.py"),
    ("Update Incident", "update_incident", "update_incident.py"),
    ("Update Supplier Badge", "update_supplier_badge", "update_supplier_badge.py"),
]

# NOTE (2026-09-02): this MANIFEST list is stale relative to
# ../server_scripts.json — server_scripts.json currently has 61 records
# (many added directly, not via this file) while MANIFEST only lists 40.
# DO NOT run main() until MANIFEST is reconciled to the full live set —
# doing so today would silently drop every record not listed here. The 3
# new entries above were added to server_scripts.json (and
# fixtures/server_script.json) by hand instead, matching the existing
# record shape.


def main():
    records = []
    for display, api_method, fname in MANIFEST:
        path = os.path.join(HERE, fname)
        if not os.path.exists(path):
            print("missing:", fname, file=sys.stderr)
            sys.exit(2)
        records.append(
            {
                "name": display,
                "script_type": "API",
                "api_method": api_method,
                "module": MODULE,
                "disabled": 0,
                "allow_guest": 0,
                "script": open(path).read(),
            }
        )
    with open(OUT, "w") as f:
        json.dump(records, f, indent=2, ensure_ascii=False)
    print("wrote", len(records), "scripts ->", OUT)


if __name__ == "__main__":
    main()
