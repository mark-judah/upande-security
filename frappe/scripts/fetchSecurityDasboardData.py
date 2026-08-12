# ═══════════════════════════════════════════════════════════════════════
# Security Dashboard API v4
# Server Script Type: API
# API Method: fetchSecurityDasboardData   (typo preserved)
# ═══════════════════════════════════════════════════════════════════════
# Tabs: overview | attendance | incidents | patrols | patrols_map
# ═══════════════════════════════════════════════════════════════════════
# Constraints:
#   - No imports, no +=, no .append / .add, no def / no return
#   - str() for datetime conversion
#   - Bubble sort where SQL ordering is impractical
# ═══════════════════════════════════════════════════════════════════════
# Changes from v3:
#   - Visitors Inside: counts by (custom_check_in_time set, custom_check_out_time NULL)
#     rather than relying on workflow_state alone
#   - Staff Clocked In: from tabAttendance (in_time set, out_time NULL, status=Present)
#   - Vehicles On Site: tabAppointment checked-in AND custom_vehicles_number_plate filled
#   - Total Patrols: COUNT(DISTINCT patrol) from GPS logs in the range
#   - Attendance tab: uses from_date/to_date directly, no period override
#     Returns full attendance_rows list for client-side search
#   - New: patrols_map tab returns entries + summary for Leaflet map render
# ═══════════════════════════════════════════════════════════════════════

frappe.response["message"] = {"success": False, "error": "Script initializing"}

