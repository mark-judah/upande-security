try:
    rows = frappe.get_all(
        "Incident Category",
        fields=["name"],
        order_by="name asc",
        limit_page_length=100,
    )
    out = []
    for r in rows:
        out.append({"name": r.name})
    frappe.response["message"] = out
except Exception as e:
    frappe.log_error("list_incident_categories", str(e))
    frappe.response["message"] = {"error": str(e)}
