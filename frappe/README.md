# Frappe backend — `upande_security`

This folder is the **source of truth** for everything the Frappe instance at
`kaitet-group.upande.com` needs in order for the mobile app to function:
DocTypes, Server Scripts, Custom Fields, Property Setters, Client Scripts,
and any Web Pages.

Every record in these JSON files mirrors a Frappe document. The repo IS the
schema — pushing to a different site is just `bench import-doc` against a
different URL.

## Layout

| File                       | Purpose                                                              |
|----------------------------|----------------------------------------------------------------------|
| `doctypes.json`            | Security-specific DocTypes (Incident Report, Incident Category, Patrol GPS Log) |
| `server_scripts.json`      | All API verbs (`script_type: "API"`). One verb per script.           |
| `custom_fields.json`       | `custom_*` fields added to stock ERPNext doctypes (Appointment, Tractor Daily Task, Employee, Attendance) |
| `property_setters.json`    | Property overrides on stock doctypes                                 |
| `client_scripts.json`      | UI-only Frappe Client Scripts (if any)                               |
| `web_pages/`               | Operational dashboards as self-contained HTML                        |

## Prerequisites on the Frappe instance

1. **Server scripts must be enabled.** In `site_config.json`:
   ```json
   "server_script_enabled": true
   ```
   Then `bench restart`. On Frappe Cloud, server scripts are only supported on
   **private** benches — confirm before standing up a new instance.

2. **Stock doctypes the security app touches** (must exist before the custom
   fields below can apply):
   - `Appointment` (the existing doctype the security app uses for visitor management)
   - `Tractor Daily Task` (used for company-vehicle gate tracking)
   - `Employee`, `Attendance`, `Timesheet` (ERPNext / HR core)

## Naming convention

- **Module**: `Upande Security` (display name) / `upande_security` (slug)
- **Server-script API methods**: no prefix.
  - `POST /api/method/check_in_visitor`
  - `POST /api/method/search_visitor_appointment`
  - `POST /api/method/get_session_info`
- **DocTypes**: PascalCase. Security-specific ones live in module `Upande Security`.
- **Custom fields** on stock ERPNext doctypes: prefix with `custom_`.

## Server-script house style

Every API server script follows this shape. Copy and adapt — don't deviate.

```python
try:
    # 1. Read body — accept JSON or form-encoded
    data = {}
    try:
        data = frappe.request.get_json(silent=True) or {}
    except Exception:
        data = {}
    if not data:
        data = dict(frappe.form_dict or {})

    # 2. Pull and validate inputs
    name = str(data.get("name") or "").strip()

    # 3. Soft-fail on validation — NEVER set frappe.response.http_status_code
    #    (the safe-exec sandbox blocks setattr on frappe.response).
    if not name:
        frappe.response["message"] = {"error": "name is required"}
    else:
        # 4. Do the work
        doc = frappe.new_doc("Thing")
        doc.name1 = name
        doc.insert(ignore_permissions=True)
        frappe.db.commit()
        frappe.response["message"] = {"name": doc.name}
except Exception as e:
    frappe.db.rollback()
    frappe.log_error("check_in_visitor", str(e))
    frappe.response["message"] = {"error": str(e)}
```

Hard rules (all derived from the safe-exec sandbox restrictions):
- **No imports.** Everything you need is on `frappe`, `frappe.utils`, or builtins.
- **No `.format()` / f-strings.** Use `+` concatenation or `"%s" % value`.
- **No top-level `return`.** Branch with `if / elif / else` and set
  `frappe.response["message"]` in each branch.
- **No augmented assignment** (`+=`, `-=`) at top level — use `x = x + 1`.
- **`frappe.db.sql` is SELECT-only.** Use `frappe.db.set_value`,
  `frappe.new_doc(...).insert()`, `frappe.delete_doc(...)` for DML.
- **Always parameterise SQL.** Positional `%s`, named `%(foo)s` — never f-string
  user values into a query.
- **Soft-fail on 200** with `{"error": "..."}`. The mobile `call<T>` wrapper
  promotes that to a thrown error, so the UI sees the same flow.
- **No identifiers starting with `_`** — `_probe`, `__name__`, etc. fail at
  compile time with `"invalid attribute/variable name"`.
