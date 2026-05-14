# Security Patrol — Frappe backend

The patrol feature is **client-driven**. The app starts and stops patrols entirely on the phone. The only server contact is periodic batched uploads of GPS points.

- **No start endpoint.** Patrols begin locally when the guard taps Start.
- **No stop endpoint.** Patrols end locally when the guard taps Stop.
- **One endpoint** — `submitPatrolPoints` — receives batches of up to 20 points every 2 minutes, lazy-creates the log rows, and de-duplicates on `(patrol, captured_at)`.

## 1. DocType: `Patrol GPS Log`

One row per captured GPS point. This is the only DocType needed for patrols.

| Field         | Type     | Options / notes                        |
|---------------|----------|----------------------------------------|
| `patrol`      | Data     | `reqd: 1` — holds the client-generated `patrol_tag` |
| `guard`       | Link     | Options: `Employee`                    |
| `captured_at` | Datetime | `reqd: 1`                              |
| `latitude`    | Data     | `reqd: 1`                              |
| `longitude`   | Data     | `reqd: 1`                              |
| `gps_accuracy`| Data     | optional                                |

Recommended MySQL index (runs once — Frappe DocType indexes can't declare composite prefixes):

```sql
ALTER TABLE `tabPatrol GPS Log`
  ADD INDEX `idx_pgl_patrol_captured` (patrol(64), captured_at);
```

The `(patrol, captured_at)` pair is what the endpoint uses for dedup lookup — this index makes it fast as rows accumulate.

## 2. Server Script: `submitPatrolPoints`

Create via **Server Script List → New**.

- **Script Type:** `API`
- **Method Name:** `submitPatrolPoints`
- **Allow Guest:** `No`

```python
data = frappe.request.get_json()

if not data:
    frappe.response.http_status_code = 400
    frappe.response["data"] = {"status": "error", "message": "GPS data missing."}
else:
    # Duck-type dispatch — dicts have .get, lists don't. Frappe's safe_exec
    # doesn't expose type() / isinstance() / hasattr(), so use AttributeError.
    try:
        data.get
        data_list = [data]
    except AttributeError:
        data_list = data

    results = []
    has_errors = False
    current_user = frappe.session.user

    employees = frappe.get_all(
        "Employee",
        filters={"user_id": current_user},
        fields=["name"]
    )
    resolved_guard = ""
    if employees:
        resolved_guard = employees[0].get("name")

    for entry in data_list:
        try:
            patrol_tag  = str(entry.get("patrol_tag") or entry.get("patrol") or "").strip()
            guard_code  = str(entry.get("guard") or "").strip()
            latitude    = entry.get("latitude")
            longitude   = entry.get("longitude")
            accuracy    = entry.get("accuracy")
            captured_at = entry.get("captured_at")

            if not patrol_tag:
                has_errors = True
                results.append({"status": "error", "message": "patrol_tag is required."})
                continue

            if not latitude or not longitude or not captured_at:
                has_errors = True
                results.append({
                    "status": "error",
                    "message": "latitude, longitude and captured_at are required.",
                    "patrol_tag": patrol_tag
                })
                continue

            existing_log = frappe.db.get_value(
                "Patrol GPS Log",
                {"patrol": patrol_tag, "captured_at": captured_at},
                "name"
            )
            if existing_log:
                results.append({
                    "status": "success",
                    "message": "Duplicate — already synced.",
                    "name": existing_log,
                    "patrol_tag": patrol_tag,
                    "duplicate": True
                })
                continue

            guard = resolved_guard
            if not guard:
                guard = guard_code

            log = frappe.new_doc("Patrol GPS Log")
            log.patrol      = patrol_tag
            log.guard       = guard
            log.captured_at = captured_at
            log.latitude    = str(latitude)
            log.longitude   = str(longitude)
            if accuracy:
                log.gps_accuracy = str(accuracy)
            log.insert(ignore_permissions=True)

            results.append({
                "status": "success",
                "name": log.name,
                "patrol_tag": patrol_tag,
                "captured_at": captured_at
            })
        except Exception as row_err:
            has_errors = True
            frappe.log_error("submitPatrolPoints row", str(row_err))
            results.append({"status": "error", "message": str(row_err)})

    any_success = False
    for r in results:
        if r.get("status") == "success":
            any_success = True

    if any_success:
        frappe.db.commit()
    else:
        frappe.db.rollback()

    if has_errors:
        all_errors = True
        for r in results:
            if r.get("status") != "error":
                all_errors = False
        if all_errors:
            frappe.response.http_status_code = 400
        else:
            frappe.response.http_status_code = 207
    else:
        frappe.response.http_status_code = 200

    frappe.response["data"] = results
```

### Sandbox-safe constraints honoured

- No imports.
- No augmented assignment (`+=`, `-=`, etc.) — every increment is `x = x + y`.
- No in-place slicing.
- No `type()`, `isinstance()`, or `hasattr()` — batch/single dispatch uses duck-typing on `.get` wrapped in `try/except AttributeError`.
- No `return` — every path writes `frappe.response.http_status_code` + `frappe.response["data"]`.
- Datetimes stringified with `str(...)` where needed (this script only emits strings for lat/lng/accuracy; `captured_at` is already an incoming string).

## 3. Request / response shape

**Request body** — either a single object or a list. The mobile client always sends a list of up to 20 items:

```json
[
  {
    "client_id":   "PAT-GUARD-20260419-120005123|2026-04-19 12:00:05|-1.234567|36.789012",
    "patrol_tag":  "PAT-GUARD-20260419-120005123",
    "guard":       "EMP-0042",
    "latitude":    -1.234567,
    "longitude":   36.789012,
    "accuracy":    5.2,
    "captured_at": "2026-04-19 12:00:05"
  }
]
```

(The `client_id` and `guard` fields are ignored server-side except that `guard` is used as a fallback when `frappe.session.user` has no linked Employee.)

**Response** — one result object per input row:

```json
{
  "data": [
    { "status": "success", "name": "PGL-0001", "patrol_tag": "PAT-...", "captured_at": "2026-04-19 12:00:05" },
    { "status": "success", "name": "PGL-0000", "patrol_tag": "PAT-...", "duplicate": true }
  ]
}
```

HTTP status codes:
- `200` — all rows inserted (or duplicate-skipped).
- `207` — mixed: some succeeded, some failed. Client marks only the succeeded points as synced; failed rows stay queued for the next cycle.
- `400` — every row was invalid (malformed payload).
- `500` — unexpected server error.

## 4. Client flow summary

Nothing on the server reacts to Start or Stop. The full lifecycle:

1. **Start (phone only).** Client generates a `patrol_tag`, writes an `active_patrol` row to local SQLite, starts the background location task + foreground poller + watchdog + sync loop.
2. **Capture (phone only).** GPS points accumulate in the local `patrol_gps_queue` table with `synced = 0`.
3. **Sync (phone → server).** Every 2 minutes, and on AppState → active, the client calls `POST /api/method/submitPatrolPoints` with up to 20 queued rows. Successful rows are marked `synced = 1` and deleted.
4. **Stop (phone only).** Client races a final sync against a 5 s timeout, stops all collectors, clears the local `active_patrol` row. No server notification.

If the phone is killed, the local `active_patrol` row survives. Re-opening the app drops the guard back on the live screen; the watchdog restarts the background task and the sync loop picks up where it left off.

## 5. Permissions

Grant the Gate Guard role:
- `read`/`write`/`create` on **Patrol GPS Log**
- `read` on **Employee** (needed so `frappe.session.user` can be resolved to a guard `name`)

## 6. Smoke test

```bash
curl -X POST "$URL/api/method/submitPatrolPoints" \
  -H "Content-Type: application/json" \
  -H "Cookie: sid=..." \
  -d '[{"patrol_tag":"PAT-TEST-20260419-120000001","guard":"EMP-0001",
        "latitude":"-1.2345","longitude":"36.7890","accuracy":"5.2",
        "captured_at":"2026-04-19 12:00:05"}]'
```

Expected: `200 OK` with a `data` array containing one `{"status":"success", ...}` entry. A second call with the same payload returns `200` with `"duplicate": true`.
