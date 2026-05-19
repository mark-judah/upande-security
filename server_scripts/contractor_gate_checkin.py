# Server Script — paste this into ERPNext at:
#   Server Script: contractor_gate_checkin
#   Script Type:   API
#   API Method:    contractor_gate_checkin
#   Allow Guest:   off
#
# Endpoint reached by the React Native app:
#   POST /api/method/contractor_gate_checkin
#   Content-Type: application/x-www-form-urlencoded
#
# Accepted form params (all optional except one of contractor_ref / contractor_name):
#   contractor_ref     Supplier name (approved-contractor path)
#   contractor_name    Display name (used when no supplier matched, or to override)
#   phone              Contact phone
#   company            Free-text company (stashed into customer_details)
#   purpose            Free-text purpose of visit
#   transport_mode     "On Foot" | "Vehicle" | "Motor Bike"
#   number_plate       Vehicle reg
#   vehicle_color      Vehicle colour
#   passengers         Integer
#
# Why the two-phase save:
#   custom_meet_with is a Link → Employee. Frappe's _validate_links() will reject
#   any non-Employee value, and contractors aren't Employees. We never set
#   custom_meet_with at all — but to be defensive we also disable link/validate
#   hooks on the insert. All contractor-specific custom_* fields are written via
#   frappe.db.set_value AFTER insert so that no validate/link hook can touch them.

from frappe.utils import now_datetime

args = frappe.form_dict

contractor_ref  = (args.get('contractor_ref')  or '').strip() or None
contractor_name = (args.get('contractor_name') or '').strip()
phone           = (args.get('phone')           or '').strip() or None
company         = (args.get('company')         or '').strip() or None
purpose         = (args.get('purpose')         or '').strip() or 'Contractor site access'
transport_mode  = (args.get('transport_mode')  or 'On Foot').strip()
number_plate    = (args.get('number_plate')    or '').strip() or None
vehicle_color   = (args.get('vehicle_color')   or '').strip() or None
passengers_raw  = args.get('passengers')

# If only supplier ref was provided, pull canonical display name.
if not contractor_name and contractor_ref:
    contractor_name = (
        frappe.db.get_value('Supplier', contractor_ref, 'supplier_name')
        or contractor_ref
    )

if not contractor_name:
    frappe.throw('contractor_name or contractor_ref is required')

passengers = None
if passengers_raw not in (None, '', 'null'):
    try:
        passengers = int(passengers_raw)
    except (TypeError, ValueError):
        passengers = None

now_str = now_datetime().strftime('%Y-%m-%d %H:%M:%S')

# Build the Appointment WITHOUT custom_meet_with so _validate_links can't fire on it.
doc = frappe.new_doc('Appointment')
doc.customer_name = contractor_name
doc.customer_phone_number = phone or ''
doc.customer_email = (
    (phone.replace(' ', '') if phone else (contractor_ref or contractor_name).replace(' ', '').lower())
    + '@contractor.gate'
)
doc.scheduled_time = now_str
doc.customer_details = (purpose + (('\nCompany: ' + company) if company else ''))
doc.custom_mode_of_transport = transport_mode
doc.status = 'Open'

# Belt + suspenders: skip every validation hook on the insert.
doc.flags.ignore_validate = True
doc.flags.ignore_links = True
doc.flags.ignore_mandatory = True
doc.flags.ignore_permissions = True
doc.insert(ignore_permissions=True)

# Now write every contractor-specific custom field straight to the DB.
# frappe.db.set_value does NOT run document validate / link checks.
updates = {
    'custom_visitor_type':    'Contractor',
    'custom_reporting_status': 'Checked in',
    'custom_check_in_time':    now_str,
    'custom_mode_of_transport': transport_mode,
}
if contractor_ref:
    updates['custom_contractor_ref'] = contractor_ref
if number_plate:
    updates['custom_vehicles_number_plate'] = number_plate
if vehicle_color:
    updates['custom_vehicles_colour'] = vehicle_color
if passengers is not None:
    updates['custom_number_of_passengers'] = passengers

frappe.db.set_value('Appointment', doc.name, updates, update_modified=True)
frappe.db.commit()

frappe.response['message'] = {
    'success': True,
    'appointment_name': doc.name,
    'check_in_time': now_str,
}
