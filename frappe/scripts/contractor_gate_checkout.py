appt_name = (frappe.form_dict.get('appointment_name') or '').strip()
if not appt_name:
    frappe.throw('appointment_name is required')

exit_gate = (frappe.form_dict.get('exit_gate') or '').strip() or None

try:
    now_str = frappe.utils.now()

    # Try workflow action but don't fail if state doesn't allow it
    try:
        from frappe.model.workflow import apply_workflow
        doc = frappe.get_doc('Appointment', appt_name)
        apply_workflow(doc, 'Confirm Check Out')
    except Exception:
        pass

    checkout_updates = {
        'custom_check_out_time': now_str,
        'custom_reporting_status': 'Checked out',
    }
    if exit_gate:
        checkout_updates['custom_exit_gate'] = exit_gate
        entry_gate = frappe.db.get_value('Appointment', appt_name, 'custom_entry_gate')
        if entry_gate and entry_gate != exit_gate:
            checkout_updates['custom_gate_mismatch'] = 1

    # Always write checkout fields via set_value (bypasses link validation)
    frappe.db.set_value('Appointment', appt_name, checkout_updates, update_modified=True)
    frappe.db.commit()

    frappe.response['message'] = {
        'success': True,
        'appointment': appt_name,
        'check_out_time': now_str,
    }

except Exception as e:
    frappe.log_error(
        title='Contractor Gate Checkout Error',
        message='User: ' + frappe.session.user + '\nAppointment: ' + appt_name + '\nError: ' + str(e)
    )
    frappe.throw('Contractor check-out failed: ' + str(e))
