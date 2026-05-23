try:
    data = {}
    try:
        data = frappe.request.get_json(silent=True) or {}
    except Exception:
        data = {}
    if not data:
        data = dict(frappe.form_dict or {})

    name = ""
    try:
        name = str(data["name"] or "").strip()
    except (KeyError, TypeError):
        name = ""

    if not name:
        frappe.response["message"] = {"error": "name is required"}
    else:
        appt = frappe.db.sql(
            """
            SELECT a.name, a.customer_name, a.customer_details,
                   a.scheduled_time, a.workflow_state, a.custom_meet_with,
                   e.employee_name AS host_display_name,
                   e.user_id AS host_user_id
            FROM `tabAppointment` a
            LEFT JOIN `tabEmployee` e ON e.name = a.custom_meet_with
            WHERE a.name = %s
            LIMIT 1
            """,
            (name,),
            as_dict=True,
        )
        if not appt:
            frappe.response["message"] = {"error": "Appointment " + name + " not found"}
        else:
            r = appt[0]

            # Apply workflow transition "Notify Host" → "Pending Host Review"
            try:
                from frappe.model.workflow import apply_workflow
                doc = frappe.get_doc("Appointment", name)
                apply_workflow(doc, "Notify Host")
                doc.save(ignore_permissions=True)
                frappe.db.commit()
            except Exception:
                # Fall back to direct field update if workflow action not configured
                frappe.db.set_value(
                    "Appointment",
                    name,
                    {"workflow_state": "Pending Host Review"},
                )
                frappe.db.commit()

            # Collect recipient user IDs
            recipient_users = []
            host_user_id = r.host_user_id or ""
            if host_user_id:
                recipient_users.append(host_user_id)

            # Add users with "Secretary" role
            try:
                sec_rows = frappe.db.sql(
                    "SELECT DISTINCT parent FROM `tabHas Role` WHERE role = 'Secretary' AND parent NOT IN ('Administrator', 'Guest')",
                    as_dict=False,
                )
                for row in sec_rows:
                    if row and row[0] and row[0] not in recipient_users:
                        recipient_users.append(row[0])
            except Exception:
                pass

            notified = 0
            visitor_name = r.customer_name or name
            host_display = r.host_display_name or r.custom_meet_with or "the host"
            purpose = r.customer_details or ""
            scheduled = str(r.scheduled_time) if r.scheduled_time else ""

            subject = "Gate Arrival: " + visitor_name + " is at the gate to see " + host_display

            body = "<p><strong>" + visitor_name + "</strong> has arrived at the gate</p>"
            if host_display:
                body = body + "<p>Visiting: " + host_display + "</p>"
            if purpose:
                body = body + "<p>Purpose: " + purpose + "</p>"
            if scheduled:
                body = body + "<p>Scheduled: " + scheduled + "</p>"
            body = body + "<p>Please <strong>approve, reschedule, or reject</strong> this visit in ERPNext.</p>"

            # Send email notifications
            if recipient_users:
                try:
                    frappe.sendmail(
                        recipients=recipient_users,
                        subject=subject,
                        message=body,
                        now=True,
                    )
                    notified = len(recipient_users)
                except Exception:
                    pass

            frappe.response["message"] = {
                "success": True,
                "appointment": name,
                "workflow_state": "Pending Host Review",
                "notified": notified,
            }
except Exception as e:
    frappe.db.rollback()
    frappe.log_error("notify_host", str(e))
    frappe.response["message"] = {"error": str(e)}
