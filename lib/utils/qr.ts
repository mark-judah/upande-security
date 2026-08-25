export function extractTicketName(raw: string): string {
  const v = raw.trim();
  if (!v) return '';
  if (v.includes('/app/tractor-daily-task/')) {
    return decodeURIComponent(v.split('/app/tractor-daily-task/').pop()!);
  }
  if (v.includes('/')) {
    return decodeURIComponent(v.split('/').pop()!);
  }
  return v;
}

export function extractBadgeNumber(raw: string): string {
  const v = raw.trim();
  if (!v) return '';
  // Badge QR encodes .../visitor-received?badge=12 — a fixed, pre-printed
  // link, since the physical badge is never reprinted per visit.
  const match = v.match(/[?&]badge=([^&#]+)/);
  if (match && match[1]) {
    return decodeURIComponent(match[1]);
  }
  // Guard may also scan a plain number if the badge is ever printed bare.
  return v;
}

export function extractDispatchReference(raw: string): string {
  const v = raw.trim();
  if (!v) return '';
  // Gate Dispatch Verification is config-driven against whichever dispatch
  // doctype is configured server-side, so there's no single fixed URL
  // segment to match — just strip a Frappe doc URL down to its last path
  // segment (the document name) the same way the ticket scanner does.
  if (v.includes('/')) {
    return decodeURIComponent(v.split('/').pop()!);
  }
  return v;
}

export function extractReceivingReference(raw: string): string {
  const v = raw.trim();
  if (!v) return '';
  // A PO number or supplier name — same generic Frappe doc URL stripping
  // as extractDispatchReference, since there's no single fixed URL segment
  // to match against.
  if (v.includes('/')) {
    return decodeURIComponent(v.split('/').pop()!);
  }
  return v;
}

export function extractEmployeeId(raw: string): string {
  const v = raw.trim();
  if (!v) return '';
  // URL like .../app/print/Employee/10038 or .../app/employee/10038
  const match = v.match(/\/[Ee]mployee\/([^/?#]+)/);
  if (match && match[1]) {
    return decodeURIComponent(match[1]);
  }
  if (v.includes('/')) {
    return decodeURIComponent(v.split('/').pop()!);
  }
  return v;
}
