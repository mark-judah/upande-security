try:
    id_number = (frappe.form_dict.get("id_number") or "").strip()

    if not id_number:
        frappe.response["message"] = {"found": False}
    else:
        # Contractor Personnel is a child table (istable) scoped to one
        # Appointment - a contractor visit can send a different roster of
        # people every time, so there is no per-person "master" record to
        # look up directly. This is the same person appearing across many
        # DIFFERENT Appointments over time, so the lookup has to join the
        # child rows back to their parent Appointment and take the most
        # recent one by check-in time - a plain frappe.get_all can't reach
        # across that parent/child boundary with an ORDER BY on the parent,
        # so this uses a parameterized SELECT (house rule: frappe.db.sql is
        # SELECT-only, and %s must always be used - never string-build the
        # id_number into the query).
        rows = frappe.db.sql(
            "SELECT cp.full_name AS full_name, a.name AS appointment, "
            "a.customer_name AS contractor_name, a.custom_check_in_time AS last_visit_date "
            "FROM `tabContractor Personnel` cp "
            "INNER JOIN `tabAppointment` a ON a.name = cp.parent "
            "WHERE cp.parenttype = 'Appointment' AND cp.id_number = %s "
            "AND a.custom_check_in_time IS NOT NULL "
            "ORDER BY a.custom_check_in_time DESC "
            "LIMIT 1",
            (id_number,),
            as_dict=True,
        )

        if not rows:
            frappe.response["message"] = {"found": False}
        else:
            r = rows[0]
            frappe.response["message"] = {
                "found": True,
                "full_name": r.full_name,
                "id_number": id_number,
                "last_contractor_name": r.contractor_name,
                "last_visit_date": r.last_visit_date,
            }
except Exception as e:
    frappe.log_error("get_contractor_personnel_history", str(e))
    frappe.response["message"] = {"found": False}
