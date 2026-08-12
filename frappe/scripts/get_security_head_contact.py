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

    contact_name = ""
    phone = ""

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
            contact_name = farm_rows[0].full_name or ""
            phone = farm_rows[0].mobile_no or farm_rows[0].phone or ""

    if not phone and company:
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
            contact_name = company_rows[0].full_name or ""
            phone = company_rows[0].mobile_no or company_rows[0].phone or ""

    source = "company_or_farm_head"

    # Last resort: a guard in genuine distress must never hit a bare error
    # just because their identity or company couldn't be resolved, or their
    # company has no Security Head configured yet. Fall back to a single
    # org-wide contact from Security Ops Settings (a Singleton a System
    # Manager/Security Head maintains) rather than dead-ending the call.
    # This does NOT fix missing HR data or missing per-company Security Head
    # assignments — those are real gaps that still need fixing at the data
    # level — it only guarantees the phone call itself always has somewhere
    # to go while that data catches up.
    if not phone:
        settings = frappe.db.get_value(
            "Security Ops Settings",
            "Security Ops Settings",
            ["fallback_contact_name", "fallback_contact_phone"],
            as_dict=True,
        )
        fallback_phone = ((settings.fallback_contact_phone if settings else "") or "").strip()
        fallback_name = ((settings.fallback_contact_name if settings else "") or "").strip()
        if fallback_phone:
            contact_name = fallback_name or "Security Operations"
            phone = fallback_phone
            source = "org_fallback"

    if not phone:
        frappe.response["message"] = {
            "error": "No Security Head configured for company '"
            + company
            + "' and no fallback contact is set in Security Ops Settings — ask a System Manager to set one."
        }
    else:
        frappe.response["message"] = {
            "name": contact_name,
            "phone": phone,
            "company": company,
            "farm": farm,
            "source": source,
        }
except Exception as e:
    frappe.log_error("get_security_head_contact", str(e))
    frappe.response["message"] = {"error": str(e)}
