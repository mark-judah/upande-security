# Server Script — paste this into ERPNext at:
#   Server Script: add_contractor_vehicle
#   Script Type:   API
#   API Method:    add_contractor_vehicle
#   Allow Guest:   off
#
# Endpoint reached by the React Native app:
#   POST /api/method/add_contractor_vehicle
#   Content-Type: application/x-www-form-urlencoded
#
# Accepted form params:
#   supplier_name   Supplier.name (required)
#   number_plate    Vehicle registration number (required)
#   colour          Vehicle colour (optional)
#   vehicle_type    Vehicle type (optional)
#
# Returns:
#   { success: true, already_exists: false }  — vehicle was added
#   { success: true, already_exists: true  }  — plate already in the child table, no change

args = frappe.form_dict

supplier_name = (args.get('supplier_name') or '').strip()
number_plate  = (args.get('number_plate')  or '').strip().upper()
colour        = (args.get('colour')        or '').strip() or None
vehicle_type  = (args.get('vehicle_type')  or '').strip() or None

if not supplier_name:
    frappe.throw('supplier_name is required')
if not number_plate:
    frappe.throw('number_plate is required')

# Load the Supplier doc
doc = frappe.get_doc('Supplier', supplier_name)

# Find the child table field that holds vehicles by inspecting child tables
# and looking for the one whose doctype contains a 'number_plate' field.
vehicle_field = None
for field in doc.meta.get_table_fields():
    child_meta = frappe.get_meta(field.options)
    field_names = [f.fieldname for f in child_meta.fields]
    if 'number_plate' in field_names:
        vehicle_field = field.fieldname
        break

if not vehicle_field:
    frappe.throw('Could not locate vehicle child table on Supplier doctype')

# Check for duplicate plate (case-insensitive)
existing_plates = [
    (row.number_plate or '').strip().upper()
    for row in (getattr(doc, vehicle_field) or [])
]

if number_plate in existing_plates:
    frappe.response['message'] = {'success': True, 'already_exists': True}
else:
    row = {'number_plate': number_plate}
    if colour:
        row['colour'] = colour
    if vehicle_type:
        row['vehicle_type'] = vehicle_type

    doc.append(vehicle_field, row)
    doc.save(ignore_permissions=True)
    frappe.db.commit()

    frappe.response['message'] = {'success': True, 'already_exists': False}
