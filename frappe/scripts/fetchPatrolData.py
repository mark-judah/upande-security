# Frappe Server Script (Type: API) — name: getPatrolMap
# Sandbox rules: No imports. No augmented assignment. No .append/.add/.update.
# No return. No def. Use str() for dates.

frappe.response["message"] = {"success": False, "error": "Script initializing"}

try:
    # ══════════════════════════════════════════════════════════════════
    # PARAMS
    # ══════════════════════════════════════════════════════════════════
    date_str = frappe.form_dict.get("date")
    if not date_str:
        date_str = frappe.utils.today()

    # Validate / normalise
    date_obj = frappe.utils.getdate(date_str)
    day_str  = str(date_obj)

    range_from_str = day_str + " 00:00:00"
    range_to_str   = day_str + " 23:59:59"

    # Optional spatial downsampling — skip every Nth point to keep payload small.
    # Default 1 (no downsampling). Pass ?stride=3 for a ⅓-size payload.
    stride_raw = frappe.form_dict.get("stride") or "1"
    try:
        stride = int(stride_raw)
    except:
        stride = 1
    if stride < 1:
        stride = 1

    # Max points per guard to send to the client — protects the payload/browser.
    max_points_per_guard = 1500

    params = {
        "from_dt": range_from_str,
        "to_dt":   range_to_str,
        "day":     day_str,
        "now":     str(frappe.utils.now_datetime())
    }

    # ══════════════════════════════════════════════════════════════════
    # 1) PATROL AGGREGATES — one SQL: counts + distance + bbox in one pass
    #     Distance uses LAG window function (same formula as the submit_patrol_points script).
    # ══════════════════════════════════════════════════════════════════
    patrol_agg = frappe.db.sql("""
        SELECT
            t.patrol            AS patrol_tag,
            t.guard             AS guard,
            COUNT(*)            AS points,
            MIN(t.captured_at)  AS first_fix,
            MAX(t.captured_at)  AS last_fix,
            MIN(t.lat)          AS min_lat,
            MAX(t.lat)          AS max_lat,
            MIN(t.lng)          AS min_lng,
            MAX(t.lng)          AS max_lng,
            COALESCE(SUM(t.seg_m), 0) AS distance_m
        FROM (
            SELECT
                patrol,
                guard,
                captured_at,
                lat,
                lng,
                CASE
                    WHEN prev_lat IS NOT NULL THEN
                        6371000 * SQRT(
                            POW((lat - prev_lat) * PI() / 180, 2) +
                            POW((lng - prev_lng) * PI() / 180 * COS(lat * PI() / 180), 2)
                        )
                    ELSE 0
                END AS seg_m
            FROM (
                SELECT
                    patrol,
                    guard,
                    captured_at,
                    CAST(latitude  AS DECIMAL(12,8)) AS lat,
                    CAST(longitude AS DECIMAL(12,8)) AS lng,
                    LAG(CAST(latitude  AS DECIMAL(12,8))) OVER (PARTITION BY patrol ORDER BY captured_at) AS prev_lat,
                    LAG(CAST(longitude AS DECIMAL(12,8))) OVER (PARTITION BY patrol ORDER BY captured_at) AS prev_lng
                FROM `tabPatrol GPS Log`
                WHERE captured_at BETWEEN %(from_dt)s AND %(to_dt)s
                  AND (gps_accuracy IS NULL OR gps_accuracy = '' OR CAST(gps_accuracy AS DECIMAL(12,2)) <= 30)
            ) inner_t
        ) t
        GROUP BY t.patrol, t.guard
        ORDER BY MAX(t.captured_at) DESC
        LIMIT 200
    """, params, as_dict=True)

    # Fast exit when no data
    if not patrol_agg:
        frappe.response["message"] = {
            "success": True,
            "date": day_str,
            "patrol_paths": [],
            "guards": [],
            "summary": {
                "total_guards": 0,
                "total_patrols": 0,
                "total_points": 0,
                "total_distance_km": 0,
                "average_duration_min": 0
            }
        }
    else:
        # Collect tags for the next (points) query
        patrol_tag_list = []
        p_i = 0
        while p_i < len(patrol_agg):
            patrol_tag_list = patrol_tag_list + [patrol_agg[p_i].patrol_tag]
            p_i = p_i + 1

        # ══════════════════════════════════════════════════════════════
        # 2) POINTS — one SQL, server-side downsampling via ROW_NUMBER
        #    Using MOD(row_num, stride) = 1 keeps first, then every Nth.
        # ══════════════════════════════════════════════════════════════
        points_params = {
            "from_dt": range_from_str,
            "to_dt":   range_to_str,
            "tags":    tuple(patrol_tag_list),
            "stride":  stride
        }

        if stride <= 1:
            points = frappe.db.sql("""
                SELECT
                    patrol,
                    guard,
                    captured_at,
                    CAST(latitude  AS DECIMAL(12,8)) AS lat,
                    CAST(longitude AS DECIMAL(12,8)) AS lng
                FROM `tabPatrol GPS Log`
                WHERE patrol IN %(tags)s
                  AND captured_at BETWEEN %(from_dt)s AND %(to_dt)s
                  AND (gps_accuracy IS NULL OR gps_accuracy = '' OR CAST(gps_accuracy AS DECIMAL(12,2)) <= 30)
                ORDER BY patrol, captured_at
            """, points_params, as_dict=True)
        else:
            points = frappe.db.sql("""
                SELECT patrol, guard, captured_at, lat, lng FROM (
                    SELECT
                        patrol,
                        guard,
                        captured_at,
                        CAST(latitude  AS DECIMAL(12,8)) AS lat,
                        CAST(longitude AS DECIMAL(12,8)) AS lng,
                        ROW_NUMBER() OVER (PARTITION BY patrol ORDER BY captured_at) AS rn
                    FROM `tabPatrol GPS Log`
                    WHERE patrol IN %(tags)s
                      AND captured_at BETWEEN %(from_dt)s AND %(to_dt)s
                      AND (gps_accuracy IS NULL OR gps_accuracy = '' OR CAST(gps_accuracy AS DECIMAL(12,2)) <= 30)
                ) t
                WHERE MOD(rn - 1, %(stride)s) = 0
                ORDER BY patrol, captured_at
            """, points_params, as_dict=True)

        # ══════════════════════════════════════════════════════════════
        # 3) RESOLVE GUARD NAMES — batch lookup
        # ══════════════════════════════════════════════════════════════
        guard_ids = []
        seen_guards = {}   # guard_id -> True
        pg_i = 0
        while pg_i < len(patrol_agg):
            gid = patrol_agg[pg_i].guard or ""
            if gid != "" and gid not in seen_guards:
                seen_guards[gid] = True
                guard_ids = guard_ids + [gid]
            pg_i = pg_i + 1

        name_map = {}
        if len(guard_ids) > 0:
            emp_rows = frappe.db.sql("""
                SELECT name, employee_name
                FROM `tabEmployee`
                WHERE name IN %(ids)s
            """, {"ids": tuple(guard_ids)}, as_dict=True)
            er_i = 0
            while er_i < len(emp_rows):
                name_map[emp_rows[er_i].name] = emp_rows[er_i].employee_name or emp_rows[er_i].name
                er_i = er_i + 1

        # ══════════════════════════════════════════════════════════════
        # 4) BUILD PATROL PATHS — group points by patrol_tag with hard cap
        # ══════════════════════════════════════════════════════════════
        points_by_tag = {}
        pt_i = 0
        while pt_i < len(points):
            r = points[pt_i]
            tag = r.patrol
            bucket = points_by_tag.get(tag)
            if bucket is None:
                points_by_tag[tag] = [[float(r.lat), float(r.lng)]]
            else:
                if len(bucket) < max_points_per_guard:
                    points_by_tag[tag] = bucket + [[float(r.lat), float(r.lng)]]
            pt_i = pt_i + 1

        # ══════════════════════════════════════════════════════════════
        # 5) ASSEMBLE RESPONSE — one entry per patrol_tag
        #    Plus an aggregated per-guard summary for the legend
        # ══════════════════════════════════════════════════════════════
        patrol_paths = []
        now_dt = frappe.utils.now_datetime()

        guard_totals = {}  # guard_id -> {patrols, points, distance_m, last_fix_str}

        ag_i = 0
        while ag_i < len(patrol_agg):
            p = patrol_agg[ag_i]
            tag        = p.patrol_tag
            guard_id   = p.guard or ""
            guard_name = name_map.get(guard_id, guard_id or "Unknown")
            pts        = points_by_tag.get(tag) or []
            dist_m     = float(p.distance_m or 0)

            # Duration between first and last fix
            duration_min = 0
            try:
                duration_min = int(frappe.utils.time_diff_in_seconds(p.last_fix, p.first_fix) / 60)
            except:
                duration_min = 0

            # Staleness relative to "now"
            staleness_min = 99999
            try:
                staleness_min = int(frappe.utils.time_diff_in_seconds(now_dt, p.last_fix) / 60)
            except:
                staleness_min = 99999

            is_active = staleness_min <= 30

            last_point = None
            if len(pts) > 0:
                last_point = pts[len(pts) - 1]

            patrol_paths = patrol_paths + [{
                "patrol_tag":       tag,
                "guard_id":         guard_id,
                "guard_name":       guard_name,
                "points":           pts,
                "point_count":      int(p.points or 0),
                "point_count_sent": len(pts),
                "distance_m":       round(dist_m, 1),
                "distance_km":      round(dist_m / 1000.0, 2),
                "first_fix":        str(p.first_fix) if p.first_fix else "",
                "last_fix":         str(p.last_fix)  if p.last_fix  else "",
                "duration_min":     duration_min,
                "staleness_min":    staleness_min,
                "is_active":        is_active,
                "bbox": {
                    "min_lat": float(p.min_lat) if p.min_lat is not None else None,
                    "max_lat": float(p.max_lat) if p.max_lat is not None else None,
                    "min_lng": float(p.min_lng) if p.min_lng is not None else None,
                    "max_lng": float(p.max_lng) if p.max_lng is not None else None
                },
                "last_point": last_point
            }]

            # Guard roll-up
            gt = guard_totals.get(guard_id)
            if gt is None:
                guard_totals[guard_id] = {
                    "guard_id":   guard_id,
                    "guard_name": guard_name,
                    "patrols":    1,
                    "points":     int(p.points or 0),
                    "distance_m": dist_m,
                    "last_fix":   str(p.last_fix) if p.last_fix else "",
                    "is_active":  is_active
                }
            else:
                guard_totals[guard_id] = {
                    "guard_id":   guard_id,
                    "guard_name": guard_name,
                    "patrols":    gt["patrols"] + 1,
                    "points":     gt["points"]  + int(p.points or 0),
                    "distance_m": gt["distance_m"] + dist_m,
                    "last_fix":   str(p.last_fix) if (p.last_fix and str(p.last_fix) > gt["last_fix"]) else gt["last_fix"],
                    "is_active":  gt["is_active"] or is_active
                }

            ag_i = ag_i + 1

        # Flatten guard_totals dict -> list, rounding distance
        guards_list = []
        for k in guard_totals:
            g = guard_totals[k]
            guards_list = guards_list + [{
                "guard_id":    g["guard_id"],
                "guard_name":  g["guard_name"],
                "patrols":     g["patrols"],
                "points":      g["points"],
                "distance_km": round(g["distance_m"] / 1000.0, 2),
                "last_fix":    g["last_fix"],
                "is_active":   g["is_active"]
            }]

        # Sort guards by last_fix desc (most recent first)
        n_g = len(guards_list)
        x = 0
        while x < n_g:
            y = 0
            while y < n_g - 1:
                if guards_list[y]["last_fix"] < guards_list[y + 1]["last_fix"]:
                    tmp = guards_list[y]
                    guards_list[y] = guards_list[y + 1]
                    guards_list[y + 1] = tmp
                y = y + 1
            x = x + 1

        # Summary totals
        total_points = 0
        total_dist_m = 0
        total_dur    = 0
        pp_i = 0
        while pp_i < len(patrol_paths):
            total_points = total_points + patrol_paths[pp_i]["point_count"]
            total_dist_m = total_dist_m + patrol_paths[pp_i]["distance_m"]
            total_dur    = total_dur    + patrol_paths[pp_i]["duration_min"]
            pp_i = pp_i + 1

        avg_dur = round(total_dur / len(patrol_paths), 1) if len(patrol_paths) > 0 else 0

        frappe.response["message"] = {
            "success": True,
            "date": day_str,
            "patrol_paths": patrol_paths,
            "guards": guards_list,
            "summary": {
                "total_guards":         len(guards_list),
                "total_patrols":        len(patrol_paths),
                "total_points":         total_points,
                "total_distance_km":    round(total_dist_m / 1000.0, 2),
                "average_duration_min": avg_dur
            }
        }

except Exception as e:
    frappe.log_error(frappe.get_traceback(), "Patrol Map Error")
    frappe.response["message"] = {
        "success": False,
        "error": "Server error: " + str(e)
    }
