try:
    query = (frappe.form_dict.get("query") or "").strip()

    if not query:
        frappe.response["message"] = {"found": False}
    else:
        like_query = "%" + query + "%"
        matches = frappe.get_all(
            "Appointment",
            filters=[
                ["custom_check_in_time", "is", "set"],
            ],
            or_filters=[
                ["customer_phone_number", "=", query],
                ["customer_name", "like", like_query],
                ["custom_id_number", "=", query],
            ],
            fields=[
                "name",
                "customer_name",
                "customer_phone_number",
                "custom_id_number",
                "custom_meet_with",
                "custom_meet_with_name",
                "customer_details",
                "custom_mode_of_transport",
                "custom_vehicles_number_plate",
                "custom_vehicles_colour",
                "scheduled_time",
                "custom_check_in_time",
            ],
            order_by="custom_check_in_time desc",
            limit_page_length=1,
        )

        if not matches:
            frappe.response["message"] = {"found": False}
        else:
            m = matches[0]
            frappe.response["message"] = {
                "found": True,
                "visitor_name": m.customer_name,
                "phone_number": m.customer_phone_number,
                "id_no": m.custom_id_number,
                "host_id": m.custom_meet_with,
                "host_name": m.custom_meet_with_name,
                "purpose": m.customer_details,
                "transport_mode": m.custom_mode_of_transport,
                "vehicle_reg_no": m.custom_vehicles_number_plate,
                "vehicle_color": m.custom_vehicles_colour,
                "last_visit_date": m.custom_check_in_time or m.scheduled_time,
            }
except Exception as e:
    frappe.log_error("get_visitor_history", str(e))
    frappe.response["message"] = {"found": False}
