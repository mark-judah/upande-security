try:
    # Today's appointments that the gate guard should be aware of, in any
    # state EXCEPT the ones the dedicated Approved/Summary tabs already cover.
    # Approved by Host + Visitor Checked In   -> Approved tab
    # Visitor Checked Out                     -> Summary tab
    # Everything else (including rejections, reschedules, redirects)         -> here.
    states = (
        "Open",
        "Pending Secretary Review",
        "Pending Host Review",
        "Approved by Secretary",
        "Rescheduled by Secretary",
        "Rescheduled by Host",
        "Redirected to Another Host",
        "Rejected by Secretary",
        "Rejected by Host",
    )

    # Show anything touched in the last 7 days. Wider than "today" because
    # transient states (Pending, Rescheduled, Redirected) often span days,
    # and same for rejections the guard may not have seen yet.
    today = frappe.utils.nowdate()
    window_start = str(frappe.utils.add_days(today, -7)) + " 00:00:00"

    placeholders = ",".join(["%s"] * len(states))

    rows = frappe.db.sql(
        """
        SELECT a.name, a.customer_name, a.customer_phone_number,
               a.customer_details, a.scheduled_time, a.workflow_state,
               a.modified, a.custom_meet_with,
               e.employee_name AS host_name
        FROM `tabAppointment` a
        LEFT JOIN `tabEmployee` e ON e.name = a.custom_meet_with
        WHERE a.workflow_state IN (""" + placeholders + """)
          AND a.modified >= %s
        ORDER BY
          CASE a.workflow_state
            WHEN 'Pending Host Review'        THEN 1
            WHEN 'Pending Secretary Review'   THEN 2
            WHEN 'Approved by Secretary'      THEN 3
            WHEN 'Rescheduled by Host'        THEN 4
            WHEN 'Rescheduled by Secretary'   THEN 5
            WHEN 'Redirected to Another Host' THEN 6
            WHEN 'Open'                       THEN 7
            WHEN 'Rejected by Host'           THEN 8
            WHEN 'Rejected by Secretary'      THEN 9
            ELSE 99
          END,
          a.modified DESC
        LIMIT 200
        """,
        tuple(states) + (window_start,),
        as_dict=True,
    )

    # Map of state -> matching Comment content prefix the client-script writes.
    # We will pull the latest Comment per appointment whose content starts with
    # the prefix and strip the HTML out into structured fields.
    state_prefix = {
        "Rejected by Host":           "<b>Rejected by",
        "Rejected by Secretary":      "<b>Rejected by",
        "Rescheduled by Host":        "<b>Rescheduled by",
        "Rescheduled by Secretary":   "<b>Rescheduled by",
        "Redirected to Another Host": "<b>Redirected by",
    }

    def parse_comment(state, html_content):
        # Returns a dict (no tuple unpacking — safe-exec lacks
        # _unpack_sequence_). Caller accesses fields via bracket lookup.
        # Strips the HTML the client script emits, e.g.
        #   <b>Rejected by Alice:</b> No appointment today
        #   <b>Rescheduled by Bob:</b> Try tomorrow<br><b>New time:</b> 2026-05-23 10:00:00
        #   <b>Redirected by Carol:</b> Boss busy<br><b>From:</b> X <b>To:</b> Y
        out = {"actor": "", "reason": "", "extra_label": "", "extra_value": ""}
        if not html_content:
            return out
        c = str(html_content)
        # actor: after "by " up to ":"
        try:
            ix1 = c.index("by ") + 3
            ix2 = c.index(":</b>", ix1)
            out["actor"] = c[ix1:ix2].strip()
        except (ValueError, KeyError, TypeError):
            pass
        # reason: between ":</b> " and the next "<br>" (or end)
        try:
            ix3 = c.index(":</b>") + len(":</b>")
            rest = c[ix3:]
            br = rest.find("<br>")
            chunk = rest if br == -1 else rest[:br]
            chunk = chunk.strip()
            if chunk.startswith(" "):
                chunk = chunk[1:]
            out["reason"] = chunk
        except (ValueError, KeyError, TypeError):
            pass
        # extra: only on Rescheduled / Redirected
        if state == "Rescheduled by Host" or state == "Rescheduled by Secretary":
            try:
                ix = c.index("<b>New time:</b>") + len("<b>New time:</b>")
                out["extra_label"] = "New time"
                out["extra_value"] = c[ix:].strip()
            except (ValueError, KeyError, TypeError):
                pass
        elif state == "Redirected to Another Host":
            try:
                ix = c.index("<b>To:</b>") + len("<b>To:</b>")
                out["extra_label"] = "New host"
                out["extra_value"] = c[ix:].strip()
            except (ValueError, KeyError, TypeError):
                pass
        return out

    result = []
    for r in rows:
        try:
            nm = str(r["name"]) if r["name"] else ""
        except (KeyError, TypeError):
            nm = ""
        try:
            cust = str(r["customer_name"]) if r["customer_name"] else ""
        except (KeyError, TypeError):
            cust = ""
        try:
            phone = str(r["customer_phone_number"]) if r["customer_phone_number"] else ""
        except (KeyError, TypeError):
            phone = ""
        try:
            purpose = str(r["customer_details"]) if r["customer_details"] else ""
        except (KeyError, TypeError):
            purpose = ""
        try:
            sched = str(r["scheduled_time"]) if r["scheduled_time"] else ""
        except (KeyError, TypeError):
            sched = ""
        try:
            wf = str(r["workflow_state"]) if r["workflow_state"] else ""
        except (KeyError, TypeError):
            wf = ""
        try:
            mod = str(r["modified"]) if r["modified"] else ""
        except (KeyError, TypeError):
            mod = ""
        try:
            host_id = str(r["custom_meet_with"]) if r["custom_meet_with"] else ""
        except (KeyError, TypeError):
            host_id = ""
        try:
            hname = str(r["host_name"]) if r["host_name"] else host_id
        except (KeyError, TypeError):
            hname = host_id

        actor = ""
        reason = ""
        extra_label = ""
        extra_value = ""
        prefix = ""
        try:
            prefix = state_prefix[wf]
        except (KeyError, TypeError):
            prefix = ""
        if prefix and nm:
            c_rows = frappe.db.sql(
                """
                SELECT content
                FROM `tabComment`
                WHERE reference_doctype = 'Appointment'
                  AND reference_name = %s
                  AND comment_type = 'Comment'
                  AND content LIKE %s
                ORDER BY creation DESC
                LIMIT 1
                """,
                (nm, prefix + "%"),
                as_dict=True,
            )
            if c_rows:
                parsed = parse_comment(wf, c_rows[0].content)
                actor = parsed["actor"]
                reason = parsed["reason"]
                extra_label = parsed["extra_label"]
                extra_value = parsed["extra_value"]

        result.append({
            "name": nm,
            "customer_name": cust,
            "phone": phone,
            "purpose": purpose,
            "scheduled_time": sched,
            "workflow_state": wf,
            "modified": mod,
            "host_id": host_id,
            "host_name": hname,
            "actor": actor,
            "reason": reason,
            "extra_label": extra_label,
            "extra_value": extra_value,
        })

    frappe.response["message"] = result
except Exception as e:
    frappe.log_error("gate_activity", str(e))
    frappe.response["message"] = {"error": str(e)}
