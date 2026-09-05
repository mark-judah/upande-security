try:
    data = {}
    try:
        data = frappe.request.get_json(silent=True) or {}
    except Exception:
        data = {}
    if not data:
        data = dict(frappe.form_dict or {})

    def s(key):
        try:
            v = data[key]
            if v is None:
                return ""
            return str(v).strip()
        except (KeyError, TypeError):
            return ""

    customer_name = s("customer_name")
    id_number = s("id_number")
    phone = s("phone")
    email = s("email")
    organization = s("organization")
    host = s("host")
    purpose = s("purpose")
    transport = s("transport") or "On Foot"
    plate = s("plate")
    colour = s("colour")
    passengers_raw = ""
    try:
        passengers_raw = str(data["passengers"]) if data["passengers"] is not None else ""
    except (KeyError, TypeError):
        passengers_raw = ""

    if not customer_name:
        frappe.response["message"] = {"error": "customer_name is required"}
    elif not phone:
        frappe.response["message"] = {"error": "phone is required"}
    elif not host:
        frappe.response["message"] = {"error": "host is required"}
    else:
        # A walk-in is inherently "right now" — the client's own idea of
        # "now" (device clock, timezone handling, whatever a specific app
        # build computes) is never trusted here. The server always derives
        # its own scheduled_time from its own clock, with a forward buffer,
        # because Appointment's own "not in the past" check re-evaluates
        # against a fresh now() a moment after this value is set — by the
        # time that runs, an unbuffered now() has already become "the past"
        # relative to it. Whatever the client sent for scheduled_time, if
        # anything, is ignored for this reason.
        scheduled_time = str(frappe.utils.add_to_date(frappe.utils.now_datetime(), minutes=15))

        host_rec = frappe.db.get_value("Employee", host, ["name", "user_id", "employee_name", "company"], as_dict=True)
        if not host_rec:
            frappe.response["message"] = {"error": "Host " + host + " not found"}
        else:
            host_email_dbg = host_rec.user_id or ""
            frappe.log_error(
                title="create_walk_in_notify debug",
                message="Payload: " + str(data) + "\nHost: " + host + "\nHost email (user_id): " + host_email_dbg,
            )

            doc = frappe.new_doc("Appointment")
            doc.flags.ignore_mandatory = True
            doc.customer_name = customer_name
            doc.custom_id_number = id_number
            doc.customer_phone_number = phone
            doc.customer_email = email
            if organization:
                doc.customer_organization = organization
            doc.custom_meet_with = host
            doc.scheduled_time = scheduled_time
            doc.customer_details = purpose
            doc.custom_mode_of_transport = transport
            doc.custom_vehicles_number_plate = plate
            doc.custom_vehicles_colour = colour
            if passengers_raw:
                try:
                    doc.custom_number_of_passengers = int(passengers_raw)
                except Exception:
                    pass
            doc.status = "Open"
            doc.custom_reporting_status = "Scheduled"
            doc.insert(ignore_permissions=True)
            appt_name = doc.name

            # Apply "Notify Host" workflow transition
            try:
                from frappe.model.workflow import apply_workflow
                doc2 = frappe.get_doc("Appointment", appt_name)
                doc2.flags.ignore_mandatory = True
                apply_workflow(doc2, "Notify Host")
                doc2.save(ignore_permissions=True)
                frappe.db.commit()
            except Exception:
                frappe.db.set_value(
                    "Appointment",
                    appt_name,
                    {
                        "workflow_state": "Pending Host Review",
                        "custom_reporting_status": "Pending Host Review",
                    },
                )
                frappe.db.commit()

            # Send notifications to host + secretary
            host_user_id = host_rec.user_id or ""
            host_name = host_rec.employee_name or host
            recipient_users = []
            if host_user_id:
                recipient_users.append(host_user_id)

            # Scoped to this host's own company via User Permission, same
            # pattern get_security_head_contact.py uses for Security Head -
            # an unscoped "anyone with role=Secretary" query also matches
            # every dev/admin test account (they're typically granted every
            # role in the system, Secretary included), so every walk-in
            # notification was silently CC'ing Upande's own dev team
            # alongside - or sometimes instead of - the real host/secretary.
            try:
                if host_rec.company:
                    sec_rows = frappe.db.sql(
                        "SELECT DISTINCT up.user FROM `tabUser Permission` up "
                        "JOIN `tabHas Role` hr ON hr.parent = up.user AND hr.role = 'Secretary' "
                        "WHERE up.allow = 'Company' AND up.for_value = %s "
                        "AND up.user NOT IN ('Administrator', 'Guest')",
                        (host_rec.company,),
                        as_dict=False,
                    )
                    for row in sec_rows:
                        if row and row[0] and row[0] not in recipient_users:
                            recipient_users.append(row[0])
            except Exception:
                pass

            subject = "Walk-in Visitor: " + customer_name + " at the gate to see " + host_name
            body = "<p><strong>" + customer_name + "</strong> (walk-in) has arrived at the gate to see <strong>" + host_name + "</strong></p>"
            if purpose:
                body = body + "<p>Purpose: " + purpose + "</p>"
            body = body + "<p>Please <strong>approve, reschedule, or reject</strong> this visit in ERPNext.</p>"

            notified = 0
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
                "name": appt_name,
                "customer_name": customer_name,
                "host_id": host,
                "workflow_state": "Pending Host Review",
                "notified": notified,
            }
except Exception as e:
    frappe.db.rollback()
    frappe.log_error("create_walk_in_notify", str(e))
    frappe.response["message"] = {"error": str(e)}
