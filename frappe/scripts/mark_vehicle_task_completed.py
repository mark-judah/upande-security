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
    task_row = ""
    try:
        task_row = str(data["task_row"] or "").strip()
    except (KeyError, TypeError):
        task_row = ""

    if not ticket:
        frappe.response["message"] = {"error": "ticket is required"}
    else:
        existing = frappe.db.get_value("Tractor Daily Task", ticket, "name")
        if not existing:
            frappe.response["message"] = {"error": "Ticket " + ticket + " not found"}
        else:
            if task_row:
                row_exists = frappe.db.get_value(
                    "Timesheet Detail",
                    {"name": task_row, "parent": ticket},
                    "name",
                )
                if not row_exists:
                    frappe.response["message"] = {"error": "Task row " + task_row + " not on ticket"}
                else:
                    frappe.db.set_value("Timesheet Detail", task_row, "completed", 1)
                    frappe.db.commit()
                    frappe.response["message"] = {
                        "ticket": ticket,
                        "task_row": task_row,
                        "completed": 1,
                    }
            else:
                rows = frappe.get_all(
                    "Timesheet Detail",
                    filters={"parent": ticket},
                    fields=["name"],
                    order_by="idx asc",
                    limit_page_length=1,
                )
                if not rows:
                    frappe.response["message"] = {
                        "ticket": ticket,
                        "task_row": None,
                        "completed": 0,
                        "message": "no task rows on ticket",
                    }
                else:
                    first_row = rows[0].name
                    frappe.db.set_value("Timesheet Detail", first_row, "completed", 1)
                    frappe.db.commit()
                    frappe.response["message"] = {
                        "ticket": ticket,
                        "task_row": first_row,
                        "completed": 1,
                    }
except Exception as e:
    frappe.db.rollback()
    frappe.log_error("mark_vehicle_task_completed", str(e))
    frappe.response["message"] = {"error": str(e)}
