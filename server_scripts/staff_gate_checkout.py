# Server Script — paste this into ERPNext at:
#   Server Script: staff_gate_checkout
#   Script Type:   API
#   API Method:    staff_gate_checkout
#   Allow Guest:   off
#
# Endpoint reached by the React Native app:
#   POST /api/method/staff_gate_checkout
#   Content-Type: application/x-www-form-urlencoded
#
# Accepted form params:
#   attendance_name   Attendance.name to check out (required) — the RN app
#                      fetches this via GET /api/resource/Attendance first
#                      (today's record for the employee that has in_time
#                      but no out_time yet).
#
# Why frappe.db.set_value instead of doc.save():
#   Staff check-in submits the Attendance doc (docstatus=1) so it shows up
#   correctly in HR reports. Frappe blocks writes to a submitted doc's
#   fields unless they're marked allow_on_submit, which out_time / working_hours
#   are not guaranteed to be on every site. Same bypass pattern as
#   contractor_gate_checkout: write straight to the DB, skipping validate hooks.

from frappe.utils import now_datetime, time_diff_in_hours

args = frappe.form_dict

attendance_name = (args.get('attendance_name') or '').strip()
if not attendance_name:
    frappe.throw('attendance_name is required')

doc = frappe.get_doc('Attendance', attendance_name)

if doc.out_time:
    frappe.throw(f'{attendance_name} is already checked out')

now_str = now_datetime().strftime('%Y-%m-%d %H:%M:%S')

working_hours = None
if doc.in_time:
    try:
        working_hours = round(time_diff_in_hours(now_str, doc.in_time), 2)
    except Exception:
        working_hours = None

updates = {'out_time': now_str}
if working_hours is not None:
    updates['working_hours'] = working_hours

frappe.db.set_value('Attendance', attendance_name, updates, update_modified=True)
frappe.db.commit()

frappe.response['message'] = {
    'success': True,
    'attendance_name': attendance_name,
    'out_time': now_str,
    'working_hours': working_hours,
}
