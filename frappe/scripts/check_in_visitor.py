try:
    data = {}
    try:
        data = frappe.request.get_json(silent=True) or {}
    except Exception:
        data = {}
    if not data:
        data = dict(frappe.form_dict or {})

    def s(key):
        try:
            v = data[key]
            if v is None:
                return ""
            return str(v).strip()
        except (KeyError, TypeError):
            return ""

    name = s("name")

    # Only overwrite a transport/plate/colour field when the client
    # explicitly sent the corresponding key. Absent key => preserve whatever
    # value the visitor already has on the Appointment (set earlier in the
    # workflow). Empty-string IS a deliberate signal — used by the Gate form
    # when the guard selects On Foot — so empty still updates.
    sent_transport = False
    transport = ""
    try:
        v = data["transport"]
        sent_transport = True
        transport = str(v).strip() if v is not None else ""
    except (KeyError, TypeError):
        sent_transport = False

    sent_plate = False
    plate = ""
    try:
        v = data["plate"]
        sent_plate = True
        plate = str(v).strip() if v is not None else ""
    except (KeyError, TypeError):
        sent_plate = False

    sent_colour = False
    colour = ""
    try:
        v = data["colour"]
        sent_colour = True
        colour = str(v).strip() if v is not None else ""
    except (KeyError, TypeError):
        sent_colour = False

    passengers_raw = ""
    try:
        passengers_raw = str(data["passengers"]) if data["passengers"] is not None else ""
    except (KeyError, TypeError):
        passengers_raw = ""

    sent_driver_name = False
    driver_name = ""
    try:
        v = data["driver_name"]
        sent_driver_name = True
        driver_name = str(v).strip() if v is not None else ""
    except (KeyError, TypeError):
        sent_driver_name = False

    sent_driver_phone = False
    driver_phone = ""
    try:
        v = data["driver_phone"]
        sent_driver_phone = True
        driver_phone = str(v).strip() if v is not None else ""
    except (KeyError, TypeError):
        sent_driver_phone = False

    entry_gate = ""
    try:
        entry_gate = str(data["entry_gate"] or "").strip()
    except (KeyError, TypeError):
        entry_gate = ""

    if not name:
        frappe.response["message"] = {"error": "name is required"}
    else:
        existing = frappe.db.get_value("Appointment", name, ["name", "workflow_state"], as_dict=True)
        if not existing:
            frappe.response["message"] = {"error": "Appointment " + name + " not found"}
        else:
            allowed_states = ["Approved by Host", "Approved by Secretary", "Open"]
            current_state = existing.workflow_state or ""
            if current_state and current_state not in allowed_states:
                frappe.response["message"] = {
                    "error": "Cannot check in from state: " + current_state +
                             ". Visitor must be approved by host first."
                }
            else:
                now = frappe.utils.now_datetime()
                # Transition is hardcoded — the allowed_states check above
                # already validated this is a legal entry point. We set
                # workflow_state via db.set_value because the safe-exec
                # sandbox forbids `from frappe.model.workflow import ...`,
                # so apply_workflow() can't be called from here.
                updates = {
                    "workflow_state": "Visitor Checked In",
                    "custom_reporting_status": "Checked in",
                    "custom_check_in_time": now,
                }
                if sent_transport:
                    updates["custom_mode_of_transport"] = transport or "On Foot"
                if sent_plate:
                    updates["custom_vehicles_number_plate"] = plate
                if sent_colour:
                    updates["custom_vehicles_colour"] = colour
                if sent_driver_name:
                    updates["custom_taxi_driver_name"] = driver_name
                if sent_driver_phone:
                    updates["custom_taxi_driver_phone"] = driver_phone
                if passengers_raw:
                    try:
                        updates["custom_number_of_passengers"] = int(passengers_raw)
                    except Exception:
                        pass
                if entry_gate:
                    updates["custom_entry_gate"] = entry_gate

                # Stamp which company/farm this visit belongs to, from the
                # checking-in guard's own scope — this is what the access
                # scoping in daily_summary.py / list_incidents.py filters on.
                current_user = frappe.session.user
                employee = frappe.db.get_value(
                    "Employee", {"user_id": current_user}, ["company", "custom_farm"], as_dict=True
                )
                resolved_company = employee.company if employee else None
                resolved_farm = employee.custom_farm if employee else None
                if not resolved_company and not resolved_farm:
                    user_full = frappe.db.get_value("User", current_user, "full_name") or ""
                    if user_full:
                        guard = frappe.db.get_value(
                            "Security Guard", {"full_name": user_full}, ["company", "farm"], as_dict=True
                        )
                        if guard:
                            resolved_company = guard.company
                            resolved_farm = guard.farm
                if resolved_company:
                    updates["custom_company"] = resolved_company
                if resolved_farm:
                    updates["custom_farmunit"] = resolved_farm

                frappe.db.set_value("Appointment", name, updates)
                frappe.db.commit()
                frappe.response["message"] = {
                    "name": name,
                    "custom_reporting_status": "Checked in",
                    "custom_check_in_time": str(now),
                }
except Exception as e:
    frappe.db.rollback()
    frappe.log_error("check_in_visitor", str(e))
    frappe.response["message"] = {"error": str(e)}