- **`type()` and `isinstance()` are not in the namespace.** For list-vs-dict
  dispatch, probe with integer indexing: try `raw[0]` in a try/except — lists
  succeed, dicts raise.
- **`.get(...)` on a dict is intercepted as a key lookup, not a method call.**
  `entry.get("foo")` evaluates to `entry["get"]` which is None, then trying
  to call None raises `'NoneType' object is not callable`. Use bracket access
  with a `try/except (KeyError, TypeError)` wrapper. Example:
  ```python
  value = ""
  try:
      value = str(entry["field_name"] or "").strip()
  except (KeyError, TypeError):
      pass
  ```
- **Attribute access on plain dicts silently returns None.** Don't trust
  `entry.field_name` to raise on missing keys — it just returns None. Same
  conclusion: bracket access.
- **Duck-type via `try: x.foo / except AttributeError` is unreliable on lists**
  — list attribute access also silently returns None. Use index-probing instead.

## Deployment

Scripts are deployed to `kaitet-group.upande.com` via FAC
(`/api/method/frappe_assistant_core.api.fac_endpoint.handle_mcp`).

After every change to a JSON file in this folder:
1. Push the updated record(s) to the live instance via FAC.
2. Commit the JSON change in the same PR as the corresponding mobile-app
   change that calls the new verb.

## Verb inventory

Stored in `server_scripts.json` — names match the mobile client's
`lib/services/api.ts` exactly so grep works from either side.

| Verb                              | Purpose                                                |
|-----------------------------------|--------------------------------------------------------|
| `get_session_info`                | User, full name, roles, employee link — drives side menu + role-gated UI |
| `search_visitor_appointment`      | Fuzzy search visitor by name/ID/phone, returns best match for today      |
| `search_staff`                    | Lookup staff by employee ID                            |
| `search_contractor`               | Lookup active contractor contract                      |
| `search_employees`                | Type-ahead host search (active employees)              |
| `get_employee`                    | Fetch employee fields needed for staff attendance      |
| `get_appointment`                 | Fetch full Appointment doc + current workflow state    |
| `check_in_visitor`                | Update Appointment fields + transition to Visitor Checked In |
| `check_out_visitor`               | Transition to Visitor Checked Out + stamp check-out time |
| `create_walk_in`                  | Create + check-in a walk-in Appointment in one call    |
| `daily_summary`                   | Aggregated totals + lists for the Summary tab          |
| `list_incident_categories`        | Categories for the incident-report form                |
| `create_incident`                 | Create an Incident Report                              |
| `my_incidents`                    | List incidents reported by `frappe.session.user`       |
| `search_vehicle_tickets`          | Tractor Daily Task search by name                      |
| `get_vehicle_ticket`              | Full ticket fetch                                      |
| `record_vehicle_entry`            | Stamp entry time + farm + status=Inside                |
| `record_vehicle_exit`             | Stamp exit time + completion note + status=Exited, mark task row completed |
| `create_gate_timesheet`           | Build Timesheet from ticket + entry time               |
| `submit_gate_timesheet`           | Compute hours, write completion note, submit (docstatus=1) |
| `create_staff_attendance`         | Insert Attendance row (Present, in_time=now)           |
| `submit_staff_attendance`         | Submit (docstatus=1) an Attendance row                 |
| `staff_gate_checkout`             | Stamp out_time + working_hours on an open Attendance row |
| `gate_temp_exit`                  | Step out / return for a currently-inside Appointment or Attendance, without a full check-out |
| `get_visitor_history`             | Look up a walk-in visitor's most recent past visit to prefill the form |
| `submit_patrol_points`            | Batch GPS-point ingest from the patrol foreground task |

26 verbs total.

Also on the instance but outside the mobile app's API surface: `Mark Guard Shift Checkin`
(`server_scripts/mark_guard_shift_checkin.py`, `script_type: "DocType Event"` on Employee
Checkin → After Insert) — ticks a guard's Shift Assignment when their biometric
check-in lands. Needs `custom_checked_in` / `custom_checkin_time` /
`custom_checkin_reference` custom fields on Shift Assignment, not yet in
`custom_fields.json`. Not wired into this config-as-code push yet since it's
unrelated to anything the app calls.
