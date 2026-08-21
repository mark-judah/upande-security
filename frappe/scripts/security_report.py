try:
    data = {}
    try:
        data = frappe.request.get_json(silent=True) or {}
    except Exception:
        data = {}
    if not data:
        data = dict(frappe.form_dict or {})

    def s(k):
        try:
            v = data[k]
            if v is None:
                return ""
            return str(v).strip()
        except (KeyError, TypeError):
            return ""

    tab = s("tab") or "overview"
    fromd = s("from_date") or str(frappe.utils.nowdate())
    tod = s("to_date") or str(frappe.utils.nowdate())
    farm = s("farm")
    loc = s("location")
    start = fromd + " 00:00:00"
    end = tod + " 23:59:59"
    now = frappe.utils.now_datetime()

    # Optional filters (parameterised — never string-interpolated).
    FARM_SQL = ""
    FARM_P = []
    if farm:
        FARM_SQL = " AND a.custom_farmunit = %s"
        FARM_P = [farm]
    LOC_SQL = ""
    LOC_P = []
    if loc:
        LOC_SQL = " AND location = %s"
        LOC_P = [loc]

    kpis = []
    tables = []
    watch = []
    extra = {}

    def scalar(q, params):
        try:
            r = frappe.db.sql(q, params)
            if r and r[0] and r[0][0] is not None:
                return r[0][0]
        except Exception:
            return 0
        return 0

    def kpi(label, value, sub):
        kpis.append({"label": label, "value": value, "sub": sub})

    def add_table(title, columns, rows):
        tables.append({"title": title, "columns": columns, "rows": rows})

    def add_watch(title, tone, rows):
        watch.append({"title": title, "tone": tone, "rows": rows})

    def farm_options():
        fl = []
        fr = frappe.db.sql("SELECT DISTINCT custom_farmunit FROM `tabAppointment` WHERE custom_farmunit IS NOT NULL AND custom_farmunit != '' ORDER BY custom_farmunit LIMIT 100", ())
        for row in fr:
            fl.append(row[0])
        return fl

    VIS = "(COALESCE(a.custom_visitor_type,'') <> 'Contractor')"
    CON = "a.custom_visitor_type = 'Contractor'"

    def appt_kpis(who):
        ci = scalar("SELECT COUNT(*) FROM `tabAppointment` a WHERE " + who + FARM_SQL + " AND a.custom_check_in_time BETWEEN %s AND %s", tuple(FARM_P + [start, end]))
        co = scalar("SELECT COUNT(*) FROM `tabAppointment` a WHERE " + who + FARM_SQL + " AND a.custom_check_out_time BETWEEN %s AND %s", tuple(FARM_P + [start, end]))
        inside = scalar("SELECT COUNT(*) FROM `tabAppointment` a WHERE " + who + FARM_SQL + " AND a.custom_check_in_time IS NOT NULL AND a.custom_check_out_time IS NULL", tuple(FARM_P))
        avg = scalar("SELECT ROUND(AVG(TIMESTAMPDIFF(MINUTE, a.custom_check_in_time, a.custom_check_out_time))) FROM `tabAppointment` a WHERE " + who + FARM_SQL + " AND a.custom_check_out_time BETWEEN %s AND %s", tuple(FARM_P + [start, end]))
        return [ci, co, inside, avg]

    def host_rows(who):
        rows = []
        r = frappe.db.sql("SELECT COALESCE(NULLIF(e.employee_name,''), a.custom_meet_with, '—') h, COUNT(*) c FROM `tabAppointment` a LEFT JOIN `tabEmployee` e ON e.name = a.custom_meet_with WHERE " + who + FARM_SQL + " AND a.custom_check_in_time BETWEEN %s AND %s GROUP BY h ORDER BY c DESC LIMIT 10", tuple(FARM_P + [start, end]))
        for row in r:
            rows.append({"host": row[0] or "—", "count": row[1]})
        return rows

    def overstay_rows(who):
        rows = []
        r = frappe.db.sql("SELECT a.customer_name, COALESCE(NULLIF(e.employee_name,''), a.custom_meet_with, '—'), a.custom_check_in_time FROM `tabAppointment` a LEFT JOIN `tabEmployee` e ON e.name = a.custom_meet_with WHERE " + who + FARM_SQL + " AND a.custom_check_in_time IS NOT NULL AND a.custom_check_out_time IS NULL AND a.custom_check_in_time < %s ORDER BY a.custom_check_in_time ASC LIMIT 25", tuple(FARM_P + [frappe.utils.add_to_date(now, hours=-8)]))
        for row in r:
            hrs = 0
            try:
                hrs = round(frappe.utils.time_diff_in_hours(now, row[2]), 1)
            except Exception:
                hrs = 0
            rows.append({"label": (row[0] or "—") + " · " + str(row[1]), "detail": str(hrs) + "h inside"})
        return rows

    if tab == "visitors":
        k = appt_kpis(VIS)
        kpi("Checked In", k[0], "in range")
        kpi("Checked Out", k[1], "in range")
        kpi("Still Inside", k[2], "now")
        kpi("Avg Visit", (str(k[3]) + "m") if k[3] else "—", "duration")
        add_table("Top Hosts", [{"key": "host", "label": "Host"}, {"key": "count", "label": "Visits", "align": "right"}], host_rows(VIS))
        fr = []
        r = frappe.db.sql("SELECT COALESCE(NULLIF(a.workflow_state,''),'—') w, COUNT(*) c FROM `tabAppointment` a WHERE " + VIS + FARM_SQL + " AND a.creation BETWEEN %s AND %s GROUP BY w ORDER BY c DESC", tuple(FARM_P + [start, end]))
        for row in r:
            fr.append({"state": row[0], "count": row[1]})
        add_table("Approval States", [{"key": "state", "label": "Workflow State"}, {"key": "count", "label": "Count", "align": "right"}], fr)
        add_watch("Overstays (>8h inside)", "danger", overstay_rows(VIS))
        extra["farms"] = farm_options()

    elif tab == "contractors":
        k = appt_kpis(CON)
        companies = scalar("SELECT COUNT(DISTINCT COALESCE(a.custom_contractor_ref, a.customer_name)) FROM `tabAppointment` a WHERE " + CON + FARM_SQL + " AND a.custom_check_in_time BETWEEN %s AND %s", tuple(FARM_P + [start, end]))
        kpi("Visits", k[0], "checked in")
        kpi("On Site", k[2], "now")
        kpi("Avg Visit", (str(k[3]) + "m") if k[3] else "—", "duration")
        kpi("Companies", companies, "distinct")
        crows = []
        r = frappe.db.sql("SELECT COALESCE(a.custom_contractor_ref, a.customer_name, '—') n, COUNT(*) c FROM `tabAppointment` a WHERE " + CON + FARM_SQL + " AND a.custom_check_in_time BETWEEN %s AND %s GROUP BY n ORDER BY c DESC LIMIT 10", tuple(FARM_P + [start, end]))
        for row in r:
            crows.append({"company": row[0] or "—", "count": row[1]})
        add_table("By Contractor", [{"key": "company", "label": "Contractor"}, {"key": "count", "label": "Visits", "align": "right"}], crows)
        add_table("Top Hosts", [{"key": "host", "label": "Host"}, {"key": "count", "label": "Visits", "align": "right"}], host_rows(CON))
        add_watch("On-site overstays (>8h)", "warn", overstay_rows(CON))
        extra["farms"] = farm_options()

    elif tab == "staff":
        total = scalar("SELECT COUNT(*) FROM `tabAttendance` WHERE attendance_date BETWEEN %s AND %s AND docstatus < 2", (fromd, tod))
        present = scalar("SELECT COUNT(*) FROM `tabAttendance` WHERE attendance_date BETWEEN %s AND %s AND status = 'Present' AND docstatus < 2", (fromd, tod))
        distinct_emp = scalar("SELECT COUNT(DISTINCT employee) FROM `tabAttendance` WHERE attendance_date BETWEEN %s AND %s AND docstatus < 2", (fromd, tod))
        late = scalar("SELECT COUNT(*) FROM `tabAttendance` WHERE attendance_date BETWEEN %s AND %s AND in_time IS NOT NULL AND TIME(in_time) > '08:00:00' AND docstatus < 2", (fromd, tod))
        kpi("Check-ins", total, "in range")
        kpi("Present", present, "records")
        kpi("Staff", distinct_emp, "distinct")
        kpi("Late (>8am)", late, "arrivals")
        drows = []
        r = frappe.db.sql("SELECT COALESCE(NULLIF(department,''),'—') d, COUNT(*) c FROM `tabAttendance` WHERE attendance_date BETWEEN %s AND %s AND docstatus < 2 GROUP BY d ORDER BY c DESC LIMIT 12", (fromd, tod))
        for row in r:
            drows.append({"dept": row[0], "count": row[1]})
        add_table("By Department", [{"key": "dept", "label": "Department"}, {"key": "count", "label": "Records", "align": "right"}], drows)

    elif tab == "vehicles":
        GTS = "`tabTimesheet` ts JOIN `tabTractor Daily Task` tdt ON tdt.timesheet = ts.name"
        inside = scalar("SELECT COUNT(*) FROM " + GTS + " WHERE ts.docstatus = 0", ())
        entries = scalar("SELECT COUNT(*) FROM " + GTS + " WHERE ts.creation BETWEEN %s AND %s", (start, end))
        exited = scalar("SELECT COUNT(*) FROM " + GTS + " WHERE ts.docstatus = 1 AND ts.modified BETWEEN %s AND %s", (start, end))
        avgh = scalar("SELECT ROUND(AVG(td.hours),1) FROM `tabTimesheet Detail` td JOIN `tabTimesheet` ts ON ts.name = td.parent JOIN `tabTractor Daily Task` tdt ON tdt.timesheet = ts.name WHERE ts.docstatus = 1 AND ts.modified BETWEEN %s AND %s", (start, end))
        kpi("Inside", inside, "now")
        kpi("Entries", entries, "in range")
        kpi("Exited", exited, "in range")
        kpi("Avg Time", (str(avgh) + "h") if avgh else "—", "inside")
        frows = []
        r = frappe.db.sql("SELECT COALESCE(NULLIF(tdt.farm,''),'—') f, COUNT(*) c FROM " + GTS + " WHERE ts.creation BETWEEN %s AND %s GROUP BY f ORDER BY c DESC LIMIT 10", (start, end))
        for row in r:
            frows.append({"farm": row[0], "count": row[1]})
        add_table("By Farm", [{"key": "farm", "label": "Farm"}, {"key": "count", "label": "Entries", "align": "right"}], frows)
        vrows = []
        r = frappe.db.sql("SELECT COALESCE(NULLIF(tdt.motor_vehicle,''),'—') v, COUNT(*) c FROM " + GTS + " WHERE ts.creation BETWEEN %s AND %s GROUP BY v ORDER BY c DESC LIMIT 10", (start, end))
        for row in r:
            vrows.append({"vehicle": row[0], "count": row[1]})
        add_table("By Vehicle", [{"key": "vehicle", "label": "Vehicle"}, {"key": "count", "label": "Entries", "align": "right"}], vrows)
        wrows = []
        r = frappe.db.sql("SELECT tdt.motor_vehicle, tdt.name, td.from_time FROM `tabTimesheet` ts JOIN `tabTractor Daily Task` tdt ON tdt.timesheet = ts.name JOIN `tabTimesheet Detail` td ON td.parent = ts.name WHERE ts.docstatus = 0 AND td.from_time < %s ORDER BY td.from_time ASC LIMIT 25", (frappe.utils.add_to_date(now, hours=-12),))
        for row in r:
            wrows.append({"label": str(row[0] or row[1]), "detail": "in since " + str(row[2])})
        add_watch("Vehicles inside >12h", "danger", wrows)

    elif tab == "incidents":
        total = scalar("SELECT COUNT(*) FROM `tabIncident Report` WHERE incident_datetime BETWEEN %s AND %s" + LOC_SQL, tuple([start, end] + LOC_P))
        openc = scalar("SELECT COUNT(*) FROM `tabIncident Report` WHERE incident_datetime BETWEEN %s AND %s AND status = 'Open'" + LOC_SQL, tuple([start, end] + LOC_P))
        crit = scalar("SELECT COUNT(*) FROM `tabIncident Report` WHERE incident_datetime BETWEEN %s AND %s AND severity IN ('High','Critical')" + LOC_SQL, tuple([start, end] + LOC_P))
        kpi("Incidents", total, "in range")
        kpi("Open", openc, "unresolved")
        kpi("High/Critical", crit, "severity")
        sev = []
        r = frappe.db.sql("SELECT COALESCE(NULLIF(severity,''),'—') sv, COUNT(*) c FROM `tabIncident Report` WHERE incident_datetime BETWEEN %s AND %s" + LOC_SQL + " GROUP BY sv ORDER BY c DESC", tuple([start, end] + LOC_P))
        for row in r:
            sev.append({"sev": row[0], "count": row[1]})
        add_table("By Severity", [{"key": "sev", "label": "Severity"}, {"key": "count", "label": "Count", "align": "right"}], sev)
        cat = []
        r = frappe.db.sql("SELECT COALESCE(NULLIF(nature_of_incident,''),'—') n, COUNT(*) c FROM `tabIncident Report` WHERE incident_datetime BETWEEN %s AND %s" + LOC_SQL + " GROUP BY n ORDER BY c DESC LIMIT 10", tuple([start, end] + LOC_P))
        for row in r:
            cat.append({"cat": row[0], "count": row[1]})
        add_table("By Category", [{"key": "cat", "label": "Nature"}, {"key": "count", "label": "Count", "align": "right"}], cat)
        wrows = []
        r = frappe.db.sql("SELECT nature_of_incident, location, severity, incident_datetime FROM `tabIncident Report` WHERE status = 'Open' AND severity IN ('High','Critical')" + LOC_SQL + " ORDER BY incident_datetime DESC LIMIT 25", tuple(LOC_P))
        for row in r:
            wrows.append({"label": str(row[2]) + " · " + str(row[0] or "—"), "detail": str(row[1] or "") + " " + str(row[3])})
        add_watch("Open High/Critical", "danger", wrows)

        def people(nm, pf):
            out = []
            pr = frappe.db.sql("SELECT person_name, person_type, id_number, contact, notes FROM `tabIncident Person` WHERE parent = %s AND parentfield = %s ORDER BY idx", (nm, pf))
            for p in pr:
                out.append({"name": p[0] or "—", "type": p[1] or "", "id_number": p[2] or "", "contact": p[3] or "", "notes": p[4] or ""})
            return out

        details = []
        r = frappe.db.sql("SELECT name, incident_datetime, severity, status, nature_of_incident, location, reporter_name, description, remarks, corrective_actions, resolution, resolution_datetime, assigned_to, attachment_1, attachment_2, attachment_3, attachment_4 FROM `tabIncident Report` WHERE incident_datetime BETWEEN %s AND %s" + LOC_SQL + " ORDER BY incident_datetime DESC LIMIT 40", tuple([start, end] + LOC_P))
        for row in r:
            nm = row[0]
            atts = []
            for a in [row[13], row[14], row[15], row[16]]:
                if a:
                    atts.append(a)
            details.append({
                "name": nm,
                "datetime": str(row[1] or ""),
                "severity": row[2] or "",
                "status": row[3] or "",
                "nature": row[4] or "",
                "location": row[5] or "",
                "reporter": row[6] or "",
                "description": row[7] or "",
                "remarks": row[8] or "",
                "corrective_actions": row[9] or "",
                "resolution": row[10] or "",
                "resolution_datetime": str(row[11] or ""),
                "assigned_to": row[12] or "",
                "attachments": atts,
                "witnesses": people(nm, "witnesses"),
                "victims": people(nm, "victims"),
                "responsible": people(nm, "responsible_persons"),
            })
        extra["details"] = details
        ll = []
        lr = frappe.db.sql("SELECT DISTINCT location FROM `tabIncident Report` WHERE location IS NOT NULL AND location != '' ORDER BY location LIMIT 200", ())
        for row in lr:
            ll.append(row[0])
        extra["locations"] = ll

    elif tab == "patrols":
        points = scalar("SELECT COUNT(*) FROM `tabPatrol GPS Log` WHERE captured_at BETWEEN %s AND %s", (start, end))
        routes = scalar("SELECT COUNT(DISTINCT patrol) FROM `tabPatrol GPS Log` WHERE captured_at BETWEEN %s AND %s", (start, end))
        guards = scalar("SELECT COUNT(DISTINCT COALESCE(internal_guard, external_guard)) FROM `tabPatrol GPS Log` WHERE captured_at BETWEEN %s AND %s AND COALESCE(internal_guard, external_guard) IS NOT NULL AND COALESCE(internal_guard, external_guard) != ''", (start, end))
        dist = scalar("SELECT ROUND(SUM(6371 * ACOS(LEAST(1, GREATEST(-1, COS(RADIANS(plat)) * COS(RADIANS(lat)) * COS(RADIANS(lng) - RADIANS(plng)) + SIN(RADIANS(plat)) * SIN(RADIANS(lat)))))), 1) FROM (SELECT CAST(latitude AS DECIMAL(12,7)) lat, CAST(longitude AS DECIMAL(12,7)) lng, LAG(CAST(latitude AS DECIMAL(12,7))) OVER (PARTITION BY patrol ORDER BY captured_at) plat, LAG(CAST(longitude AS DECIMAL(12,7))) OVER (PARTITION BY patrol ORDER BY captured_at) plng FROM `tabPatrol GPS Log` WHERE captured_at BETWEEN %s AND %s AND latitude != '' AND longitude != '') t WHERE plat IS NOT NULL AND ABS(lat - plat) < 0.5 AND ABS(lng - plng) < 0.5", (start, end))
        kpi("GPS Points", points, "logged")
        kpi("Distance", (str(dist) + " km") if dist else "—", "patrolled")
        kpi("Guards", guards, "patrolling")
        kpi("Routes", routes, "distinct")
        prows = []
        r = frappe.db.sql("SELECT COALESCE(NULLIF(COALESCE(internal_guard, external_guard),''),'—') g, COUNT(*) c, COUNT(DISTINCT patrol) rt, MAX(captured_at) m FROM `tabPatrol GPS Log` WHERE captured_at BETWEEN %s AND %s GROUP BY g ORDER BY c DESC LIMIT 15", (start, end))
        for row in r:
            prows.append({"guard": row[0], "count": row[1], "routes": row[2], "last": str(row[3])})
        add_table("By Guard", [{"key": "guard", "label": "Guard"}, {"key": "count", "label": "Points", "align": "right"}, {"key": "routes", "label": "Routes", "align": "right"}, {"key": "last", "label": "Last Seen"}], prows)
        pts = []
        r = frappe.db.sql("SELECT latitude, longitude, captured_at, COALESCE(internal_guard, external_guard), patrol FROM `tabPatrol GPS Log` WHERE captured_at BETWEEN %s AND %s AND latitude != '' AND longitude != '' ORDER BY captured_at DESC LIMIT 3000", (start, end))
        for row in r:
            pts.append({"lat": row[0], "lng": row[1], "at": str(row[2]), "guard": row[3] or "", "patrol": row[4] or ""})
        extra["points"] = pts

    else:
        vis_inside = scalar("SELECT COUNT(*) FROM `tabAppointment` a WHERE a.custom_check_in_time IS NOT NULL AND a.custom_check_out_time IS NULL", ())
        veh_inside = scalar("SELECT COUNT(*) FROM `tabTractor Daily Task` tdt JOIN `tabTimesheet` ts ON tdt.timesheet = ts.name WHERE ts.docstatus = 0", ())
        entries = scalar("SELECT COUNT(*) FROM `tabAppointment` a WHERE a.custom_check_in_time BETWEEN %s AND %s", (start, end))
        open_inc = scalar("SELECT COUNT(*) FROM `tabIncident Report` WHERE status = 'Open'", ())
        patrol_today = scalar("SELECT COUNT(*) FROM `tabPatrol GPS Log` WHERE captured_at BETWEEN %s AND %s", (start, end))
        kpi("On Premises", vis_inside + veh_inside, "people + vehicles")
        kpi("Entries", entries, "in range")
        kpi("Open Incidents", open_inc, "all-time")
        kpi("Patrol Points", patrol_today, "in range")
        brk = []
        vcount = scalar("SELECT COUNT(*) FROM `tabAppointment` a WHERE " + VIS + " AND a.custom_check_in_time BETWEEN %s AND %s", (start, end))
        ccount = scalar("SELECT COUNT(*) FROM `tabAppointment` a WHERE " + CON + " AND a.custom_check_in_time BETWEEN %s AND %s", (start, end))
        vehcount = scalar("SELECT COUNT(*) FROM `tabTractor Daily Task` tdt JOIN `tabTimesheet` ts ON tdt.timesheet = ts.name WHERE ts.creation BETWEEN %s AND %s", (start, end))
        brk.append({"type": "Visitors", "count": vcount})
        brk.append({"type": "Contractors", "count": ccount})
        brk.append({"type": "Vehicles", "count": vehcount})
        add_table("Entries by Type", [{"key": "type", "label": "Type"}, {"key": "count", "label": "Entries", "align": "right"}], brk)

    msg = {"tab": tab, "from_date": fromd, "to_date": tod, "kpis": kpis, "tables": tables, "watch": watch}
    for kk in extra:
        msg[kk] = extra[kk]
    frappe.response["message"] = msg
except Exception as e:
    frappe.log_error("security_report", str(e))
    frappe.response["message"] = {"error": str(e)}
