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

    # This app user isn't linked to any Employee or Security Guard at all
    # (a shared/test login, or someone testing SOS before their HR/guard
    # record is set up) - don't error out, pick any real guard's
    # company/farm at random so the SAME resolution chain below still has
    # something to resolve against. A contact for the "wrong" company beats
    # no contact at all in an actual emergency.
    used_random_guard = False
    if not company:
        random_guard = frappe.db.sql(
            "SELECT company, farm FROM `tabSecurity Guard` "
            "WHERE company IS NOT NULL AND company != '' "
            "ORDER BY RAND() LIMIT 1",
            as_dict=True,
        )
        if random_guard:
            company = random_guard[0].company or ""
            farm = random_guard[0].farm or ""
            used_random_guard = True

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

    # A company's own configured fallback - lets each company (Kaitet Ltd.,
    # Karen Roses, Westwood Dairies, ...) have its own number without
    # needing a real Security Head assignment just to get one.
    if not phone and company:
        fallback_row = frappe.db.get_value(
            "Security Fallback Contact",
            {"parent": "Security Ops Settings", "company": company},
            ["contact_name", "contact_phone"],
            as_dict=True,
        )
        if fallback_row and fallback_row.contact_phone:
            contact_name = fallback_row.contact_name or "Security Operations"
            phone = fallback_row.contact_phone
            source = "company_fallback"

    # The single org-wide fallback (Security Ops Settings' own
    # fallback_contact_name/phone/description fields) was removed once every
    # company got its own row in Security Fallback Contact above - a company
    # with neither a Security Head nor a fallback row now hits a clear
    # error naming the company, a real gap to fix by adding a row, not
    # something to paper over with a stale generic number.
    if not phone:
        frappe.response["message"] = {
            "error": "No Security Head configured for company '"
            + company
            + "' and no fallback contact row exists for it in Security Ops Settings — ask a System Manager to add one."
        }
    else:
        frappe.response["message"] = {
            "name": contact_name,
            "phone": phone,
            "company": company,
            "farm": farm,
            "source": source,
            "unlinked_user": used_random_guard,
        }
except Exception as e:
    frappe.log_error("get_security_head_contact", str(e))
    frappe.response["message"] = {"error": str(e)}
