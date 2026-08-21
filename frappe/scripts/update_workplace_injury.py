try:
    data = {}
    try:
        data = frappe.request.get_json(silent=True) or {}
    except Exception:
        data = {}
    if not data:
        data = dict(frappe.form_dict or {})

    name = ""
    try:
        name = str(data["name"] or "").strip()
    except (KeyError, TypeError):
        name = ""

    if not name:
        frappe.response["message"] = {"error": "name is required"}
    else:
        existing = frappe.db.get_value(
            "Incident Report", name, ["name", "nature_of_incident"], as_dict=True
        )
        if not existing:
            frappe.response["message"] = {"error": "Incident Report " + name + " not found"}
        elif existing.nature_of_incident != "Workplace Injury":
            frappe.response["message"] = {
                "error": name + " is not a Workplace Injury incident"
            }
        else:
            # Progressive case update — the follow-up screen sends only
            # whichever fields it changed. Each list below is only touched
            # when the client explicitly includes that key.
            check_fields = [
                "first_aid_given",
                "ambulance_needed",
                "taken_to_hospital",
                "police_report_required",
                "compensation_required",
                "wiba_claim_filed",
                "is_fatal",
                "doshs_reported",
            ]
            text_fields = [
                "injury_case_status",
                "injury_current_location",
                "first_aider_name",
                "ambulance_provider",
                "hospital_name",
                "hospital_admission_type",
                "attending_physician",
                "treatment_summary",
                "ob_number",
                "police_station",
                "wiba_claim_number",
                "payment_status",
                "activity_at_time_of_injury",
                "body_part_affected",
                "nature_of_injury",
                "doshs_reference_number",
            ]
            datetime_fields = ["ambulance_called_at"]
            date_fields = ["return_to_work_date", "doshs_reported_date"]

            updates = {}

            for key in check_fields:
                try:
                    v = data[key]
                    updates[key] = 1 if v else 0
                except (KeyError, TypeError):
                    pass

            for key in text_fields:
                try:
                    v = data[key]
                    updates[key] = str(v).strip() if v is not None else ""
                except (KeyError, TypeError):
                    pass

            for key in datetime_fields + date_fields:
                try:
                    v = data[key]
                    updates[key] = v if v else None
                except (KeyError, TypeError):
                    pass

            try:
                v = data["days_off_work"]
                if v in (None, ""):
                    updates["days_off_work"] = None
                else:
                    updates["days_off_work"] = int(v)
            except (KeyError, TypeError, ValueError):
                pass

            try:
                v = data["amount_paid"]
                if v in (None, ""):
                    updates["amount_paid"] = None
                else:
                    updates["amount_paid"] = float(v)
            except (KeyError, TypeError, ValueError):
                pass

            if not updates:
                frappe.response["message"] = {"error": "No updatable fields were sent"}
            else:
                # Closing a case without a resolution on the parent Incident
                # Report would leave it permanently "Open" — mirror the
                # status across so the general incident list reflects it too.
                closing = False
                try:
                    closing = updates["injury_case_status"] == "Closed"
                except (KeyError, TypeError):
                    closing = False
                if closing:
                    updates["status"] = "Resolved"

                frappe.db.set_value("Incident Report", name, updates)
                frappe.db.commit()
                frappe.response["message"] = {"name": name, "updated": list(updates.keys())}
except Exception as e:
    frappe.db.rollback()
    frappe.log_error("update_workplace_injury", str(e))
    frappe.response["message"] = {"error": str(e)}
