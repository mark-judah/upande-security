# Report Asset Missing — a guard can't scan a QR sticker that's gone with
# the asset it was on, so this is a separate path from scan_asset: the
# guard picks a known asset (from my_assets_at_farm) and confirms it's not
# where it should be. Requires the asset to already exist — nothing to
# compare a "missing" report against for a code nobody has ever scanned.
try:
    raw = None
    try:
        raw = frappe.request.get_json(silent=True)
    except Exception:
        raw = None
    if raw is None:
        raw = dict(frappe.form_dict or {})

    try:
        asset_code = str(raw["asset_code"] or "").strip()
    except (KeyError, TypeError):
        asset_code = ""
    try:
        latitude = raw["latitude"]
    except (KeyError, TypeError):
        latitude = None
    try:
        longitude = raw["longitude"]
    except (KeyError, TypeError):
        longitude = None
    try:
        accuracy = raw["accuracy"]
    except (KeyError, TypeError):
        accuracy = None
    try:
        remarks = raw["remarks"]
    except (KeyError, TypeError):
        remarks = None

    if not asset_code:
        frappe.response["message"] = {"error": "asset_code is required"}
    elif not frappe.db.exists("Security Asset", asset_code):
        frappe.response["message"] = {"error": "Unknown asset — it must be scanned as Found at least once first"}
    else:
        current_user = frappe.session.user

        personel = None
        internal_guard = None
        external_guard = None
        resolved_farm = None

        emp = frappe.db.get_value("Employee", {"user_id": current_user}, ["name", "custom_farm"], as_dict=True)
        if emp:
            personel = "Internal Guard"
            internal_guard = emp["name"]
            resolved_farm = emp["custom_farm"]
        else:
            user_full = frappe.db.get_value("User", current_user, "full_name") or ""
            guard_name = None
            if user_full:
                guard_name = frappe.db.get_value("Security Guard", {"full_name": user_full}, "name")
            if guard_name:
                personel = "External Guard"
                external_guard = guard_name
                resolved_farm = frappe.db.get_value("Security Guard", guard_name, "farm")

        log = frappe.new_doc("Asset Scan Log")
        log.asset = asset_code
        log.status = "Missing"
        log.personel = personel
        log.internal_guard = internal_guard
        log.external_guard = external_guard
        log.farm = resolved_farm
        if latitude:
            log.latitude = str(latitude)
        if longitude:
            log.longitude = str(longitude)
        if accuracy:
            log.gps_accuracy = str(accuracy)
        log.remarks = remarks
        log.scanned_at = frappe.utils.now()
        log.flags.ignore_links = True
        log.insert(ignore_permissions=True)

        guard_display = internal_guard if internal_guard else external_guard
        frappe.db.set_value(
            "Security Asset",
            asset_code,
            {
                "last_status": "Missing",
                "last_missing_reported_at": log.scanned_at,
                "last_reported_by": guard_display,
            },
            update_modified=False,
        )
        frappe.db.commit()

        frappe.response["message"] = {"asset_code": asset_code, "status": "Missing", "reported_at": str(log.scanned_at)}
except Exception as e:
    frappe.db.rollback()
    frappe.log_error("report_asset_missing", str(e))
    frappe.response["message"] = {"error": str(e)}
