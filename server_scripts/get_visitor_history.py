# Server Script — paste this into ERPNext at:
#   Server Script: get_visitor_history
#   Script Type:   API
#   API Method:    getVisitorHistory
#   Allow Guest:   off
#
# Endpoint reached by the React Native app:
#   POST /api/method/getVisitorHistory
#
# Purpose:
#   getVisitorAppointment only matches an appointment SCHEDULED FOR TODAY.
#   When a walk-in visitor has no appointment today, this method instead
#   looks back across ALL past Appointments for that visitor (matched by
#   phone number or name) and returns their most recent completed visit, so
#   the gate app can prefill host / purpose / transport / vehicle instead of
#   asking the guard to type everything again.
#
#   Matching is on phone number / name only for now. The app has an "ID"
#   field planned for visitors but it has not been deployed to this site's
#   Appointment doctype yet — once it exists, add it to the or_filters list
#   below (e.g. ['custom_id_number', '=', query]) and it'll take priority
#   automatically since Frappe ORs all of or_filters together.
#
# Accepted params:
#   query   Phone number or name text typed into the gate search bar (required)
#
# Returns:
#   { found: false }
#   { found: true, visitor_name, phone_number, host_id, host_name, purpose,
#     transport_mode, vehicle_reg_no, vehicle_color, last_visit_date }

query = (frappe.form_dict.get('query') or '').strip()

if not query:
    frappe.response['message'] = {'found': False}
else:
    matches = frappe.get_all(
        'Appointment',
        filters=[
            ['custom_visitor_type', 'in', ['Visitor', '']],
            ['custom_check_in_time', 'is', 'set'],
        ],
        or_filters=[
            ['customer_phone_number', '=', query],
            ['customer_name', 'like', f'%{query}%'],
        ],
        fields=[
            'name',
            'customer_name',
            'customer_phone_number',
            'custom_meet_with',
            'host_name',
            'customer_details',
            'custom_mode_of_transport',
            'custom_vehicles_number_plate',
            'custom_vehicles_colour',
            'scheduled_time',
            'custom_check_in_time',
        ],
        order_by='custom_check_in_time desc',
        limit_page_length=1,
    )

    if not matches:
        frappe.response['message'] = {'found': False}
    else:
        m = matches[0]
        frappe.response['message'] = {
            'found': True,
            'visitor_name': m.customer_name,
            'phone_number': m.customer_phone_number,
            'host_id': m.custom_meet_with,
            'host_name': m.host_name,
            'purpose': m.customer_details,
            'transport_mode': m.custom_mode_of_transport,
            'vehicle_reg_no': m.custom_vehicles_number_plate,
            'vehicle_color': m.custom_vehicles_colour,
            'last_visit_date': m.custom_check_in_time or m.scheduled_time,
        }
