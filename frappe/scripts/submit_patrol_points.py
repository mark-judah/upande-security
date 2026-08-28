try:
    # Body parsing — accept JSON list, JSON object, or form-encoded.
    raw = None
    try:
        raw = frappe.request.get_json(silent=True)
    except Exception:
        raw = None

    # Safe-exec gotchas worked around:
    #   - `.get(...)` on dicts is intercepted as a key lookup, returns None.
    #   - Attribute access on plain dicts silently returns None.
    #   - Duck-typing via try/except AttributeError doesn't fire on lists.
    # So: probe via integer indexing for list-ness, then read entries via
    # bracket access wrapped in try/except KeyError.
    data_list = []
    if raw is not None:
        is_list = False
        try:
            probe = raw[0]
            is_list = True
        except Exception:
            is_list = False
        if is_list:
            data_list = raw
        else:
            data_list = [raw]
    if not data_list:
        f = dict(frappe.form_dict or {})
        if f:
            data_list = [f]

    if not data_list:
        frappe.response["message"] = [
            {"status": "error", "message": "GPS data missing"}
        ]
    else:
        results = []
        any_success = False
        current_user = frappe.session.user

        # Resolve who is patrolling. Guards live in one of two doctypes: internal
        # guards are Employees, external guards are Security Guard records.
        # Order: Employee by user_id -> Security Guard by user -> Security Guard
        # by full name (legacy, for guards not yet given a User link) -> raw
        # user identity.
        user_full = ""
        try:
            user_full = frappe.db.get_value("User", current_user, "full_name") or ""
        except Exception:
            user_full = ""

        resolved_type = ""
        resolved_guard = ""
        emp = frappe.db.get_value("Employee", {"user_id": current_user}, "name")
        if emp:
            resolved_type = "Employee"
            resolved_guard = emp
        else:
            sg = frappe.db.get_value("Security Guard", {"user": current_user}, "name")
            if not sg and user_full:
                # Name matching is fragile — duplicates collide and a renamed
                # user silently detaches. Kept only until every Security Guard
                # has its User link populated.
                sg = frappe.db.get_value("Security Guard", {"full_name": user_full}, "name")
            if sg:
                resolved_type = "Security Guard"
                resolved_guard = sg

        if not resolved_guard:
            resolved_guard = user_full or current_user

        # Which farm this guard is patrolling right now - their currently
        # Active shift assignment, same source the missed-check-in/geofence
        # scheduled task already trusts for this. Resolved once per batch
        # (not per point) since every point in one submission belongs to the
        # same ongoing shift. Left blank, not guessed, when there's no
        # matching Active shift (e.g. a guard whose shift already ended, or
        # a submission from an account with no Employee/Security Guard link
        # at all) - a blank farm on the log is honest; a wrong one isn't.
        resolved_farm = ""
        try:
            if resolved_type == "Employee":
                resolved_farm = frappe.db.get_value(
                    "Security Guard Shift Assignment",
                    {"internal_guard": resolved_guard, "status": "Active"},
                    "farm",
                ) or ""
            elif resolved_type == "Security Guard":
                resolved_farm = frappe.db.get_value(
                    "Security Guard Shift Assignment",
                    {"external_guard": resolved_guard, "status": "Active"},
                    "farm",
                ) or ""
        except Exception:
            resolved_farm = ""

        for entry in data_list:
            try:
                # Use a fresh defaulted lookup that doesn't rely on .get().
                patrol_tag = ""
                try:
                    patrol_tag = str(entry["patrol_tag"] or "").strip()
                except (KeyError, TypeError):
                    pass
                if not patrol_tag:
                    try:
                        patrol_tag = str(entry["patrol"] or "").strip()
                    except (KeyError, TypeError):
                        pass

                guard_code = ""
                try:
                    guard_code = str(entry["guard"] or "").strip()
                except (KeyError, TypeError):
                    pass

                latitude = None
                try:
                    latitude = entry["latitude"]
                except (KeyError, TypeError):
                    latitude = None
                longitude = None
                try:
                    longitude = entry["longitude"]
                except (KeyError, TypeError):
                    longitude = None
                accuracy = None
                try:
                    accuracy = entry["accuracy"]
                except (KeyError, TypeError):
                    accuracy = None
                captured_at = None
                try:
                    captured_at = entry["captured_at"]
                except (KeyError, TypeError):
                    captured_at = None

                if not patrol_tag:
                    results.append(
                        {"status": "error", "message": "patrol_tag is required"}
                    )
                    continue

                if not latitude or not longitude or not captured_at:
                    results.append(
                        {
                            "status": "error",
                            "message": "latitude, longitude and captured_at are required",
                            "patrol_tag": patrol_tag,
                        }
                    )
                    continue

                existing = frappe.db.get_value(
                    "Patrol GPS Log",
                    {"patrol": patrol_tag, "captured_at": captured_at},
                    "name",
                )
                if existing:
                    results.append(
                        {
                            "status": "success",
                            "message": "Duplicate - already synced",
                            "name": existing,
                            "patrol_tag": patrol_tag,
                            "duplicate": True,
                        }
                    )
                    continue

                guard = resolved_guard
                if not guard:
                    guard = guard_code

                log = frappe.new_doc("Patrol GPS Log")
                log.patrol = patrol_tag
                if resolved_farm:
                    log.farm = resolved_farm
                if resolved_type == "Employee":
                    log.personel = "Internal Guard"
                    log.internal_guard = guard
                elif resolved_type == "Security Guard":
                    log.personel = "External Guard"
                    log.external_guard = guard
                log.captured_at = captured_at
                log.latitude = str(latitude)
                log.longitude = str(longitude)
                if accuracy:
                    log.gps_accuracy = str(accuracy)
                # guard now holds a User full name / email, not an Employee — skip
                # link validation so users without an Employee record can submit.
                log.flags.ignore_links = True
                log.insert(ignore_permissions=True)

                any_success = True
                results.append(
                    {
                        "status": "success",
                        "name": log.name,
                        "patrol_tag": patrol_tag,
                        "captured_at": str(captured_at),
                    }
                )
            except Exception as row_err:
                frappe.log_error("submit_patrol_points row", str(row_err))
                results.append({"status": "error", "message": str(row_err)})

        if any_success:
            frappe.db.commit()
        else:
            frappe.db.rollback()

        frappe.response["message"] = results
except Exception as e:
    frappe.db.rollback()
    frappe.log_error("submit_patrol_points", str(e))
    frappe.response["message"] = [{"status": "error", "message": str(e)}]
