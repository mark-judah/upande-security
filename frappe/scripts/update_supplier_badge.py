# Edits a Supplier Badge from the Command Center's mobile badge-management
# screen. Also doubles as "issue a badge" — issuing is just setting
# supplier + company + status=Active on a currently-Unassigned badge, same
# endpoint, no separate verb needed.
#
# Request payload (only "name" is required — every other field is optional,
# only fields present in the payload are applied):
#   {
#     "name": "<Supplier Badge name>",
#     "supplier": "<Supplier name>",
#     "company": "<Company name>",
#     "status": "Unassigned" | "Active" | "Suspended" | "Lost"
#   }
#
# qr_image is never touched here — it's generated/attached elsewhere.
#
# Access: strictly Security Head / System Manager by role - no allowlist.
try:
    current_user = frappe.session.user
    role_rows = frappe.db.sql(
        "SELECT role FROM `tabHas Role` WHERE parent = %s", (current_user,)
    )
    roles = []
    for row in role_rows:
        if row and row[0]:
            roles.append(row[0])
    has_access = "Security Head" in roles or "System Manager" in roles

    if not has_access:
        frappe.response["message"] = {"error": "You do not have access to this action."}
    else:
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
        elif not frappe.db.exists("Supplier Badge", name):
            frappe.response["message"] = {"error": "Supplier Badge not found."}
        else:
            # Matches Supplier Badge's "status" Select options exactly (see
            # fixtures/doctype.json's "Supplier Badge" entry).
            valid_statuses = ("Unassigned", "Active", "Suspended", "Lost")

            has_supplier = True
            supplier_val = None
            try:
                supplier_val = data["supplier"]
            except (KeyError, TypeError):
                has_supplier = False

            has_company = True
            company_val = None
            try:
                company_val = data["company"]
            except (KeyError, TypeError):
                has_company = False

            has_status = True
            status_val = None
            try:
                status_val = data["status"]
            except (KeyError, TypeError):
                has_status = False

            if has_status and status_val not in valid_statuses:
                frappe.response["message"] = {"error": "Invalid status."}
            else:
                doc = frappe.get_doc("Supplier Badge", name)
                applied = False
                if has_supplier:
                    doc.supplier = supplier_val
                    applied = True
                if has_company:
                    doc.company = company_val
                    applied = True
                if has_status:
                    doc.status = status_val
                    applied = True

                if not applied:
                    frappe.response["message"] = {"error": "No updatable fields were sent"}
                else:
                    try:
                        doc.save(ignore_permissions=True)
                        frappe.db.commit()

                        supplier_name = ""
                        if doc.supplier:
                            supplier_name = frappe.db.get_value("Supplier", doc.supplier, "supplier_name") or ""

                        frappe.response["message"] = {
                            "success": True,
                            "name": doc.name,
                            "badge_number": doc.badge_number,
                            "supplier": doc.supplier or "",
                            "supplier_name": supplier_name,
                            "company": doc.company or "",
                            "status": doc.status,
                        }
                    except Exception as e:
                        frappe.db.rollback()
                        frappe.response["message"] = {"error": str(e)}
except Exception as e:
    frappe.db.rollback()
    frappe.log_error("update_supplier_badge", str(e))
    frappe.response["message"] = {"error": str(e)}
