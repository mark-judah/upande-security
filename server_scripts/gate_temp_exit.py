# Server Script — paste this into ERPNext at:
#   Server Script: gate_temp_exit
#   Script Type:   API
#   API Method:    gate_temp_exit
#   Allow Guest:   off
#
# Endpoint reached by the React Native app:
#   POST /api/method/gate_temp_exit
#   Content-Type: application/x-www-form-urlencoded
#
# Purpose:
#   Lets the guard mark someone who is currently inside as "stepped out"
#   (e.g. gone to their car for a few minutes) and later "returned", without
#   touching check-in/check-out — used by both the visitor/contractor Inside
#   list and the staff gate panel so a short absence doesn't require a full
#   check-out + re-check-in.
#
# Requires as Custom Fields on BOTH Appointment and Attendance:
#   custom_temp_exit_time   Datetime   — set while stepped out, null otherwise
#   custom_temp_exit_log    Long Text  — JSON array of {out, in, duration_minutes},
#                                        appended on each return. Audit trail only.
#
# Accepted form params:
#   reference_doctype   "Appointment" or "Attendance" (required)
#   reference_name      docname to update (required)
#   direction            "out" (step out) or "in" (return)   (required)
#
# Why frappe.db.set_value instead of doc.save():
#   Both Appointment (once checked in) and Attendance (submitted, docstatus=1)
#   may reject plain field writes outside their normal workflow/submit rules.
#   Same bypass pattern as staff_gate_checkout.py / contractor_gate_checkout.py:
#   write straight to the DB, skipping validate hooks.
#
# Returns:
#   { success: true, direction, temp_exit_time }        (direction=out)
#   { success: true, direction, out_time, duration_minutes }  (direction=in)

import json

from frappe.utils import now_datetime, time_diff_in_seconds

ALLOWED_DOCTYPES = {"Appointment", "Attendance"}

args = frappe.form_dict

reference_doctype = (args.get("reference_doctype") or "").strip()
reference_name = (args.get("reference_name") or "").strip()
direction = (args.get("direction") or "").strip()

if reference_doctype not in ALLOWED_DOCTYPES:
    frappe.throw("reference_doctype must be one of: " + ", ".join(sorted(ALLOWED_DOCTYPES)))
if not reference_name:
    frappe.throw("reference_name is required")
if direction not in ("out", "in"):
    frappe.throw("direction must be 'out' or 'in'")

doc = frappe.get_doc(reference_doctype, reference_name)
current_temp_exit = getattr(doc, "custom_temp_exit_time", None)

if direction == "out":
    if current_temp_exit:
        frappe.throw(f"{reference_name} is already stepped out")

    now_str = now_datetime().strftime("%Y-%m-%d %H:%M:%S")
    frappe.db.set_value(reference_doctype, reference_name, "custom_temp_exit_time", now_str, update_modified=True)
    frappe.db.commit()

    frappe.response["message"] = {
        "success": True,
        "direction": "out",
        "temp_exit_time": now_str,
    }

else:
    if not current_temp_exit:
        frappe.throw(f"{reference_name} is not currently stepped out")

    now_str = now_datetime().strftime("%Y-%m-%d %H:%M:%S")

    try:
        duration_minutes = round(time_diff_in_seconds(now_str, current_temp_exit) / 60, 1)
    except Exception:
        duration_minutes = None

    try:
        log = json.loads(getattr(doc, "custom_temp_exit_log", None) or "[]")
    except Exception:
        log = []
    log.append({"out": str(current_temp_exit), "in": now_str, "duration_minutes": duration_minutes})

    frappe.db.set_value(
        reference_doctype,
        reference_name,
        {"custom_temp_exit_time": None, "custom_temp_exit_log": json.dumps(log)},
        update_modified=True,
    )
    frappe.db.commit()

    frappe.response["message"] = {
        "success": True,
        "direction": "in",
        "out_time": now_str,
        "duration_minutes": duration_minutes,
    }
