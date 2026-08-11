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

    contractor_ref = s("contractor_ref")
    contractor_name = s("contractor_name")
    phone = s("phone")
    host = s("host")
    purpose = s("purpose") or "Contractor site access"
    plate = s("plate")
    scope_of_work = s("scope_of_work")
    expected_exit_raw = s("expected_exit")
    transport_mode_in = s("transport_mode")
    personnel_raw = s("personnel")
    passengers_raw = ""
    try:
        passengers_raw = str(data["passengers"]) if data["passengers"] is not None else ""
    except (KeyError, TypeError):
        passengers_raw = ""

    # personnel is a JSON array of {full_name, id_number, is_team_leader} —
    # everyone this contractor company actually sent, not just the one
    # contact name. Malformed/missing input just means no personnel rows
    # get added; it must never block registering the contractor at the gate.
    personnel_rows = []
    if personnel_raw:
        try:
            parsed = frappe.utils.parse_json(personnel_raw)
            if parsed:
                for row in parsed:
                    try:
                        full_name = str(row["full_name"] or "").strip()
                    except (KeyError, TypeError):
                        full_name = ""
                    if not full_name:
                        continue
                    try:
                        id_number = str(row["id_number"] or "").strip()
                    except (KeyError, TypeError):
                        id_number = ""
                    try:
                        is_team_leader = 1 if row["is_team_leader"] else 0
                    except (KeyError, TypeError):
                        is_team_leader = 0
                    personnel_rows.append(
                        {"full_name": full_name, "id_number": id_number, "is_team_leader": is_team_leader}
                    )
        except Exception:
            personnel_rows = []

    if not contractor_name and contractor_ref:
        contractor_name = frappe.db.get_value("Supplier", contractor_ref, "supplier_name") or contractor_ref

    if not contractor_name:
        frappe.response["message"] = {"error": "contractor_name or contractor_ref is required"}
    elif not host:
        frappe.response["message"] = {"error": "host is required"}
    else:
        host_rec = frappe.db.get_value("Employee", host, ["name", "user_id", "employee_name"], as_dict=True)
        if not host_rec:
            frappe.response["message"] = {"error": "Host " + host + " not found"}
        else:
            host_email_dbg = host_rec.user_id or ""
            frappe.log_error(
                title="create_contractor_notify debug",
                message="Payload: " + str(data) + "\nHost: " + host + "\nHost email (user_id): " + host_email_dbg,
            )

            # Explicit transport_mode from the client wins — older callers
            # that don't send it yet fall back to the old plate-implies-
            # Vehicle guess so nothing breaks mid-rollout.
            valid_transport_modes = ["On Foot", "Vehicle", "Motorcycle", "Motor Bike"]
            if transport_mode_in in valid_transport_modes:
                transport = transport_mode_in
            else:
                transport = "Vehicle" if plate else "On Foot"
            now_str = str(frappe.utils.now_datetime())

            doc = frappe.new_doc("Appointment")
            doc.customer_name = contractor_name
            doc.customer_email = ""
            doc.custom_meet_with = host
            doc.scheduled_time = now_str
            doc.customer_details = purpose
            doc.custom_mode_of_transport = transport
            doc.custom_vehicles_number_plate = plate
            doc.status = "Open"
            doc.custom_reporting_status = "Scheduled"
            for row in personnel_rows:
                doc.append("custom_contractor_personnel", row)
            doc.flags.ignore_validate = True
            doc.flags.ignore_links = True
            doc.flags.ignore_mandatory = True
            doc.insert(ignore_permissions=True)
            appt_name = doc.name

            updates = {
                "custom_visitor_type": "Contractor",
            }
            if phone:
                updates["customer_phone_number"] = phone
            if contractor_ref:
                updates["custom_contractor_ref"] = contractor_ref
            if passengers_raw:
                try:
                    updates["custom_number_of_passengers"] = int(passengers_raw)
                except Exception:
                    pass
            if scope_of_work:
                updates["custom_scope_of_work"] = scope_of_work
            # Best-effort — a bad/unparseable expected_exit must never block
            # registering the contractor at the gate, it's just not recorded.
            if expected_exit_raw:
                try:
                    updates["custom_expected_exit"] = frappe.utils.get_datetime(expected_exit_raw)
                except Exception:
                    pass
            frappe.db.set_value("Appointment", appt_name, updates, update_modified=False)

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

            # Send notifications to host (user_id is an email) + secretaries
            host_user_id = host_rec.user_id or ""
            host_name = host_rec.employee_name or host
            recipient_users = []
            if host_user_id:
                recipient_users.append(host_user_id)

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

            subject = "Contractor: " + contractor_name + " at the gate to see " + host_name
            body = "<p><strong>" + contractor_name + "</strong> (contractor) has arrived at the gate to see <strong>" + host_name + "</strong></p>"
            if purpose:
                body = body + "<p>Purpose: " + purpose + "</p>"
            if plate:
                body = body + "<p>Vehicle: " + plate + "</p>"
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
                "customer_name": contractor_name,
                "host_id": host,
                "workflow_state": "Pending Host Review",
                "notified": notified,
            }
except Exception as e:
    frappe.db.rollback()
    frappe.log_error("create_contractor_notify", str(e))
    frappe.response["message"] = {"error": str(e)}
