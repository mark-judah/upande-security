try:
    data = {}
    try:
        data = frappe.request.get_json(silent=True) or {}
    except Exception:
        data = {}
    if not data:
        data = dict(frappe.form_dict or {})

    ticket = ""
    try:
        ticket = str(data["ticket"] or "").strip()
    except (KeyError, TypeError):
        ticket = ""
    entry_time = ""
    try:
        entry_time = str(data["entry_time"] or "").strip()
    except (KeyError, TypeError):
        entry_time = ""

    if not ticket:
        frappe.response["message"] = {"error": "ticket is required"}
    else:
        if not entry_time:
            entry_time = str(frappe.utils.now_datetime())

        ticket_row = frappe.db.get_value(
            "Tractor Daily Task",
            ticket,
            [
                "name",
                "motor_vehicle",
                "operator",
                "operator",
                "company",
                "farm",
                "erp_task",
            ],
            as_dict=True,
        )
        if not ticket_row:
            frappe.response["message"] = {"error": "Ticket " + ticket + " not found"}
        else:
            first_task = frappe.db.sql(
                """
                SELECT activity_type, description, task
                FROM `tabTimesheet Detail`
                WHERE parent = %s
                ORDER BY idx ASC
                LIMIT 1
                """,
                (ticket,),
                as_dict=True,
            )
            activity = "Transport"
            description = ""
            task_link = ticket_row.erp_task or ""
            if first_task:
                ft = first_task[0]
                if ft.activity_type:
                    activity = ft.activity_type
                if ft.description:
                    description = ft.description
                if ft.task and not task_link:
                    task_link = ft.task

            # Build Timesheet doc
            ts = frappe.new_doc("Timesheet")
            ts.naming_series = "TS-.YYYY.-"
            if ticket_row.company:
                ts.company = ticket_row.company
            # Prefer the linked Employee if present, fall back to nothing.
            if ticket_row.operator:
                ts.employee = frappe.db.get_value(
                    "Driver", ticket_row.operator, "employee"
                )
            ts.custom_asset = ticket_row.motor_vehicle
            ts.start_date = frappe.utils.nowdate()
            ts.end_date = frappe.utils.nowdate()

            provisional_end = frappe.utils.add_to_date(
                entry_time, hours=1, as_datetime=True
            )

            ts.append(
                "time_logs",
                {
                    "activity_type": activity,
                    "from_time": entry_time,
                    "to_time": str(provisional_end),
                    "hours": 1,
                    "expected_hours": 1,
                    "description": description,
                    "task": task_link,
                    "is_billable": 1,
                    "completed": 0,
                },
            )

            ts.insert(ignore_permissions=True)
            frappe.db.commit()
            frappe.response["message"] = {
                "name": ts.name,
                "ticket": ticket,
                "entry_time": entry_time,
                "activity_type": activity,
                "description": description,
            }
except Exception as e:
    frappe.db.rollback()
    frappe.log_error("create_gate_timesheet", str(e))
    frappe.response["message"] = {"error": str(e)}
