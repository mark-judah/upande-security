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
