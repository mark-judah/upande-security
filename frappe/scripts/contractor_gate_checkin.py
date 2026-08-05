args = frappe.form_dict

appt_name       = (args.get('appointment_name') or '').strip() or None
contractor_ref  = (args.get('contractor_ref')   or '').strip() or None
contractor_name = (args.get('contractor_name')  or '').strip()
phone           = (args.get('phone')            or '').strip() or None
company         = (args.get('company')          or '').strip() or None
purpose         = (args.get('purpose')          or '').strip() or 'Contractor site access'
transport       = (args.get('transport_mode')   or 'On Foot').strip()
number_plate    = (args.get('number_plate')     or '').strip() or None
vehicle_color   = (args.get('vehicle_color')    or '').strip() or None
passengers_raw  = args.get('passengers')

if not contractor_name and contractor_ref:
    contractor_name = frappe.db.get_value('Supplier', contractor_ref, 'supplier_name') or contractor_ref

if not contractor_name:
    frappe.throw('contractor_name or contractor_ref is required')

passengers = None
if passengers_raw not in (None, '', 'null'):
    try:
        passengers = int(passengers_raw)
    except (TypeError, ValueError):
        passengers = None

now_str = frappe.utils.now()

# Stamp which company/farm this visit belongs to, from the checking-in
# guard's own scope — this is what the access scoping in daily_summary.py /
# list_incidents.py filters on.
current_user = frappe.session.user
employee = frappe.db.get_value(
    'Employee', {'user_id': current_user}, ['company', 'custom_farm'], as_dict=True
)
resolved_company = employee.company if employee else None
resolved_farm = employee.custom_farm if employee else None
if not resolved_company and not resolved_farm:
    user_full = frappe.db.get_value('User', current_user, 'full_name') or ''
    if user_full:
        guard = frappe.db.get_value(
            'Security Guard', {'full_name': user_full}, ['company', 'farm'], as_dict=True
        )
        if guard:
            resolved_company = guard.company
            resolved_farm = guard.farm

try:
    if not appt_name:
        detail_str = purpose
        if company:
            detail_str = detail_str + '\nCompany: ' + company
        if contractor_ref:
            detail_str = detail_str + ' [' + contractor_ref + ']'

        doc = frappe.new_doc('Appointment')
        doc.customer_name  = contractor_name
        doc.customer_email = ''
        doc.scheduled_time = now_str
        doc.status         = 'Open'
        doc.flags.ignore_validate        = True
        doc.flags.ignore_links           = True
        doc.flags.ignore_mandatory       = True
        doc.flags.ignore_email_alert     = True
        doc.flags.ignore_send_email      = True
        doc.flags.do_not_send_email      = True
        doc.insert(ignore_permissions=True)
        appt_name = doc.name

        updates = {
            'customer_details'             : detail_str,
            'custom_visitor_type'          : 'Contractor',
            'custom_reporting_status'      : 'Checked in',
            'custom_check_in_time'         : now_str,
            'custom_mode_of_transport'     : transport,
        }
        if phone:         updates['customer_phone_number']        = phone
        if number_plate:  updates['custom_vehicles_number_plate'] = number_plate
        if vehicle_color: updates['custom_vehicles_colour']       = vehicle_color
        if passengers is not None: updates['custom_number_of_passengers'] = passengers
        if resolved_company: updates['custom_company']   = resolved_company
        if resolved_farm:    updates['custom_farmunit']  = resolved_farm

        frappe.db.set_value('Appointment', appt_name, updates, update_modified=True)

        if contractor_ref:
            frappe.db.set_value('Appointment', appt_name, 'custom_contractor_ref', contractor_ref, update_modified=False)

    else:
        try:
            from frappe.model.workflow import apply_workflow
            doc = frappe.get_doc('Appointment', appt_name)
            apply_workflow(doc, 'Confirm Check In')
        except Exception:
            pass

        updates = {
            'custom_visitor_type'      : 'Contractor',
            'custom_check_in_time'     : now_str,
            'custom_reporting_status'  : 'Checked in',
            'custom_mode_of_transport' : transport,
        }
        if number_plate:  updates['custom_vehicles_number_plate'] = number_plate
        if vehicle_color: updates['custom_vehicles_colour']       = vehicle_color
        if passengers is not None: updates['custom_number_of_passengers'] = passengers
        if resolved_company: updates['custom_company']   = resolved_company
        if resolved_farm:    updates['custom_farmunit']  = resolved_farm

        frappe.db.set_value('Appointment', appt_name, updates, update_modified=True)
        if contractor_ref:
            frappe.db.set_value('Appointment', appt_name, 'custom_contractor_ref', contractor_ref, update_modified=False)

    frappe.db.commit()

    frappe.response['message'] = {
        'success'          : True,
        'appointment_name' : appt_name,
        'check_in_time'    : now_str,
    }

except Exception as e:
    frappe.log_error(
        title='Contractor Gate Checkin Error',
        message='User: ' + frappe.session.user + '\nError: ' + str(e)
    )
    frappe.throw('Contractor check-in failed: ' + str(e))
