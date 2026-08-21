# Scan Asset — guard scans an existing QR sticker on a physical asset
# (water pump, generator, etc.). Stickers already carry pre-set codes —
# this verb accepts whatever code is scanned and auto-registers a new
# Security Asset the first time that code is seen (there's no catalog to
# pre-populate against; the first scan of a code IS the registration).
#
# Location is never trusted from a single reading — the cached
# latitude/longitude on Security Asset is the average of every "Found"
# scan's GPS reading, refining toward the true position as more guards
# scan the same sticker over time (expected to converge within about a
# month per the rollout plan).
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

    if not asset_code:
        frappe.response["message"] = {"error": "asset_code is required"}
    elif not latitude or not longitude:
        frappe.response["message"] = {"error": "latitude and longitude are required"}
    else:
        current_user = frappe.session.user

        personel = None
        internal_guard = None
        external_guard = None
        resolved_farm = None
        resolved_company = None

        emp = frappe.db.get_value(
            "Employee", {"user_id": current_user}, ["name", "custom_farm", "company"], as_dict=True
        )
        if emp:
            personel = "Internal Guard"
            internal_guard = emp["name"]
            resolved_farm = emp["custom_farm"]
            resolved_company = emp["company"]
        else:
            user_full = frappe.db.get_value("User", current_user, "full_name") or ""
            guard_name = None
            if user_full:
                guard_name = frappe.db.get_value("Security Guard", {"full_name": user_full}, "name")
            if guard_name:
                personel = "External Guard"
                external_guard = guard_name
                sg = frappe.db.get_value("Security Guard", guard_name, ["farm", "company"], as_dict=True)
                if sg:
                    resolved_farm = sg["farm"]
                    resolved_company = sg["company"]

        is_new = False
        if frappe.db.exists("Security Asset", asset_code):
            asset = frappe.get_doc("Security Asset", asset_code)
        else:
            asset = frappe.new_doc("Security Asset")
            asset.asset_code = asset_code
            asset.farm = resolved_farm
            asset.company = resolved_company
            asset.flags.ignore_links = True
            asset.insert(ignore_permissions=True)
            is_new = True

        log = frappe.new_doc("Asset Scan Log")
        log.asset = asset_code
        log.status = "Found"
        log.personel = personel
        log.internal_guard = internal_guard
        log.external_guard = external_guard
        log.farm = resolved_farm
        log.latitude = str(latitude)
        log.longitude = str(longitude)
        if accuracy:
            log.gps_accuracy = str(accuracy)
        log.scanned_at = frappe.utils.now()
        log.flags.ignore_links = True
        log.insert(ignore_permissions=True)

        agg = frappe.db.sql(
            """
            SELECT AVG(CAST(latitude AS DECIMAL(12,8))) AS avg_lat,
                   AVG(CAST(longitude AS DECIMAL(12,8))) AS avg_lng,
                   COUNT(*) AS n
            FROM `tabAsset Scan Log`
            WHERE asset = %s AND status = 'Found'
            """,
            (asset_code,),
            as_dict=True,
        )
        guard_display = internal_guard if internal_guard else external_guard

        if agg and agg[0]["n"]:
            frappe.db.set_value(
                "Security Asset",
                asset_code,
                {
                    "latitude": str(agg[0]["avg_lat"]),
                    "longitude": str(agg[0]["avg_lng"]),
                    "location_sample_count": agg[0]["n"],
                    "last_status": "Found",
                    "last_seen_at": log.scanned_at,
                    "last_reported_by": guard_display,
                },
                update_modified=False,
            )
        frappe.db.commit()

        updated = frappe.get_doc("Security Asset", asset_code)
        frappe.response["message"] = {
            "asset_code": asset_code,
            "asset_name": updated.asset_name,
            "farm": updated.farm,
            "is_new": is_new,
            "latitude": updated.latitude,
            "longitude": updated.longitude,
            "location_sample_count": updated.location_sample_count,
        }
except Exception as e:
    frappe.db.rollback()
    frappe.log_error("scan_asset", str(e))
    frappe.response["message"] = {"error": str(e)}
