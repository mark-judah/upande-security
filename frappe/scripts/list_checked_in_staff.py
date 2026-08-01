try:
    today = frappe.utils.today()
    rows = frappe.get_all(
        "Attendance",
        filters=[
            ["attendance_date", "=", today],
            ["custom_gate_app_entry", "=", 1],
            ["out_time", "is", "not set"],
            ["docstatus", "<", 2],
        ],
        fields=[
            "name",
            "employee",
            "employee_name",
            "department",
            "in_time",
            "custom_temp_exit_time",
            "docstatus",
        ],
        order_by="in_time desc",
    )
    frappe.response["message"] = {"staff": rows}
except Exception as e:
    frappe.log_error("list_checked_in_staff", str(e))
    frappe.response["message"] = {"staff": [], "error": str(e)}
