try:
    farm = None
    try:
        farm = frappe.form_dict["farm"]
    except (KeyError, TypeError):
        farm = None

    if not farm:
        frappe.response["message"] = {"gates": []}
    else:
        # Security Gate Config is a child table of Security Ops Settings with
        # an empty permissions array (relies on the parent's DocPerm when
        # viewed through that form) - querying it directly, as the gate-
        # picker Client Script used to, fails with "Insufficient Permission"
        # for any real user (worked for Administrator testing only, since
        # Administrator bypasses permission checks entirely - that's why
        # this slipped through local testing). Gate names for a farm aren't
        # sensitive, so ignore_permissions=True here is deliberate, not lazy.
        rows = frappe.get_all(
            "Security Gate Config",
            filters={"parent": "Security Ops Settings", "farm": farm, "active": 1},
            fields=["gate_name"],
            order_by="idx asc",
            ignore_permissions=True,
        )
        names = []
        for row in rows:
            if row.gate_name:
                names.append(row.gate_name)
        frappe.response["message"] = {"gates": names}
except Exception as e:
    frappe.log_error("list_active_gates_for_farm", str(e))
    frappe.response["message"] = {"gates": [], "error": str(e)}
