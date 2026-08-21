# File Patrol Report — guard files an observation/incident report, either
# tied to their current active GPS patrol tag or standalone (ad-hoc tag
# generated client-side when no patrol is currently running).
# Sandbox rules: no imports, no f-strings, no top-level return, no augmented
# assignment, bracket-access + try/except instead of .get().
try:
    raw = None
    try:
        raw = frappe.request.get_json(silent=True)
    except Exception:
        raw = None
    if raw is None:
        raw = dict(frappe.form_dict or {})

    try:
        patrol = str(raw["patrol"] or "").strip()
    except (KeyError, TypeError):
        patrol = ""

    try:
        report_type = raw["report_type"]
    except (KeyError, TypeError):
        report_type = None

    try:
        observations = str(raw["observations"] or "").strip()
    except (KeyError, TypeError):
        observations = ""

    if not patrol:
        frappe.response["message"] = {"error": "Missing patrol tag"}
    elif report_type not in ["Routine", "Incident"]:
        frappe.response["message"] = {"error": "report_type must be Routine or Incident"}
    elif not observations:
        frappe.response["message"] = {"error": "Observations are required"}
    else:
        try:
            severity = raw["severity"]
        except (KeyError, TypeError):
            severity = None
        try:
            nature_of_incident = raw["nature_of_incident"]
        except (KeyError, TypeError):
            nature_of_incident = None
        try:
            incident_report = raw["incident_report"]
        except (KeyError, TypeError):
            incident_report = None
        try:
            farm = raw["farm"]
        except (KeyError, TypeError):
            farm = None
        try:
            started_at = raw["started_at"]
        except (KeyError, TypeError):
            started_at = None
        try:
            ended_at = raw["ended_at"]
        except (KeyError, TypeError):
            ended_at = None
        try:
            attachment_1 = raw["attachment_1"]
        except (KeyError, TypeError):
            attachment_1 = None
        try:
            attachment_2 = raw["attachment_2"]
        except (KeyError, TypeError):
            attachment_2 = None
        try:
            attachment_3 = raw["attachment_3"]
        except (KeyError, TypeError):
            attachment_3 = None
        try:
            attachment_4 = raw["attachment_4"]
        except (KeyError, TypeError):
            attachment_4 = None

        if report_type == "Incident" and not nature_of_incident:
            frappe.response["message"] = {"error": "Nature of incident is required for Incident reports"}
        elif incident_report and not frappe.db.exists("Incident Report", incident_report):
            frappe.response["message"] = {"error": "Linked incident report not found"}
        else:
            current_user = frappe.session.user

            # Same Employee -> Security Guard fallback pattern used by
            # submit_patrol_points.py / get_security_head_contact.py, but here
            # written into Patrol Report's own personel/internal_guard/
            # external_guard fields (unlike the legacy `guard` column on
            # Patrol GPS Log, these are real fields on this doctype).
            personel = None
            internal_guard = None
            external_guard = None
            resolved_farm = farm

            emp = frappe.db.get_value(
                "Employee", {"user_id": current_user}, ["name", "custom_farm"], as_dict=True
            )
            if emp:
                personel = "Internal Guard"
                internal_guard = emp["name"]
                if not resolved_farm:
                    resolved_farm = emp["custom_farm"]
            else:
                user_full = frappe.db.get_value("User", current_user, "full_name") or ""
                guard_name = None
                if user_full:
                    guard_name = frappe.db.get_value("Security Guard", {"full_name": user_full}, "name")
                if guard_name:
                    personel = "External Guard"
                    external_guard = guard_name

            # Auto-link this report to the guard's current Active shift, if
            # any — no guard input needed. Same identity used to resolve
            # personel/internal_guard/external_guard above. Wrapped in its
            # own try/except: this is a nice-to-have, not a requirement, and
            # different sites can have a differently-shaped Security Guard
            # Shift Assignment doctype (or none at all) — a schema mismatch
            # here must never abort the whole filing.
            resolved_shift = None
            try:
                if internal_guard:
                    resolved_shift = frappe.db.get_value(
                        "Security Guard Shift Assignment",
                        {"internal_guard": internal_guard, "status": "Active"},
                        "name",
                    )
                elif external_guard:
                    resolved_shift = frappe.db.get_value(
                        "Security Guard Shift Assignment",
                        {"external_guard": external_guard, "status": "Active"},
                        "name",
                    )
            except Exception:
                resolved_shift = None

            points_logged = frappe.db.count("Patrol GPS Log", {"patrol": patrol})

            # `patrol` is a UNIQUE field on this doctype — one report per patrol
            # tag. Treat a resubmit for the same tag as an edit (idempotent),
            # not a hard failure — a guard may re-tap after a typo, or amend
            # their observations before a supervisor reviews it.
            existing_name = frappe.db.exists("Patrol Report", {"patrol": patrol})
            if existing_name:
                report = frappe.get_doc("Patrol Report", existing_name)
            else:
                report = frappe.new_doc("Patrol Report")
                report.patrol = patrol

            report.report_type = report_type
            report.farm = resolved_farm
            report.personel = personel
            report.internal_guard = internal_guard
            report.external_guard = external_guard
            report.shift_assignment = resolved_shift
            report.started_at = started_at
            report.ended_at = ended_at
            report.points_logged = points_logged
            report.filed_at = frappe.utils.now()
            report.observations = observations
            if report_type == "Incident":
                report.severity = severity if severity else "Medium"
                report.nature_of_incident = nature_of_incident
                report.incident_report = incident_report
            else:
                report.severity = None
                report.nature_of_incident = None
                report.incident_report = None
            report.attachment_1 = attachment_1
            report.attachment_2 = attachment_2
            report.attachment_3 = attachment_3
            report.attachment_4 = attachment_4
            report.flags.ignore_links = True
            if existing_name:
                report.save(ignore_permissions=True)
            else:
                report.status = "Submitted"
                report.insert(ignore_permissions=True)
            frappe.db.commit()

            frappe.response["message"] = {
                "name": report.name,
                "patrol": report.patrol,
                "report_type": report.report_type,
                "status": report.status,
                "filed_at": str(report.filed_at),
                "points_logged": report.points_logged,
                "updated": True if existing_name else False,
            }
except Exception as e:
    frappe.db.rollback()
    frappe.log_error("file_patrol_report", str(e))
    frappe.response["message"] = {"error": str(e)}
