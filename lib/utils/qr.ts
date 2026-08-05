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
