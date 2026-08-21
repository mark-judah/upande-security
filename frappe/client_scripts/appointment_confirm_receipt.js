// Adds a "Confirm Receipt" action button to the Appointment form for hosts
// once their visitor has been checked in and a badge issued — the only
// other way to confirm receipt is scanning the visitor badge's QR code,
// which isn't practical if the host is just looking at the record itself
// (e.g. checking their appointment list at their desk).
frappe.ui.form.on('Appointment', {
	refresh: function (frm) {
		if (
			frm.doc.workflow_state === 'Visitor Checked In' &&
			frm.doc.custom_visitor_badge &&
			!frm.doc.custom_host_received_time
		) {
			frm.add_custom_button('Confirm Receipt', function () {
				frappe.call({
					method: 'confirm_host_received_by_appointment',
					args: { name: frm.doc.name },
					freeze: true,
					freeze_message: __('Confirming...'),
					callback: function (r) {
						if (r.message && r.message.error) {
							frappe.msgprint(r.message.error);
							return;
						}
						frappe.show_alert({ message: __('Visitor receipt confirmed'), indicator: 'green' });
						frm.reload_doc();
					},
				});
			}).addClass('btn-primary');
		}

		if (frm.doc.custom_host_received_time) {
			frm.dashboard.set_headline_alert(
				'<span class="indicator-pill green">Visitor receipt confirmed at ' +
					frappe.datetime.str_to_user(frm.doc.custom_host_received_time) +
					'</span>',
			);
		}
	},
});