try:
    tab = frappe.form_dict.get("tab", "overview") or "overview"
    period = frappe.form_dict.get("period", "today") or "today"
    from_date_in = frappe.form_dict.get("from_date", "") or ""
    to_date_in = frappe.form_dict.get("to_date", "") or ""

    today_str = frappe.utils.today()
    now_dt = frappe.utils.now_datetime()

    # ─── PERIOD RESOLVER ────────────────────────────────────────────────
    if period == "custom" and from_date_in and to_date_in:
        range_from = from_date_in
        range_to = to_date_in
    elif period == "yesterday":
        y = frappe.utils.add_days(today_str, -1)
        range_from = y
        range_to = y
    elif period == "last_7_days":
        range_from = frappe.utils.add_days(today_str, -6)
        range_to = today_str
    elif period == "last_30_days":
        range_from = frappe.utils.add_days(today_str, -29)
        range_to = today_str
    elif period == "this_week":
        dow = now_dt.weekday()
        range_from = frappe.utils.add_days(today_str, -dow)
        range_to = today_str
    elif period == "this_month":
        range_from = str(now_dt.year) + "-" + str(now_dt.month).zfill(2) + "-01"
        range_to = today_str
    else:
        range_from = today_str
        range_to = today_str

    from_dt = range_from + " 00:00:00"
    to_dt = range_to + " 23:59:59"

    params = {
        "from_date": range_from,
        "to_date": range_to,
        "from_dt": from_dt,
        "to_dt": to_dt,
        "today": today_str,
        "now": str(now_dt),
    }

    INCIDENT_STATES_OPEN = (
        "Draft",
        "Pending Supervisor Review",
        "Under Investigation",
        "Assigned",
        "Pending Closure Review",
    )

    resp = {
        "success": True,
        "tab": tab,
        "period": period,
        "range_from": range_from,
        "range_to": range_to,
        "generated_at": str(now_dt),
    }

    # ═══════════════════════════════════════════════════════════════════
    # TAB: OVERVIEW
    # ═══════════════════════════════════════════════════════════════════
    if tab == "overview":

        # ─── RIGHT NOW: visitors inside ────────────────────────────────
        # RULE: checked-in but not yet checked-out (regardless of workflow_state)
        inside_rows = frappe.db.sql("""
            SELECT a.name, a.customer_name, a.customer_phone_number,
                   a.custom_visitor_type AS visitor_type,
                   a.custom_meet_with AS host,
                   e.employee_name AS host_name,
                   a.custom_mode_of_transport AS mode_of_transport,
                   a.scheduled_time,
                   a.custom_check_in_time,
                   TIMESTAMPDIFF(MINUTE, a.custom_check_in_time, NOW()) AS duration_minutes
            FROM `tabAppointment` a
            LEFT JOIN `tabEmployee` e ON e.name = a.custom_meet_with
            WHERE a.custom_check_in_time IS NOT NULL
              AND a.custom_check_out_time IS NULL
            ORDER BY a.custom_check_in_time DESC
            LIMIT 200
        """, as_dict=True)

        overstayers = 0
        inside_list = []
        ii = 0
        while ii < len(inside_rows):
            r = inside_rows[ii]
            dur = r.duration_minutes or 0
            if dur > 240:
                overstayers = overstayers + 1
            inside_list = inside_list + [{
                "name": r.name,
                "customer_name": r.customer_name or "",
                "customer_phone_number": r.customer_phone_number or "",
                "visitor_type": r.visitor_type or "",
                "host": r.host_name or r.host or "",
                "mode_of_transport": r.mode_of_transport or "",
                "duration_minutes": dur,
            }]
            ii = ii + 1

        # ─── RIGHT NOW: staff clocked in (from Attendance) ─────────────
        # RULE: today's attendance with in_time set, out_time NULL, Present
        staff_att = frappe.db.sql("""
            SELECT COUNT(*) AS cnt
            FROM `tabAttendance`
            WHERE attendance_date = %(today)s
              AND status = 'Present'
              AND in_time IS NOT NULL
              AND out_time IS NULL
              AND docstatus < 2
        """, params, as_dict=True)
        staff_clocked_in_now = 0
        if staff_att and staff_att[0]:
            staff_clocked_in_now = staff_att[0].cnt or 0

        # ─── RIGHT NOW: vehicles on site ───────────────────────────────
        # RULE: checked-in, not checked-out, AND has plate number
        vehicle_rows = frappe.db.sql("""
            SELECT a.name, a.customer_name,
                   a.custom_mode_of_transport AS mode,
                   a.custom_vehicles_number_plate AS plate,
                   a.custom_vehicles_colour AS colour,
                   TIMESTAMPDIFF(MINUTE, a.custom_check_in_time, NOW()) AS duration_minutes
            FROM `tabAppointment` a
            WHERE a.custom_check_in_time IS NOT NULL
              AND a.custom_check_out_time IS NULL
              AND a.custom_vehicles_number_plate IS NOT NULL
              AND a.custom_vehicles_number_plate != ''
            ORDER BY a.custom_check_in_time DESC
            LIMIT 100
        """, as_dict=True)
        vehicles_list = []
        vi = 0
        while vi < len(vehicle_rows):
            v = vehicle_rows[vi]
            vehicles_list = vehicles_list + [{
                "plate": v.plate or "",
                "mode": v.mode or "",
                "colour": v.colour or "",
                "customer_name": v.customer_name or "",
                "duration_minutes": v.duration_minutes or 0,
            }]
            vi = vi + 1

        # ─── RIGHT NOW: awaiting review ────────────────────────────────
        awaiting_rows = frappe.db.sql("""
            SELECT a.name, a.customer_name,
                   a.custom_visitor_type AS visitor_type,
                   a.workflow_state,
                   TIMESTAMPDIFF(MINUTE, a.creation, NOW()) AS waiting_minutes
            FROM `tabAppointment` a
            WHERE a.workflow_state LIKE 'Pending%%'
            ORDER BY a.creation ASC
            LIMIT 50
        """, as_dict=True)
        aw_lt5 = 0
        aw_5_15 = 0
        aw_gt15 = 0
        awaiting_list = []
        ai = 0
        while ai < len(awaiting_rows):
            a = awaiting_rows[ai]
            wm = a.waiting_minutes or 0
            if wm < 5:
                aw_lt5 = aw_lt5 + 1
            elif wm < 15:
                aw_5_15 = aw_5_15 + 1
            else:
                aw_gt15 = aw_gt15 + 1
            awaiting_list = awaiting_list + [{
                "name": a.name,
                "customer_name": a.customer_name or "",
                "visitor_type": a.visitor_type or "",
                "workflow_state": a.workflow_state or "",
                "waiting_minutes": wm,
            }]
            ai = ai + 1

        # ─── RIGHT NOW: TOTAL PATROLS (today, by distinct patrol id) ──
        total_patrols_today_rows = frappe.db.sql("""
            SELECT COUNT(DISTINCT patrol) AS cnt
            FROM `tabPatrol GPS Log`
            WHERE DATE(captured_at) = %(today)s
              AND patrol IS NOT NULL
              AND patrol != ''
        """, params, as_dict=True)
        total_patrols_today = 0
        if total_patrols_today_rows and total_patrols_today_rows[0]:
            total_patrols_today = total_patrols_today_rows[0].cnt or 0

        # Track stale patrols separately (for anomaly signal only)
        patrol_rows = frappe.db.sql("""
            SELECT patrol,
                   guard,
                   TIMESTAMPDIFF(MINUTE, MAX(captured_at), NOW()) AS staleness_minutes
            FROM `tabPatrol GPS Log`
            WHERE DATE(captured_at) = %(today)s
              AND patrol IS NOT NULL
              AND patrol != ''
            GROUP BY patrol, guard
        """, params, as_dict=True)
        stale_patrols_now = 0
        pi = 0
        while pi < len(patrol_rows):
            pr = patrol_rows[pi]
            stl = pr.staleness_minutes if pr.staleness_minutes is not None else 9999
            if stl > 10 and stl <= 60:
                stale_patrols_now = stale_patrols_now + 1
            pi = pi + 1

        # ─── RIGHT NOW: open incidents ─────────────────────────────────
        inc_rows = frappe.db.sql("""
            SELECT name, incident_datetime, severity, status
            FROM `tabIncident Report`
            WHERE status IN ('Open', 'In Progress')
            ORDER BY incident_datetime DESC
            LIMIT 500
        """, as_dict=True)
        inc_open = 0
        inc_crit_open = 0
        inc_high_open = 0
        inc_oldest_hours = 0
        ici = 0
        while ici < len(inc_rows):
            ir = inc_rows[ici]
            inc_open = inc_open + 1
            sv = ir.severity or "Medium"
            if sv == "Critical":
                inc_crit_open = inc_crit_open + 1
            elif sv == "High":
                inc_high_open = inc_high_open + 1
            if ir.incident_datetime:
                try:
                    hrs = int(frappe.utils.time_diff_in_seconds(now_dt, ir.incident_datetime) / 3600)
                    if hrs > inc_oldest_hours:
                        inc_oldest_hours = hrs
                except:
                    pass
            ici = ici + 1

        resp["visitors_inside"] = len(inside_list)
        resp["visitors_inside_list"] = inside_list
        resp["overstayers_count"] = overstayers
        resp["staff_clocked_in_now"] = staff_clocked_in_now
        resp["vehicles_inside"] = len(vehicles_list)
        resp["vehicles_inside_list"] = vehicles_list
        resp["awaiting_review"] = len(awaiting_list)
        resp["awaiting_list"] = awaiting_list[:5]
        resp["awaiting_age_buckets"] = {"lt_5": aw_lt5, "5_to_15": aw_5_15, "gt_15": aw_gt15}
        resp["total_patrols_today"] = total_patrols_today
        resp["stale_patrols_now"] = stale_patrols_now
        resp["incidents_open"] = inc_open
        resp["incidents_critical_open"] = inc_crit_open
        resp["incidents_high_open"] = inc_high_open
        resp["incidents_oldest_open_hours"] = inc_oldest_hours

        # ─── AT A GLANCE ───────────────────────────────────────────────
        apt_totals = frappe.db.sql("""
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN workflow_state IN ('Approved by Secretary', 'Approved by Host',
                         'Visitor Checked In', 'Visitor Checked Out') THEN 1 ELSE 0 END) AS approved,
                SUM(CASE WHEN workflow_state LIKE 'Rejected%%' THEN 1 ELSE 0 END) AS rejected,
                SUM(CASE WHEN custom_check_out_time IS NOT NULL THEN 1 ELSE 0 END) AS checked_out
            FROM `tabAppointment`
            WHERE DATE(scheduled_time) BETWEEN %(from_date)s AND %(to_date)s
        """, params, as_dict=True)
        total_appts = 0
        approved_count = 0
        rejected_count = 0
        visitors_left = 0
        if apt_totals and apt_totals[0]:
            total_appts = apt_totals[0].total or 0
            approved_count = apt_totals[0].approved or 0
            rejected_count = apt_totals[0].rejected or 0
            visitors_left = apt_totals[0].checked_out or 0

        pp_total = frappe.db.sql("""
            SELECT COUNT(*) AS cnt
            FROM `tabPatrol GPS Log`
            WHERE DATE(captured_at) BETWEEN %(from_date)s AND %(to_date)s
        """, params, as_dict=True)
        total_patrol_points = 0
        if pp_total and pp_total[0]:
            total_patrol_points = pp_total[0].cnt or 0

        is_single_day = (range_from == range_to)
        hourly_throughput = []
        daily_throughput = []

        if is_single_day:
            hr_rows = frappe.db.sql("""
                SELECT
                    HOUR(COALESCE(custom_check_in_time, scheduled_time)) AS hr,
                    SUM(CASE WHEN custom_check_in_time IS NOT NULL THEN 1 ELSE 0 END) AS in_cnt,
                    SUM(CASE WHEN custom_check_out_time IS NOT NULL THEN 1 ELSE 0 END) AS out_cnt
                FROM `tabAppointment`
                WHERE DATE(scheduled_time) = %(from_date)s
                GROUP BY HOUR(COALESCE(custom_check_in_time, scheduled_time))
                ORDER BY hr
            """, params, as_dict=True)
            hr_map = {}
            hri = 0
            while hri < len(hr_rows):
                hrr = hr_rows[hri]
                hr_map[hrr.hr] = {"in": hrr.in_cnt or 0, "out": hrr.out_cnt or 0}
                hri = hri + 1
            h = 6
            while h <= 20:
                e = hr_map.get(h, {"in": 0, "out": 0})
                hourly_throughput = hourly_throughput + [{"hour": h, "in": e["in"], "out": e["out"]}]
                h = h + 1
        else:
            d_rows = frappe.db.sql("""
                SELECT DATE(scheduled_time) AS d,
                       SUM(CASE WHEN custom_check_in_time IS NOT NULL THEN 1 ELSE 0 END) AS in_cnt,
                       SUM(CASE WHEN custom_check_out_time IS NOT NULL THEN 1 ELSE 0 END) AS out_cnt
                FROM `tabAppointment`
                WHERE DATE(scheduled_time) BETWEEN %(from_date)s AND %(to_date)s
                GROUP BY DATE(scheduled_time)
                ORDER BY DATE(scheduled_time)
            """, params, as_dict=True)
            dri = 0
            while dri < len(d_rows):
                dr = d_rows[dri]
                daily_throughput = daily_throughput + [{"date": str(dr.d), "in": dr.in_cnt or 0, "out": dr.out_cnt or 0}]
                dri = dri + 1

        vt_rows = frappe.db.sql("""
            SELECT custom_visitor_type AS visitor_type,
                   COUNT(*) AS cnt,
                   AVG(TIMESTAMPDIFF(MINUTE, custom_check_in_time, custom_check_out_time)) AS avg_dwell
            FROM `tabAppointment`
            WHERE DATE(scheduled_time) BETWEEN %(from_date)s AND %(to_date)s
              AND custom_visitor_type IS NOT NULL
              AND custom_visitor_type != ''
            GROUP BY custom_visitor_type
            ORDER BY cnt DESC
        """, params, as_dict=True)
        visitor_type_breakdown = []
        dwell_breakdown = []
        vti = 0
        while vti < len(vt_rows):
            vt = vt_rows[vti]
            visitor_type_breakdown = visitor_type_breakdown + [{"type": vt.visitor_type, "count": vt.cnt or 0}]
            if vt.avg_dwell:
                dwell_breakdown = dwell_breakdown + [{"type": vt.visitor_type, "avg_minutes": float(vt.avg_dwell)}]
            vti = vti + 1

        resp["total_appointments"] = total_appts
        resp["approved_count"] = approved_count
        resp["rejected_count"] = rejected_count
        resp["visitors_left"] = visitors_left
        resp["total_patrol_points"] = total_patrol_points
        resp["is_single_day"] = is_single_day
        resp["hourly_throughput"] = hourly_throughput
        resp["daily_throughput"] = daily_throughput
        resp["visitor_type_breakdown"] = visitor_type_breakdown
        resp["dwell_breakdown"] = dwell_breakdown

        # ─── ANOMALIES ─────────────────────────────────────────────────
        anomalies = []

        over_rows = frappe.db.sql("""
            SELECT name, customer_name,
                   TIMESTAMPDIFF(MINUTE, custom_check_in_time, NOW()) AS duration_minutes
            FROM `tabAppointment`
            WHERE custom_check_in_time IS NOT NULL
              AND custom_check_out_time IS NULL
              AND TIMESTAMPDIFF(MINUTE, custom_check_in_time, NOW()) > 240
            LIMIT 50
        """, as_dict=True)
        oi = 0
        while oi < len(over_rows):
            ov = over_rows[oi]
            dur = ov.duration_minutes or 0
            hrs = int(dur / 60)
            sev_str = "high" if dur > 480 else "medium"
            anomalies = anomalies + [{
                "type": "Overstay",
                "severity": sev_str,
                "label": (ov.customer_name or "Unknown visitor") + " — inside " + str(hrs) + "h (>4h threshold)",
                "reference": ov.name,
            }]
            oi = oi + 1

        stale_detail = frappe.db.sql("""
            SELECT patrol, guard,
                   TIMESTAMPDIFF(MINUTE, MAX(captured_at), NOW()) AS staleness_minutes
            FROM `tabPatrol GPS Log`
            WHERE DATE(captured_at) = %(today)s
              AND patrol IS NOT NULL
              AND patrol != ''
            GROUP BY patrol, guard
            HAVING staleness_minutes > 10 AND staleness_minutes <= 60
            LIMIT 50
        """, params, as_dict=True)
        si = 0
        while si < len(stale_detail):
            st = stale_detail[si]
            stm = st.staleness_minutes if st.staleness_minutes is not None else 999
            sev_str = "high" if stm > 30 else "medium"
            anomalies = anomalies + [{
                "type": "Stale Patrol",
                "severity": sev_str,
                "label": (st.patrol or "Unknown patrol") + " · " + (st.guard or "Unknown") + " — no GPS fix in " + str(stm) + " min",
                "reference": st.patrol or "",
            }]
            si = si + 1

        old_inc = frappe.db.sql("""
            SELECT name, severity, nature_of_incident, location, incident_datetime,
                   TIMESTAMPDIFF(HOUR, incident_datetime, NOW()) AS age_hours
            FROM `tabIncident Report`
            WHERE status IN ('Open', 'In Progress')
              AND severity IN ('Critical', 'High')
              AND TIMESTAMPDIFF(HOUR, incident_datetime, NOW()) >= 2
            ORDER BY incident_datetime ASC
            LIMIT 50
        """, as_dict=True)
        xi = 0
        while xi < len(old_inc):
            x = old_inc[xi]
            sev_str = "high" if x.severity == "Critical" else "medium"
            lbl = (x.severity or "").upper() + " · " + (x.nature_of_incident or "Incident")
            if x.location:
                lbl = lbl + " @ " + x.location
            lbl = lbl + " — open " + str(x.age_hours or 0) + "h"
            anomalies = anomalies + [{
                "type": "Open Incident",
                "severity": sev_str,
                "label": lbl,
                "reference": x.name,
            }]
            xi = xi + 1

        backlog_rows = frappe.db.sql("""
            SELECT name, customer_name, workflow_state,
                   TIMESTAMPDIFF(MINUTE, creation, NOW()) AS waiting_minutes
            FROM `tabAppointment`
            WHERE workflow_state LIKE 'Pending%%'
              AND TIMESTAMPDIFF(MINUTE, creation, NOW()) > 15
            ORDER BY creation ASC
            LIMIT 50
        """, as_dict=True)
        bi = 0
        while bi < len(backlog_rows):
            b = backlog_rows[bi]
            wm = b.waiting_minutes or 0
            sev_str = "high" if wm > 60 else "medium"
            anomalies = anomalies + [{
                "type": "Queue Backlog",
                "severity": sev_str,
                "label": (b.customer_name or "Unknown") + " — " + (b.workflow_state or "") + " for " + str(wm) + "m",
                "reference": b.name,
            }]
            bi = bi + 1

        resp["anomalies"] = anomalies

    # ═══════════════════════════════════════════════════════════════════
    # TAB: ATTENDANCE
    # Direct from/to date filtering; returns records for client-side search
    # ═══════════════════════════════════════════════════════════════════
    elif tab == "attendance":
        att_rows = frappe.db.sql("""
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) AS present,
                SUM(CASE WHEN status = 'Absent' THEN 1 ELSE 0 END) AS absent,
                SUM(CASE WHEN status = 'Half Day' THEN 1 ELSE 0 END) AS halfday,
                SUM(CASE WHEN status = 'On Leave' THEN 1 ELSE 0 END) AS onleave,
                SUM(CASE WHEN status = 'Work From Home' THEN 1 ELSE 0 END) AS wfh,
                SUM(CASE WHEN status = 'Present' AND in_time IS NOT NULL
                         AND out_time IS NULL THEN 1 ELSE 0 END) AS still_clocked_in
            FROM `tabAttendance`
            WHERE attendance_date BETWEEN %(from_date)s AND %(to_date)s
              AND docstatus < 2
        """, params, as_dict=True)
        att_total = 0
        att_present = 0
        att_absent = 0
        att_halfday = 0
        att_onleave = 0
        att_wfh = 0
        att_still_in = 0
        if att_rows and att_rows[0]:
            att_total = att_rows[0].total or 0
            att_present = att_rows[0].present or 0
            att_absent = att_rows[0].absent or 0
            att_halfday = att_rows[0].halfday or 0
            att_onleave = att_rows[0].onleave or 0
            att_wfh = att_rows[0].wfh or 0
            att_still_in = att_rows[0].still_clocked_in or 0

        # Full table (capped at 1000) for client-side search
        att_list_rows = frappe.db.sql("""
            SELECT
                a.name,
                a.employee,
                a.employee_name,
                a.department,
                a.attendance_date,
                a.status,
                a.in_time,
                a.out_time,
                a.working_hours,
                a.late_entry,
                a.early_exit,
                a.shift
            FROM `tabAttendance` a
            WHERE a.attendance_date BETWEEN %(from_date)s AND %(to_date)s
              AND a.docstatus < 2
            ORDER BY a.attendance_date DESC, a.employee_name ASC
            LIMIT 1000
        """, params, as_dict=True)

        att_records = []
        ar = 0
        while ar < len(att_list_rows):
            a = att_list_rows[ar]
            still_in = 1 if (a.status == "Present" and a.in_time and not a.out_time) else 0
            att_records = att_records + [{
                "name": a.name,
                "employee": a.employee or "",
                "employee_name": a.employee_name or "",
                "department": a.department or "",
                "attendance_date": str(a.attendance_date) if a.attendance_date else "",
                "status": a.status or "",
                "in_time": str(a.in_time) if a.in_time else "",
                "out_time": str(a.out_time) if a.out_time else "",
                "working_hours": float(a.working_hours) if a.working_hours else 0,
                "late_entry": a.late_entry or 0,
                "early_exit": a.early_exit or 0,
                "shift": a.shift or "",
                "still_clocked_in": still_in,
            }]
            ar = ar + 1

        resp["attendance_total"] = att_total
        resp["attendance_present"] = att_present
        resp["attendance_absent"] = att_absent
        resp["attendance_halfday"] = att_halfday
        resp["attendance_onleave"] = att_onleave
        resp["attendance_wfh"] = att_wfh
        resp["attendance_still_clocked_in"] = att_still_in
        resp["attendance_records"] = att_records
        resp["attendance_records_count"] = len(att_records)

    # ═══════════════════════════════════════════════════════════════════
    # TAB: INCIDENTS
    # ═══════════════════════════════════════════════════════════════════
    elif tab == "incidents":
        inc_rows = frappe.db.sql("""
            SELECT name, incident_datetime, reported_datetime, reported_by,
                   reporter_name, nature_of_incident, severity, status,
                   location, assigned_to, resolution_datetime,
                   attachment_1, attachment_2, attachment_3, attachment_4
            FROM `tabIncident Report`
            WHERE incident_datetime BETWEEN %(from_dt)s AND %(to_dt)s
            ORDER BY incident_datetime DESC
            LIMIT 2000
        """, params, as_dict=True)

        inc_total = 0
        inc_open = 0
        inc_under_inv = 0
        inc_resolved = 0
        inc_closed = 0
        inc_critical_open = 0
        inc_high_open = 0

        sev_counts = {"Critical": 0, "High": 0, "Medium": 0, "Low": 0}
        cat_counts = {}
        status_counts = {}
        reporter_counts = {}
        loc_counts = {}
        day_counts = {}

        resolution_secs_sum = 0
        resolution_n = 0
        recent_list = []
        gallery_list = []

        ii = 0
        while ii < len(inc_rows):
            r = inc_rows[ii]
            inc_total = inc_total + 1

            sev = r.severity or "Medium"
            sev_counts[sev] = sev_counts.get(sev, 0) + 1

            cat = r.nature_of_incident or "Other"
            cat_counts[cat] = cat_counts.get(cat, 0) + 1

            st = r.status or "Open"
            status_counts[st] = status_counts.get(st, 0) + 1

            rep = r.reporter_name or r.reported_by or "Unknown"
            reporter_counts[rep] = reporter_counts.get(rep, 0) + 1

            loc = r.location or "Unspecified"
            loc_counts[loc] = loc_counts.get(loc, 0) + 1

            id_ = r.incident_datetime
            day = str(id_)[:10] if id_ else "Unknown"
            day_counts[day] = day_counts.get(day, 0) + 1

            if st == "Open" or st == "In Progress":
                inc_open = inc_open + 1
                if sev == "Critical":
                    inc_critical_open = inc_critical_open + 1
                elif sev == "High":
                    inc_high_open = inc_high_open + 1
            if st == "In Progress":
                inc_under_inv = inc_under_inv + 1
            if st == "Resolved":
                inc_resolved = inc_resolved + 1
            if st == "Closed":
                inc_closed = inc_closed + 1

            rd = r.resolution_datetime
            if rd and id_ and (st == "Resolved" or st == "Closed"):
                try:
                    secs = frappe.utils.time_diff_in_seconds(rd, id_)
                    if secs > 0:
                        resolution_secs_sum = resolution_secs_sum + secs
                        resolution_n = resolution_n + 1
                except:
                    pass

            atts = []
            if r.attachment_1 and r.attachment_1 != "None":
                atts = atts + [r.attachment_1]
            if r.attachment_2 and r.attachment_2 != "None":
                atts = atts + [r.attachment_2]
            if r.attachment_3 and r.attachment_3 != "None":
                atts = atts + [r.attachment_3]
            if r.attachment_4 and r.attachment_4 != "None":
                atts = atts + [r.attachment_4]

            recent_list = recent_list + [{
                "name": r.name,
                "incident_datetime": str(id_) if id_ else "",
                "nature_of_incident": cat,
                "severity": sev,
                "status": st,
                "workflow_state": st,
                "location": r.location or "",
                "reporter_name": rep,
                "assigned_to": r.assigned_to or "",
                "attachments": atts,
            }]

            if atts and len(gallery_list) < 12:
                gallery_list = gallery_list + [{
                    "name": r.name,
                    "severity": sev,
                    "nature_of_incident": cat,
                    "location": r.location or "",
                    "url": atts[0],
                }]

            ii = ii + 1

        sev_list = []
        sev_order = ["Critical", "High", "Medium", "Low"]
        so = 0
        while so < len(sev_order):
            skey = sev_order[so]
            sev_list = sev_list + [{"severity": skey, "count": sev_counts.get(skey, 0)}]
            so = so + 1

        cat_list = []
        for ck in cat_counts:
            cat_list = cat_list + [{"category": ck, "count": cat_counts[ck]}]
        n_cat = len(cat_list)
        c_i = 0
        while c_i < n_cat:
            c_j = 0
            while c_j < n_cat - 1:
                if cat_list[c_j]["count"] < cat_list[c_j + 1]["count"]:
                    tmp = cat_list[c_j]
                    cat_list[c_j] = cat_list[c_j + 1]
                    cat_list[c_j + 1] = tmp
                c_j = c_j + 1
            c_i = c_i + 1

        rep_list = []
        for rk in reporter_counts:
            rep_list = rep_list + [{"reporter": rk, "count": reporter_counts[rk]}]
        n_rep = len(rep_list)
        r_i = 0
        while r_i < n_rep:
            r_j = 0
            while r_j < n_rep - 1:
                if rep_list[r_j]["count"] < rep_list[r_j + 1]["count"]:
                    tmp = rep_list[r_j]
                    rep_list[r_j] = rep_list[r_j + 1]
                    rep_list[r_j + 1] = tmp
                r_j = r_j + 1
            r_i = r_i + 1

        loc_list = []
        for lk in loc_counts:
            loc_list = loc_list + [{"location": lk, "count": loc_counts[lk]}]
        n_loc = len(loc_list)
        l_i = 0
        while l_i < n_loc:
            l_j = 0
            while l_j < n_loc - 1:
                if loc_list[l_j]["count"] < loc_list[l_j + 1]["count"]:
                    tmp = loc_list[l_j]
                    loc_list[l_j] = loc_list[l_j + 1]
                    loc_list[l_j + 1] = tmp
                l_j = l_j + 1
            l_i = l_i + 1

        day_list = []
        for dk in day_counts:
            day_list = day_list + [{"day": dk, "count": day_counts[dk]}]
        n_day = len(day_list)
        d_i = 0
        while d_i < n_day:
            d_j = 0
            while d_j < n_day - 1:
                if day_list[d_j]["day"] > day_list[d_j + 1]["day"]:
                    tmp = day_list[d_j]
                    day_list[d_j] = day_list[d_j + 1]
                    day_list[d_j + 1] = tmp
                d_j = d_j + 1
            d_i = d_i + 1

        status_list = []
        for stk in status_counts:
            status_list = status_list + [{"state": stk, "count": status_counts[stk]}]

        avg_res_min = 0
        if resolution_n > 0:
            avg_res_min = int(resolution_secs_sum / resolution_n / 60.0)

        resp["incidents_total"] = inc_total
        resp["incidents_open"] = inc_open
        resp["incidents_under_investigation"] = inc_under_inv
        resp["incidents_pending_closure"] = 0
        resp["incidents_resolved"] = inc_resolved
        resp["incidents_closed"] = inc_closed
        resp["incidents_rejected"] = 0
        resp["incidents_critical_open"] = inc_critical_open
        resp["incidents_high_open"] = inc_high_open
        resp["incidents_avg_resolution_minutes"] = avg_res_min
        resp["incidents_by_severity"] = sev_list
        resp["incidents_by_category"] = cat_list[:10]
        resp["incidents_by_state"] = status_list
        resp["incidents_by_reporter"] = rep_list[:10]
        resp["incidents_by_location"] = loc_list[:10]
        resp["incidents_over_time"] = day_list
        resp["incidents_recent"] = recent_list[:20]
        resp["incidents_gallery"] = gallery_list

    # ═══════════════════════════════════════════════════════════════════
    # TAB: PATROLS (text/stats view)
    # ═══════════════════════════════════════════════════════════════════
    elif tab == "patrols":
        # Compute per-patrol distance using Haversine on consecutive points
        # via correlated subquery LAG-style (MariaDB 10.3+ supports window functions)
        patrol_distance_rows = frappe.db.sql("""
            SELECT patrol,
                   SUM(seg_m) AS distance_m
            FROM (
                SELECT
                    patrol,
                    6371000 * 2 * ASIN(SQRT(
                        POWER(SIN((RADIANS(CAST(latitude AS DECIMAL(10,7))) - RADIANS(LAG(CAST(latitude AS DECIMAL(10,7))) OVER (PARTITION BY patrol ORDER BY captured_at))) / 2), 2)
                        + COS(RADIANS(LAG(CAST(latitude AS DECIMAL(10,7))) OVER (PARTITION BY patrol ORDER BY captured_at)))
                          * COS(RADIANS(CAST(latitude AS DECIMAL(10,7))))
                          * POWER(SIN((RADIANS(CAST(longitude AS DECIMAL(10,7))) - RADIANS(LAG(CAST(longitude AS DECIMAL(10,7))) OVER (PARTITION BY patrol ORDER BY captured_at))) / 2), 2)
                    )) AS seg_m
                FROM `tabPatrol GPS Log`
                WHERE DATE(captured_at) BETWEEN %(from_date)s AND %(to_date)s
                  AND patrol IS NOT NULL
                  AND patrol != ''
                  AND latitude IS NOT NULL
                  AND longitude IS NOT NULL
            ) segs
            WHERE seg_m IS NOT NULL
            GROUP BY patrol
        """, params, as_dict=True)
        distance_by_patrol = {}
        ddi = 0
        while ddi < len(patrol_distance_rows):
            dr = patrol_distance_rows[ddi]
            distance_by_patrol[dr.patrol] = float(dr.distance_m or 0)
            ddi = ddi + 1

        patrol_rows = frappe.db.sql("""
            SELECT patrol,
                   guard,
                   DATE(MIN(captured_at)) AS patrol_date,
                   COUNT(*) AS points,
                   MIN(captured_at) AS first_fix,
                   MAX(captured_at) AS last_fix,
                   TIMESTAMPDIFF(MINUTE, MAX(captured_at), NOW()) AS staleness_minutes
            FROM `tabPatrol GPS Log`
            WHERE DATE(captured_at) BETWEEN %(from_date)s AND %(to_date)s
              AND patrol IS NOT NULL
              AND patrol != ''
            GROUP BY patrol, guard
            ORDER BY last_fix DESC
            LIMIT 500
        """, params, as_dict=True)

        total_patrols_in_range = 0
        active_patrols = 0
        stale_patrols = 0
        total_points = 0
        total_distance_m = 0
        patrol_list = []
        pi2 = 0
        while pi2 < len(patrol_rows):
            pr = patrol_rows[pi2]
            total_patrols_in_range = total_patrols_in_range + 1
            stl = pr.staleness_minutes if pr.staleness_minutes is not None else 9999
            is_today = (str(pr.patrol_date) == today_str)
            if is_today and stl <= 30:
                status = "Active"
                active_patrols = active_patrols + 1
                if stl > 10:
                    stale_patrols = stale_patrols + 1
            else:
                status = "Ended"
            total_points = total_points + (pr.points or 0)
            dist_m = distance_by_patrol.get(pr.patrol, 0)
            total_distance_m = total_distance_m + dist_m
            patrol_list = patrol_list + [{
                "name": pr.patrol or "",
                "patrol": pr.patrol or "",
                "guard": pr.guard or "",
                "patrol_date": str(pr.patrol_date or ""),
                "status": status,
                "points": pr.points or 0,
                "distance_m": dist_m,
                "first_fix": str(pr.first_fix) if pr.first_fix else "",
                "last_fix": str(pr.last_fix) if pr.last_fix else "",
                "staleness_minutes": stl if stl < 9999 else 0,
            }]
            pi2 = pi2 + 1

        # Per-guard distance aggregation (sum distances across their patrols)
        guard_distance_rows = frappe.db.sql("""
            SELECT guard, SUM(seg_m) AS distance_m
            FROM (
                SELECT
                    guard,
                    6371000 * 2 * ASIN(SQRT(
                        POWER(SIN((RADIANS(CAST(latitude AS DECIMAL(10,7))) - RADIANS(LAG(CAST(latitude AS DECIMAL(10,7))) OVER (PARTITION BY patrol ORDER BY captured_at))) / 2), 2)
                        + COS(RADIANS(LAG(CAST(latitude AS DECIMAL(10,7))) OVER (PARTITION BY patrol ORDER BY captured_at)))
                          * COS(RADIANS(CAST(latitude AS DECIMAL(10,7))))
                          * POWER(SIN((RADIANS(CAST(longitude AS DECIMAL(10,7))) - RADIANS(LAG(CAST(longitude AS DECIMAL(10,7))) OVER (PARTITION BY patrol ORDER BY captured_at))) / 2), 2)
                    )) AS seg_m
                FROM `tabPatrol GPS Log`
                WHERE DATE(captured_at) BETWEEN %(from_date)s AND %(to_date)s
                  AND patrol IS NOT NULL
                  AND patrol != ''
                  AND guard IS NOT NULL
                  AND guard != ''
                  AND latitude IS NOT NULL
                  AND longitude IS NOT NULL
            ) segs
            WHERE seg_m IS NOT NULL
            GROUP BY guard
        """, params, as_dict=True)
        distance_by_guard = {}
        gdi = 0
        while gdi < len(guard_distance_rows):
            gd = guard_distance_rows[gdi]
            distance_by_guard[gd.guard] = float(gd.distance_m or 0)
            gdi = gdi + 1

        guard_rows = frappe.db.sql("""
            SELECT
                gl.guard AS employee,
                e.employee_name,
                e.department,
                COUNT(DISTINCT gl.patrol) AS patrols,
                COUNT(gl.name) AS total_points
            FROM `tabPatrol GPS Log` gl
            LEFT JOIN `tabEmployee` e ON e.name = gl.guard
            WHERE DATE(gl.captured_at) BETWEEN %(from_date)s AND %(to_date)s
              AND gl.guard IS NOT NULL
              AND gl.guard != ''
            GROUP BY gl.guard, e.employee_name, e.department
            ORDER BY total_points DESC
            LIMIT 100
        """, params, as_dict=True)
        guard_stats = []
        gi = 0
        while gi < len(guard_rows):
            g = guard_rows[gi]
            g_dist = distance_by_guard.get(g.employee, 0)
            guard_stats = guard_stats + [{
                "employee": g.employee or "",
                "employee_name": g.employee_name or g.employee or "",
                "department": g.department or "",
                "patrols": g.patrols or 0,
                "total_points": g.total_points or 0,
                "distance_m": g_dist,
                "distance_km": round(g_dist / 1000.0, 2),
                "visitors_processed": 0,
            }]
            gi = gi + 1

        resp["total_patrols_in_range"] = total_patrols_in_range
        resp["active_patrols"] = active_patrols
        resp["stale_patrols"] = stale_patrols
        resp["total_patrol_points"] = total_points
        resp["total_distance_m"] = total_distance_m
        resp["total_distance_km"] = round(total_distance_m / 1000.0, 2)
        resp["patrol_list"] = patrol_list
        resp["guard_stats"] = guard_stats


    else:
        resp["success"] = False
        resp["error"] = "Unknown tab: " + tab

    frappe.response["message"] = resp

except Exception as e:
    frappe.log_error(str(e), "Security Dashboard Error")
    frappe.response["message"] = {"success": False, "error": "Server error: " + str(e)}
