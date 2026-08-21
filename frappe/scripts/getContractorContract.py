try:
    data = frappe.request.get_json()
    query = (data.get("query") if data else None) or frappe.form_dict.get("query", "")

    if not query:
        frappe.throw("Search query is required")

    q = query.strip()

    suppliers = frappe.get_all(
        "Supplier",
        filters={
            "disabled": 0,
            "custom_is_contractor": 1,
            "supplier_name": ["like", "%" + q + "%"]
        },
        fields=[
            "name", "supplier_name", "supplier_group",
            # "custom_approved_by", "custom_approval_date",
            "custom_access_start_date", "custom_access_end_date",
            "mobile_no", "email_id"
        ],
        limit=5,
        order_by="supplier_name asc"
    )

    if not suppliers:
        frappe.response["message"] = {
            "contract_name": None, "contractor_name": None,
            "is_contractor": False, "supplier_id": None, "vehicles": []
        }
    else:
        s = suppliers[0]

        # Fetch vehicles from Supplier Vehicle child table
        # parentfield is custom_registered_vehicles (the field name on Supplier)
        vehicles = []
        try:
            rows = frappe.get_all(
                "Supplier Vehicle",
                filters={"parent": s["name"], "parentfield": "custom_registered_vehicles"},
                fields=["number_plate", "colour", "vehicle_type", "is_active"],
                order_by="idx asc"
            )
            vehicles = [
                {
                    "number_plate": r["number_plate"],
                    "colour": r.get("colour") or "",
                    "vehicle_type": r.get("vehicle_type") or ""
                }
                for r in rows if r.get("number_plate")
            ]
        except Exception:
            pass

        frappe.response["message"] = {
            "contract_name": s["name"],
            "contractor_name": s["supplier_name"],
            "supplier_id": s["name"],
            "supplier_group": s.get("supplier_group"),
            "is_contractor": True,
            "is_approved": True,
            "approved_by": s.get("custom_approved_by"),
            "approval_date": str(s["custom_approval_date"]) if s.get("custom_approval_date") else None,
            "access_start": str(s["custom_access_start_date"]) if s.get("custom_access_start_date") else None,
            "access_end": str(s["custom_access_end_date"]) if s.get("custom_access_end_date") else None,
            "contact_phone": s.get("mobile_no") or "",
            "vehicles": vehicles
        }

except Exception as e:
    frappe.log_error("Contractor Contract Search Error")
    frappe.response["message"] = {
        "contract_name": None, "contractor_name": None,
        "is_contractor": False, "supplier_id": None,
        "vehicles": [], "error": str(e)
    }
