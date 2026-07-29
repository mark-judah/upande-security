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
        row = frappe.db.get_value(
            "Tractor Daily Task",
            name,
            [
                "name",
                "motor_vehicle",
                "farm",
                "operator",
                "custom_employee",
                "company",
                "date",
                "erp_task",
                "timesheet",
                "workflow_state",
                "location",
                "custom_qr_code",
            ],
            as_dict=True,
        )
        if not row:
            frappe.response["message"] = {"error": "Ticket " + name + " not found"}
        else:
            tasks = frappe.get_all(
                "Timesheet Detail",
                filters={"parent": name},
                fields=[
                    "name",
                    "activity_type",
                    "description",
                    "from_time",
                    "to_time",
                    "hours",
                    "completed",
                    "task",
                    "is_billable",
                ],
                order_by="idx asc",
            )

            operator_name = ""
            if row.operator:
                operator_name = (
                    frappe.db.get_value("Driver", row.operator, "full_name") or ""
                )
            employee_name = ""
            if row.custom_employee:
                employee_name = (
                    frappe.db.get_value("Employee", row.custom_employee, "employee_name") or ""
                )

            task_rows = []
            for t in tasks:
                task_rows.append(
                    {
                        "name": t.name,
                        "activity_type": t.activity_type or "",
                        "description": t.description or "",
                        "from_time": str(t.from_time) if t.from_time else "",
                        "to_time": str(t.to_time) if t.to_time else "",
                        "hours": float(t.hours or 0),
                        "completed": int(t.completed or 0),
                        "task": t.task or "",
                        "is_billable": int(t.is_billable or 0),
                    }
                )

            frappe.response["message"] = {
                "name": row.name,
                "motor_vehicle": row.motor_vehicle or "",
                "farm": row.farm or "",
                "operator": row.operator or "",
                "operator_name": operator_name,
                "custom_employee": row.custom_employee or "",
                "employee_name": employee_name,
                "company": row.company or "",
                "date": str(row.date) if row.date else "",
                "erp_task": row.erp_task or "",
                "timesheet": row.timesheet or "",
                "workflow_state": row.workflow_state or "",
                "location": row.location or "",
                "custom_qr_code": row.custom_qr_code or "",
                "task": task_rows,
            }
except Exception as e:
    frappe.log_error("get_vehicle_ticket", str(e))
    frappe.response["message"] = {"error": str(e)}
