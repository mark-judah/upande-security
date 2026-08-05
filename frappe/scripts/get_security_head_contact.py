try:
    current_user = frappe.session.user
    company = ""
    farm = ""

    # Resolve who's asking, same order as submit_patrol_points.py: Employee
    # linked to this login first, then Security Guard matched by the user's
    # full name (Security Guard has no user_id field, so name-match is the
    # only link available for guards who aren't in Employee at all).
    employee = frappe.db.get_value(
        "Employee", {"user_id": current_user}, ["company", "custom_farm"], as_dict=True
    )
    if employee:
        company = employee.company or ""
        farm = employee.custom_farm or ""
    else:
        user_full = ""
        try:
            user_full = frappe.db.get_value("User", current_user, "full_name") or ""
        except Exception:
            user_full = ""
        if user_full:
            guard = frappe.db.get_value(
                "Security Guard", {"full_name": user_full}, ["company", "farm"], as_dict=True
            )
            if guard:
                company = guard.company or ""
                farm = guard.farm or ""

    if not company and not farm:
        frappe.response["message"] = {
            "error": "No Employee or Security Guard record linked to this user"
        }
    else:
        contact = None

        # Join to User, not Employee, for the phone number — the Security
        # Head's own login always has a User record, but several real Security
        # Heads on this site (e.g. shared desk accounts like
        # security@karenroses.com) have no Employee record at all, and even
        # ones that do often have a blank Employee.cell_number while their
        # User.mobile_no/phone is populated.
        if farm:
            farm_rows = frappe.db.sql(
                "SELECT u.full_name, u.mobile_no, u.phone "
                "FROM `tabUser Permission` up "
                "JOIN `tabHas Role` hr ON hr.parent = up.user AND hr.role = 'Security Head' "
                "JOIN `tabUser` u ON u.name = up.user "
                "WHERE up.allow = 'Farm' AND up.for_value = %s LIMIT 1",
                (farm,),
                as_dict=True,
            )
            if farm_rows:
                contact = farm_rows[0]

        if not contact and company:
            company_rows = frappe.db.sql(
                "SELECT u.full_name, u.mobile_no, u.phone "
                "FROM `tabUser Permission` up "
                "JOIN `tabHas Role` hr ON hr.parent = up.user AND hr.role = 'Security Head' "
                "JOIN `tabUser` u ON u.name = up.user "
                "WHERE up.allow = 'Company' AND up.for_value = %s LIMIT 1",
                (company,),
                as_dict=True,
            )
            if company_rows:
                contact = company_rows[0]

        phone = ""
        if contact:
            phone = contact.mobile_no or contact.phone or ""

        if not contact:
            frappe.response["message"] = {
                "error": "No Security Head configured for company '" + company + "'"
            }
        elif not phone:
            frappe.response["message"] = {"error": "Security Head has no phone number on file"}
        else:
            frappe.response["message"] = {
                "name": contact.full_name,
                "phone": phone,
                "company": company,
                "farm": farm,
            }
except Exception as e:
    frappe.log_error("get_security_head_contact", str(e))
    frappe.response["message"] = {"error": str(e)}
