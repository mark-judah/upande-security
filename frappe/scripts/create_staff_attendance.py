try:
    data = {}
    try:
        data = frappe.request.get_json(silent=True) or {}
    except Exception:
        data = {}
    if not data:
        data = dict(frappe.form_dict or {})

    employee = ""
    try:
        employee = str(data["employee"] or "").strip()
    except (KeyError, TypeError):
        employee = ""
    vehicle_plate = ""
    try:
        vehicle_plate = str(data["vehicle_plate"] or "").strip()
    except (KeyError, TypeError):
        vehicle_plate = ""

    if not employee:
        frappe.response["message"] = {"error": "employee is required"}
    else:
        emp = frappe.db.get_value(
            "Employee",
            employee,
            [
                "name",
                "employee_name",
                "company",
                "department",
                "default_shift",
                "custom_farm",
                "employee_category",
                "status",
            ],
            as_dict=True,
        )
        if not emp:
            frappe.response["message"] = {"error": "Employee " + employee + " not found"}
        elif emp.status and emp.status != "Active":
            frappe.response["message"] = {"error": "Employee status is " + str(emp.status)}
        else:
            today = frappe.utils.today()
            duplicate = frappe.db.get_value(
                "Attendance",
                {"employee": employee, "attendance_date": today, "docstatus": ["<", 2]},
                "name",
            )
            if duplicate:
                frappe.response["message"] = {
                    "error": "Attendance already exists for today",
                    "existing": duplicate,
                }
            else:
                now = frappe.utils.now_datetime()
                doc = frappe.new_doc("Attendance")
                doc.naming_series = "HR-ATT-.YYYY.-"
                doc.employee = emp.name
                doc.employee_name = emp.employee_name
                doc.status = "Present"
                doc.attendance_date = today
                doc.in_time = now
                if emp.company:
                    doc.company = emp.company
                if emp.department:
                    doc.department = emp.department
                if emp.default_shift:
                    doc.shift = emp.default_shift
                if emp.custom_farm:
                    doc.custom_farm = emp.custom_farm
                if emp.employee_category:
                    doc.custom_employee_category = emp.employee_category
                if vehicle_plate:
                    doc.custom_vehicle_number_plate = vehicle_plate
                doc.custom_gate_app_entry = 1
                doc.insert(ignore_permissions=True)
                frappe.db.commit()
                frappe.response["message"] = {
                    "name": doc.name,
                    "employee": emp.name,
                    "employee_name": emp.employee_name or "",
                    "status": "Present",
                    "in_time": str(now),
                    "docstatus": doc.docstatus,
                }
except Exception as e:
    frappe.db.rollback()
    frappe.log_error("create_staff_attendance", str(e))
    frappe.response["message"] = {"error": str(e)}
